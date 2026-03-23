/**
 * planner.js - Weekly Planner
 * 
 * 7-day meal planning grid with diet selector
 * and patient context integration.
 */

const Planner = (function() {
    // DOM Elements
    let weekGrid, dailyTarget, weeklyAvg;
    let patientSelect, patientInfo;
    let templateSelect, dietGoal, dietTarget;

    // Current state
    let selectedPatientId = null;
    let selectedTemplateId = null;

    // Constants
    const DAYS = State.DAYS;
    const DAY_LABELS = State.DAY_LABELS;
    const MEAL_TYPES = State.VALID_MEAL_TYPES;
    const MEAL_LABELS = State.MEAL_LABELS;

    /**
     * Initialize planner module
     */
    function init() {
        weekGrid = document.getElementById('week-grid');
        dailyTarget = document.getElementById('daily-target');
        weeklyAvg = document.getElementById('weekly-avg');
        patientSelect = document.getElementById('planner-patient-select');
        patientInfo = document.getElementById('planner-patient-info');
        templateSelect = document.getElementById('planner-template-select');
        dietGoal = document.getElementById('planner-diet-goal');
        dietTarget = document.getElementById('planner-diet-target');

        bindEvents();
        subscribeToState();
        populatePatientSelector();
        populateTemplateSelector();
        renderWeekPlan();
        updateDietDisplay();

        console.log('[Planner] Initialized');
    }

    /**
     * Populate template selector
     */
    function populateTemplateSelector() {
        if (!templateSelect) return;
        
        const templates = State.getDietTemplates();
        const currentTemplateId = State.getCurrentTemplateId();

        templateSelect.innerHTML = templates.map(t => 
            `<option value="${t.id}">${UI.escapeHtml(t.name)} (${t.dailyTarget} kcal)</option>`
        ).join('');

        // Restore current selection
        if (currentTemplateId && templates.find(t => t.id === currentTemplateId)) {
            templateSelect.value = currentTemplateId;
            selectedTemplateId = currentTemplateId;
        } else if (templates.length > 0) {
            templateSelect.value = templates[0].id;
            selectedTemplateId = templates[0].id;
            State.setCurrentTemplate(templates[0].id);
        }

        updateDietInfo();
    }

    /**
     * Update diet info display
     */
    function updateDietInfo() {
        const profile = State.getDietProfile();
        if (dietGoal) dietGoal.textContent = UI.capitalize(profile.goal);
        if (dietTarget) dietTarget.textContent = `${profile.dailyTarget} kcal/day`;
        if (dailyTarget) dailyTarget.value = profile.dailyTarget;
    }

    /**
     * Handle template selection change
     */
    function handleTemplateChange() {
        const templateId = templateSelect?.value;
        
        if (templateId) {
            selectedTemplateId = templateId;
            State.setCurrentTemplate(templateId);
        }
        
        updateDietInfo();
    }

    /**
     * Show template management modal
     */
    function showTemplateModal() {
        const templates = State.getDietTemplates();
        
        const content = `
            <div class="template-manager">
                <p style="margin-bottom: 16px; color: var(--color-text-light);">Create and manage diet plan templates that can be applied to patients.</p>
                <div class="template-list">
                    ${templates.map(t => `
                        <div class="template-item ${t.isDefault ? 'template-item--default' : ''}" data-id="${t.id}">
                            <div class="template-item__info">
                                <h4>${UI.escapeHtml(t.name)}</h4>
                                <p>${UI.escapeHtml(t.description || 'No description')}</p>
                                <div class="template-item__meta">
                                    <span class="template-badge template-badge--${t.goal}">${UI.capitalize(t.goal)}</span>
                                    <span>${t.dailyTarget} kcal/day</span>
                                    ${t.isDefault ? '<span class="template-badge template-badge--default">Default</span>' : ''}
                                </div>
                            </div>
                            <div class="template-item__actions">
                                <button class="btn btn--secondary btn--sm btn-edit-template" data-id="${t.id}">Edit</button>
                                ${!t.isDefault ? `<button class="btn btn--danger btn--sm btn-delete-template" data-id="${t.id}">Delete</button>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top: 20px; text-align: center;">
                    <button class="btn btn--primary" data-action="add-template">+ Add Template</button>
                </div>
            </div>
        `;

        UI.openModal({
            title: 'Manage Diet Templates',
            content,
            size: 'large',
            hideFooter: true
        });
    }

    /**
     * Show add template modal
     */
    function showAddTemplateModal() {
        const content = `
            <div class="form-group">
                <label class="form-label">Template Name *</label>
                <input type="text" id="tpl-name" class="form-input" placeholder="e.g., Weight Loss 1500">
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <input type="text" id="tpl-description" class="form-input" placeholder="Brief description...">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Goal</label>
                    <select id="tpl-goal" class="form-select">
                        ${State.DIET_GOALS.map(g => `<option value="${g}">${UI.capitalize(g)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Daily Calories</label>
                    <input type="number" id="tpl-calories" class="form-input" value="2000" min="800" max="10000">
                </div>
            </div>
        `;

        UI.openModal({
            title: 'Add Diet Template',
            content,
            confirmText: 'Add Template',
            onConfirm: () => {
                const name = document.getElementById('tpl-name')?.value.trim();
                const description = document.getElementById('tpl-description')?.value.trim();
                const goal = document.getElementById('tpl-goal')?.value;
                const calories = parseInt(document.getElementById('tpl-calories')?.value) || 2000;

                if (!name) {
                    UI.toastError('Template name is required');
                    return false;
                }

                State.addDietTemplate({ name, description, goal, dailyTarget: calories });
                UI.toastSuccess('Template added');
                showTemplateModal(); // Refresh the modal
                populateTemplateSelector(); // Refresh the selector
                return true;
            }
        });
    }

    /**
     * Show edit template modal
     */
    function showEditTemplateModal(templateId) {
        const template = State.getDietTemplate(templateId);
        if (!template) return;

        const content = `
            <div class="form-group">
                <label class="form-label">Template Name *</label>
                <input type="text" id="tpl-name" class="form-input" value="${UI.escapeHtml(template.name)}" placeholder="e.g., Weight Loss 1500">
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <input type="text" id="tpl-description" class="form-input" value="${UI.escapeHtml(template.description || '')}" placeholder="Brief description...">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Goal</label>
                    <select id="tpl-goal" class="form-select">
                        ${State.DIET_GOALS.map(g => `<option value="${g}" ${template.goal === g ? 'selected' : ''}>${UI.capitalize(g)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Daily Calories</label>
                    <input type="number" id="tpl-calories" class="form-input" value="${template.dailyTarget}" min="800" max="10000">
                </div>
            </div>
        `;

        UI.openModal({
            title: 'Edit Diet Template',
            content,
            confirmText: 'Save Changes',
            onConfirm: () => {
                const name = document.getElementById('tpl-name')?.value.trim();
                const description = document.getElementById('tpl-description')?.value.trim();
                const goal = document.getElementById('tpl-goal')?.value;
                const calories = parseInt(document.getElementById('tpl-calories')?.value) || 2000;

                if (!name) {
                    UI.toastError('Template name is required');
                    return false;
                }

                State.updateDietTemplate(templateId, { name, description, goal, dailyTarget: calories });
                UI.toastSuccess('Template updated');
                showTemplateModal(); // Refresh the modal
                populateTemplateSelector(); // Refresh the selector
                return true;
            }
        });
    }

    /**
     * Handle template modal actions
     */
    document.addEventListener('click', (e) => {
        if (e.target.closest('.btn-edit-template')) {
            const id = e.target.closest('.btn-edit-template').dataset.id;
            showEditTemplateModal(id);
        }
        if (e.target.closest('.btn-delete-template')) {
            const id = e.target.closest('.btn-delete-template').dataset.id;
            UI.confirmDanger('Delete this template?', () => {
                State.deleteDietTemplate(id);
                UI.toastSuccess('Template deleted');
                showTemplateModal(); // Refresh the modal
                populateTemplateSelector(); // Refresh the selector
            });
        }
    });

    /**
     * Populate patient dropdown
     */
    function populatePatientSelector() {
        if (!patientSelect) return;
        
        const patients = State.getPatients();
        const currentValue = patientSelect.value;

        patientSelect.innerHTML = '<option value="">-- No patient selected --</option>' +
            patients.map(p => `<option value="${p.id}">${UI.escapeHtml(p.firstName)} ${UI.escapeHtml(p.lastName)}</option>`).join('');

        // Restore selection
        if (currentValue && patients.find(p => p.id === currentValue)) {
            patientSelect.value = currentValue;
            handlePatientChange();
        }
    }

    /**
     * Handle patient selection change
     */
    function handlePatientChange() {
        selectedPatientId = patientSelect?.value || null;
        
        if (selectedPatientId) {
            updatePatientInfo();
        } else {
            hidePatientInfo();
        }
    }

    /**
     * Update patient info bar
     */
    function updatePatientInfo() {
        if (!patientInfo || !selectedPatientId) return;

        const context = State.getPatientContext(selectedPatientId);
        if (!context) return;

        // Update info bar
        patientInfo.style.display = 'flex';

        // Goal
        const goalEl = document.getElementById('planner-patient-goal');
        if (goalEl) goalEl.textContent = `Goal: ${UI.capitalize(context.goal)}`;

        // Target calories
        const targetEl = document.getElementById('planner-patient-target');
        if (targetEl) {
            targetEl.textContent = `Target: ${context.targetCalories} kcal`;
            if (dailyTarget) dailyTarget.value = context.targetCalories;
        }

        // Restrictions
        const restrictionEl = document.getElementById('planner-patient-restrictions');
        if (restrictionEl) {
            if (context.allergies.length > 0) {
                restrictionEl.textContent = `⚠ Allergens: ${context.allergies.join(', ')}`;
                restrictionEl.className = 'planner__patient-restrictions warning';
            } else {
                restrictionEl.textContent = 'No known allergens';
                restrictionEl.className = 'planner__patient-restrictions';
            }
        }

        // Metrics
        const metricsEl = document.getElementById('planner-patient-metrics');
        if (metricsEl && context.latestMetrics) {
            metricsEl.textContent = `Weight: ${context.latestMetrics.weight?.toFixed(1) || '-'} kg | BMI: ${context.latestMetrics.bmi?.toFixed(1) || '-'}`;
        } else if (metricsEl) {
            metricsEl.textContent = 'No metrics recorded';
        }

        // Update diet goal selector
        if (dietGoal) dietGoal.value = context.goal;
    }

    /**
     * Hide patient info bar
     */
    function hidePatientInfo() {
        if (patientInfo) patientInfo.style.display = 'none';
    }

    /**
     * Save current week plan to patient
     */
    function saveToPatient() {
        if (!selectedPatientId) {
            UI.toastError('Please select a patient first');
            return;
        }

        const weekPlan = State.getWeekPlan();
        const hasMeals = Object.values(weekPlan).some(day => 
            Object.values(day).some(meal => meal)
        );

        if (!hasMeals) {
            UI.toastWarning('No meals to save');
            return;
        }

        try {
            const target = parseInt(dailyTarget?.value) || 2000;
            const plan = State.savePlannerToPatient(selectedPatientId, weekPlan, target);
            
            UI.toastSuccess(`Plan saved for ${State.getPatient(selectedPatientId)?.firstName}`);
            
            // Refresh patient plans if viewing a patient
            if (typeof render === 'function') {
                // Will be handled by event subscription
            }
        } catch (error) {
            UI.toastError(error.message);
        }
    }

    /**
     * Bind events using delegation
     */
    function bindEvents() {
        // Patient selector
        patientSelect?.addEventListener('change', handlePatientChange);

        // Template selector
        templateSelect?.addEventListener('change', handleTemplateChange);

        // Manage templates button
        document.getElementById('btn-manage-templates')?.addEventListener('click', showTemplateModal);

        // Daily target with validation
        dailyTarget?.addEventListener('change', (e) => {
            const target = Math.max(500, Math.min(10000, parseInt(e.target.value) || 2000));
            e.target.value = target;
            State.updateDietProfile({ dailyTarget: target });
            // Clear template selection when manually changing calories
            if (templateSelect) templateSelect.value = '';
            selectedTemplateId = null;
            updateDietInfo();
        });

        // Save to patient
        document.getElementById('btn-save-patient-plan')?.addEventListener('click', saveToPatient);

        // Clear week (only current template)
        document.getElementById('btn-clear-week')?.addEventListener('click', () => {
            const template = State.getDietTemplate(selectedTemplateId);
            const templateName = template ? template.name : 'current';
            UI.confirmDanger(
                `Clear the "${templateName}" week plan? This cannot be undone.`,
                () => {
                    State.clearWeekPlan();
                    UI.toastSuccess('Week plan cleared for ' + templateName);
                }
            );
        });

        // Event delegation for meal slots
        weekGrid?.addEventListener('click', handleGridClick);
        weekGrid?.addEventListener('change', handleGridChange);
    }

    /**
     * Handle grid click events (delegation)
     */
    function handleGridClick(e) {
        const slot = e.target.closest('.meal-slot');
        const removeBtn = e.target.closest('.meal-slot__remove');
        const dayCard = e.target.closest('.day-card');

        if (removeBtn) {
            e.stopPropagation();
            const { day, meal } = removeBtn.dataset;
            State.removeMeal(day, meal);
            return;
        }

        if (slot) {
            const { day, meal } = slot.dataset;
            showRecipeSelectModal(day, meal);
            return;
        }
    }

    /**
     * Handle grid change events (delegation)
     */
    function handleGridChange(e) {
        // Future: handle inline quantity edits
    }

    /**
     * Subscribe to state changes
     */
    function subscribeToState() {
        State.subscribe('weekPlan:updated', () => { renderWeekPlan(); updateMealSlotCalories(); });
        State.subscribe('template:changed', (templateId) => {
            selectedTemplateId = templateId;
            populateTemplateSelector();
            renderWeekPlan();
        });
        State.subscribe('dietProfile:updated', () => { updateDietDisplay(); });
        State.subscribe('dietTemplates:updated', populateTemplateSelector);
        State.subscribe('recipes:updated', renderWeekPlan);
        State.subscribe('patients:updated', populatePatientSelector);
    }

    /**
     * Update only the calories display (partial update)
     */
    function updateMealSlotCalories() {
        if (!weekGrid) return;

        const target = State.getDietProfile().dailyTarget;
        const today = getTodayIndex();

        DAYS.forEach((day, index) => {
            const dayCard = weekGrid.querySelector(`[data-day="${day}"]`);
            if (!dayCard) return;

            const calories = State.getDailyCalories(day);
            const calDisplay = dayCard.querySelector('.day-card__calories');
            if (calDisplay) {
                calDisplay.classList.toggle('day-card__calories-over', calories > target);
                calDisplay.innerHTML = `
                    ${UI.formatCalories(calories)}
                    <span class="day-card__calories-value">/ ${UI.formatNumber(target)}</span>
                `;
            }
        });

        updateWeeklyAverage();
    }

    /**
     * Get today's index (0 = Monday)
     */
    function getTodayIndex() {
        const today = new Date().getDay();
        return today === 0 ? 6 : today - 1;
    }

    /**
     * Render the weekly plan grid
     */
    function renderWeekPlan() {
        if (!weekGrid) return;

        const today = getTodayIndex();
        const target = State.getDietProfile().dailyTarget;

        weekGrid.innerHTML = DAYS.map((day, index) => {
            const isToday = index === today;
            const meals = State.getDayMeals(day) || {};
            const dayCalories = State.getDailyCalories(day);
            const isOver = dayCalories > target;

            return `
                <div class="day-card" data-day="${day}">
                    <div class="day-card__header ${isToday ? 'day-card__header--today' : ''}">
                        ${DAY_LABELS[day]}${isToday ? ' (Hoy)' : ''}
                    </div>
                    <div class="day-card__content">
                        <div class="day-card__calories ${isOver ? 'day-card__calories-over' : ''}">
                            ${UI.formatCalories(dayCalories)}
                            <span class="day-card__calories-value">/ ${UI.formatNumber(target)}</span>
                        </div>
                        ${MEAL_TYPES.map(type => renderMealSlot(day, type, meals[type])).join('')}
                    </div>
                </div>
            `;
        }).join('');

        updateWeeklyAverage();
    }

    /**
     * Render a single meal slot
     */
    function renderMealSlot(day, mealType, recipeId) {
        const recipe = recipeId ? State.getRecipe(recipeId) : null;

        if (recipe) {
            // Check for allergens if patient is selected
            let allergenWarning = '';
            if (selectedPatientId) {
                const check = State.checkRecipeAllergens(recipeId, selectedPatientId);
                if (check.hasAllergens) {
                    allergenWarning = `<span class="allergen-warning" title="Contains: ${check.allergens.join(', ')}">⚠</span>`;
                }
            }

            const nutrition = recipe.nutrition || { calories: 0, protein: 0, carbs: 0, fat: 0 };

            return `
                <div class="meal-slot meal-slot--filled" data-day="${day}" data-meal="${mealType}">
                    <div class="meal-slot__label">${MEAL_LABELS[mealType]}</div>
                    <div class="meal-slot__content">
                        ${UI.escapeHtml(recipe.name)} ${allergenWarning}
                        <button class="meal-slot__remove" data-day="${day}" data-meal="${mealType}" title="Remove">×</button>
                    </div>
                    <div class="meal-slot__nutrition">
                        <span class="meal-slot__kcal">${Math.round(nutrition.calories)} kcal</span>
                        <span class="meal-slot__macros">P:${Math.round(nutrition.protein)}g C:${Math.round(nutrition.carbs)}g F:${Math.round(nutrition.fat)}g</span>
                    </div>
                </div>
            `;
        }

        return `
            <div class="meal-slot" data-day="${day}" data-meal="${mealType}">
                <div class="meal-slot__label">${MEAL_LABELS[mealType]}</div>
                <div class="meal-slot__empty">+ Add meal</div>
            </div>
        `;
    }

    /**
     * Show recipe selection modal
     */
    function showRecipeSelectModal(day, mealType) {
        const recipes = State.getRecipes();

        if (recipes.length === 0) {
            UI.toastWarning('Create some recipes first in the Recipes tab');
            return;
        }

        const content = `
            <p style="margin-bottom: 16px;">
                Select a recipe for <strong>${MEAL_LABELS[mealType]}</strong> 
                on <strong>${UI.capitalize(day)}</strong>:
                ${selectedPatientId ? `<br><small style="color:var(--color-text-light)">Recipes with allergen warnings may affect the patient</small>` : ''}
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
            if (selectedPatientId) {
                const check = State.checkRecipeAllergens(recipe.id, selectedPatientId);
                hasAllergens = check.hasAllergens;
                if (check.hasAllergens) {
                    allergenWarning = `<span class="allergen-badge" title="Contains: ${check.allergens.join(', ')}">⚠ Allergen</span>`;
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
                if (selectedPatientId) {
                    const check = State.checkRecipeAllergens(item.dataset.id, selectedPatientId);
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

    /**
     * Update weekly average display
     */
    function updateWeeklyAverage() {
        const avg = State.getWeeklyAverage();
        if (weeklyAvg) {
            weeklyAvg.textContent = UI.formatNumber(avg);
        }
    }

    /**
     * Update diet display
     */
    function updateDietDisplay() {
        updateDietInfo();
        updateMealSlotCalories();
    }

    return { init, DAYS, DAY_LABELS, MEAL_TYPES, MEAL_LABELS, showAddTemplateModal };
})();

document.addEventListener('DOMContentLoaded', () => Planner.init());
