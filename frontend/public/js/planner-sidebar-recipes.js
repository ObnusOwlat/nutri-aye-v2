/**
 * planner-sidebar-recipes.js - "Recetas" tab of the planner's left column:
 * search, meal filter, "suggested for the patient" order with reasons and
 * warnings. Recipes are dragged onto a meal slot of the week, or tapped to
 * choose the day and meal.
 */

const PlannerSidebarRecipes = (function() {
    let panel, list, search, mealFilter, sortSelect;

    function init() {
        panel = document.querySelector('[data-sidebar-panel="recipes"]');
        if (!panel) return;
        list = panel.querySelector('#sidebar-recipe-list');
        search = panel.querySelector('#sidebar-recipe-search');
        mealFilter = panel.querySelector('#sidebar-recipe-meal');
        sortSelect = panel.querySelector('#sidebar-recipe-sort');

        fillMealFilter();
        [search, mealFilter, sortSelect].forEach(el => el.addEventListener('input', render));

        list.addEventListener('dragstart', (e) => {
            const card = e.target.closest('[data-recipe-id]');
            if (!card) return;
            e.dataTransfer.setData('text/x-recipe-id', card.dataset.recipeId);
            e.dataTransfer.effectAllowed = 'copy';
        });
        list.addEventListener('click', (e) => {
            const card = e.target.closest('[data-recipe-id]');
            if (card) chooseSlot(card.dataset.recipeId);
        });
        bindDropTargets();

        State.subscribe('recipes:updated', render);
        State.subscribe('state:ready', () => { fillMealFilter(); render(); });
        State.subscribe('plannerSuggestions:updated', render);
        render();
    }

    function fillMealFilter() {
        const current = mealFilter.value;
        mealFilter.innerHTML = '<option value="">Todas las comidas</option>' + Object.keys(State.labels?.mealCategory || {})
            .map(v => `<option value="${v}">${UI.escapeHtml(UI.label('mealCategory', v))}</option>`).join('');
        mealFilter.value = current;
    }

    // Drop on any meal slot of the grid (the grid is redrawn often: delegation)
    function bindDropTargets() {
        const grid = document.getElementById('week-grid');
        grid?.addEventListener('dragover', (e) => {
            const slot = e.target.closest('.meal-slot');
            if (!slot || !e.dataTransfer.types.includes('text/x-recipe-id')) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            grid.querySelectorAll('.meal-slot--drop').forEach(s => s !== slot && s.classList.remove('meal-slot--drop'));
            slot.classList.add('meal-slot--drop');
        });
        grid?.addEventListener('dragleave', (e) => e.target.closest('.meal-slot')?.classList.remove('meal-slot--drop'));
        grid?.addEventListener('drop', (e) => {
            const slot = e.target.closest('.meal-slot');
            const recipeId = e.dataTransfer.getData('text/x-recipe-id');
            if (!slot || !recipeId) return;
            e.preventDefault();
            slot.classList.remove('meal-slot--drop');
            place(recipeId, slot.dataset.day, slot.dataset.meal);
        });
    }

    function place(recipeId, day, meal) {
        const recipe = State.getRecipe(recipeId);
        if (!recipe || !State.assignMeal(day, meal, recipeId)) return;
        const warnings = PlannerSidebar.warningsFor(recipeId);
        const where = `${UI.label('day', day)}, ${UI.label('mealType', meal)}`;
        if (warnings.length) UI.toastWarning(`${recipe.name} en ${where}: ${warnings[0]}`);
        else UI.toastSuccess(`${recipe.name} en ${where}`);
    }

    // Tap on a recipe: pick the day and the meal
    function chooseSlot(recipeId) {
        const recipe = State.getRecipe(recipeId);
        if (!recipe) return;
        const options = (group, values, selected) => values
            .map(v => `<option value="${v}" ${v === selected ? 'selected' : ''}>${UI.escapeHtml(UI.label(group, v))}</option>`).join('');
        const suggestedMeal = State.VALID_MEAL_TYPES.includes(recipe.category) ? recipe.category : 'lunch';
        UI.openModal({
            title: `Agregar "${recipe.name}"`,
            content: `
                <div class="form-group"><label class="form-label" for="sidebar-pick-day">Día</label>
                    <select class="form-select" id="sidebar-pick-day">${options('day', State.DAYS, State.DAYS[0])}</select></div>
                <div class="form-group"><label class="form-label" for="sidebar-pick-meal">Comida</label>
                    <select class="form-select" id="sidebar-pick-meal">${options('mealType', State.VALID_MEAL_TYPES, suggestedMeal)}</select></div>`,
            confirmText: 'Agregar',
            cancelText: 'Cancelar',
            onConfirm: () => place(recipeId, document.getElementById('sidebar-pick-day').value, document.getElementById('sidebar-pick-meal').value)
        });
    }

    function visibleRecipes() {
        const plain = (t) => String(t || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
        const query = plain(search.value).split(/\s+/).filter(Boolean);
        const suggestions = PlannerSidebar.getSuggestions();
        const ranked = new Map((suggestions?.data || []).map((s, i) => [s.recipeId, { ...s, rank: i }]));

        let recipes = State.getRecipes()
            .filter(r => !mealFilter.value || r.category === mealFilter.value)
            .filter(r => query.every(w => plain(`${r.name} ${(r.ingredients || []).map(i => i.ingredientName).join(' ')}`).includes(w)))
            .map(r => ({ recipe: r, suggestion: ranked.get(r.id) || null }));

        if (sortSelect.value === 'suggested' && suggestions) {
            recipes.sort((a, b) => (a.suggestion?.rank ?? 1e9) - (b.suggestion?.rank ?? 1e9));
        } else if (sortSelect.value === 'kcal') {
            recipes.sort((a, b) => (a.recipe.nutrition?.calories || 0) - (b.recipe.nutrition?.calories || 0));
        } else {
            recipes.sort((a, b) => a.recipe.name.localeCompare(b.recipe.name, 'es'));
        }
        return recipes;
    }

    function card({ recipe, suggestion }) {
        const n = recipe.nutrition || {};
        const excluded = suggestion?.excluded;
        const reasons = (suggestion?.reasons || []).slice(0, 2).map(t => `<li>✓ ${UI.escapeHtml(t)}</li>`).join('');
        const warnings = (suggestion?.warnings || []).slice(0, 2).map(t => `<li class="warn">⚠ ${UI.escapeHtml(t)}</li>`).join('');
        return `
            <div class="sidebar-recipe ${excluded ? 'sidebar-recipe--excluded' : ''}" draggable="true" data-recipe-id="${UI.escapeHtml(recipe.id)}"
                 title="Arrastrala a un hueco de la semana o tocala para elegir día y comida">
                <div class="sidebar-recipe__top">
                    <strong>${UI.escapeHtml(recipe.name)}</strong>
                    <span>${UI.formatCalories(n.calories)}</span>
                </div>
                <div class="sidebar-recipe__meta">${UI.escapeHtml(UI.label('mealCategory', recipe.category))} · P ${UI.formatNumber(n.protein)} g · C ${UI.formatNumber(n.carbs)} g · G ${UI.formatNumber(n.fat)} g</div>
                ${reasons || warnings ? `<ul class="sidebar-recipe__why">${warnings}${reasons}</ul>` : ''}
            </div>`;
    }

    function render() {
        if (!list) return;
        const patientId = PlannerSidebar.getPatientId();
        sortSelect.querySelector('[value="suggested"]').disabled = !patientId;
        if (!patientId && sortSelect.value === 'suggested') sortSelect.value = 'name';
        if (patientId && !sortSelect.dataset.touched) sortSelect.value = 'suggested';
        const recipes = visibleRecipes();
        list.innerHTML = recipes.length ? recipes.map(card).join('')
            : '<p class="sidebar-note">No hay recetas con ese filtro.</p>';
    }

    document.addEventListener('DOMContentLoaded', () => {
        init();
        document.getElementById('sidebar-recipe-sort')?.addEventListener('change', (e) => { e.target.dataset.touched = '1'; });
    });

    return { render };
})();
