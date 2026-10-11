/**
 * planner-patient.js - Patient of the planner: selector, info bar, loading and
 * saving the patient's week on the server
 */

const PlannerPatient = (function() {
    let patientSelect, patientInfo, dailyTarget, dietGoal;
    let selectedId = null;

    function init() {
        patientSelect = document.getElementById('planner-patient-select');
        patientInfo = document.getElementById('planner-patient-info');
        dailyTarget = document.getElementById('daily-target');
        dietGoal = document.getElementById('planner-diet-goal');

        patientSelect?.addEventListener('change', handlePatientChange);
        document.getElementById('btn-save-patient-plan')?.addEventListener('click', saveToPatient);
        State.subscribe('patients:updated', populatePatientSelector);
        populatePatientSelector();
    }

    /**
     * Populate patient dropdown
     */
    function populatePatientSelector() {
        if (!patientSelect) return;
        
        const patients = State.getPatients();
        const currentValue = patientSelect.value;

        patientSelect.innerHTML = '<option value="">-- No patient selected --</option>' +
            patients.map(p => `<option value="${UI.escapeHtml(p.id)}">${UI.escapeHtml(p.firstName)} ${UI.escapeHtml(p.lastName)}</option>`).join('');

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
        selectedId = patientSelect?.value || null;
        
        if (selectedId) {
            updatePatientInfo();
            loadPatientWeek(selectedId);
        } else {
            hidePatientInfo();
        }
    }

    // Server planner id per patient, to update it on "Save to Patient"
    const serverPlannerIds = {};

    /**
     * Load the patient's saved week from the server into the grid
     */
    async function loadPatientWeek(patientId) {
        try {
            const res = await fetch(`/api/planner?patientId=${encodeURIComponent(patientId)}`);
            if (!res.ok) return;
            const planner = (await res.json()).data?.[0];
            if (!planner || patientId !== selectedId) return;

            serverPlannerIds[patientId] = planner.id;
            if (!planner.meals?.length) return;

            const week = {};
            for (const meal of planner.meals) {
                if (!meal.recipeId || !State.getRecipe(meal.recipeId)) continue;
                (week[meal.day] = week[meal.day] || {})[meal.mealType] = meal.recipeId;
            }
            State.setWeekPlan(week);
            UI.toastInfo(`Loaded ${State.getPatient(patientId)?.firstName}'s week`);
        } catch (e) {
            console.warn('[Planner] Could not load patient week:', e.message);
        }
    }

    /**
     * Save the grid as the patient's week on the server
     */
    async function savePatientWeekToServer(patientId, weekPlan) {
        const meals = [];
        for (const [day, slots] of Object.entries(weekPlan)) {
            for (const [mealType, recipeId] of Object.entries(slots || {})) {
                if (recipeId) meals.push({ day, mealType, recipeId });
            }
        }

        let plannerId = serverPlannerIds[patientId];
        if (!plannerId) {
            const res = await fetch('/api/planner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ patientId })
            });
            if (!res.ok) throw new Error(`Server error: ${res.status}`);
            plannerId = serverPlannerIds[patientId] = (await res.json()).data.id;
        }

        const res = await fetch(`/api/planner/${plannerId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ meals })
        });
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return (await res.json()).skippedMeals || 0;
    }

    /**
     * Update patient info bar
     */
    function updatePatientInfo() {
        if (!patientInfo || !selectedId) return;

        const context = State.getPatientContext(selectedId);
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
        if (!selectedId) {
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
            const plan = State.savePlannerToPatient(selectedId, weekPlan, target);
            
            UI.toastSuccess(`Plan saved for ${State.getPatient(selectedId)?.firstName}`);
            savePatientWeekToServer(selectedId, weekPlan)
                .then(skipped => skipped && UI.toastWarning(`${skipped} comida(s) usan recetas que solo están en este navegador y no se guardaron en el servidor`))
                .catch(e => UI.toastWarning('Saved in this browser only: ' + e.message));
            
            // Refresh patient plans if viewing a patient
            if (typeof render === 'function') {
                // Will be handled by event subscription
            }
        } catch (error) {
            UI.toastError(error.message);
        }
    }

    return { init, getSelectedId: () => selectedId };
})();
