/**
 * recipe-editor.js - Create/edit recipe modal: name, category, foods with grams
 * and live nutrition totals
 */

const RecipeEditor = (function() {
    // Modal form state
    let formState = {
        recipeId: null,
        name: '',
        category: 'breakfast',
        ingredients: [],        // Array of { ingredientId, grams }
        isEdit: false
    };

    // Cache for ingredients (refreshed on modal open)
    let ingredientsCache = [];

    // Category options
    const CATEGORIES = [
        { id: 'breakfast', name: 'Desayuno' },
        { id: 'lunch', name: 'Almuerzo' },
        { id: 'dinner', name: 'Cena' },
        { id: 'afternoon_snack', name: 'Merienda' },
        { id: 'snack', name: 'Colación' }
    ];

    async function open(recipeId) {

        // First foods for the empty search
        try {
            const response = await fetch('/api/ingredients?limit=100');
            if (!response.ok) throw new Error('API error: ' + response.status);
            ingredientsCache = (await response.json()).data || [];
        } catch (e) {
            console.error('[Recipes] Failed to load ingredients:', e);
            UI.toastWarning('No se pudieron cargar los alimentos: ' + e.message);
            return;
        }

        if (ingredientsCache.length === 0) {
            UI.toastWarning('Primero agregá alimentos en la pestaña Alimentos');
            return;
        }

        // Initialize form state
        const recipe = recipeId ? State.getRecipe(recipeId) : null;

        formState = {
            recipeId: recipeId,
            name: recipe?.name || '',
            category: recipe?.category || 'breakfast',
            ingredients: recipe ? recipe.ingredients.map(ri => ({ ingredientId: ri.ingredientId, grams: ri.grams })) : [],
            isEdit: !!recipe
        };

        UI.openModal({
            title: formState.isEdit ? 'Editar receta' : 'Crear receta',
            content: buildFormContent(),
            confirmText: formState.isEdit ? 'Guardar cambios' : 'Crear receta',
            size: 'large',
            onConfirm: handleSave,
            onOpen: bindFormEvents
        });
    }

    function buildFormContent() {
        // Render ingredient list
        const ingredientListHtml = RecipeLines.render(formState.ingredients);

        // Render category options
        const categoryOptionsHtml = CATEGORIES.map(cat => 
            `<option value="${UI.escapeHtml(cat.id)}" ${formState.category === cat.id ? 'selected' : ''}>${cat.name}</option>`
        ).join('');

        return `
            <div class="recipe-form">
                <!-- Recipe Name -->
                <div class="form-group">
                    <label class="form-label">Nombre de la receta *</label>
                    <input type="text" id="recipe-name" class="form-input" 
                           value="${UI.escapeHtml(formState.name)}" 
                           placeholder="e.g., Chicken Salad">
                </div>

                <!-- Category -->
                <div class="form-group">
                    <label class="form-label">Categoría</label>
                    <select id="recipe-category" class="form-select">
                        ${categoryOptionsHtml}
                    </select>
                </div>

                <!-- Ingredients Section -->
                <div class="form-group">
                    <label class="form-label">Alimentos (${formState.ingredients.length})</label>

                    <!-- Current ingredients list -->
                    <div id="recipe-ingredient-list" class="recipe-ingredient-list">
                        ${ingredientListHtml}
                    </div>

                    <!-- Search input -->
                    <div class="ingredient-search-section">
                        <label class="ingredient-search-label">🔍 Buscá y agregá alimentos:</label>
                        <div class="recipe-food-filters">
                            <select id="recipe-food-category" class="form-select" aria-label="Grupo">
                                <option value="">Todos los grupos</option>
                                ${Object.entries(State.labels?.ingredientCategory || {}).map(([v, t]) => `<option value="${v}">${UI.escapeHtml(t)}</option>`).join('')}
                            </select>
                            <select id="recipe-food-subgroup" class="form-select" aria-label="Origen" disabled>
                                <option value="">Todo origen</option>
                            </select>
                            <label class="recipe-food-filters__py" title="Alimentos de otros países. La misma opción que en Alimentos."><input type="checkbox" id="recipe-food-py" ${FoodPrefs.hideImported() ? 'checked' : ''}> Ocultar importados</label>
                        </div>
                        <div class="ingredient-combobox">
                            <input type="text" id="recipe-ingredient-search" class="form-input" 
                                   placeholder="Escribí para buscar..."
                                   autocomplete="off">
                            <div id="ingredient-dropdown" class="ingredient-dropdown"></div>
                        </div>
                    </div>
                </div>

                <!-- Nutrition Summary -->
                <div class="nutrition-summary">
                    <div class="nutrition-summary__title">Información nutricional (total)</div>
                    <div class="nutrition-summary__values">
                        ${nutritionValuesHtml()}
                    </div>
                </div>
            </div>
        `;
    }

    function calculateFormNutrition() {
        const result = { calories: 0, protein: 0, carbs: 0, fat: 0 };

        for (const ri of formState.ingredients) {
            const ing = State.getIngredient(ri.ingredientId);
            if (!ing) continue;

            const factor = ri.grams / 100;
            result.calories += ing.kcalPer100g * factor;
            result.protein += (ing.proteinPer100g || 0) * factor;
            result.carbs += (ing.carbsPer100g || 0) * factor;
            result.fat += (ing.fatPer100g || 0) * factor;
        }

        return result;
    }

    function bindFormEvents() {
        // Keep anything typed before the modal finished opening
        const nameInput = document.getElementById('recipe-name');
        if (nameInput) formState.name = nameInput.value;
        nameInput?.addEventListener('input', (e) => {
            formState.name = e.target.value;
        });

        // Category select
        document.getElementById('recipe-category')?.addEventListener('change', (e) => {
            formState.category = e.target.value;
        });

        RecipeIngredientSearch.attach(ingredientsCache, addIngredient);

        // Quantities in grams or household portions (recipe-lines.js)
        const list = document.getElementById('recipe-ingredient-list');
        if (list) RecipeLines.bind(list, () => formState.ingredients, { onTotals: refreshNutrition, onRedraw: refreshForm });
        RecipeLines.loadPortions(formState.ingredients).then(refreshForm);
    }

    /**
     * Adds the food picked in the search; server foods (USDA) are kept in this
     * browser so the recipe can sum them
     */
    function addIngredient(food) {
        if (!food) {
            UI.toastWarning('Elegí un alimento');
            return;
        }
        const ingredientId = food.id;

        // Check duplicate
        if (formState.ingredients.some(ri => ri.ingredientId === ingredientId)) {
            UI.toastWarning('Ese alimento ya está en la receta');
            return;
        }

        if (!State.getIngredient(ingredientId)) State.cacheIngredient(food);
        formState.ingredients.push({ ingredientId, grams: 100 });

        refreshForm();
        RecipeLines.loadPortions(formState.ingredients).then(refreshForm);
        UI.toastSuccess('Alimento agregado');
    }

    function refreshForm() {
        const ingredientList = document.getElementById('recipe-ingredient-list');
        const dropdown = document.getElementById('ingredient-dropdown');
        const searchInput = document.getElementById('recipe-ingredient-search');

        // Update ingredient list
        if (ingredientList) {
            ingredientList.innerHTML = RecipeLines.render(formState.ingredients);
        }

        // Update dropdown with current search
        if (dropdown && searchInput) {
            RecipeIngredientSearch.refresh(searchInput.value);
        }

        // Update nutrition display
        refreshNutrition();
    }

    const nutritionValuesHtml = () => {
        const n = calculateFormNutrition();
        return `<span><strong>${Math.round(n.calories)}</strong> kcal</span>
            <span>P: <strong>${Math.round(n.protein)}g</strong></span>
            <span>C: <strong>${Math.round(n.carbs)}g</strong></span>
            <span>G: <strong>${Math.round(n.fat)}g</strong></span>`;
    };

    function refreshNutrition() {
        const summary = document.querySelector('.nutrition-summary__values');
        if (summary) summary.innerHTML = nutritionValuesHtml();
    }

    async function handleSave() {
        // Validate
        const name = formState.name.trim();

        if (!name) {
            UI.toastError('El nombre de la receta es obligatorio');
            return false; // Keep modal open
        }

        if (formState.ingredients.length === 0) {
            UI.toastError('Agregá al menos un alimento');
            return false;
        }

        // Prepare data
        const data = {
            name,
            category: formState.category,
            instructions: '',
            ingredients: formState.ingredients.map(ri => ({
                ingredientId: ri.ingredientId,
                grams: ri.grams
            }))
        };

        try {
            if (formState.recipeId) {
                await State.updateRecipe(formState.recipeId, data);
                UI.toastSuccess('Receta actualizada');
            } else {
                await State.addRecipe(data);
                UI.toastSuccess('Receta creada');
            }
            return true; // Close modal
        } catch (e) {
            UI.toastError(e.message);
            return false; // Keep modal open
        }
    }

    return { open, CATEGORIES };
})();
