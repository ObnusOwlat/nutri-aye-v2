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
        { id: 'breakfast', name: 'Breakfast' },
        { id: 'lunch', name: 'Lunch' },
        { id: 'dinner', name: 'Dinner' },
        { id: 'afternoon_snack', name: 'Afternoon Snack' },
        { id: 'snack', name: 'Snack' }
    ];

    async function open(recipeId) {

        // First foods for the empty search
        try {
            const response = await fetch('/api/ingredients?limit=100');
            if (!response.ok) throw new Error('API error: ' + response.status);
            ingredientsCache = (await response.json()).data || [];
        } catch (e) {
            console.error('[Recipes] Failed to load ingredients:', e);
            UI.toastWarning('Failed to load ingredients: ' + e.message);
            return;
        }

        if (ingredientsCache.length === 0) {
            UI.toastWarning('Add ingredients first in the Ingredients tab');
            return;
        }

        // Initialize form state
        const recipe = recipeId ? State.getRecipe(recipeId) : null;

        formState = {
            recipeId: recipeId,
            name: recipe?.name || '',
            category: recipe?.category || 'breakfast',
            ingredients: recipe ? [...recipe.ingredients] : [],
            isEdit: !!recipe
        };

        UI.openModal({
            title: formState.isEdit ? 'Edit Recipe' : 'Create Recipe',
            content: buildFormContent(),
            confirmText: formState.isEdit ? 'Save Changes' : 'Create Recipe',
            size: 'large',
            onConfirm: handleSave,
            onOpen: bindFormEvents
        });
    }

    function buildFormContent() {
        // Render ingredient list
        const ingredientListHtml = renderIngredientList();

        // Render category options
        const categoryOptionsHtml = CATEGORIES.map(cat => 
            `<option value="${UI.escapeHtml(cat.id)}" ${formState.category === cat.id ? 'selected' : ''}>${cat.name}</option>`
        ).join('');

        return `
            <div class="recipe-form">
                <!-- Recipe Name -->
                <div class="form-group">
                    <label class="form-label">Recipe Name *</label>
                    <input type="text" id="recipe-name" class="form-input" 
                           value="${UI.escapeHtml(formState.name)}" 
                           placeholder="e.g., Chicken Salad">
                </div>

                <!-- Category -->
                <div class="form-group">
                    <label class="form-label">Category</label>
                    <select id="recipe-category" class="form-select">
                        ${categoryOptionsHtml}
                    </select>
                </div>

                <!-- Ingredients Section -->
                <div class="form-group">
                    <label class="form-label">Ingredients (${formState.ingredients.length})</label>

                    <!-- Current ingredients list -->
                    <div id="recipe-ingredient-list" class="recipe-ingredient-list">
                        ${ingredientListHtml}
                    </div>

                    <!-- Search input -->
                    <div class="ingredient-search-section">
                        <label class="ingredient-search-label">🔍 Search and add ingredients:</label>
                        <div class="ingredient-combobox">
                            <input type="text" id="recipe-ingredient-search" class="form-input" 
                                   placeholder="Type to search..."
                                   autocomplete="off">
                            <div id="ingredient-dropdown" class="ingredient-dropdown"></div>
                        </div>
                    </div>
                </div>

                <!-- Nutrition Summary -->
                <div class="nutrition-summary">
                    <div class="nutrition-summary__title">Nutrition Facts (Total)</div>
                    <div class="nutrition-summary__values">
                        ${nutritionValuesHtml()}
                    </div>
                </div>
            </div>
        `;
    }

    function renderIngredientList() {
        if (formState.ingredients.length === 0) {
            return '<p class="empty-message">No ingredients added yet. Search and select below.</p>';
        }

        return formState.ingredients.map((ri, idx) => {
            const ing = State.getIngredient(ri.ingredientId);
            if (!ing) {
                return `<div class="ingredient-item ingredient-item--error">Unknown ingredient</div>`;
            }

            const factor = ri.grams / 100;
            const kcal = Math.round(ing.kcalPer100g * factor);
            const protein = ((ing.proteinPer100g || 0) * factor).toFixed(1);
            const carbs = ((ing.carbsPer100g || 0) * factor).toFixed(1);
            const fat = ((ing.fatPer100g || 0) * factor).toFixed(1);

            return `
                <div class="ingredient-item" data-index="${idx}">
                    <div class="ingredient-item__main">
                        <span class="ingredient-item__name">${UI.escapeHtml(ing.name)}</span>
                        <input type="number" class="ingredient-item__grams" 
                               value="${UI.escapeHtml(ri.grams)}" min="1" max="10000"
                               data-grams-idx="${idx}">
                        <span class="ingredient-item__kcal">${kcal} kcal</span>
                        <button class="ingredient-item__remove" data-remove-idx="${idx}">X</button>
                    </div>
                    <div class="ingredient-item__macros">
                        <span>P: ${protein}g</span>
                        <span>C: ${carbs}g</span>
                        <span>F: ${fat}g</span>
                    </div>
                </div>
            `;
        }).join('');
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

        // Ingredient list interactions
        document.getElementById('recipe-ingredient-list')?.addEventListener('input', (e) => {
            if (e.target.matches('[data-grams-idx]')) {
                const idx = parseInt(e.target.dataset.gramsIdx);
                const grams = Math.max(1, parseInt(e.target.value) || 100);
                formState.ingredients[idx].grams = grams;
                refreshNutrition();
            }
        });

        document.getElementById('recipe-ingredient-list')?.addEventListener('click', (e) => {
            if (e.target.matches('[data-remove-idx]')) {
                const idx = parseInt(e.target.dataset.removeIdx);
                formState.ingredients.splice(idx, 1);
                refreshForm();
            }
        });
    }

    /**
     * Adds the food picked in the search; server foods (USDA) are kept in this
     * browser so the recipe can sum them
     */
    function addIngredient(food) {
        if (!food) {
            UI.toastWarning('Select an ingredient');
            return;
        }
        const ingredientId = food.id;

        // Check duplicate
        if (formState.ingredients.some(ri => ri.ingredientId === ingredientId)) {
            UI.toastWarning('Ingredient already added');
            return;
        }

        if (!State.getIngredient(ingredientId)) State.cacheIngredient(food);
        formState.ingredients.push({ ingredientId, grams: 100 });

        refreshForm();
        UI.toastSuccess('Ingredient added');
    }

    function refreshForm() {
        const ingredientList = document.getElementById('recipe-ingredient-list');
        const dropdown = document.getElementById('ingredient-dropdown');
        const searchInput = document.getElementById('recipe-ingredient-search');

        // Update ingredient list
        if (ingredientList) {
            ingredientList.innerHTML = renderIngredientList();
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
            <span>F: <strong>${Math.round(n.fat)}g</strong></span>`;
    };

    function refreshNutrition() {
        const summary = document.querySelector('.nutrition-summary__values');
        if (summary) summary.innerHTML = nutritionValuesHtml();
    }

    async function handleSave() {
        // Validate
        const name = formState.name.trim();

        if (!name) {
            UI.toastError('Recipe name is required');
            return false; // Keep modal open
        }

        if (formState.ingredients.length === 0) {
            UI.toastError('Add at least one ingredient');
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
                UI.toastSuccess('Recipe updated');
            } else {
                await State.addRecipe(data);
                UI.toastSuccess('Recipe created');
            }
            return true; // Close modal
        } catch (e) {
            UI.toastError(e.message);
            return false; // Keep modal open
        }
    }

    return { open, CATEGORIES };
})();
