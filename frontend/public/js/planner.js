/**
 * planner.js - Weekly planner grid: meal slots, daily calories, clearing the week.
 * Templates, patient and recipe picker live in planner-templates.js,
 * planner-patient.js and planner-recipe-picker.js.
 */

const Planner = (function() {
    let weekGrid, dailyTarget, weeklyAvg;

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

        PlannerTemplates.init();
        PlannerPatient.init();
        bindEvents();
        subscribeToState();
        renderWeekPlan();
        updateDietDisplay();

    }

    /**
     * Bind events using delegation
     */
    function bindEvents() {
        // Daily target with validation
        dailyTarget?.addEventListener('change', (e) => {
            const target = Math.max(500, Math.min(10000, parseInt(e.target.value) || 2000));
            e.target.value = target;
            State.updateDietProfile({ dailyTarget: target });
            // Manual calories: no template applies any more
            PlannerTemplates.clearSelection();
            PlannerTemplates.updateDietInfo();
        });

        // Clear week (only current template)
        document.getElementById('btn-clear-week')?.addEventListener('click', () => {
            const template = State.getDietTemplate(PlannerTemplates.getSelectedId());
            const templateName = template ? template.name : 'current';
            UI.confirmDanger(
                `Clear the "${templateName}" week plan? This cannot be undone.`,
                () => {
                    State.clearWeekPlan();
                    UI.toastSuccess('Week plan cleared for ' + templateName);
                },
                'Vaciar semana'
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
            RecipePicker.open(day, meal);
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
        State.subscribe('template:changed', renderWeekPlan);
        State.subscribe('dietProfile:updated', () => { updateDietDisplay(); });
        State.subscribe('recipes:updated', renderWeekPlan);
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
            const patientId = PlannerPatient.getSelectedId();
            if (patientId) {
                const check = State.checkRecipeAllergens(recipeId, patientId);
                if (check.hasAllergens) {
                    allergenWarning = `<span class="allergen-warning" title="Contains: ${UI.escapeHtml(check.allergens.join(', '))}">⚠</span>`;
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
        PlannerTemplates.updateDietInfo();
        updateMealSlotCalories();
    }

    return { init };
})();

document.addEventListener('DOMContentLoaded', () => Planner.init());
