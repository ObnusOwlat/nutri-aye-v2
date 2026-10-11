/**
 * recipes.js - Recipe list: cards, category filter, deactivation.
 * The editor lives in recipe-editor.js and its food search in
 * recipe-ingredient-search.js.
 */

const Recipes = (function() {
    let elements = {};

    function init() {
        elements = {
            grid: document.getElementById('recipes-grid'),
            categoryFilter: document.querySelector('#tab-recipes .category-filter'),
            addBtn: document.getElementById('btn-add-recipe')
        };

        elements.addBtn?.addEventListener('click', () => RecipeEditor.open(null));
        elements.categoryFilter?.addEventListener('click', handleCategoryFilter);
        elements.grid?.addEventListener('click', handleGridClick);
        State.subscribe('recipes:updated', render);
        render();
    }

    // ==========================================
    // MAIN RENDER
    // ==========================================
    
    function render() {
        const { grid, categoryFilter } = elements;
        if (!grid) return;
        
        // Get active filter
        const activeFilter = categoryFilter?.querySelector('.active')?.dataset.category || 'all';
        
        // Get and filter recipes
        let recipes = State.getRecipes();
        if (activeFilter !== 'all') {
            recipes = recipes.filter(r => r.category === activeFilter);
        }
        
        // Sort alphabetically
        recipes.sort((a, b) => a.name.localeCompare(b.name));
        
        // Empty state
        if (recipes.length === 0) {
            grid.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state__icon"></div>
                    <p class="empty-state__text">Todavía no hay recetas</p>
                    <p class="empty-state__hint">Creá tu primera receta</p>
                </div>
            `;
            return;
        }
        
        // Render cards
        grid.innerHTML = recipes.map(recipe => renderRecipeCard(recipe)).join('');
    }
    
    function renderRecipeCard(recipe) {
        const nutrition = recipe.nutrition || { calories: 0, protein: 0, carbs: 0, fat: 0 };
        const ingredientCount = (recipe.ingredients || []).length;
        
        // Get first 3 ingredient names
        const ingredientNames = (recipe.ingredients || [])
            .slice(0, 3)
            .map(ri => {
                const ing = State.getIngredient(ri.ingredientId);
                return ing ? ing.name : 'Desconocido';
            })
            .join(', ');
        
        const categoryLabel = RecipeEditor.CATEGORIES.find(c => c.id === recipe.category)?.name || recipe.category;
        
        return `
            <div class="recipe-card" data-id="${recipe.id}">
                <div class="recipe-card__header">
                    <h4 class="recipe-card__title">${UI.escapeHtml(recipe.name)}</h4>
                    <span class="category-badge category-badge--${recipe.category}">${categoryLabel}</span>
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
                    <p class="recipe-card__ingredients">${UI.plural(ingredientCount, 'alimento')}</p>
                    <p class="recipe-card__list">${UI.escapeHtml(ingredientNames) || 'Sin alimentos'}${ingredientCount > 3 ? '...' : ''}</p>
                </div>
                <div class="recipe-card__footer">
                    <button class="btn btn--secondary btn--sm btn-edit">Editar</button>
                    <button class="btn btn--danger btn--sm btn-delete">Desactivar</button>
                </div>
            </div>
        `;
    }
    
    // ==========================================
    // EVENT HANDLERS
    // ==========================================
    
    function handleCategoryFilter(e) {
        const btn = e.target.closest('.category-filter__btn');
        if (!btn) return;
        
        // Update UI
        elements.categoryFilter?.querySelectorAll('.category-filter__btn')
            .forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Re-render
        render();
    }
    
    function handleGridClick(e) {
        const card = e.target.closest('.recipe-card');
        if (!card) return;
        
        const id = card.dataset.id;
        
        if (e.target.closest('.btn-edit')) {
            RecipeEditor.open(id);
        } else if (e.target.closest('.btn-delete')) {
            UI.confirmDanger('¿Desactivar esta receta? Deja de aparecer en la lista; los planes que la usan no cambian.', async () => {
                await State.deleteRecipe(id);
                UI.toastSuccess('Receta desactivada');
            });
        }
    }
    
    return { init };
})();

document.addEventListener('DOMContentLoaded', () => Recipes.init());
