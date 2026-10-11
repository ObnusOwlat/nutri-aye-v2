/**
 * planner-nutrients.js - Side panel of the planner: nutrients of the week being
 * edited (daily average) or of one day. The server gives each recipe's
 * nutrients (POST /api/nutrition/analyze); the sums are made here, so changing
 * the day needs no request. Clicking a day's header in the grid selects it.
 */

const PlannerNutrients = (function() {
    const AVERAGE = 'average';
    const DAY_NAMES = {
        monday: 'Lunes', tuesday: 'Martes', wednesday: 'Miércoles', thursday: 'Jueves',
        friday: 'Viernes', saturday: 'Sábado', sunday: 'Domingo'
    };
    const GROUP_NAMES = {
        proximates: 'Composición general', energy: 'Energía', carbohydrates: 'Carbohidratos',
        lipids: 'Grasas y ácidos grasos', amino_acids: 'Aminoácidos', vitamins: 'Vitaminas',
        minerals: 'Minerales', sterols: 'Esteroles', organic_acids: 'Ácidos orgánicos', other: 'Otros'
    };
    // Key nutrients are shown in three blocks
    const keyBlock = (n) => (n.group === 'vitamins' ? 'Vitaminas' : n.group === 'minerals' ? 'Minerales' : 'Energía y macronutrientes');

    let panel, select, body;
    let selected = AVERAGE;
    let nutrients = [];               // [{ id, name, unit, group, key }]
    const perRecipe = new Map();      // recipeId -> { nutrientId: amount }
    let requestId = 0;

    function init() {
        panel = document.getElementById('planner-nutrients');
        if (!panel) return;
        select = panel.querySelector('#planner-nutrients-day');
        body = panel.querySelector('#planner-nutrients-body');

        select.innerHTML = `<option value="${AVERAGE}">Promedio diario de la semana</option>` +
            State.DAYS.map(d => `<option value="${d}">${DAY_NAMES[d]}</option>`).join('');
        select.addEventListener('change', () => selectDay(select.value));

        // Clicking a day's header in the grid shows that day (again: back to the average)
        document.getElementById('week-grid')?.addEventListener('click', (e) => {
            const header = e.target.closest('.day-card__header');
            if (!header) return;
            const day = header.closest('.day-card')?.dataset.day;
            selectDay(day === selected ? AVERAGE : day);
        });

        State.subscribe('weekPlan:updated', refresh);
        State.subscribe('recipes:updated', () => { perRecipe.clear(); refresh(); });
        if (State.isReady()) refresh();
    }

    function selectDay(day) {
        selected = day && (day === AVERAGE || State.DAYS.includes(day)) ? day : AVERAGE;
        select.value = selected;
        render();
    }

    // Recipe ids per day of the week being edited
    function weekRecipes() {
        const week = State.getWeekPlan();
        return Object.fromEntries(State.DAYS.map(d => [d, Object.values(week[d] || {}).filter(Boolean)]));
    }

    // Asks the server only for recipes not seen yet, then draws
    async function refresh() {
        const missing = [...new Set(Object.values(weekRecipes()).flat())].filter(id => !perRecipe.has(id));
        if (!missing.length) return render();

        const current = ++requestId;
        if (!nutrients.length) body.innerHTML = '<p class="nutrients-panel__note">Calculando…</p>';
        try {
            const data = await State._api('POST', '/api/nutrition/analyze', { recipeIds: missing.slice(0, 100) });
            if (current !== requestId) return;
            mergeNutrients(data.nutrients);
            for (const id of missing) perRecipe.set(id, data.recipes[id] || {});
            render();
        } catch (error) {
            if (current !== requestId) return;
            body.innerHTML = `<p class="nutrients-panel__note">No se pudieron calcular los nutrientes: ${UI.escapeHtml(error.message)}</p>`;
        }
    }

    // One list in arrival order (the server sends key nutrients first)
    function mergeNutrients(list) {
        const known = new Set(nutrients.map(n => n.id));
        nutrients = [...nutrients, ...list.filter(n => !known.has(n.id))];
    }

    // { nutrientId: amount } for a list of recipes (null when no recipe has data)
    function sum(recipeIds) {
        const totals = {};
        for (const id of recipeIds) {
            for (const [nutrientId, amount] of Object.entries(perRecipe.get(id) || {})) {
                if (amount == null) continue;
                totals[nutrientId] = (totals[nutrientId] || 0) + amount;
            }
        }
        return totals;
    }

    // Selected day, or the average of the days that have at least one meal
    function totalsForSelection() {
        const byDay = weekRecipes();
        if (selected !== AVERAGE) return { totals: sum(byDay[selected]), days: byDay[selected].length ? 1 : 0 };
        const days = State.DAYS.filter(d => byDay[d].length);
        const totals = sum(days.flatMap(d => byDay[d]));
        for (const id of Object.keys(totals)) totals[id] /= days.length;
        return { totals, days: days.length };
    }

    function formatAmount(amount) {
        if (amount == null) return '—';
        const digits = amount >= 100 ? 0 : amount >= 10 ? 1 : 2;
        return amount.toLocaleString('es-PY', { maximumFractionDigits: digits });
    }

    const row = (n, totals) => `
        <div class="nutrients-panel__row">
            <span class="nutrients-panel__name" title="${UI.escapeHtml(n.nameEn || '')}">${UI.escapeHtml(n.name)}</span>
            <span class="nutrients-panel__amount">${formatAmount(totals[n.id])} <small>${UI.escapeHtml(n.unit)}</small></span>
        </div>`;

    function render() {
        if (!body) return;
        const { totals, days } = totalsForSelection();
        if (!days) {
            body.innerHTML = `<p class="nutrients-panel__note">${selected === AVERAGE
                ? 'Agregá comidas a la semana para ver sus nutrientes.'
                : `${DAY_NAMES[selected]} no tiene comidas.`}</p>`;
            return;
        }

        const note = selected === AVERAGE
            ? `Promedio de ${days} día${days === 1 ? '' : 's'} con comidas.`
            : `Total de ${DAY_NAMES[selected]}.`;

        const blocks = { 'Energía y macronutrientes': [], Vitaminas: [], Minerales: [] };
        for (const n of nutrients.filter(n => n.key)) blocks[keyBlock(n)].push(n);
        const keyHtml = Object.entries(blocks).filter(([, list]) => list.length).map(([title, list]) => `
            <h4 class="nutrients-panel__block">${title}</h4>
            ${list.map(n => row(n, totals)).join('')}`).join('');

        const groups = {};
        for (const n of nutrients.filter(n => !n.key && totals[n.id] != null)) (groups[n.group] = groups[n.group] || []).push(n);
        const restHtml = Object.entries(groups).map(([group, list]) => `
            <details class="nutrients-panel__group">
                <summary>${GROUP_NAMES[group] || group} <span>(${list.length})</span></summary>
                ${list.map(n => row(n, totals)).join('')}
            </details>`).join('');

        body.innerHTML = `
            <p class="nutrients-panel__note">${note}</p>
            ${keyHtml}
            ${restHtml ? `<h4 class="nutrients-panel__block">Ver todos</h4>${restHtml}` : ''}
            <p class="nutrients-panel__note nutrients-panel__note--small">Datos USDA por receta. Sin comparación con la recomendación diaria todavía.</p>`;

        document.querySelectorAll('#week-grid .day-card').forEach(card =>
            card.classList.toggle('day-card--nutrients-selected', card.dataset.day === selected));
    }

    return { init, selectDay };
})();

// After planner.js: the grid is redrawn first, then the selected day is marked
document.addEventListener('DOMContentLoaded', () => PlannerNutrients.init());
