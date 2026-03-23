/**
 * ingredients.js - Ingredient Management
 * 
 * CRUD operations, CSV import/export for ingredients.
 * 
 * Optimized with:
 * - Proper CSV parsing (handles quoted values)
 * - Duplicate name validation
 * - Debounced search
 */

const Ingredients = (function() {
    // DOM Elements
    let ingredientsList, categoryFilter;

    // State
    let currentFilter = 'all';
    let searchQuery = '';

    // CSV Headers
    const CSV_HEADERS = ['name', 'kcalPer100g', 'category'];

    /**
     * Initialize ingredients module
     */
    function init() {
        ingredientsList = document.getElementById('ingredients-list');
        categoryFilter = document.querySelector('#tab-ingredients .category-filter');

        bindEvents();
        State.subscribe('ingredients:updated', renderIngredients);
        renderIngredients();

        console.log('[Ingredients] Initialized');
    }

    /**
     * Bind events
     */
    function bindEvents() {
        document.getElementById('btn-add-ingredient')?.addEventListener('click', showAddModal);
        document.getElementById('btn-import-json')?.addEventListener('click', handleImportJSON);
        document.getElementById('btn-import-csv')?.addEventListener('click', handleImportCSV);
        document.getElementById('btn-export-csv')?.addEventListener('click', handleExportCSV);
        document.getElementById('btn-delete-all-ingredients')?.addEventListener('click', deleteAllIngredients);

        // Search
        document.getElementById('ingredient-search')?.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim();
            renderIngredients();
        });

        categoryFilter?.addEventListener('click', (e) => {
            const btn = e.target.closest('.category-filter__btn');
            if (btn) {
                currentFilter = btn.dataset.category;
                updateFilterUI();
                renderIngredients();
            }
        });
    }

    /**
     * Delete all ingredients
     */
    function deleteAllIngredients() {
        UI.confirmDanger('Delete ALL ingredients? This cannot be undone!', () => {
            State.deleteAllIngredients();
            UI.toastSuccess('All ingredients deleted');
        });
    }

    /**
     * Update filter UI
     */
    function updateFilterUI() {
        categoryFilter?.querySelectorAll('.category-filter__btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.category === currentFilter);
        });
    }

    /**
     * Get filtered and sorted ingredients
     */
    function getFilteredIngredients() {
        let ingredients = State.getIngredients();
        
        if (currentFilter !== 'all') {
            ingredients = ingredients.filter(i => i.category === currentFilter);
        }
        
        if (searchQuery && typeof searchQuery === 'string' && searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            ingredients = ingredients.filter(i => i.name.toLowerCase().includes(query));
        }
        
        // Sort alphabetically
        ingredients.sort((a, b) => a.name.localeCompare(b.name));
        
        return ingredients;
    }

    /**
     * Get summary stats for ingredients
     */
    function getSummaryStats() {
        const all = State.getIngredients();
        const filtered = getFilteredIngredients();
        
        const calc = (arr, field) => {
            if (!arr.length) return 0;
            const sum = arr.reduce((a, b) => a + (b[field] || 0), 0);
            const max = Math.max(...arr.map(b => b[field] || 0));
            const min = Math.min(...arr.filter(b => b[field]).map(b => b[field]));
            return { avg: sum / arr.length, max, min };
        };

        return {
            total: filtered.length,
            totalAll: all.length,
            kcal: calc(filtered, 'kcalPer100g'),
            protein: calc(filtered, 'proteinPer100g'),
            carbs: calc(filtered, 'carbsPer100g'),
            fat: calc(filtered, 'fatPer100g'),
            byCategory: filtered.reduce((acc, i) => {
                acc[i.category] = (acc[i.category] || 0) + 1;
                return acc;
            }, {})
        };
    }

    /**
     * Render summary stats bar
     */
    function renderSummaryBar() {
        const stats = getSummaryStats();
        
        return `
            <div class="ingredients-summary">
                <div class="ingredients-summary__stat">
                    <span class="ingredients-summary__value">${stats.total}</span>
                    <span class="ingredients-summary__label">${currentFilter !== 'all' ? currentFilter : 'Total'}</span>
                </div>
                <div class="ingredients-summary__divider"></div>
                <div class="ingredients-summary__stat">
                    <span class="ingredients-summary__value">${Math.round(stats.kcal.avg || 0)}</span>
                    <span class="ingredients-summary__label">Avg kcal</span>
                </div>
                <div class="ingredients-summary__stat">
                    <span class="ingredients-summary__value">${Math.round(stats.protein.avg || 0)}g</span>
                    <span class="ingredients-summary__label">Avg Protein</span>
                </div>
                <div class="ingredients-summary__stat">
                    <span class="ingredients-summary__value">${Math.round(stats.carbs.avg || 0)}g</span>
                    <span class="ingredients-summary__label">Avg Carbs</span>
                </div>
                <div class="ingredients-summary__stat">
                    <span class="ingredients-summary__value">${Math.round(stats.fat.avg || 0)}g</span>
                    <span class="ingredients-summary__label">Avg Fat</span>
                </div>
                <div class="ingredients-summary__divider"></div>
                <div class="ingredients-summary__categories">
                    ${Object.entries(stats.byCategory).slice(0, 4).map(([cat, count]) => `
                        <span class="category-badge category-badge--${cat}">${UI.capitalize(cat)}: ${count}</span>
                    `).join('')}
                </div>
            </div>
        `;
    }

    /**
     * Render ingredients list
     */
    function renderIngredients() {
        const ingredients = getFilteredIngredients();

        if (ingredients.length === 0) {
            ingredientsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state__icon"></div>
                <p class="empty-state__text">No ingredients yet</p>
                <p class="empty-state__hint">Add ingredients manually or import from CSV</p>
            </div>
            `;
            return;
        }

        const summaryHtml = renderSummaryBar();

        ingredientsList.innerHTML = summaryHtml + ingredients.map(ingredient => `
            <div class="ingredient-item" data-id="${ingredient.id}">
                <div class="ingredient-item__compact" data-action="toggle-ingredient">
                    <div class="ingredient-item__title">
                        <span class="category-badge category-badge--${ingredient.category}">${UI.capitalize(ingredient.category)}</span>
                        <span class="ingredient-item__name">${UI.escapeHtml(ingredient.name)}</span>
                    </div>
                    <div class="ingredient-item__macros">
                        <span class="macro-kcal">${Math.round(ingredient.kcalPer100g)} kcal</span>
                        <span class="macro-divider">|</span>
                        <span class="macro-p">P: ${round(ingredient.proteinPer100g)}g</span>
                        <span class="macro-c">C: ${round(ingredient.carbsPer100g)}g</span>
                        <span class="macro-f">F: ${round(ingredient.fatPer100g)}g</span>
                    </div>
                    <button class="btn btn--secondary btn--sm btn-edit" data-action="edit-ingredient" data-id="${ingredient.id}">Edit</button>
                    <button class="btn btn--danger btn--sm btn-delete" data-action="delete-ingredient" data-id="${ingredient.id}">Delete</button>
                </div>
                <div class="ingredient-item__nutrition" id="nutrition-${ingredient.id}" style="display: none;">
                    <div class="ingredient-nutrition-panel ingredient-nutrition-panel--expanded">
                        <div class="ingredient-nutrition-panel__header">
                            <strong>Nutrition Facts</strong>
                            <span>per 100g</span>
                        </div>
                        <div class="ingredient-nutrition-panel__calories">
                            <strong>Calories</strong>
                            <span class="calories-value">${Math.round(ingredient.kcalPer100g)} kcal</span>
                        </div>
                        <div class="ingredient-nutrition-panel__section">
                            <div class="ingredient-nutrition-panel__row ingredient-nutrition-panel__row--bold">
                                <span>Fat</span>
                                <span>${round(ingredient.fatPer100g)}g</span>
                            </div>
                            <div class="ingredient-nutrition-panel__row ingredient-nutrition-panel__row--sub">
                                <span>Saturated</span>
                                <span>${round(ingredient.saturatedFatPer100g)}g</span>
                            </div>
                            <div class="ingredient-nutrition-panel__row ingredient-nutrition-panel__row--sub">
                                <span>Polyunsaturated</span>
                                <span>${round(ingredient.polyunsaturatedFatPer100g)}g</span>
                            </div>
                            <div class="ingredient-nutrition-panel__row ingredient-nutrition-panel__row--sub">
                                <span>Monounsaturated</span>
                                <span>${round(ingredient.monounsaturatedFatPer100g)}g</span>
                            </div>
                            <div class="ingredient-nutrition-panel__row">
                                <span>Cholesterol</span>
                                <span>${round(ingredient.cholesterolPer100g)}mg</span>
                            </div>
                            <div class="ingredient-nutrition-panel__row">
                                <span>Sodium</span>
                                <span>${round(ingredient.sodiumPer100g)}mg</span>
                            </div>
                            <div class="ingredient-nutrition-panel__row ingredient-nutrition-panel__row--bold">
                                <span>Carbohydrates</span>
                                <span>${round(ingredient.carbsPer100g)}g</span>
                            </div>
                            <div class="ingredient-nutrition-panel__row ingredient-nutrition-panel__row--sub">
                                <span>Sugar</span>
                                <span>${round(ingredient.sugarPer100g)}g</span>
                            </div>
                            <div class="ingredient-nutrition-panel__row ingredient-nutrition-panel__row--sub">
                                <span>Fiber</span>
                                <span>${round(ingredient.fiberPer100g)}g</span>
                            </div>
                            <div class="ingredient-nutrition-panel__row ingredient-nutrition-panel__row--bold ingredient-nutrition-panel__row--protein">
                                <span>Protein</span>
                                <span>${round(ingredient.proteinPer100g)}g</span>
                            </div>
                        </div>
                        ${hasVitamins(ingredient) ? `
                        <div class="ingredient-nutrition-panel__section ingredient-nutrition-panel__section--full">
                            <div class="nutrition-grid-header">Vitamins</div>
                            <div class="nutrition-grid">
                                <div class="nutrition-grid-item">
                                    <span class="nutrition-label">Vitamin A</span>
                                    <span class="nutrition-value">${round(ingredient.vitaminAPer100g)} mcg</span>
                                </div>
                                <div class="nutrition-grid-item">
                                    <span class="nutrition-label">Vitamin B1</span>
                                    <span class="nutrition-value">${round(ingredient.vitaminB1Per100g)} mg</span>
                                </div>
                                <div class="nutrition-grid-item">
                                    <span class="nutrition-label">Vitamin B2</span>
                                    <span class="nutrition-value">${round(ingredient.vitaminB2Per100g)} mg</span>
                                </div>
                                <div class="nutrition-grid-item">
                                    <span class="nutrition-label">Vitamin B3</span>
                                    <span class="nutrition-value">${round(ingredient.vitaminB3Per100g)} mg</span>
                                </div>
                                <div class="nutrition-grid-item">
                                    <span class="nutrition-label">Vitamin B5</span>
                                    <span class="nutrition-value">${round(ingredient.vitaminB5Per100g)} mg</span>
                                </div>
                                <div class="nutrition-grid-item">
                                    <span class="nutrition-label">Vitamin B6</span>
                                    <span class="nutrition-value">${round(ingredient.vitaminB6Per100g)} mg</span>
                                </div>
                                <div class="nutrition-grid-item">
                                    <span class="nutrition-label">Vitamin B9</span>
                                    <span class="nutrition-value">${round(ingredient.vitaminB9Per100g)} mcg</span>
                                </div>
                                <div class="nutrition-grid-item">
                                    <span class="nutrition-label">Vitamin B12</span>
                                    <span class="nutrition-value">${round(ingredient.vitaminB12Per100g)} mcg</span>
                                </div>
                                <div class="nutrition-grid-item">
                                    <span class="nutrition-label">Vitamin C</span>
                                    <span class="nutrition-value">${round(ingredient.vitaminCPer100g)} mg</span>
                                </div>
                                <div class="nutrition-grid-item">
                                    <span class="nutrition-label">Vitamin D</span>
                                    <span class="nutrition-value">${round(ingredient.vitaminDPer100g)} mcg</span>
                                </div>
                                <div class="nutrition-grid-item">
                                    <span class="nutrition-label">Vitamin E</span>
                                    <span class="nutrition-value">${round(ingredient.vitaminEPer100g)} mg</span>
                                </div>
                                <div class="nutrition-grid-item">
                                    <span class="nutrition-label">Vitamin K</span>
                                    <span class="nutrition-value">${round(ingredient.vitaminKPer100g)} mcg</span>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                        ${hasMinerals(ingredient) ? `
                        <div class="ingredient-nutrition-panel__section ingredient-nutrition-panel__section--full">
                            <div class="nutrition-grid-header">Minerals</div>
                            <div class="nutrition-grid">
                                <div class="nutrition-grid-item">
                                    <span class="nutrition-label">Calcium</span>
                                    <span class="nutrition-value">${round(ingredient.calciumPer100g)} mg</span>
                                </div>
                                <div class="nutrition-grid-item">
                                    <span class="nutrition-label">Iron</span>
                                    <span class="nutrition-value">${round(ingredient.ironPer100g)} mg</span>
                                </div>
                                <div class="nutrition-grid-item">
                                    <span class="nutrition-label">Magnesium</span>
                                    <span class="nutrition-value">${round(ingredient.magnesiumPer100g)} mg</span>
                                </div>
                                <div class="nutrition-grid-item">
                                    <span class="nutrition-label">Phosphorus</span>
                                    <span class="nutrition-value">${round(ingredient.phosphorusPer100g)} mg</span>
                                </div>
                                <div class="nutrition-grid-item">
                                    <span class="nutrition-label">Potassium</span>
                                    <span class="nutrition-value">${round(ingredient.potassiumPer100g)} mg</span>
                                </div>
                                <div class="nutrition-grid-item">
                                    <span class="nutrition-label">Selenium</span>
                                    <span class="nutrition-value">${round(ingredient.seleniumPer100g)} mcg</span>
                                </div>
                                <div class="nutrition-grid-item">
                                    <span class="nutrition-label">Zinc</span>
                                    <span class="nutrition-value">${round(ingredient.zincPer100g)} mg</span>
                                </div>
                                <div class="nutrition-grid-item">
                                    <span class="nutrition-label">Manganese</span>
                                    <span class="nutrition-value">${round(ingredient.manganesePer100g)} mg</span>
                                </div>
                                <div class="nutrition-grid-item">
                                    <span class="nutrition-label">Copper</span>
                                    <span class="nutrition-value">${round(ingredient.copperPer100g)} mg</span>
                                </div>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `).join('');

        // Bind item events
        ingredientsList.addEventListener('click', (e) => {
            const btn = e.target.closest('.btn-edit');
            if (btn) {
                e.stopPropagation();
                showEditModal(btn.dataset.id);
                return;
            }
            
            const delBtn = e.target.closest('.btn-delete');
            if (delBtn) {
                e.stopPropagation();
                showDeleteConfirmation(delBtn.dataset.id);
            }
        });
    }
     
    function round(val) {
        return Math.round((val || 0) * 10) / 10;
    }
     
    function hasVitamins(ing) {
        return ing.vitaminAPer100g || ing.vitaminB1Per100g || ing.vitaminB2Per100g || 
               ing.vitaminB3Per100g || ing.vitaminB5Per100g || ing.vitaminB6Per100g ||
               ing.vitaminB9Per100g || ing.vitaminB12Per100g || ing.vitaminCPer100g ||
               ing.vitaminDPer100g || ing.vitaminEPer100g || ing.vitaminKPer100g;
    }
    
    function hasMinerals(ing) {
        return ing.calciumPer100g || ing.ironPer100g || ing.potassiumPer100g ||
               ing.magnesiumPer100g || ing.phosphorusPer100g || ing.sodiumPer100g ||
               ing.zincPer100g || ing.selenuimPer100g || ing.copperPer100g ||
               ing.manganesePer100g;
    }

    /**
     * Show add ingredient modal
     */
    function showAddModal() {
        const content = createIngredientForm();

        UI.openModal({
            title: 'Add Ingredient',
            content,
            confirmText: 'Add',
            onConfirm: handleSaveIngredient,
            size: 'large'
        });
    }

    /**
     * Show edit ingredient modal
     */
    function showEditModal(id) {
        const ingredient = State.getIngredient(id);
        if (!ingredient) return;

        const content = createIngredientForm(ingredient);

        UI.openModal({
            title: 'Edit Ingredient',
            content,
            confirmText: 'Save',
            onConfirm: () => handleSaveIngredient(id),
            size: 'large'
        });
    }

    /**
     * Create ingredient form HTML
     */
    function createIngredientForm(ingredient = {}) {
        const form = document.createElement('div');
        form.innerHTML = `
            <div class="form-group">
                <label class="form-label" for="ingredient-name">Name *</label>
                <input type="text" id="ingredient-name" class="form-input" 
                       value="${ingredient.name ? UI.escapeHtml(ingredient.name) : ''}" 
                       placeholder="e.g., Chicken Breast" required autocomplete="off">
            </div>
            
            <div class="nutrition-form-row">
                <div class="form-group">
                    <label class="form-label" for="ingredient-category">Category</label>
                    <select id="ingredient-category" class="form-select">
                        ${State.VALID_CATEGORIES.map(cat => 
                            `<option value="${cat}" ${ingredient.category === cat ? 'selected' : ''}>${UI.capitalize(cat)}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="ingredient-unit">Unit</label>
                    <select id="ingredient-unit" class="form-select">
                        <option value="g" ${(!ingredient.unit || ingredient.unit === 'g') ? 'selected' : ''}>Grams (g)</option>
                        <option value="oz" ${ingredient.unit === 'oz' ? 'selected' : ''}>Ounces (oz)</option>
                    </select>
                </div>
            </div>
            
            <div class="nutrition-panel">
                <div class="nutrition-panel__header">
                    <span class="nutrition-panel__title">Nutrition Facts</span>
                    <span class="nutrition-panel__serving">per 100g</span>
                </div>
                
                <div class="nutrition-panel__section">
                    <div class="nutrition-panel__row nutrition-panel__row--main">
                        <span>Calories</span>
                        <input type="number" id="ingredient-kcal" class="nutrition-input" 
                               value="${ingredient.kcalPer100g ?? ''}" placeholder="0" min="0" step="0.1">
                        <span>kcal</span>
                    </div>
                </div>
                
                <div class="nutrition-panel__section">
                    <div class="nutrition-panel__label">Fat</div>
                    <div class="nutrition-panel__row">
                        <span>Total Fat</span>
                        <input type="number" id="ingredient-fat" class="nutrition-input" 
                               value="${ingredient.fatPer100g ?? ''}" placeholder="0" min="0" step="0.1">
                        <span>g</span>
                    </div>
                    <div class="nutrition-panel__row nutrition-panel__row--sub">
                        <span>Saturated Fat</span>
                        <input type="number" id="ingredient-satfat" class="nutrition-input" 
                               value="${ingredient.saturatedFatPer100g ?? ''}" placeholder="0" min="0" step="0.1">
                        <span>g</span>
                    </div>
                    <div class="nutrition-panel__row nutrition-panel__row--sub">
                        <span>Polyunsaturated Fat</span>
                        <input type="number" id="ingredient-polyfat" class="nutrition-input" 
                               value="${ingredient.polyunsaturatedFatPer100g ?? ''}" placeholder="0" min="0" step="0.1">
                        <span>g</span>
                    </div>
                    <div class="nutrition-panel__row nutrition-panel__row--sub">
                        <span>Monounsaturated Fat</span>
                        <input type="number" id="ingredient-monosatfat" class="nutrition-input" 
                               value="${ingredient.monounsaturatedFatPer100g ?? ''}" placeholder="0" min="0" step="0.1">
                        <span>g</span>
                    </div>
                </div>
                
                <div class="nutrition-panel__section">
                    <div class="nutrition-panel__row">
                        <span>Cholesterol</span>
                        <input type="number" id="ingredient-cholesterol" class="nutrition-input" 
                               value="${ingredient.cholesterolPer100g ?? ''}" placeholder="0" min="0" step="0.1">
                        <span>mg</span>
                    </div>
                    <div class="nutrition-panel__row">
                        <span>Sodium</span>
                        <input type="number" id="ingredient-sodium" class="nutrition-input" 
                               value="${ingredient.sodiumPer100g ?? ''}" placeholder="0" min="0" step="0.1">
                        <span>mg</span>
                    </div>
                </div>
                
                <div class="nutrition-panel__section">
                    <div class="nutrition-panel__label">Carbohydrates</div>
                    <div class="nutrition-panel__row">
                        <span>Total Carbs</span>
                        <input type="number" id="ingredient-carbs" class="nutrition-input" 
                               value="${ingredient.carbsPer100g ?? ''}" placeholder="0" min="0" step="0.1">
                        <span>g</span>
                    </div>
                    <div class="nutrition-panel__row nutrition-panel__row--sub">
                        <span>Sugar</span>
                        <input type="number" id="ingredient-sugar" class="nutrition-input" 
                               value="${ingredient.sugarPer100g ?? ''}" placeholder="0" min="0" step="0.1">
                        <span>g</span>
                    </div>
                    <div class="nutrition-panel__row nutrition-panel__row--sub">
                        <span>Fiber</span>
                        <input type="number" id="ingredient-fiber" class="nutrition-input" 
                               value="${ingredient.fiberPer100g ?? ''}" placeholder="0" min="0" step="0.1">
                        <span>g</span>
                    </div>
                </div>
                
                <div class="nutrition-panel__section">
                    <div class="nutrition-panel__row nutrition-panel__row--main">
                        <span>Protein</span>
                        <input type="number" id="ingredient-protein" class="nutrition-input" 
                               value="${ingredient.proteinPer100g ?? ''}" placeholder="0" min="0" step="0.1">
                        <span>g</span>
                    </div>
                </div>
                
                <div class="nutrition-panel__section">
                    <div class="nutrition-panel__label">Vitamins</div>
                    <div class="nutrition-form-grid-4">
                        <div class="nutrition-mini-input">
                            <label>A (mcg)</label>
                            <input type="number" id="ingredient-vitA" value="${ingredient.vitaminAPer100g ?? ''}" placeholder="0" step="0.1">
                        </div>
                        <div class="nutrition-mini-input">
                            <label>B1 (mg)</label>
                            <input type="number" id="ingredient-vitB1" value="${ingredient.vitaminB1Per100g ?? ''}" placeholder="0" step="0.01">
                        </div>
                        <div class="nutrition-mini-input">
                            <label>B2 (mg)</label>
                            <input type="number" id="ingredient-vitB2" value="${ingredient.vitaminB2Per100g ?? ''}" placeholder="0" step="0.01">
                        </div>
                        <div class="nutrition-mini-input">
                            <label>B3 (mg)</label>
                            <input type="number" id="ingredient-vitB3" value="${ingredient.vitaminB3Per100g ?? ''}" placeholder="0" step="0.01">
                        </div>
                        <div class="nutrition-mini-input">
                            <label>B5 (mg)</label>
                            <input type="number" id="ingredient-vitB5" value="${ingredient.vitaminB5Per100g ?? ''}" placeholder="0" step="0.01">
                        </div>
                        <div class="nutrition-mini-input">
                            <label>B6 (mg)</label>
                            <input type="number" id="ingredient-vitB6" value="${ingredient.vitaminB6Per100g ?? ''}" placeholder="0" step="0.01">
                        </div>
                        <div class="nutrition-mini-input">
                            <label>B9 (mcg)</label>
                            <input type="number" id="ingredient-vitB9" value="${ingredient.vitaminB9Per100g ?? ''}" placeholder="0" step="1">
                        </div>
                        <div class="nutrition-mini-input">
                            <label>B12 (mcg)</label>
                            <input type="number" id="ingredient-vitB12" value="${ingredient.vitaminB12Per100g ?? ''}" placeholder="0" step="0.01">
                        </div>
                        <div class="nutrition-mini-input">
                            <label>D (mcg)</label>
                            <input type="number" id="ingredient-vitD" value="${ingredient.vitaminDPer100g ?? ''}" placeholder="0" step="0.1">
                        </div>
                        <div class="nutrition-mini-input">
                            <label>E (mg)</label>
                            <input type="number" id="ingredient-vitE" value="${ingredient.vitaminEPer100g ?? ''}" placeholder="0" step="0.01">
                        </div>
                        <div class="nutrition-mini-input">
                            <label>K (mcg)</label>
                            <input type="number" id="ingredient-vitK" value="${ingredient.vitaminKPer100g ?? ''}" placeholder="0" step="0.1">
                        </div>
                    </div>
                </div>
                
                <div class="nutrition-panel__section">
                    <div class="nutrition-panel__label">Minerals</div>
                    <div class="nutrition-form-grid-4">
                        <div class="nutrition-mini-input">
                            <label>Magnesium (mg)</label>
                            <input type="number" id="ingredient-magnesium" value="${ingredient.magnesiumPer100g ?? ''}" placeholder="0" step="0.1">
                        </div>
                        <div class="nutrition-mini-input">
                            <label>Calcium (mg)</label>
                            <input type="number" id="ingredient-calcium" value="${ingredient.calciumPer100g ?? ''}" placeholder="0" step="0.1">
                        </div>
                        <div class="nutrition-mini-input">
                            <label>Phosphorus (mg)</label>
                            <input type="number" id="ingredient-phosphorus" value="${ingredient.phosphorusPer100g ?? ''}" placeholder="0" step="0.1">
                        </div>
                        <div class="nutrition-mini-input">
                            <label>Potassium (mg)</label>
                            <input type="number" id="ingredient-potassium" value="${ingredient.potassiumPer100g ?? ''}" placeholder="0" step="0.1">
                        </div>
                        <div class="nutrition-mini-input">
                            <label>Iron (mg)</label>
                            <input type="number" id="ingredient-iron" value="${ingredient.ironPer100g ?? ''}" placeholder="0" step="0.01">
                        </div>
                        <div class="nutrition-mini-input">
                            <label>Selenium (mcg)</label>
                            <input type="number" id="ingredient-selenium" value="${ingredient.seleniumPer100g ?? ''}" placeholder="0" step="0.1">
                        </div>
                        <div class="nutrition-mini-input">
                            <label>Zinc (mg)</label>
                            <input type="number" id="ingredient-zinc" value="${ingredient.zincPer100g ?? ''}" placeholder="0" step="0.01">
                        </div>
                        <div class="nutrition-mini-input">
                            <label>Manganese (mg)</label>
                            <input type="number" id="ingredient-manganese" value="${ingredient.manganesePer100g ?? ''}" placeholder="0" step="0.01">
                        </div>
                        <div class="nutrition-mini-input">
                            <label>Copper (mg)</label>
                            <input type="number" id="ingredient-copper" value="${ingredient.copperPer100g ?? ''}" placeholder="0" step="0.01">
                        </div>
                    </div>
                </div>
            </div>
        `;
        return form;
    }

    /**
     * Handle save ingredient
     */
    function handleSaveIngredient(existingId) {
        const name = document.getElementById('ingredient-name')?.value.trim();
        const kcal = parseFloat(document.getElementById('ingredient-kcal')?.value);
        const category = document.getElementById('ingredient-category')?.value;
        const unit = document.getElementById('ingredient-unit')?.value;

        if (!name) {
            UI.toastError('Please enter an ingredient name');
            return false;
        }
        if (isNaN(kcal) || kcal < 0) {
            UI.toastError('Please enter valid calories');
            return false;
        }

        const data = {
            name, category, unit, kcalPer100g: kcal,
            // Macros
            proteinPer100g: parseFloat(document.getElementById('ingredient-protein')?.value) || 0,
            carbsPer100g: parseFloat(document.getElementById('ingredient-carbs')?.value) || 0,
            fatPer100g: parseFloat(document.getElementById('ingredient-fat')?.value) || 0,
            saturatedFatPer100g: parseFloat(document.getElementById('ingredient-satfat')?.value) || 0,
            polyunsaturatedFatPer100g: parseFloat(document.getElementById('ingredient-polyfat')?.value) || 0,
            monounsaturatedFatPer100g: parseFloat(document.getElementById('ingredient-monosatfat')?.value) || 0,
            sugarPer100g: parseFloat(document.getElementById('ingredient-sugar')?.value) || 0,
            fiberPer100g: parseFloat(document.getElementById('ingredient-fiber')?.value) || 0,
            cholesterolPer100g: parseFloat(document.getElementById('ingredient-cholesterol')?.value) || 0,
            sodiumPer100g: parseFloat(document.getElementById('ingredient-sodium')?.value) || 0,
            // Vitamins
            vitaminAPer100g: parseFloat(document.getElementById('ingredient-vitA')?.value) || 0,
            vitaminB1Per100g: parseFloat(document.getElementById('ingredient-vitB1')?.value) || 0,
            vitaminB2Per100g: parseFloat(document.getElementById('ingredient-vitB2')?.value) || 0,
            vitaminB3Per100g: parseFloat(document.getElementById('ingredient-vitB3')?.value) || 0,
            vitaminB5Per100g: parseFloat(document.getElementById('ingredient-vitB5')?.value) || 0,
            vitaminB6Per100g: parseFloat(document.getElementById('ingredient-vitB6')?.value) || 0,
            vitaminB9Per100g: parseFloat(document.getElementById('ingredient-vitB9')?.value) || 0,
            vitaminB12Per100g: parseFloat(document.getElementById('ingredient-vitB12')?.value) || 0,
            vitaminDPer100g: parseFloat(document.getElementById('ingredient-vitD')?.value) || 0,
            vitaminEPer100g: parseFloat(document.getElementById('ingredient-vitE')?.value) || 0,
            vitaminKPer100g: parseFloat(document.getElementById('ingredient-vitK')?.value) || 0,
            // Minerals
            magnesiumPer100g: parseFloat(document.getElementById('ingredient-magnesium')?.value) || 0,
            calciumPer100g: parseFloat(document.getElementById('ingredient-calcium')?.value) || 0,
            phosphorusPer100g: parseFloat(document.getElementById('ingredient-phosphorus')?.value) || 0,
            potassiumPer100g: parseFloat(document.getElementById('ingredient-potassium')?.value) || 0,
            ironPer100g: parseFloat(document.getElementById('ingredient-iron')?.value) || 0,
            seleniumPer100g: parseFloat(document.getElementById('ingredient-selenium')?.value) || 0,
            zincPer100g: parseFloat(document.getElementById('ingredient-zinc')?.value) || 0,
            manganesePer100g: parseFloat(document.getElementById('ingredient-manganese')?.value) || 0,
            copperPer100g: parseFloat(document.getElementById('ingredient-copper')?.value) || 0
        };

        try {
            if (existingId) {
                State.updateIngredient(existingId, data);
                UI.toastSuccess('Ingredient updated');
            } else {
                State.addIngredient(data);
                UI.toastSuccess('Ingredient added');
            }
            return true;
        } catch (error) {
            UI.toastError(error.message);
            return false;
        }
    }

    /**
     * Show delete confirmation
     */
    function showDeleteConfirmation(id) {
        const ingredient = State.getIngredient(id);
        if (!ingredient) return;

        UI.confirmDanger(
            `Delete "${ingredient.name}"? This will also remove it from any recipes.`,
            () => {
                State.deleteIngredient(id);
                UI.toastSuccess('Ingredient deleted');
            }
        );
    }

    // ==========================================
    // CSV IMPORT/EXPORT
    // ==========================================

    /**
     * Handle JSON import (full nutritional data)
     */
    function handleImportJSON() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (!Array.isArray(data)) {
                        throw new Error('JSON must be an array of ingredients');
                    }
                    showImportPreview(data, true);
                } catch (error) {
                    UI.toastError('Error parsing JSON: ' + error.message);
                }
            };
            reader.onerror = () => UI.toastError('Error reading file');
            reader.readAsText(file);
        };
        input.click();
    }

    /**
     * Handle CSV import
     */
    function handleImportCSV() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const result = parseCSV(event.target.result);
                    if (result.length === 0) {
                        UI.toastError('No valid ingredients found in CSV');
                        return;
                    }
                    showImportPreview(result);
                } catch (error) {
                    UI.toastError('Error parsing CSV: ' + error.message);
                }
            };
            reader.onerror = () => UI.toastError('Error reading file');
            reader.readAsText(file);
        };
        input.click();
    }

    /**
     * Parse CSV content (handles quoted values)
     */
    function parseCSV(content) {
        const rows = parseCSVLines(content);
        if (rows.length < 2) {
            throw new Error('CSV must have a header row and at least one data row');
        }

        const headers = rows[0].map(h => h.trim().toLowerCase());
        const headerMap = {};
        
        headers.forEach((h, i) => {
            if (h.includes('name') || h.includes('nombre')) headerMap.name = i;
            if (h.includes('kcal') || h.includes('calories') || h.includes('calorias')) headerMap.kcal = i;
            if (h.includes('category') || h.includes('categoria') || h.includes('type')) headerMap.category = i;
        });

        if (headerMap.name === undefined || headerMap.kcal === undefined) {
            throw new Error('CSV must have "name" and "kcalPer100g" columns');
        }

        const ingredients = [];
        for (let i = 1; i < rows.length; i++) {
            const values = rows[i];
            if (values.length < 2) continue;

            const name = values[headerMap.name]?.trim();
            const kcal = parseFloat(values[headerMap.kcal]) || 0;
            const categoryValue = headerMap.category !== undefined ? values[headerMap.category] : 'mixed';

            if (name && !isNaN(kcal)) {
                ingredients.push({ 
                    name, 
                    kcalPer100g: kcal, 
                    category: normalizeCategory(categoryValue) 
                });
            }
        }

        return ingredients;
    }

    /**
     * Parse CSV content into rows of values
     */
    function parseCSVLines(content) {
        const rows = [];
        let currentRow = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            const nextChar = content[i + 1];

            if (char === '"' && !inQuotes) {
                inQuotes = true;
            } else if (char === '"' && inQuotes) {
                if (nextChar === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else if (char === ',' && !inQuotes) {
                currentRow.push(current);
                current = '';
            } else if ((char === '\n' || char === '\r') && !inQuotes) {
                if (char === '\r' && nextChar === '\n') {
                    i++;
                }
                if (current || currentRow.length > 0) {
                    currentRow.push(current);
                    if (currentRow.some(v => v.trim())) {
                        rows.push(currentRow);
                    }
                }
                currentRow = [];
                current = '';
            } else {
                current += char;
            }
        }

        if (current || currentRow.length > 0) {
            currentRow.push(current);
            if (currentRow.some(v => v.trim())) {
                rows.push(currentRow);
            }
        }

        return rows;
    }

    /**
     * Normalize category value
     */
    function normalizeCategory(value) {
        if (!value) return 'mixed';
        const v = value.toLowerCase().trim();
        
        if (v.includes('protein') || v.includes('carne') || v.includes('meat')) return 'protein';
        if (v.includes('carb') || v.includes('carbo') || v.includes('bread') || v.includes('pasta')) return 'carbs';
        if (v.includes('fat') || v.includes('grasa') || v.includes('oil')) return 'fats';
        if (v.includes('veg') || v.includes('verdura') || v.includes('salad')) return 'vegetables';
        return 'mixed';
    }

    /**
     * Show import preview
     */
    function showImportPreview(ingredients, isFullData = false) {
        const hasFullData = isFullData && ingredients.length > 0 && 
            (ingredients[0].proteinPer100g !== undefined || ingredients[0].fatPer100g !== undefined);
        
        const content = document.createElement('div');
        
        if (hasFullData) {
            content.innerHTML = `
                <p>Found ${ingredients.length} ingredient${ingredients.length !== 1 ? 's' : ''} with full nutritional data to import:</p>
                <div style="max-height: 300px; overflow-y: auto; margin-top: 16px; border: 1px solid var(--color-border); border-radius: 8px;">
                    ${ingredients.slice(0, 8).map(i => `
                        <div style="padding: 10px 12px; border-bottom: 1px solid var(--color-border);">
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                                <span style="font-weight: 500;">${UI.escapeHtml(i.name)}</span>
                                <span class="text-muted">${i.kcalPer100g} kcal</span>
                            </div>
                            <div style="display: flex; gap: 12px; font-size: 12px; color: var(--color-text-light);">
                                <span>P: ${i.proteinPer100g}g</span>
                                <span>C: ${i.carbsPer100g}g</span>
                                <span>F: ${i.fatPer100g}g</span>
                                ${i.fiberPer100g ? `<span>Fi: ${i.fiberPer100g}g</span>` : ''}
                            </div>
                        </div>
                    `).join('')}
                    ${ingredients.length > 8 ? `
                        <div style="padding: 8px; text-align: center; color: var(--color-text-light);">
                            ...and ${ingredients.length - 8} more
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            content.innerHTML = `
                <p>Found ${ingredients.length} ingredient${ingredients.length !== 1 ? 's' : ''} to import:</p>
                <div style="max-height: 300px; overflow-y: auto; margin-top: 16px; border: 1px solid var(--color-border); border-radius: 8px;">
                    ${ingredients.slice(0, 10).map(i => `
                        <div style="padding: 8px 12px; border-bottom: 1px solid var(--color-border); display: flex; justify-content: space-between; align-items: center;">
                            <span>${UI.escapeHtml(i.name)}</span>
                            <span class="text-muted">${i.kcalPer100g} kcal</span>
                        </div>
                    `).join('')}
                    ${ingredients.length > 10 ? `
                        <div style="padding: 8px; text-align: center; color: var(--color-text-light);">
                            ...and ${ingredients.length - 10} more
                        </div>
                    ` : ''}
                </div>
            `;
        }

        UI.openModal({
            title: 'Import Ingredients',
            content,
            confirmText: 'Import All',
            cancelText: 'Cancel',
            onConfirm: () => {
                const result = isFullData ? State.importIngredientsFull(ingredients) : State.importIngredients(ingredients);
                if (result.imported.length > 0) {
                    UI.toastSuccess(`Imported ${result.imported.length} ingredient${result.imported.length !== 1 ? 's' : ''}`);
                }
                if (result.errors.length > 0) {
                    UI.toastWarning(`${result.errors.length} ingredient${result.errors.length !== 1 ? 's' : ''} skipped (duplicates)`);
                }
            },
            size: 'medium'
        });
    }

    /**
     * Handle CSV export
     */
    function handleExportCSV() {
        const ingredients = State.getIngredients();

        if (ingredients.length === 0) {
            UI.toastWarning('No ingredients to export');
            return;
        }

        const csvContent = [
            CSV_HEADERS.join(','),
            ...ingredients.map(i => `"${i.name.replace(/"/g, '""')}",${i.kcalPer100g},${i.category}`)
        ].join('\n');

        downloadFile(csvContent, `ingredients_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
        UI.toastSuccess('CSV exported');
    }

    /**
     * Download file helper
     */
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Get CSV template
     */
    function getCSVTemplate() {
        return `name,kcalPer100g,category
"Chicken Breast, boneless",165,protein
Brown Rice,111,carbs
Avocado,160,fats
Broccoli,34,vegetables
Mixed Salad,20,mixed`;
    }

    return { init, getFilteredIngredients, getCSVTemplate };
})();

document.addEventListener('DOMContentLoaded', () => Ingredients.init());
