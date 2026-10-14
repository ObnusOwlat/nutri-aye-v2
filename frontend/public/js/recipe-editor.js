/**
 * recipe-editor.js - Create/edit a recipe in the Recetas tab, full width (no
 * modal): name, category, its foods as a table with live totals
 * (recipe-lines.js), preparation, and the food search at the right
 * (recipe-food-picker.js). Leaving with unsaved changes asks first.
 */

const RecipeEditor = (function() {
    const CATEGORIES = [
        { id: 'breakfast', name: 'Desayuno' },
        { id: 'lunch', name: 'Almuerzo' },
        { id: 'dinner', name: 'Cena' },
        { id: 'afternoon_snack', name: 'Merienda' },
        { id: 'snack', name: 'Colación' }
    ];

    let form = null;      // { recipeId, name, category, instructions, ingredients: [{ ingredientId, grams, qty?, portion? }] }
    let saved = '';       // what was loaded, to know if something changed
    let el = {};

    const snapshot = () => JSON.stringify({
        name: form.name.trim(), category: form.category, instructions: form.instructions.trim(),
        ingredients: form.ingredients.map(l => [l.ingredientId, l.grams])
    });
    const isDirty = () => form && snapshot() !== saved;

    function init() {
        el = {
            list: document.getElementById('recipes-list-view'),
            view: document.getElementById('recipe-editor-view'),
            title: document.getElementById('recipe-editor-title'),
            form: document.getElementById('recipe-editor-form'),
            picker: document.getElementById('recipe-food-picker'),
            save: document.getElementById('recipe-editor-save')
        };
        if (!el.view) return;
        document.getElementById('recipe-editor-back').addEventListener('click', leave);
        document.getElementById('recipe-editor-cancel').addEventListener('click', leave);
        el.save.addEventListener('click', save);

        // Name, category and preparation (the table has its own events)
        el.form.addEventListener('input', (e) => {
            if (e.target.id === 'recipe-name') form.name = e.target.value;
            if (e.target.id === 'recipe-instructions') form.instructions = e.target.value;
        });
        el.form.addEventListener('change', (e) => {
            if (e.target.id === 'recipe-category') form.category = e.target.value;
        });
    }

    function open(recipeId) {
        const recipe = recipeId ? State.getRecipe(recipeId) : null;
        form = {
            recipeId: recipe ? recipeId : null,
            name: recipe?.name || '',
            category: recipe?.category || 'breakfast',
            instructions: recipe?.instructions || '',
            ingredients: recipe ? recipe.ingredients.map(ri => ({ ingredientId: ri.ingredientId, grams: ri.grams })) : []
        };
        saved = snapshot();

        el.title.textContent = recipe ? 'Editar receta' : 'Crear receta';
        el.save.textContent = recipe ? 'Guardar cambios' : 'Crear receta';
        el.form.innerHTML = formHtml();
        const lines = document.getElementById('recipe-lines');
        RecipeLines.bind(lines, () => form.ingredients, { onChange: () => {}, onRedraw: redraw });
        RecipeLines.loadPortions(form.ingredients).then(redraw);
        RecipeFoodPicker.mount(el.picker, { add, inRecipe: () => new Set(form.ingredients.map(l => l.ingredientId)) });

        el.list.hidden = true;
        el.view.hidden = false;
        window.scrollTo(0, 0);
        if (!recipe) document.getElementById('recipe-name')?.focus();
    }

    function formHtml() {
        const options = CATEGORIES.map(c =>
            `<option value="${c.id}" ${form.category === c.id ? 'selected' : ''}>${c.name}</option>`).join('');
        return `
            <div class="recipe-editor__fields">
                <label class="form-group recipe-editor__name">
                    <span class="form-label">Nombre de la receta *</span>
                    <input type="text" id="recipe-name" class="form-input" value="${UI.escapeHtml(form.name)}" placeholder="Ej.: Ensalada de palta y huevo">
                </label>
                <label class="form-group">
                    <span class="form-label">Comida</span>
                    <select id="recipe-category" class="form-select">${options}</select>
                </label>
            </div>
            <div id="recipe-allergens"></div>
            <h3 class="recipe-editor__heading">Alimentos <span id="recipe-count" class="text-muted"></span></h3>
            <div id="recipe-lines" class="recipe-lines-wrap"></div>
            <label class="form-group recipe-editor__prep">
                <span class="form-label">Preparación</span>
                <textarea id="recipe-instructions" class="form-input" rows="5" placeholder="Pasos para prepararla (opcional)">${UI.escapeHtml(form.instructions)}</textarea>
            </label>`;
    }

    // Table, allergens, count and the "+ / ✓" of the search
    function redraw() {
        const lines = document.getElementById('recipe-lines');
        if (!lines) return;
        lines.innerHTML = RecipeLines.render(form.ingredients);
        document.getElementById('recipe-allergens').innerHTML = RecipeLines.allergenSummary(form.ingredients);
        document.getElementById('recipe-count').textContent = form.ingredients.length ? `(${form.ingredients.length})` : '';
        RecipeFoodPicker.refresh();
    }

    // A food picked at the right: 100 g, kept in this browser so the recipe can sum it
    function add(food) {
        if (!food || form.ingredients.some(l => l.ingredientId === food.id)) return;
        if (!State.getIngredient(food.id)) State.cacheIngredient(food);
        form.ingredients.push({ ingredientId: food.id, grams: 100 });
        redraw();
        RecipeLines.loadPortions(form.ingredients).then(redraw);
    }

    function close() {
        form = null;
        el.view.hidden = true;
        el.list.hidden = false;
        window.scrollTo(0, 0);
    }

    function leave() {
        if (!isDirty()) return close();
        UI.confirm('Hay cambios sin guardar. ¿Salir igual? Se pierden los cambios.', close);
    }

    async function save() {
        const name = form.name.trim();
        if (!name) {
            UI.toastError('El nombre de la receta es obligatorio');
            return document.getElementById('recipe-name')?.focus();
        }
        if (!form.ingredients.length) return UI.toastError('Agregá al menos un alimento');

        const data = {
            name,
            category: form.category,
            instructions: form.instructions.trim(),
            ingredients: form.ingredients.map(l => ({ ingredientId: l.ingredientId, grams: l.grams }))
        };
        el.save.disabled = true;
        try {
            if (form.recipeId) {
                await State.updateRecipe(form.recipeId, data);
                UI.toastSuccess('Receta actualizada');
            } else {
                await State.addRecipe(data);
                UI.toastSuccess('Receta creada');
            }
            close();
        } catch (e) {
            UI.toastError(e.message);
        } finally {
            el.save.disabled = false;
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    return { open, isOpen: () => !!form, CATEGORIES };
})();
