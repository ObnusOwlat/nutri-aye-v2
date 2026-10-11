/**
 * recipe-lines.js - The foods of the recipe being edited: quantity in grams or in
 * a household portion ("2 × 1 taza, picado (128 g)"). Only grams are saved;
 * portions come from the food's profile in the server.
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

    function lineHtml(line, idx) {
        const ing = State.getIngredient(line.ingredientId);
        if (!ing) return '<div class="ingredient-item ingredient-item--error">Alimento desconocido</div>';
        if (line.qty === undefined) { line.qty = line.grams; line.portion = -1; }

        const factor = line.grams / 100;
        const macro = (value) => UI.formatDecimal((value || 0) * factor, 1);
        const portions = portionsById.get(line.ingredientId) || [];
        const options = [`<option value="-1" ${line.portion < 0 ? 'selected' : ''}>g</option>`]
            .concat(portions.map((p, i) => `<option value="${i}" ${line.portion === i ? 'selected' : ''}>× ${UI.escapeHtml(p.label)} (${UI.formatNumber(p.gramWeight, 0)} g)</option>`));

        return `
            <div class="ingredient-item" data-index="${idx}">
                <div class="ingredient-item__main">
                    <span class="ingredient-item__name">${UI.escapeHtml(ing.name)}</span>
                    <input type="number" class="ingredient-item__grams" value="${UI.escapeHtml(line.qty)}" min="0" step="any"
                           data-qty-idx="${idx}" aria-label="Cantidad">
                    <select class="ingredient-item__unit" data-unit-idx="${idx}" aria-label="Unidad">${options.join('')}</select>
                    <span class="ingredient-item__kcal">${line.portion >= 0 ? `${UI.formatNumber(line.grams)} g · ` : ''}${UI.formatNumber(Math.round((ing.kcalPer100g || 0) * factor))} kcal</span>
                    <button class="ingredient-item__remove" data-remove-idx="${idx}" type="button" aria-label="Quitar">×</button>
                </div>
                <div class="ingredient-item__macros">
                    <span>P: ${macro(ing.proteinPer100g)}g</span>
                    <span>C: ${macro(ing.carbsPer100g)}g</span>
                    <span>G: ${macro(ing.fatPer100g)}g</span>
                </div>
            </div>`;
    }

    function render(lines) {
        if (!lines.length) return '<p class="empty-message">Todavía no hay alimentos. Buscalos y elegilos abajo.</p>';
        return lines.map(lineHtml).join('');
    }

    /**
     * Events of the list: typing updates the totals (onTotals); changing the unit
     * or removing a line redraws it (onRedraw)
     */
    function bind(container, lines, { onTotals, onRedraw }) {
        container.addEventListener('input', (e) => {
            const idx = e.target.dataset.qtyIdx;
            if (idx === undefined) return;
            const line = lines()[idx];
            setQuantity(line, e.target.value, line.portion);
            onTotals();
        });
        container.addEventListener('change', (e) => {
            const qtyIdx = e.target.dataset.qtyIdx, unitIdx = e.target.dataset.unitIdx;
            if (qtyIdx !== undefined) onRedraw();
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

    return { render, bind, loadPortions };
})();
