/**
 * state/planner.js - Planner: diet templates (server) and the week being edited.
 * The week belongs either to the selected template (each change is saved to
 * the template, after a short pause) or to the selected patient (saved with
 * "Guardar en paciente").
 */

Object.assign(State, (function() {
    const S = State;
    const SAVE_DELAY_MS = 600;

    let currentTemplateId = null;
    let dietProfile = { goal: 'maintenance', dailyTarget: 2000 };
    let working = { source: null, id: null, week: emptyWeek() };
    let saveTimer = null;
    const plannerIds = {}; // patientId -> server planner id

    function emptyWeek() {
        return Object.fromEntries(S.DAYS.map(d => [d, Object.fromEntries(S.VALID_MEAL_TYPES.map(m => [m, null]))]));
    }
    // Any stored week -> full week with every day and meal
    const normalize = (week) => {
        const full = emptyWeek();
        for (const day of S.DAYS) for (const meal of S.VALID_MEAL_TYPES) full[day][meal] = week?.[day]?.[meal] || null;
        return full;
    };
    const weekChanged = () => S.emit('weekPlan:updated', { source: working.source, id: working.id, weekPlan: getWeekPlan() });

    // After loading: the first template is the starting point
    S._onLoad(() => {
        const keep = S._data.dietTemplates.find(t => t.id === currentTemplateId);
        setCurrentTemplate((keep || S._data.dietTemplates[0])?.id || null);
    });

    // --- Templates
    const getDietTemplates = () => [...S._data.dietTemplates];
    const getDietTemplate = (id) => S._find('dietTemplates', id);
    const getCurrentTemplateId = () => currentTemplateId;
    const templatesChanged = () => S.emit('dietTemplates:updated', S._data.dietTemplates);

    function setCurrentTemplate(templateId) {
        flushTemplateSave();
        currentTemplateId = templateId;
        const template = getDietTemplate(templateId);
        if (template) dietProfile = { goal: template.goal, dailyTarget: template.dailyTarget };
        working = { source: template ? 'template' : null, id: templateId, week: normalize(template?.weekPlan) };
        S.emit('template:changed', templateId);
        S.emit('dietProfile:updated', getDietProfile());
        weekChanged();
    }

    async function addDietTemplate(data) {
        const template = S._put('dietTemplates', await S._api('POST', '/api/diet-templates', data));
        templatesChanged();
        return template;
    }

    async function updateDietTemplate(id, data) {
        const template = S._put('dietTemplates', await S._api('PUT', `/api/diet-templates/${encodeURIComponent(id)}`, data));
        templatesChanged();
        return template;
    }

    async function deleteDietTemplate(id) {
        await S._api('DELETE', `/api/diet-templates/${encodeURIComponent(id)}`);
        S._drop('dietTemplates', id);
        if (currentTemplateId === id) setCurrentTemplate(S._data.dietTemplates[0]?.id || null);
        templatesChanged();
        return true;
    }

    // Template weeks are saved a moment after the last change
    function scheduleTemplateSave() {
        clearTimeout(saveTimer);
        const { id, week } = working;
        saveTimer = setTimeout(() => {
            saveTimer = null;
            S._api('PUT', `/api/diet-templates/${encodeURIComponent(id)}`, { weekPlan: week })
                .then(template => S._put('dietTemplates', template))
                .catch(error => UI.toastError('No se pudo guardar la semana: ' + error.message));
        }, SAVE_DELAY_MS);
        S._put('dietTemplates', { ...getDietTemplate(id), weekPlan: week });
    }
    function flushTemplateSave() {
        if (!saveTimer) return;
        clearTimeout(saveTimer);
        saveTimer = null;
        const { id, week } = working;
        S._api('PUT', `/api/diet-templates/${encodeURIComponent(id)}`, { weekPlan: week }).catch(() => {});
    }
    window.addEventListener('beforeunload', flushTemplateSave);

    // --- Week being edited
    const getWeekPlan = () => normalize(working.week);
    const getDayMeals = (day) => ({ ...normalize(working.week)[day] });

    function changeWeek(update) {
        update(working.week);
        if (working.source === 'template' && working.id) scheduleTemplateSave();
        weekChanged();
        return true;
    }

    const assignMeal = (day, mealType, recipeId) => (S.DAYS.includes(day) && S.VALID_MEAL_TYPES.includes(mealType)
        ? changeWeek(week => { week[day][mealType] = recipeId; }) : false);
    const removeMeal = (day, mealType) => assignMeal(day, mealType, null);
    const clearWeekPlan = () => changeWeek(week => { Object.assign(week, emptyWeek()); });

    // Show a patient's week in the grid (it is saved with "Guardar en paciente")
    function setWeekPlan(plan, patientId) {
        flushTemplateSave();
        working = { source: 'patient', id: patientId, week: normalize(plan) };
        weekChanged();
        return true;
    }

    const getDailyCalories = (day) => Math.round(Object.values(working.week[day] || {})
        .reduce((sum, id) => sum + (S.getRecipe(id)?.nutrition?.calories || 0), 0));
    const getWeeklyTotal = () => S.DAYS.reduce((sum, d) => sum + getDailyCalories(d), 0);
    const getWeeklyAverage = () => {
        const days = S.DAYS.map(getDailyCalories).filter(c => c > 0);
        return days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : 0;
    };

    const getDietProfile = () => ({ ...dietProfile });
    function updateDietProfile(changes) {
        dietProfile = { ...dietProfile, ...changes };
        S.emit('dietProfile:updated', getDietProfile());
        return getDietProfile();
    }

    // --- Patient week (server planner)
    async function loadPatientWeek(patientId) {
        const planner = (await S._api('GET', `/api/planner?patientId=${encodeURIComponent(patientId)}`))[0];
        if (!planner) return null;
        plannerIds[patientId] = planner.id;
        const week = emptyWeek();
        for (const meal of planner.meals || []) {
            if (meal.recipeId && S.getRecipe(meal.recipeId) && week[meal.day]) week[meal.day][meal.mealType] = meal.recipeId;
        }
        return week;
    }

    // Saves the week as the patient's planner week and as a new active plan
    async function savePlannerToPatient(patientId, weekPlan, dailyTarget) {
        if (!patientId) throw new Error('Elegí un paciente');
        const meals = [];
        for (const [day, slots] of Object.entries(weekPlan)) {
            for (const [mealType, recipeId] of Object.entries(slots || {})) if (recipeId) meals.push({ day, mealType, recipeId });
        }
        if (!plannerIds[patientId]) plannerIds[patientId] = (await S._api('POST', '/api/planner', { patientId })).id;
        await S._api('PUT', `/api/planner/${plannerIds[patientId]}`, { meals });
        return S.addPatientPlan(patientId, {
            name: `Planificador - ${new Date().toLocaleDateString('es-PY')}`,
            dietGoal: dietProfile.goal, dailyTarget, startDate: S._today(),
            notes: 'Creado desde el planificador semanal', status: 'active', weekPlan
        });
    }

    return {
        getDietTemplates, getDietTemplate, getCurrentTemplateId, setCurrentTemplate, addDietTemplate, updateDietTemplate, deleteDietTemplate,
        getWeekPlan, getDayMeals, assignMeal, removeMeal, clearWeekPlan, setWeekPlan,
        getDailyCalories, getWeeklyTotal, getWeeklyAverage, getDietProfile, updateDietProfile,
        loadPatientWeek, savePlannerToPatient
    };
})());
