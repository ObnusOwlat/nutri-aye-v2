/**
 * print-shopping.js - "Lista de compras" of a week: every food of its recipes,
 * the grams added up for the whole week, grouped as in a market (Vaca, Hojas
 * verdes, Quesos… in the order of the subgroups; the category when a food has
 * none), with a box to tick. Alone or after the weekly plan.
 */

const PrintShopping = (function() {
    const esc = (v) => UI.escapeHtml(v ?? '');

    const amount = (g) => (g >= 1000 ? `${UI.formatDecimal(g / 1000, 1)} kg` : `${UI.formatNumber(Math.round(g))} g`);

    // ingredientId -> grams, over every meal of the week
    function totals(week) {
        const grams = new Map();
        for (const day of State.DAYS) for (const type of State.VALID_MEAL_TYPES) {
            const recipe = week?.[day]?.[type] && State.getRecipe(week[day][type]);
            for (const ri of recipe?.ingredients || []) grams.set(ri.ingredientId, (grams.get(ri.ingredientId) || 0) + (Number(ri.grams) || 0));
        }
        return grams;
    }

    // [{ name, items: [{ name, grams }] }] in market order, "Otros" last
    function groups(week) {
        const order = Object.keys(State.labels?.foodSubgroup || {});
        const byGroup = new Map();
        for (const [id, grams] of totals(week)) {
            const food = State.getIngredient(id);
            const key = food?.subgroup && food.subgroup !== 'other' ? `s:${food.subgroup}` : `c:${food?.category || 'other'}`;
            if (!byGroup.has(key)) byGroup.set(key, []);
            byGroup.get(key).push({ name: food ? Print.foodName(food.name) : 'Alimento no disponible', grams });
        }
        const rank = (key) => (key.startsWith('s:') ? order.indexOf(key.slice(2)) : order.length + 1);
        const label = (key) => (key.startsWith('s:') ? UI.label('foodSubgroup', key.slice(2))
            : key === 'c:other' ? 'Otros' : UI.label('ingredientCategory', key.slice(2)));
        return [...byGroup].sort((a, b) => rank(a[0]) - rank(b[0]))
            .map(([key, items]) => ({ name: label(key), items: items.sort((a, b) => a.name.localeCompare(b.name, 'es')) }));
    }

    function list(week) {
        return `<div class="pdoc-shopping">${groups(week).map(g => `
            <div class="pdoc-shopping__group">
                <h3>${esc(g.name)}</h3>
                <ul>${g.items.map(i => `<li><span class="pdoc-shopping__box" aria-hidden="true"></span>
                    <span class="pdoc-shopping__name">${esc(i.name)}</span><span class="pdoc-shopping__qty">${amount(i.grams)}</span></li>`).join('')}</ul>
            </div>`).join('')}</div>`;
    }

    const NOTE = '<p class="pdoc__muted pdoc-shopping__note">Cantidades para toda la semana, en crudo o como figura en cada receta.</p>';

    // After the weekly plan
    const section = (week) => `<section class="pdoc__section pdoc__section--break"><h2>Lista de compras</h2>${NOTE}${list(week)}</section>`;

    // Document for PrintDialog
    function doc({ week, patient }) {
        return {
            id: 'shopping',
            label: 'Lista de compras',
            options: [],
            build: () => {
                if (!PrintPlan.hasMeals(week)) throw new Error(patient ? 'La semana del paciente no tiene comidas guardadas' : 'La semana no tiene comidas');
                return {
                    title: Print.fileTitle('Lista de compras', patient),
                    html: Print.page({ title: 'Lista de compras', subtitle: 'Para la semana del plan alimentario', patient,
                        body: `<section class="pdoc__section">${NOTE}${list(week)}</section>` })
                };
            }
        };
    }

    return { doc, section, groups };
})();
