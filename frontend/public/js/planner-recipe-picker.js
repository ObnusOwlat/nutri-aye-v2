/**
 * planner-recipe-picker.js - Modal to choose the recipe of a meal slot,
 * warning about the selected patient's allergens
 */

const RecipePicker = (function() {
    /**
     * Show recipe selection modal
     */
    // Allergens of the selected patient in a recipe: the server's check (ingredient
    // names vs. allergy groups); falls back to the local name match while it loads
    function allergensOf(recipeId) {
        const found = PlannerSidebar.warningsFor(recipeId).filter(t => t.startsWith('Contiene '));
        if (PlannerSidebar.getSuggestions()) return { hasAllergens: found.length > 0, allergens: found.map(t => t.slice('Contiene '.length)) };
        return State.checkRecipeAllergens(recipeId, PlannerPatient.getSelectedId());
    }

    function open(day, mealType) {
        const recipes = State.getRecipes();

        if (recipes.length === 0) {
            UI.toastWarning('Primero creá recetas en la pestaña Recetas');
            return;
        }

        const content = `
            <p style="margin-bottom: 16px;">
                Elegí una receta para <strong>${State.MEAL_LABELS[mealType]}</strong> 
                el <strong>${UI.label('day', day)}</strong>:
                ${PlannerPatient.getSelectedId() ? `<br><small style="color:var(--color-text-light)">Las recetas con aviso de alérgenos pueden afectar al paciente</small>` : ''}
            </p>
            <div class="ingredient-select__search" style="margin-bottom: 16px;">
                <input type="text" id="recipe-search" class="form-input" 
                       placeholder="Buscar recetas..." autocomplete="off">
            </div>
            <div class="ingredient-select__list" id="recipe-select-list">
                ${renderRecipeSelectList(recipes)}
            </div>
        `;

        UI.openModal({
            title: 'Elegir receta',
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
            return '<p style="text-align: center; padding: 20px; color: var(--color-text-light);">No se encontraron recetas</p>';
        }

        return recipes.map(recipe => {
            // Check for allergens if patient is selected
            let allergenWarning = '';
            let hasAllergens = false;
            if (PlannerPatient.getSelectedId()) {
                const check = allergensOf(recipe.id);
                hasAllergens = check.hasAllergens;
                if (check.hasAllergens) {
                    allergenWarning = `<span class="allergen-badge" title="Contiene: ${UI.escapeHtml(check.allergens.join(', '))}">⚠ Alérgeno</span>`;
                }
            }

            const nutrition = recipe.nutrition || { calories: 0, protein: 0, carbs: 0, fat: 0 };

            return `
                <div class="ingredient-select__item ${hasAllergens ? 'has-allergen' : ''}" data-id="${recipe.id}">
                    <div class="ingredient-select__item-info">
                        <span class="category-badge category-badge--${recipe.category}">${UI.label('mealCategory', recipe.category)}</span>
                        <span class="ingredient-select__item-name">${UI.escapeHtml(recipe.name)}</span>
                        ${allergenWarning}
                    </div>
                    <div class="ingredient-select__item-nutrition">
                        <span class="ingredient-select__item-kcal">${Math.round(nutrition.calories)} kcal</span>
                        <span class="ingredient-select__item-macros">P:${Math.round(nutrition.protein)}g C:${Math.round(nutrition.carbs)}g G:${Math.round(nutrition.fat)}g</span>
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
                    const check = allergensOf(item.dataset.id);
                    if (check.hasAllergens) {
                        UI.confirm(
                            `Esta receta tiene alérgenos del paciente: ${check.allergens.join(', ')}. ¿Agregarla igual?`,
                            () => {
                                State.assignMeal(day, mealType, item.dataset.id);
                                UI.closeModal();
                                UI.toastWarning('Comida agregada con aviso de alérgenos');
                            }
                        );
                        return;
                    }
                }
                State.assignMeal(day, mealType, item.dataset.id);
                UI.closeModal();
                UI.toastSuccess('Comida agregada');
            });
        });
    }

    return { open };
})();
