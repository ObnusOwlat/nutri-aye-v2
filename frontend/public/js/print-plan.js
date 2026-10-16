/**
 * print-plan.js - "Plan alimentario semanal" for the patient: one block per
 * day with its meals in order and the recipe of each. Calories only when the
 * option is on. Empty meals are left out; an empty day says so. Optionally
 * followed by the recetario (print-recipe.js).
 */

const PrintPlan = (function() {
    const esc = (v) => UI.escapeHtml(v ?? '');

    const hasMeals = (week) => Boolean(week) && State.DAYS.some(d => Object.values(week[d] || {}).some(Boolean));

    // Allergies and intolerances, by the name the nutritionist gave them (no severity, no notes)
    function avoidLine(patient) {
        if (!patient) return '';
        const names = State.getAllergies(patient.id).map(c => c.name).filter(Boolean);
        return names.length ? `<strong>Alergias e intolerancias:</strong> ${esc(names.join(', '))}` : '';
    }

    function dayBlock(day, meals, opts) {
        const rows = State.VALID_MEAL_TYPES
            .map(type => [type, meals?.[type] && State.getRecipe(meals[type])])
            .filter(([, recipe]) => recipe);
        const kcal = opts.calories && rows.length ? State.calculateDayNutrition(meals).calories : null;
        return `
            <div class="pdoc-day pdoc__block">
                <h3>${esc(UI.label('day', day))}${kcal != null ? ` <small>${UI.formatCalories(kcal)}</small>` : ''}</h3>
                ${rows.length ? `<dl>${rows.map(([type, recipe]) => `
                    <dt>${esc(UI.label('mealType', type))}</dt>
                    <dd>${esc(Print.recipeName(recipe.name))}${opts.calories ? ` <small>${UI.formatCalories(State.calculateMealNutrition(recipe.id).calories)}</small>` : ''}</dd>`).join('')}
                </dl>` : '<p class="pdoc__muted">Sin comidas indicadas</p>'}
            </div>`;
    }

    function html({ week, patient }, opts) {
        const days = State.DAYS.map(d => dayBlock(d, week[d], opts)).join('');
        const withMeals = State.DAYS.filter(d => Object.values(week[d] || {}).some(Boolean));
        const average = opts.calories && withMeals.length
            ? withMeals.reduce((sum, d) => sum + State.calculateDayNutrition(week[d]).calories, 0) / withMeals.length : null;
        const body = `
            <section class="pdoc__section">
                <div class="pdoc-week">${days}</div>
                ${average != null ? `<p class="pdoc-week__avg">Promedio diario: <strong>${UI.formatCalories(average)}</strong></p>` : ''}
            </section>
            ${opts.recipes ? PrintRecipe.recetario(week, opts) : ''}`;
        return Print.page({ title: 'Plan alimentario semanal', subtitle: avoidLine(patient), patient, body });
    }

    // Document for PrintDialog; week = { monday: { breakfast: recipeId, ... }, ... }
    function doc({ week, patient }) {
        return {
            id: 'plan',
            label: 'Plan alimentario semanal',
            options: ['calories', 'recipes', 'notes'],
            build: (opts) => {
                if (!hasMeals(week)) throw new Error(patient ? 'La semana del paciente no tiene comidas guardadas' : 'La semana no tiene comidas');
                return { title: Print.fileTitle('Plan semanal', patient), html: html({ week, patient }, opts) };
            }
        };
    }

    // Planner button: the week as it is on screen (saved or not), with or without patient
    function fromPlanner() {
        const patient = State.getPatient(PlannerPatient.getSelectedId()) || null;
        PrintDialog.open({ title: 'Imprimir plan semanal', docs: [doc({ week: State.getWeekPlan(), patient })] });
    }

    return { doc, html, fromPlanner, hasMeals };
})();
