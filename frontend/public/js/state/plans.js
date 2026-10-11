/**
 * state/plans.js - Patient meal plans (with their week) and progress check-ins,
 * saved in the server. A new active plan completes the previous one.
 */

Object.assign(State, (function() {
    const S = State;
    const enc = encodeURIComponent;

    // --- Plans
    const getPatientPlans = (patientId) => S._data.patientPlans.filter(p => p.patientId === patientId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const getActivePlan = (patientId) => getPatientPlans(patientId).find(p => p.status === 'active') || null;
    const plansChanged = (patientId) => S.emit('patientPlans:updated', { patientId, plans: getPatientPlans(patientId) });

    // Mirrors the server: only one active plan per patient
    const completeOthers = (plan) => {
        if (plan.status !== 'active') return;
        for (const other of getPatientPlans(plan.patientId)) {
            if (other.id !== plan.id && other.status === 'active') S._put('patientPlans', { ...other, status: 'completed' });
        }
    };

    async function addPatientPlan(patientId, data) {
        const plan = S._put('patientPlans', await S._api('POST', `/api/patients/${enc(patientId)}/plans`, data));
        completeOthers(plan);
        plansChanged(patientId);
        return plan;
    }

    async function updatePatientPlan(id, data) {
        const current = S._find('patientPlans', id);
        if (!current) return null;
        const plan = S._put('patientPlans', await S._api('PUT', `/api/patients/${enc(current.patientId)}/plans/${enc(id)}`, data));
        completeOthers(plan);
        plansChanged(plan.patientId);
        return plan;
    }

    async function deletePatientPlan(id) {
        const plan = S._find('patientPlans', id);
        if (!plan) return false;
        await S._api('DELETE', `/api/patients/${enc(plan.patientId)}/plans/${enc(id)}`);
        S._drop('patientPlans', id);
        plansChanged(plan.patientId);
        return true;
    }

    const getPatientDailyCalories = (patientId, day) => {
        const meals = getActivePlan(patientId)?.weekPlan?.[day];
        if (!meals) return 0;
        const total = Object.values(meals).reduce((sum, id) => sum + (S.getRecipe(id)?.nutrition?.calories || 0), 0);
        return Math.round(total);
    };

    // --- Progress
    const getPatientProgress = (patientId) => S._data.patientProgress.filter(p => p.patientId === patientId)
        .sort((a, b) => new Date(b.date) - new Date(a.date));
    const progressChanged = (patientId) => S.emit('patientProgress:updated', { patientId, progress: getPatientProgress(patientId) });

    async function addPatientProgress(patientId, data) {
        const entry = S._put('patientProgress', await S._api('POST', `/api/patients/${enc(patientId)}/progress`, data));
        progressChanged(patientId);
        return entry;
    }

    async function updatePatientProgress(id, data) {
        const current = S._find('patientProgress', id);
        if (!current) return null;
        const entry = S._put('patientProgress', await S._api('PUT', `/api/patients/${enc(current.patientId)}/progress/${enc(id)}`, data));
        progressChanged(entry.patientId);
        return entry;
    }

    async function deletePatientProgress(id) {
        const entry = S._find('patientProgress', id);
        if (!entry) return false;
        await S._api('DELETE', `/api/patients/${enc(entry.patientId)}/progress/${enc(id)}`);
        S._drop('patientProgress', id);
        progressChanged(entry.patientId);
        return true;
    }

    // Everything of one patient, for the "Exportar" button
    const exportPatientData = (patientId) => {
        const patient = S.getPatient(patientId);
        if (!patient) return null;
        return {
            patient,
            metrics: S.getPatientMetrics(patientId),
            conditions: S.getPatientConditions(patientId),
            plans: getPatientPlans(patientId),
            progress: getPatientProgress(patientId)
        };
    };

    return {
        getPatientPlans, getActivePlan, addPatientPlan, updatePatientPlan, deletePatientPlan, getPatientDailyCalories,
        getPatientProgress, addPatientProgress, updatePatientProgress, deletePatientProgress, exportPatientData
    };
})());
