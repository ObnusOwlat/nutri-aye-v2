/**
 * recipes.js - Recetario, laid out like the Alimentos tab: filters at the left
 * (meal and "sin alérgeno", with counts), search by recipe or food name, and one
 * row per recipe. The editor lives in recipe-editor.js (same tab, full width).
 */

const Recipes = (function() {
    const meals = new Set();      // chosen categories (none = all)
    const without = new Set();    // allergens the recipe must not have
    const allergenLabels = new Map(); // allergen code -> label, for the chips
    let query = '';
    let el = {};

    const plain = (text) => String(text || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const mealName = (id) => RecipeEditor.CATEGORIES.find(c => c.id === id)?.name || id;
    const foodsOf = (recipe) => (recipe.ingredients || []).map(ri => State.getIngredient(ri.ingredientId)).filter(Boolean);

    // allergen code -> label, of every food in the recipe
    function allergensOf(recipe) {
        const found = new Map();
        for (const food of foodsOf(recipe)) for (const a of food.allergens || []) found.set(a.allergen, a.label);
        return found;
    }

    function init() {
        el = {
            filters: document.getElementById('recipe-filters'),
            chips: document.getElementById('recipe-filter-chips'),
            list: document.getElementById('recipes-list'),
            count: document.getElementById('recipes-count')
        };
        if (!el.list) return;
        document.getElementById('btn-add-recipe')?.addEventListener('click', () => RecipeEditor.open(null));
        document.getElementById('recipe-search')?.addEventListener('input', (e) => { query = e.target.value.trim(); render(); });
        el.filters.addEventListener('change', (e) => {
            const box = e.target;
            const set = box.dataset.meal ? meals : box.dataset.without ? without : null;
            if (!set) return;
            const key = box.dataset.meal || box.dataset.without;
            box.checked ? set.add(key) : set.delete(key);
            render();
        });
        el.filters.addEventListener('click', (e) => {
            if (!e.target.closest('[data-clear]')) return;
            meals.clear(); without.clear(); render();
        });
        el.chips.addEventListener('click', (e) => {
            const chip = e.target.closest('[data-remove]');
            if (!chip) return;
            const [kind, key] = chip.dataset.remove.split(':');
            (kind === 'meal' ? meals : without).delete(key);
            render();
        });
        el.list.addEventListener('click', handleListClick);
        // Phone: the filters are folded behind a button
        document.getElementById('recipe-filters-toggle')?.addEventListener('click', (e) => {
            const open = document.getElementById('recipes-list-view').classList.toggle('recipes--filters-open');
            e.currentTarget.setAttribute('aria-expanded', open);
        });
        State.subscribe('recipes:updated', render);
        render();
    }

    function matchesSearch(recipe) {
        const words = plain(query).split(/\s+/).filter(Boolean);
        if (!words.length) return true;
        const text = plain([recipe.name, ...foodsOf(recipe).map(f => f.name)].join(' '));
        return words.every(w => text.includes(w));
    }

    const hasNone = (recipe) => { const a = allergensOf(recipe); return [...without].every(code => !a.has(code)); };

    function render() {
        if (!el.list) return;
        const searched = State.getRecipes().filter(matchesSearch);
        const shown = searched
            .filter(r => !meals.size || meals.has(r.category))
            .filter(hasNone)
            .sort((a, b) => a.name.localeCompare(b.name, 'es'));
        el.filters.innerHTML = filtersHtml(searched);
        el.chips.innerHTML = chipsHtml();
        el.list.innerHTML = shown.length ? `<ul class="food-list recipe-list">${shown.map(rowHtml).join('')}</ul>` : emptyHtml();
        el.count.innerHTML = shown.length ? `<span>${UI.plural(shown.length, 'receta')}</span>` : '';
    }

    function emptyHtml() {
        const text = State.getRecipes().length ? 'Ninguna receta coincide con la búsqueda o los filtros' : 'Todavía no hay recetas. Creá la primera con «+ Crear receta».';
        return `<div class="empty-state"><p class="empty-state__text">${UI.escapeHtml(text)}</p></div>`;
    }

    // Counts: meals over the searched recipes (with the allergen filter);
    // allergens over the searched recipes of the chosen meals
    function filtersHtml(searched) {
        const byMeal = searched.filter(hasNone);
        const inMeals = searched.filter(r => !meals.size || meals.has(r.category));
        const allergens = new Map(); // code -> { label, n }
        for (const r of inMeals) for (const [code, label] of allergensOf(r)) {
            allergenLabels.set(code, label);
            const entry = allergens.get(code) || allergens.set(code, { label, n: 0 }).get(code);
            entry.n++;
        }
        for (const code of without) if (!allergens.has(code)) allergens.set(code, { label: allergenLabels.get(code) || code, n: 0 });
        const row = (attr, key, label, n, checked) => `
            <li class="food-filters__row">
                <label><input type="checkbox" data-${attr}="${UI.escapeHtml(key)}" ${checked ? 'checked' : ''}> ${UI.escapeHtml(label)}</label>
                <span class="food-filters__n">${UI.formatNumber(n)}</span>
            </li>`;
        return `
            <div class="food-filters__head">
                <h4>Filtros</h4>
                ${meals.size || without.size ? '<button type="button" class="btn btn--secondary btn--sm" data-clear>Limpiar</button>' : ''}
            </div>
            <h5>Comida</h5>
            <ul class="food-filters__tree">${RecipeEditor.CATEGORIES.map(c =>
                row('meal', c.id, c.name, byMeal.filter(r => r.category === c.id).length, meals.has(c.id))).join('')}</ul>
            <h5>Sin alérgeno</h5>
            <ul class="food-filters__tree">${[...allergens].sort((a, b) => a[1].label.localeCompare(b[1].label, 'es')).map(([code, a]) =>
                row('without', code, `Sin ${a.label}`, a.n, without.has(code))).join('') || '<li class="text-muted">Ninguna receta tiene alérgenos</li>'}</ul>
            <p class="food-filters__note">Los alérgenos salen del nombre de cada alimento: revisá las etiquetas.</p>`;
    }

    function chipsHtml() {
        const chips = [...[...meals].map(m => [`meal:${m}`, mealName(m)]),
            ...[...without].map(code => [`without:${code}`, `Sin ${allergenLabels.get(code) || code}`])];
        return chips.map(([key, text]) => `<button type="button" class="food-filters__chip" data-remove="${UI.escapeHtml(key)}">${UI.escapeHtml(text)} ×</button>`).join('');
    }

    function rowHtml(recipe) {
        const n = recipe.nutrition || { calories: 0, protein: 0, carbs: 0, fat: 0 };
        const foods = foodsOf(recipe);
        const chips = [...allergensOf(recipe).values()].map(label => ` <span class="allergen-chip">${UI.escapeHtml(label)}</span>`).join('');
        const names = foods.slice(0, 4).map(f => f.name.split(',')[0]).join(', ') + (foods.length > 4 ? '…' : '');
        return `
            <li class="food-row recipe-row" data-id="${UI.escapeHtml(recipe.id)}">
                <button class="food-row__main recipe-row__main" type="button" data-action="edit" title="Abrir la receta">
                    <span class="category-badge category-badge--${UI.escapeHtml(recipe.category)}">${UI.escapeHtml(mealName(recipe.category))}</span>
                    <span class="recipe-row__name">
                        <span class="food-row__name">${UI.escapeHtml(recipe.name)}</span>${chips}
                        <small class="recipe-row__foods">${UI.plural((recipe.ingredients || []).length, 'alimento')}${names ? ` · ${UI.escapeHtml(names)}` : ''}</small>
                    </span>
                    <span class="food-row__kcal">${UI.formatNumber(Math.round(n.calories))} kcal</span>
                    <span class="food-row__macros">P ${Math.round(n.protein)} · C ${Math.round(n.carbs)} · G ${Math.round(n.fat)} g</span>
                </button>
                <span class="food-row__actions">
                    <button class="btn btn--secondary btn--sm" type="button" data-action="edit">Editar</button>
                    <button class="btn btn--danger btn--sm" type="button" data-action="deactivate">Desactivar</button>
                </span>
            </li>`;
    }

    function handleListClick(e) {
        const row = e.target.closest('.recipe-row');
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (!row || !action) return;
        const id = row.dataset.id;
        if (action === 'edit') RecipeEditor.open(id);
        if (action === 'deactivate') {
            UI.confirmDanger('¿Desactivar esta receta? Deja de aparecer en la lista; los planes que la usan no cambian.', async () => {
                await State.deleteRecipe(id);
                UI.toastSuccess('Receta desactivada');
            });
        }
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => Recipes.init());
