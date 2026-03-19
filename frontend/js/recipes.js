/**
 * recipes.js - Recipe Management
 * Clean recipe builder with ingredient selection
 */

const Recipes = (function() {
    let recipesGrid, categoryFilter;

    function init() {
        recipesGrid = document.getElementById('recipes-grid');
        categoryFilter = document.querySelector('#tab-recipes .category-filter');

        bindEvents();
        render();
        State.subscribe('recipes:updated', render);
    }

    function bindEvents() {
        document.getElementById('btn-add-recipe')?.addEventListener('click', () => openModal(null));

        categoryFilter?.addEventListener('click', (e) => {
            const btn = e.target.closest('.category-filter__btn');
            if (btn) {
                categoryFilter.querySelectorAll('.category-filter__btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                render();
            }
        });

        recipesGrid?.addEventListener('click', (e) => {
            const card = e.target.closest('.recipe-card');
            if (!card) return;

            const id = card.dataset.id;
            if (e.target.closest('.btn-edit')) {
                openModal(id);
            } else if (e.target.closest('.btn-delete')) {
                UI.confirmDanger('Delete this recipe?', () => {
                    State.deleteRecipe(id);
                    UI.toastSuccess('Recipe deleted');
                });
            }
        });
    }

    function render() {
        const activeFilter = categoryFilter?.querySelector('.active')?.dataset.category || 'all';
        let recipes = State.getRecipes();

        if (activeFilter !== 'all') {
            recipes = recipes.filter(r => r.category === activeFilter);
        }

        if (recipes.length === 0) {
            recipesGrid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state__icon"></div>
                    <p class="empty-state__text">No recipes yet</p>
                    <p class="empty-state__hint">Create your first recipe</p>
                </div>
            `;
            return;
        }

        recipesGrid.innerHTML = recipes.map(recipe => {
            const nutrition = recipe.nutrition || { calories: 0, protein: 0, carbs: 0, fat: 0 };
            const ingredientNames = (recipe.ingredients || [])
                .slice(0, 3)
                .map(ri => {
                    const ing = State.getIngredient(ri.ingredientId);
                    return ing ? ing.name : 'Unknown';
                })
                .join(', ');

            return `
                <div class="recipe-card" data-id="${recipe.id}">
                    <div class="recipe-card__header">
                        <h4 class="recipe-card__title">${UI.escapeHtml(recipe.name)}</h4>
                        <span class="category-badge category-badge--${recipe.category}">${UI.capitalize(recipe.category)}</span>
                    </div>
                    <div class="recipe-card__body">
                        <div class="recipe-nutrition-summary">
                            <div class="recipe-nutrition-item recipe-nutrition-item--main">
                                <span class="recipe-nutrition-value">${Math.round(nutrition.calories)}</span>
                                <span class="recipe-nutrition-label">kcal</span>
                            </div>
                            <div class="recipe-nutrition-item">
                                <span class="recipe-nutrition-value">${Math.round(nutrition.protein)}g</span>
                                <span class="recipe-nutrition-label">P</span>
                            </div>
                            <div class="recipe-nutrition-item">
                                <span class="recipe-nutrition-value">${Math.round(nutrition.carbs)}g</span>
                                <span class="recipe-nutrition-label">C</span>
                            </div>
                            <div class="recipe-nutrition-item">
                                <span class="recipe-nutrition-value">${Math.round(nutrition.fat)}g</span>
                                <span class="recipe-nutrition-label">F</span>
                            </div>
                        </div>
                        <p class="recipe-card__ingredients">${(recipe.ingredients || []).length} ingredient${(recipe.ingredients || []).length !== 1 ? 's' : ''}</p>
                        <p class="recipe-card__list">${UI.escapeHtml(ingredientNames) || 'No ingredients'}${(recipe.ingredients || []).length > 3 ? '...' : ''}</p>
                    </div>
                    <div class="recipe-card__footer">
                        <button class="btn btn--secondary btn--sm btn-edit">Edit</button>
                        <button class="btn btn--danger btn--sm btn-delete">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Modal state
    let currentIngredients = [];
    let currentRecipeId = null;
    let currentName = '';
    let currentCategory = 'protein';
    let renderFn = null;

    function openModal(recipeId) {
        const recipe = recipeId ? State.getRecipe(recipeId) : null;
        const isEdit = !!recipe;
        const ingredients = State.getIngredients();

        if (ingredients.length === 0) {
            UI.toastWarning('Add ingredients first in the Ingredients tab');
            return;
        }

        currentRecipeId = recipeId;
        currentIngredients = recipe ? [...recipe.ingredients] : [];
        currentName = recipe ? recipe.name : '';
        currentCategory = recipe ? recipe.category : 'protein';

        renderFn = buildForm;

        UI.openModal({
            title: isEdit ? 'Edit Recipe' : 'Create Recipe',
            content: buildForm(),
            confirmText: isEdit ? 'Save Changes' : 'Create Recipe',
            size: 'large',
            onConfirm: doSave
        });
    }

    function buildForm() {
        const ingredients = State.getIngredients();
        const nutrition = calculateNutrition();

        const ingredientList = currentIngredients.length === 0 
            ? '<p style="color: var(--color-text-light); padding: 12px;">No ingredients added</p>'
            : currentIngredients.map((ri, idx) => {
                const ing = State.getIngredient(ri.ingredientId);
                const ingName = ing ? ing.name : 'Unknown (ID: ' + ri.ingredientId.substring(0,8) + ')';
                const ingKcal = ing ? Math.round(ing.kcalPer100g * ri.grams / 100) : 0;
                const ingP = ing ? ((ing.proteinPer100g || 0) * ri.grams / 100).toFixed(1) : '0';
                const ingC = ing ? ((ing.carbsPer100g || 0) * ri.grams / 100).toFixed(1) : '0';
                const ingF = ing ? ((ing.fatPer100g || 0) * ri.grams / 100).toFixed(1) : '0';
                const ingFi = ing ? ((ing.fiberPer100g || 0) * ri.grams / 100).toFixed(1) : '0';
                
                return `
                    <div style="background: var(--color-bg); border-radius: 8px; margin-bottom: 8px; padding: 10px;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="flex: 1; font-weight: 500;">${UI.escapeHtml(ingName)}</span>
                            <input type="number" value="${ri.grams}" min="1" max="10000" 
                                   style="width: 70px; padding: 4px 8px; border: 1px solid var(--color-border); border-radius: 4px;"
                                   onchange="Recipes.updateGrams(${idx}, this.value)">
                            <span style="width: 70px; font-weight: 600; color: var(--color-primary);">${ingKcal} kcal</span>
                            <button onclick="Recipes.removeIng(${idx})" style="background: var(--color-danger); color: white; border: none; border-radius: 4px; padding: 4px 8px; cursor: pointer;">X</button>
                        </div>
                        <div style="display: flex; gap: 12px; margin-top: 6px; font-size: 12px; color: var(--color-text-light);">
                            <span>P: ${ingP}g</span>
                            <span>C: ${ingC}g</span>
                            <span>F: ${ingF}g</span>
                            <span>Fi: ${ingFi}g</span>
                        </div>
                    </div>
                `;
            }).join('');

        const options = ingredients.map(ing => 
            `<option value="${ing.id}">${UI.escapeHtml(ing.name)} - ${ing.kcalPer100g} kcal/100g</option>`
        ).join('');

        return `
            <div style="display: flex; flex-direction: column; gap: 16px;">
                <div class="form-group">
                    <label class="form-label">Recipe Name *</label>
                    <input type="text" id="recipe-name" class="form-input" 
                           value="${UI.escapeHtml(currentName)}" 
                           placeholder="e.g., Chicken Salad"
                           oninput="Recipes.setName(this.value)">
                </div>

                <div class="form-group">
                    <label class="form-label">Category</label>
                    <select id="recipe-category" class="form-select" onchange="Recipes.setCategory(this.value)">
                        ${['protein', 'carbs', 'fats', 'vegetables', 'mixed'].map(cat => 
                            `<option value="${cat}" ${currentCategory === cat ? 'selected' : ''}>${UI.capitalize(cat)}</option>`
                        ).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label class="form-label">Ingredients (${currentIngredients.length})</label>
                    <div style="max-height: 200px; overflow-y: auto; margin-bottom: 12px;">
                        ${ingredientList}
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <select id="ingredient-select" class="form-select" style="flex: 1;">
                            <option value="">Select ingredient...</option>
                            ${options}
                        </select>
                        <button onclick="Recipes.addIng()" class="btn btn--secondary">Add</button>
                    </div>
                </div>

                <div style="background: var(--color-bg); padding: 16px; border-radius: 8px;">
                    <div style="font-weight: 600; margin-bottom: 12px;">Nutrition Facts (Total)</div>
                    <div style="display: flex; gap: 20px;">
                        <div><strong>${Math.round(nutrition.calories)}</strong> kcal</div>
                        <div>P: <strong>${Math.round(nutrition.protein)}g</strong></div>
                        <div>C: <strong>${Math.round(nutrition.carbs)}g</strong></div>
                        <div>F: <strong>${Math.round(nutrition.fat)}g</strong></div>
                    </div>
                </div>
            </div>
        `;
    }

    function calculateNutrition() {
        const result = { calories: 0, protein: 0, carbs: 0, fat: 0 };
        for (const ri of currentIngredients) {
            const ing = State.getIngredient(ri.ingredientId);
            if (!ing) {
                console.warn('Ingredient not found:', ri.ingredientId);
                continue;
            }
            const factor = ri.grams / 100;
            result.calories += ing.kcalPer100g * factor;
            result.protein += (ing.proteinPer100g || 0) * factor;
            result.carbs += (ing.carbsPer100g || 0) * factor;
            result.fat += (ing.fatPer100g || 0) * factor;
        }
        return result;
    }

    function refreshForm() {
        const body = document.getElementById('modal-body');
        if (body && renderFn) {
            body.innerHTML = renderFn();
        }
    }

    function addIng() {
        const select = document.getElementById('ingredient-select');
        const id = select?.value;
        if (!id) return;
        currentIngredients.push({ ingredientId: id, grams: 100 });
        refreshForm();
    }

    function removeIng(index) {
        currentIngredients.splice(index, 1);
        refreshForm();
    }

    function updateGrams(index, grams) {
        if (currentIngredients[index]) {
            currentIngredients[index].grams = Math.max(1, parseInt(grams) || 100);
            refreshForm();
        }
    }

    function setName(name) {
        currentName = name;
    }

    function setCategory(cat) {
        currentCategory = cat;
    }

    function doSave() {
        const name = currentName.trim();
        const category = currentCategory;

        if (!name) {
            UI.toastError('Recipe name is required');
            return;
        }
        if (currentIngredients.length === 0) {
            UI.toastError('Add at least one ingredient');
            return;
        }

        const data = {
            name,
            category,
            instructions: '',
            ingredients: currentIngredients.map(ri => ({
                ingredientId: ri.ingredientId,
                grams: ri.grams
            }))
        };

        try {
            if (currentRecipeId) {
                State.updateRecipe(currentRecipeId, data);
                UI.toastSuccess('Recipe updated');
            } else {
                State.addRecipe(data);
                UI.toastSuccess('Recipe created');
            }
        } catch (e) {
            UI.toastError(e.message);
        }
    }

    // Public API
    return {
        init,
        addIng,
        removeIng,
        updateGrams,
        setName,
        setCategory
    };
})();

document.addEventListener('DOMContentLoaded', () => Recipes.init());
