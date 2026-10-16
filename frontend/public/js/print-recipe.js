/**
 * print-recipe.js - A recipe for the patient: foods with grams, preparation and
 * what allergens it has. Nutrition only with "Mostrar calorías"; the recipe
 * notes only with "Incluir notas" (they may carry internal references). The
 * same block makes the recetario that goes after the weekly plan.
 */

const PrintRecipe = (function() {
    const esc = (v) => UI.escapeHtml(v ?? '');

    const grams = (g) => (g >= 1000 ? `${UI.formatDecimal(g / 1000, 2)} kg` : `${UI.formatNumber(Math.round(g))} g`);

    function allergenLabels(foods) {
        const labels = new Map();
        for (const food of foods) for (const a of food?.allergens || []) labels.set(a.allergen, a.label);
        return [...labels.values()].sort((a, b) => a.localeCompare(b, 'es'));
    }

    function nutritionLine(recipe) {
        const n = State.calculateRecipeNutrition(recipe);
        const g = (v) => `${UI.formatNumber(Math.round(v || 0))} g`;
        return `<p class="pdoc-recipe__nutrition"><strong>Aporte:</strong> ${UI.formatCalories(n.calories)} · Proteínas ${g(n.protein)}
            · Carbohidratos ${g(n.carbs)} · Grasas ${g(n.fat)} · Fibra ${g(n.fiber)}</p>`;
    }

    // One recipe; `heading` is the tag of its title (h2 alone, h3 inside the recetario)
    function block(recipe, opts, heading = 'h3') {
        const lines = recipe.ingredients || [];
        const foods = lines.map(ri => State.getIngredient(ri.ingredientId));
        const rows = lines.map((ri, i) => [esc(foods[i] ? Print.foodName(foods[i].name) : 'Alimento no disponible'), grams(ri.grams)]);
        const allergens = allergenLabels(foods);
        const instructions = String(recipe.instructions || '').trim();
        const notes = String(recipe.notes || '').trim();
        return `
            <article class="pdoc-recipe">
                <${heading} class="pdoc-recipe__name">${esc(Print.recipeName(recipe.name))}
                    <small>${esc(UI.label('mealCategory', recipe.category))}</small></${heading}>
                ${rows.length ? Print.table([{ label: 'Alimento' }, { label: 'Cantidad', num: true }], rows, 'pdoc-recipe__foods')
                    : '<p class="pdoc__muted">Sin alimentos cargados</p>'}
                ${instructions ? `<h4>Preparación</h4><p class="pdoc__note">${esc(instructions)}</p>` : ''}
                ${allergens.length ? `<p class="pdoc-recipe__allergens"><strong>Contiene:</strong> ${esc(allergens.join(', '))}</p>` : ''}
                ${opts.calories ? nutritionLine(recipe) : ''}
                ${opts.notes && notes ? `<h4>Notas</h4><p class="pdoc__note">${esc(notes)}</p>` : ''}
            </article>`;
    }

    // Every recipe of the week once, in the order they first appear
    function recetario(week, opts) {
        const ids = [];
        for (const day of State.DAYS) for (const type of State.VALID_MEAL_TYPES) {
            const id = week[day]?.[type];
            if (id && !ids.includes(id) && State.getRecipe(id)) ids.push(id);
        }
        if (!ids.length) return '';
        return `<section class="pdoc__section pdoc__section--break pdoc-recetario"><h2>Recetario</h2>
            ${ids.map(id => block(State.getRecipe(id), opts)).join('')}</section>`;
    }

    // Document for PrintDialog (Recetas tab)
    function doc(recipe) {
        return {
            id: 'recipe',
            label: 'Receta',
            options: ['calories', 'notes'],
            build: (opts) => ({
                title: Print.fileTitle(`Receta ${Print.recipeName(recipe.name)}`),
                html: Print.page({ title: 'Receta', body: `<section class="pdoc__section">${block(recipe, opts, 'h2')}</section>` })
            })
        };
    }

    function open(recipeId) {
        const recipe = State.getRecipe(recipeId);
        if (recipe) PrintDialog.open({ title: 'Imprimir receta', docs: [doc(recipe)] });
    }

    return { block, recetario, doc, open };
})();
