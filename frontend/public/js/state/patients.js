/**
 * state/patients.js - Patients, measurements and conditions (saved in the server).
 * "Desactivar" deactivates in the server; the record stays and can be reactivated.
 */

Object.assign(State, (function() {
    const S = State;
    const enc = encodeURIComponent;

    // --- Patients
    const getPatients = () => [...S._data.patients];
    const getPatient = (id) => S._find('patients', id);
    const findPatientByEmail = (email) => (email ? S._data.patients.find(p => p.email?.toLowerCase() === email.trim().toLowerCase()) || null : null);

    const searchPatients = (query) => {
        if (!query || typeof query !== 'string' || !query.trim()) return getPatients();
        const q = query.toLowerCase();
        return S._data.patients.filter(p =>
            p.firstName?.toLowerCase().includes(q) || p.lastName?.toLowerCase().includes(q) ||
            p.email?.toLowerCase().includes(q) || p.phone?.includes(q));
    };

    const patientsChanged = () => S.emit('patients:updated', S._data.patients);

    async function addPatient(data) {
        const patient = S._put('patients', await S._api('POST', '/api/patients', data));
        patientsChanged();
        S.emit('patients:added', patient);
        return patient;
    }

    async function updatePatient(id, data) {
        const patient = S._put('patients', await S._api('PUT', `/api/patients/${enc(id)}`, data));
        patientsChanged();
        S.emit('patients:changed', patient);
        return patient;
    }

    // Fresh copy from the server (e.g. after linking it to billing)
    async function refreshPatient(id) {
        const { metrics, conditions, allergies, ...patient } = await S._api('GET', `/api/patients/${enc(id)}`); // eslint-disable-line no-unused-vars
        S._put('patients', patient);
        patientsChanged();
        return patient;
    }

    async function deletePatient(id) {
        await S._api('DELETE', `/api/patients/${enc(id)}`);
        S._drop('patients', id);
        for (const list of ['patientMetrics', 'patientConditions', 'patientPlans', 'patientProgress']) {
            S._replaceAll(list, S._data[list].filter(x => x.patientId !== id));
        }
        patientsChanged();
        S.emit('patients:deleted', { id });
        return true;
    }

    // --- Measurements
    const getPatientMetrics = (patientId) => S._data.patientMetrics.filter(m => m.patientId === patientId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    const getLatestMetrics = (patientId) => getPatientMetrics(patientId)[0] || null;
    const metricsChanged = (patientId) => S.emit('patientMetrics:updated', { patientId, metrics: getPatientMetrics(patientId) });

    async function addPatientMetric(patientId, data) {
        const weight = parseFloat(data.weight) || null;
        const height = parseFloat(data.height) || null;
        const bmi = S.calculateBMI(weight, height);
        const body = { ...data, weight, height, bmi, bmiCategory: bmi ? S.getBMICategory(bmi) : null };
        const metric = S._put('patientMetrics', await S._api('POST', `/api/patients/${enc(patientId)}/metrics`, body));
        metricsChanged(patientId);
        return metric;
    }

    async function deletePatientMetric(id) {
        const metric = S._find('patientMetrics', id);
        if (!metric) return false;
        await S._api('DELETE', `/api/patients/${enc(metric.patientId)}/metrics/${enc(id)}`);
        S._drop('patientMetrics', id);
        metricsChanged(metric.patientId);
        return true;
    }

    // --- Conditions
    const getPatientConditions = (patientId) => S._data.patientConditions.filter(c => c.patientId === patientId)
        .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    const getAllergies = (patientId) => getPatientConditions(patientId).filter(c => c.type === 'allergy' || c.type === 'intolerance');
    const conditionsChanged = (patientId) => S.emit('patientConditions:updated', { patientId, conditions: getPatientConditions(patientId) });

    async function addPatientCondition(patientId, data) {
        const condition = S._put('patientConditions', await S._api('POST', `/api/patients/${enc(patientId)}/conditions`, data));
        conditionsChanged(patientId);
        return condition;
    }

    async function updatePatientCondition(id, data) {
        const current = S._find('patientConditions', id);
        if (!current) return null;
        const condition = S._put('patientConditions', await S._api('PUT', `/api/patients/${enc(current.patientId)}/conditions/${enc(id)}`, data));
        conditionsChanged(current.patientId);
        return condition;
    }

    async function deletePatientCondition(id) {
        const condition = S._find('patientConditions', id);
        if (!condition) return false;
        await S._api('DELETE', `/api/patients/${enc(condition.patientId)}/conditions/${enc(id)}`);
        S._drop('patientConditions', id);
        conditionsChanged(condition.patientId);
        return true;
    }

    const getSuggestedActivities = () => [...S.DEFAULT_SUGGESTED_ACTIVITIES];

    const getSuggestedActivitiesByCategory = (category) => {
        if (!category || category === 'all') return S.DEFAULT_SUGGESTED_ACTIVITIES;
        return S.DEFAULT_SUGGESTED_ACTIVITIES.filter(a => a.category === category);
    };

    const getSuggestedActivitiesByIntensity = (intensity) => {
        if (!intensity || intensity === 'all') return S.DEFAULT_SUGGESTED_ACTIVITIES;
        return S.DEFAULT_SUGGESTED_ACTIVITIES.filter(a => a.intensity === intensity);
    };

    /**
     * Get patient context for planner
     */
    const getPatientContext = (patientId) => {
        if (!patientId) return null;
        
        const patient = getPatient(patientId);
        if (!patient) return null;

        const activePlan = S.getActivePlan(patientId);
        const conditions = getPatientConditions(patientId);
        const latestMetrics = getLatestMetrics(patientId);
        
        // Get allergies and intolerances
        const allergies = conditions
            .filter(c => c.type === 'allergy' || c.type === 'intolerance')
            .map(c => c.name.toLowerCase());
        
        // Get dietary notes from conditions
        const dietaryNotes = conditions
            .filter(c => c.dietaryNotes)
            .map(c => c.dietaryNotes);

        return {
            patient,
            activePlan,
            conditions,
            allergies,
            dietaryNotes,
            latestMetrics,
            targetCalories: activePlan?.dailyTarget || 2000,
            goal: activePlan?.dietGoal || 'maintenance'
        };
    };

    /**
     * Check if recipe contains allergens
     */
    const checkRecipeAllergens = (recipeId, patientId) => {
        if (!patientId) return { hasAllergens: false, allergens: [] };
        
        const recipe = S.getRecipe(recipeId);
        if (!recipe) return { hasAllergens: false, allergens: [] };

        const context = getPatientContext(patientId);
        if (!context || context.allergies.length === 0) {
            return { hasAllergens: false, allergens: [] };
        }

        // Check recipe ingredients and name for allergens
        const recipeText = `${recipe.name} ${recipe.notes || ''}`.toLowerCase();
        const matchedAllergens = context.allergies.filter(allergy => 
            recipeText.includes(allergy) ||
            recipe.ingredients?.some(ing => {
                const ingredient = S.getIngredient(ing.ingredientId);
                return ingredient && ingredient.name.toLowerCase().includes(allergy);
            })
        );

        return {
            hasAllergens: matchedAllergens.length > 0,
            allergens: matchedAllergens
        };
    };

    return {
        getPatients, getPatient, findPatientByEmail, searchPatients, addPatient, updatePatient, refreshPatient, deletePatient,
        getPatientMetrics, getLatestMetrics, addPatientMetric, deletePatientMetric,
        getPatientConditions, getAllergies, addPatientCondition, updatePatientCondition, deletePatientCondition,
        getSuggestedActivities, getSuggestedActivitiesByCategory, getSuggestedActivitiesByIntensity,
        getPatientContext, checkRecipeAllergens
    };
})());
