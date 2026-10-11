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

        // Restore selection (the patient's week is not reloaded: unsaved changes stay)
        if (currentValue && patients.find(p => p.id === currentValue)) {
            patientSelect.value = currentValue;
            updatePatientInfo();
        }
    }

    /**
     * Patient chosen: show their saved week. No patient: back to the template's week.
     */
    function handlePatientChange() {
        selectedId = patientSelect?.value || null;
        if (selectedId) {
            updatePatientInfo();
            loadPatientWeek(selectedId);
        } else {
            hidePatientInfo();
            State.setCurrentTemplate(State.getCurrentTemplateId());
        }
    }

    async function loadPatientWeek(patientId) {
        try {
            const week = await State.loadPatientWeek(patientId);
            if (patientId !== selectedId) return; // another patient was chosen meanwhile
            State.setWeekPlan(week || {}, patientId);
            if (week) UI.toastInfo(`Loaded ${State.getPatient(patientId)?.firstName}'s week`);
        } catch (e) {
            UI.toastError('No se pudo cargar la semana del paciente: ' + e.message);
        }
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
    async function saveToPatient() {
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
            await State.savePlannerToPatient(selectedId, weekPlan, target);
            UI.toastSuccess(`Plan saved for ${State.getPatient(selectedId)?.firstName}`);
        } catch (error) {
            UI.toastError(error.message);
        }
    }

    return { init, getSelectedId: () => selectedId };
})();
