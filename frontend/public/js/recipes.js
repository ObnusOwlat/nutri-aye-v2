/**
 * recipes.js - Recipe Management
 * Clean recipe builder with ingredient selection
 * Refactored: Fixed state issues, removed duplicates, proper cleanup
 */

const Recipes = (function() {
    // ==========================================
    // PRIVATE STATE
    // ==========================================
    
    // Modal form state
    let formState = {
        recipeId: null,
        name: '',
        category: 'breakfast',  // FIX: was 'protein'
        ingredients: [],        // Array of { ingredientId, grams }
        isEdit: false
    };
    
    // Cache for ingredients (refreshed on modal open) - MOVED UP to fix ReferenceError
    let ingredientsCache = [];
    
    // DOM refs (cached on init)
    let elements = {};
    
    // Category options
    const CATEGORIES = [
        { id: 'breakfast', name: 'Breakfast' },
        { id: 'lunch', name: 'Lunch' },
        { id: 'dinner', name: 'Dinner' },
        { id: 'afternoon_snack', name: 'Afternoon Snack' },
        { id: 'snack', name: 'Snack' }
    ];
    
    // ==========================================
    // INITIALIZATION
    // ==========================================
    
    function init() {
        // Cache DOM elements
        elements = {
            grid: document.getElementById('recipes-grid'),
            categoryFilter: document.querySelector('#tab-recipes .category-filter'),
            addBtn: document.getElementById('btn-add-recipe')
        };
        
        // Bind main events
        elements.addBtn?.addEventListener('click', () => openModal(null));
        
        elements.categoryFilter?.addEventListener('click', handleCategoryFilter);
        elements.grid?.addEventListener('click', handleGridClick);
        
        // Subscribe to state changes
        State.subscribe('recipes:updated', render);
        
        // Initial render
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
                    <p class="empty-state__text">No recipes yet</p>
                    <p class="empty-state__hint">Create your first recipe</p>
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
                return ing ? ing.name : 'Unknown';
            })
            .join(', ');
        
        const categoryLabel = CATEGORIES.find(c => c.id === recipe.category)?.name || recipe.category;
        
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
                    <p class="recipe-card__ingredients">${ingredientCount} ingredient${ingredientCount !== 1 ? 's' : ''}</p>
                    <p class="recipe-card__list">${UI.escapeHtml(ingredientNames) || 'No ingredients'}${ingredientCount > 3 ? '...' : ''}</p>
                </div>
                <div class="recipe-card__footer">
                    <button class="btn btn--secondary btn--sm btn-edit">Edit</button>
                    <button class="btn btn--danger btn--sm btn-delete">Delete</button>
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
            openModal(id);
        } else if (e.target.closest('.btn-delete')) {
            UI.confirmDanger('Delete this recipe?', () => {
                State.deleteRecipe(id);
                UI.toastSuccess('Recipe deleted');
            });
        }
    }
    
    // ==========================================
    // MODAL MANAGEMENT
    // ==========================================
    
    async function openModal(recipeId) {
        
        // Load ingredients from API first
        try {
            const response = await fetch('/api/ingredients?limit=100');
            
            if (!response.ok) {
                throw new Error('API error: ' + response.status);
            }
            
            const data = await response.json();
            
            // Handle different response formats
            ingredientsCache = data.data || data.ingredients || data || [];
            
        } catch (e) {
            console.error('[Modal] Failed to load ingredients:', e);
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
            onOpen: bindFormEvents,
            onClose: handleModalClose
        });
    }
    
    function handleModalClose() {
        // Cleanup: reset state if needed
    }
    
    // ==========================================
    // FORM BUILDING
    // ==========================================
    
    function buildFormContent() {
        const nutrition = calculateFormNutrition();
        
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
                        <span><strong>${Math.round(nutrition.calories)}</strong> kcal</span>
                        <span>P: <strong>${Math.round(nutrition.protein)}g</strong></span>
                        <span>C: <strong>${Math.round(nutrition.carbs)}g</strong></span>
                        <span>F: <strong>${Math.round(nutrition.fat)}g</strong></span>
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
    
    // ==========================================
    // FORM EVENT BINDING
    // ==========================================
    
    function bindFormEvents() {
        // Name input
        document.getElementById('recipe-name')?.addEventListener('input', (e) => {
            formState.name = e.target.value;
        });
        
        // Category select
        document.getElementById('recipe-category')?.addEventListener('change', (e) => {
            formState.category = e.target.value;
        });
        
        // Search input - instant filtering
        document.getElementById('recipe-ingredient-search')?.addEventListener('input', (e) => {
            filterIngredients(e.target.value);
        });
        
        // Keyboard navigation in dropdown
        document.getElementById('recipe-ingredient-search')?.addEventListener('keydown', handleSearchKeydown);
        
        // Close dropdown on outside click
        document.addEventListener('click', handleOutsideClick);
        
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
        
        // Initial dropdown population
        filterIngredients('');
    }
    
    // ==========================================
    // INGREDIENT SEARCH (FIXED)
    // ==========================================
    
    // Empty query: the first foods (cache loaded on modal open). With text: search
    // the server (own foods + USDA catalog) plus foods that exist only in this browser.
    let searchTimer = null;
    let searchSeq = 0;
    const searchResults = new Map();

    function filterIngredients(query) {
        const q = (query || '').trim();
        clearTimeout(searchTimer);
        if (!q) return renderDropdown(ingredientsCache);
        searchTimer = setTimeout(() => searchIngredients(q), 200);
    }

    async function searchIngredients(q) {
        const seq = ++searchSeq;
        const local = State.getIngredients().filter(ing => ing.name.toLowerCase().includes(q.toLowerCase()));
        let remote = [];
        try {
            const res = await fetch(`/api/ingredients?search=${encodeURIComponent(q)}&limit=30`);
            if (res.ok) remote = (await res.json()).data || [];
        } catch (e) {
            console.warn('[Recipes] Ingredient search failed:', e.message);
        }
        if (seq !== searchSeq) return; // a newer search already ran
        const seen = new Set();
        renderDropdown([...local, ...remote].filter(ing => !seen.has(ing.id) && seen.add(ing.id)));
    }

    function renderDropdown(list) {
        const dropdown = document.getElementById('ingredient-dropdown');
        if (!dropdown) return;
        for (const ing of list) searchResults.set(ing.id, ing);

        if (list.length === 0) {
            dropdown.innerHTML = '<div class="ingredient-dropdown__empty">No ingredients found</div>';
        } else {
            dropdown.innerHTML = list.map(ing => `
                <div class="ingredient-dropdown__item" data-id="${UI.escapeHtml(ing.id)}">
                    <span class="ingredient-dropdown__name">${UI.escapeHtml(ing.name)}</span>
                    <span class="ingredient-dropdown__kcal">${Math.round(ing.kcalPer100g || 0)} kcal/100g</span>
                </div>
            `).join('');
            dropdown.querySelectorAll('.ingredient-dropdown__item').forEach(item => {
                item.addEventListener('click', () => addIngredient(item.dataset.id));
            });
        }
        dropdown.style.display = 'block';
    }

    function handleSearchKeydown(e) {
        const dropdown = document.getElementById('ingredient-dropdown');
        const items = dropdown?.querySelectorAll('.ingredient-dropdown__item');
        if (!items || items.length === 0) return;
        
        const activeClass = 'ingredient-dropdown__item--active';
        let active = dropdown.querySelector('.' + activeClass);
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                active?.classList.remove(activeClass);
                const next = active?.nextElementSibling || items[0];
                next?.classList.add(activeClass);
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                active?.classList.remove(activeClass);
                const prev = active?.previousElementSibling || items[items.length - 1];
                prev?.classList.add(activeClass);
                break;
                
            case 'Enter':
                e.preventDefault();
                if (active) {
                    addIngredient(active.dataset.id);
                }
                break;
                
            case 'Escape':
                dropdown.style.display = 'none';
                break;
        }
    }
    
    function handleOutsideClick(e) {
        const searchSection = e.target.closest('.ingredient-search-section');
        if (!searchSection) {
            const dropdown = document.getElementById('ingredient-dropdown');
            if (dropdown) dropdown.style.display = 'none';
        }
    }
    
    function addIngredient(ingredientId) {
        // Validate
        if (!ingredientId) {
            UI.toastWarning('Select an ingredient');
            return;
        }
        
        // Check duplicate
        if (formState.ingredients.some(ri => ri.ingredientId === ingredientId)) {
            UI.toastWarning('Ingredient already added');
            return;
        }
        
        // Server foods (USDA) are kept in this browser so the recipe can sum them
        if (!State.getIngredient(ingredientId) && searchResults.has(ingredientId)) {
            State.cacheIngredient(searchResults.get(ingredientId));
        }
        formState.ingredients.push({ ingredientId, grams: 100 });
        
        // Clear search and close dropdown
        const searchInput = document.getElementById('recipe-ingredient-search');
        const dropdown = document.getElementById('ingredient-dropdown');
        if (searchInput) searchInput.value = '';
        if (dropdown) dropdown.style.display = 'none';
        
        // Refresh form
        refreshForm();
        UI.toastSuccess('Ingredient added');
    }
    
    // ==========================================
    // FORM REFRESH (OPTIMIZED)
    // ==========================================
    
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
            filterIngredients(searchInput.value);
        }
        
        // Update nutrition display
        refreshNutrition();
    }
    
    function refreshNutrition() {
        const nutrition = calculateFormNutrition();
        const summaryEl = document.querySelector('.nutrition-summary__values');
        if (summaryEl) {
            summaryEl.innerHTML = `
                <span><strong>${Math.round(nutrition.calories)}</strong> kcal</span>
                <span>P: <strong>${Math.round(nutrition.protein)}g</strong></span>
                <span>C: <strong>${Math.round(nutrition.carbs)}g</strong></span>
                <span>F: <strong>${Math.round(nutrition.fat)}g</strong></span>
            `;
        }
    }
    
    // ==========================================
    // SAVE LOGIC
    // ==========================================
    
    function handleSave() {
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
                State.updateRecipe(formState.recipeId, data);
                UI.toastSuccess('Recipe updated');
            } else {
                State.addRecipe(data);
                UI.toastSuccess('Recipe created');
            }
            return true; // Close modal
        } catch (e) {
            UI.toastError(e.message);
            return false; // Keep modal open
        }
    }
    
    // ==========================================
    // PUBLIC API
    // ==========================================
    
    return {
        init,
        openModal
    };
})();

// Auto-initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => Recipes.init());
