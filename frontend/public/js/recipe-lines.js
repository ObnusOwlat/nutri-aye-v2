/**
 * recipe-lines.js - The foods of the recipe being edited, as table rows: quantity
 * in grams or in a household portion ("2 × 1 taza, picado (128 g)"), grams, kcal
 * and macros, plus a TOTAL row. Only grams are saved; portions come from the
 * food's profile in the server.
 */

const RecipeLines = (function() {
    const portionsById = new Map(); // ingredientId -> [{ label, gramWeight }]

    // Loads the portions of the given foods (once each); resolves when all are known
    function loadPortions(lines) {
        const missing = [...new Set(lines.map(l => l.ingredientId))].filter(id => !portionsById.has(id));
        return Promise.all(missing.map(id => State._api('GET', `/api/ingredients/${encodeURIComponent(id)}`)
            .then(food => portionsById.set(id, food.portions || []))
            .catch(() => portionsById.set(id, []))));
    }

    // Grams from the quantity and the chosen unit (-1 = grams)
    function setQuantity(line, qty, portion) {
        line.qty = Math.max(0, Number(qty) || 0);
        line.portion = Number(portion);
        const weight = portionsById.get(line.ingredientId)?.[line.portion]?.gramWeight;
        line.grams = Math.max(1, Math.round(line.portion >= 0 && weight ? line.qty * weight : line.qty));
    }

    // kcal and macros of one line, from its food per 100 g
    function nutrition(line) {
        const ing = State.getIngredient(line.ingredientId) || {};
        const f = line.grams / 100;
        return { kcal: (ing.kcalPer100g || 0) * f, p: (ing.proteinPer100g || 0) * f, c: (ing.carbsPer100g || 0) * f, g: (ing.fatPer100g || 0) * f };
    }

    function totals(lines) {
        return lines.reduce((t, line) => {
            const n = nutrition(line);
            return { grams: t.grams + line.grams, kcal: t.kcal + n.kcal, p: t.p + n.p, c: t.c + n.c, g: t.g + n.g };
        }, { grams: 0, kcal: 0, p: 0, c: 0, g: 0 });
    }

    const dec = (n) => UI.formatDecimal(n, 1);
    const numbersHtml = (grams, n) => `
        <td class="rl-num" data-cell="grams">${UI.formatNumber(Math.round(grams))}</td>
        <td class="rl-num rl-kcal" data-cell="kcal">${UI.formatNumber(Math.round(n.kcal))}</td>
        <td class="rl-num" data-cell="p">${dec(n.p)}</td>
        <td class="rl-num" data-cell="c">${dec(n.c)}</td>
        <td class="rl-num" data-cell="g">${dec(n.g)}</td>`;

    function lineHtml(line, idx) {
        const ing = State.getIngredient(line.ingredientId);
        if (!ing) return `<tr class="rl-row rl-row--error"><td colspan="9">Alimento desconocido</td></tr>`;
        if (line.qty === undefined) { line.qty = line.grams; line.portion = -1; }

        const portions = portionsById.get(line.ingredientId) || [];
        const options = [`<option value="-1" ${line.portion < 0 ? 'selected' : ''}>g</option>`]
            .concat(portions.map((p, i) => `<option value="${i}" ${line.portion === i ? 'selected' : ''}>× ${UI.escapeHtml(p.label)} (${UI.formatNumber(p.gramWeight, 0)} g)</option>`));
        const allergens = (ing.allergens || []).map(a =>
            `<span class="allergen-chip" title="Alérgeno (${a.source === 'manual' ? 'marcado a mano' : a.source === 'off' ? 'Open Food Facts' : 'reglas'})">${UI.escapeHtml(a.label)}</span>`).join('');

        return `
            <tr class="rl-row" data-index="${idx}">
                <td class="rl-name">${ing.availablePy ? '<span title="Se consigue en Paraguay">⭐</span> ' : ''}${UI.escapeHtml(ing.name)} ${allergens}</td>
                <td><input type="number" class="rl-qty" value="${UI.escapeHtml(line.qty)}" min="0" step="any" data-qty-idx="${idx}" aria-label="Cantidad"></td>
                <td><select class="rl-unit" data-unit-idx="${idx}" aria-label="Unidad">${options.join('')}</select></td>
                ${numbersHtml(line.grams, nutrition(line))}
                <td><button class="rl-remove" data-remove-idx="${idx}" type="button" aria-label="Quitar" title="Quitar">×</button></td>
            </tr>`;
    }

    // Allergens of the whole recipe (union of its foods)
    function allergenSummary(lines) {
        const found = new Map();
        for (const line of lines) {
            for (const a of State.getIngredient(line.ingredientId)?.allergens || []) found.set(a.allergen, a.label);
        }
        return found.size
            ? `<p class="recipe-allergens">⚠ Contiene: <strong>${[...found.values()].map(UI.escapeHtml).join(', ')}</strong>
                <small>(según el nombre de cada alimento; revisá las etiquetas)</small></p>`
            : '';
    }

    const totalHtml = (lines) => {
        const t = totals(lines);
        return `<td class="rl-name">TOTAL</td><td></td><td></td>${numbersHtml(t.grams, t)}<td></td>`;
    };

    // The whole table (head, one row per food, TOTAL)
    function render(lines) {
        if (!lines.length) return '<p class="empty-message">Todavía no hay alimentos. Buscalos a la derecha y tocá «+ Agregar».</p>';
        return `
            <table class="recipe-lines">
                <thead><tr>
                    <th>Alimento</th><th>Cantidad</th><th>Unidad</th>
                    <th class="rl-num">g</th><th class="rl-num">kcal</th><th class="rl-num">P</th><th class="rl-num">C</th><th class="rl-num">G</th><th></th>
                </tr></thead>
                <tbody>${lines.map(lineHtml).join('')}</tbody>
                <tfoot><tr class="rl-total">${totalHtml(lines)}</tr></tfoot>
            </table>`;
    }

    // Typing a quantity only updates the numbers of its row and the TOTAL (keeps the focus)
    function refreshNumbers(container, lines, idx) {
        const row = container.querySelector(`.rl-row[data-index="${idx}"]`);
        const line = lines[idx];
        if (row && line) {
            const n = nutrition(line);
            const cells = { grams: UI.formatNumber(line.grams), kcal: UI.formatNumber(Math.round(n.kcal)), p: dec(n.p), c: dec(n.c), g: dec(n.g) };
            for (const [key, text] of Object.entries(cells)) row.querySelector(`[data-cell="${key}"]`).textContent = text;
        }
        const total = container.querySelector('.rl-total');
        if (total) total.innerHTML = totalHtml(lines);
    }

    /**
     * Events of the table: typing updates the numbers (onChange); changing the unit
     * or removing a line redraws it (onRedraw)
     */
    function bind(container, lines, { onChange, onRedraw }) {
        container.addEventListener('input', (e) => {
            const idx = e.target.dataset.qtyIdx;
            if (idx === undefined) return;
            const line = lines()[idx];
            setQuantity(line, e.target.value, line.portion);
            refreshNumbers(container, lines(), idx);
            onChange();
        });
        container.addEventListener('change', (e) => {
            const unitIdx = e.target.dataset.unitIdx;
            if (unitIdx === undefined) return;
            const line = lines()[unitIdx];
            // Switching unit keeps the amount sensible: 1 portion, or the grams it was
            const toGrams = Number(e.target.value) < 0;
            setQuantity(line, toGrams ? line.grams : 1, e.target.value);
            onRedraw();
        });
        container.addEventListener('click', (e) => {
            const idx = e.target.dataset.removeIdx;
            if (idx === undefined) return;
            lines().splice(Number(idx), 1);
            onRedraw();
        });
    }

    return { render, bind, loadPortions, allergenSummary, totals };
})();
