/**
 * state/planner.js - Planner: diet templates (server) and the week being edited.
 * The week belongs either to the selected template (each change is saved to
 * the template, after a short pause) or to the selected patient (saved with
 * "Guardar en paciente"). Next to the meals there is the week of physical
 * activity (exercises and activities stacked per day), saved the same way.
 */

Object.assign(State, (function() {
    const S = State;
    const SAVE_DELAY_MS = 600;

    let currentTemplateId = null;
    let dietProfile = { goal: 'maintenance', dailyTarget: 2000 };
    let working = { source: null, id: null, week: emptyWeek(), activity: emptyActivity() };
    let mode = 'meals';   // the grid shows 'meals' or 'activity'
    let saveTimer = null;
    const plannerIds = {}; // patientId -> server planner id
    const lastActivity = {}; // patientId -> activity plan loaded with the week

    function emptyActivity() {
        return Object.fromEntries(S.DAYS.map(d => [d, []]));
    }
    const normalizeActivity = (plan) => Object.fromEntries(S.DAYS.map(d => [d, Array.isArray(plan?.[d]) ? plan[d].map(i => ({ ...i })) : []]));

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
        working = { source: template ? 'template' : null, id: templateId, week: normalize(template?.weekPlan), activity: normalizeActivity(template?.activityPlan) };
        S.emit('template:changed', templateId);
        S.emit('dietProfile:updated', getDietProfile());
        weekChanged();
        activityChanged();
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
        const { id, week, activity } = working;
        saveTimer = setTimeout(() => {
            saveTimer = null;
            S._api('PUT', `/api/diet-templates/${encodeURIComponent(id)}`, { weekPlan: week, activityPlan: activity })
                .then(template => S._put('dietTemplates', template))
                .catch(error => UI.toastError('No se pudo guardar la semana: ' + error.message));
        }, SAVE_DELAY_MS);
        S._put('dietTemplates', { ...getDietTemplate(id), weekPlan: week, activityPlan: activity });
    }
    function flushTemplateSave() {
        if (!saveTimer) return;
        clearTimeout(saveTimer);
        saveTimer = null;
        const { id, week, activity } = working;
        S._api('PUT', `/api/diet-templates/${encodeURIComponent(id)}`, { weekPlan: week, activityPlan: activity }).catch(() => {});
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
    function setWeekPlan(plan, patientId, activityPlan = null) {
        flushTemplateSave();
        working = { source: 'patient', id: patientId, week: normalize(plan), activity: normalizeActivity(activityPlan) };
        weekChanged();
        activityChanged();
        return true;
    }

    // --- Physical activity of the week being edited
    const activityChanged = () => S.emit('activityPlan:updated', { source: working.source, id: working.id, activityPlan: getActivityPlan() });
    const getActivityPlan = () => normalizeActivity(working.activity);
    const getDayActivities = (day) => (working.activity[day] || []).map(i => ({ ...i }));

    function changeActivity(update) {
        update(working.activity);
        if (working.source === 'template' && working.id) scheduleTemplateSave();
        activityChanged();
        return true;
    }
    const newActivityId = () => `act-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const addActivity = (day, item) => (S.DAYS.includes(day)
        ? changeActivity(a => { a[day].push({ ...item, id: newActivityId() }); }) : false);
    const updateActivity = (day, id, changes) => changeActivity(a => {
        a[day] = a[day].map(i => (i.id === id ? { ...i, ...changes, id } : i));
    });
    const removeActivity = (day, id) => changeActivity(a => { a[day] = a[day].filter(i => i.id !== id); });
    // Another day or position: drag & drop inside the grid
    const moveActivity = (fromDay, id, toDay, beforeId = null) => changeActivity(a => {
        const item = a[fromDay].find(i => i.id === id);
        if (!item) return;
        a[fromDay] = a[fromDay].filter(i => i.id !== id);
        const index = beforeId ? a[toDay].findIndex(i => i.id === beforeId) : -1;
        if (index === -1) a[toDay].push(item); else a[toDay].splice(index, 0, item);
    });
    const clearActivityPlan = () => changeActivity(a => { Object.assign(a, emptyActivity()); });
    // A routine replaces the week's activity (new item ids: days never share one)
    const replaceActivityPlan = (plan) => changeActivity(a => {
        Object.assign(a, emptyActivity());
        for (const [day, items] of Object.entries(plan || {})) {
            if (S.DAYS.includes(day)) a[day] = items.map(i => ({ ...i, id: newActivityId() }));
        }
    });

    const getMode = () => mode;
    function setMode(next) {
        mode = next === 'activity' ? 'activity' : 'meals';
        S.emit('plannerMode:changed', mode);
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
        lastActivity[patientId] = planner.activityPlan || null;
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
        await S._api('PUT', `/api/planner/${plannerIds[patientId]}`, { meals, activityPlan: getActivityPlan() });
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
        loadPatientWeek, savePlannerToPatient, getLoadedActivity: (patientId) => lastActivity[patientId] || null,
        getActivityPlan, getDayActivities, addActivity, updateActivity, removeActivity, moveActivity, clearActivityPlan, replaceActivityPlan, getMode, setMode
    };
})());
