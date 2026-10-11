/**
 * planner-recipe-picker.js - Modal to choose the recipe of a meal slot,
 * warning about the selected patient's allergens
 */

const RecipePicker = (function() {
    /**
     * Show recipe selection modal
     */
    function open(day, mealType) {
        const recipes = State.getRecipes();

        if (recipes.length === 0) {
            UI.toastWarning('Create some recipes first in the Recipes tab');
            return;
        }

        const content = `
            <p style="margin-bottom: 16px;">
                Select a recipe for <strong>${State.MEAL_LABELS[mealType]}</strong> 
                on <strong>${UI.capitalize(day)}</strong>:
                ${PlannerPatient.getSelectedId() ? `<br><small style="color:var(--color-text-light)">Recipes with allergen warnings may affect the patient</small>` : ''}
            </p>
            <div class="ingredient-select__search" style="margin-bottom: 16px;">
                <input type="text" id="recipe-search" class="form-input" 
                       placeholder="Search recipes..." autocomplete="off">
            </div>
            <div class="ingredient-select__list" id="recipe-select-list">
                ${renderRecipeSelectList(recipes)}
            </div>
        `;

        UI.openModal({
            title: 'Select Recipe',
            content,
            hideFooter: true,
            size: 'medium',
            onOpen: () => {
                // Bind search after modal opens
                const searchInput = document.getElementById('recipe-search');
                const listContainer = document.getElementById('recipe-select-list');
                
                searchInput?.addEventListener('input', (e) => {
                    const query = (e.target.value || '').toLowerCase();
                    const filtered = recipes.filter(r => r.name.toLowerCase().includes(query));
                    listContainer.innerHTML = renderRecipeSelectList(filtered);
                    bindRecipeSelectEvents(day, mealType);
                });

                bindRecipeSelectEvents(day, mealType);
            }
        });
    }

    /**
     * Render recipe select list
     */
    function renderRecipeSelectList(recipes) {
        if (recipes.length === 0) {
            return '<p style="text-align: center; padding: 20px; color: var(--color-text-light);">No recipes found</p>';
        }

        return recipes.map(recipe => {
            // Check for allergens if patient is selected
            let allergenWarning = '';
            let hasAllergens = false;
            if (PlannerPatient.getSelectedId()) {
                const check = State.checkRecipeAllergens(recipe.id, PlannerPatient.getSelectedId());
                hasAllergens = check.hasAllergens;
                if (check.hasAllergens) {
                    allergenWarning = `<span class="allergen-badge" title="Contains: ${UI.escapeHtml(check.allergens.join(', '))}">⚠ Allergen</span>`;
                }
            }

            const nutrition = recipe.nutrition || { calories: 0, protein: 0, carbs: 0, fat: 0 };

            return `
                <div class="ingredient-select__item ${hasAllergens ? 'has-allergen' : ''}" data-id="${recipe.id}">
                    <div class="ingredient-select__item-info">
                        <span class="category-badge category-badge--${recipe.category}">${UI.capitalize(recipe.category)}</span>
                        <span class="ingredient-select__item-name">${UI.escapeHtml(recipe.name)}</span>
                        ${allergenWarning}
                    </div>
                    <div class="ingredient-select__item-nutrition">
                        <span class="ingredient-select__item-kcal">${Math.round(nutrition.calories)} kcal</span>
                        <span class="ingredient-select__item-macros">P:${Math.round(nutrition.protein)}g C:${Math.round(nutrition.carbs)}g F:${Math.round(nutrition.fat)}g</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Bind recipe select events
     */
    function bindRecipeSelectEvents(day, mealType) {
        document.querySelectorAll('.ingredient-select__item').forEach(item => {
            item.addEventListener('click', () => {
                // Check allergens before adding
                if (PlannerPatient.getSelectedId()) {
                    const check = State.checkRecipeAllergens(item.dataset.id, PlannerPatient.getSelectedId());
                    if (check.hasAllergens) {
                        UI.confirm(
                            `This recipe contains allergens: ${check.allergens.join(', ')}. Add anyway?`,
                            () => {
                                State.assignMeal(day, mealType, item.dataset.id);
                                UI.closeModal();
                                UI.toastWarning('Meal added with allergen warning');
                            }
                        );
                        return;
                    }
                }
                State.assignMeal(day, mealType, item.dataset.id);
                UI.closeModal();
                UI.toastSuccess('Meal added');
            });
        });
    }

    return { open };
})();
