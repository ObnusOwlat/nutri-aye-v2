/**
 * planner-patient.js - Patient of the planner: selector, loading and saving the
 * patient's week on the server. The patient sheet is in planner-sidebar.js.
 */

const PlannerPatient = (function() {
    let patientSelect, dailyTarget, dietGoal;
    let selectedId = null;

    function init() {
        patientSelect = document.getElementById('planner-patient-select');
        dailyTarget = document.getElementById('daily-target');
        dietGoal = document.getElementById('planner-diet-goal');

        patientSelect?.addEventListener('change', handlePatientChange);
        document.getElementById('btn-save-patient-plan')?.addEventListener('click', saveToPatient);
        document.getElementById('btn-print-week')?.addEventListener('click', () => PrintPlan.fromPlanner());
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

        patientSelect.innerHTML = '<option value="">Sin paciente</option>' +
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
        State.emit('plannerPatient:changed', selectedId);
        if (selectedId) {
            updatePatientInfo();
            loadPatientWeek(selectedId);
        } else {
            State.setCurrentTemplate(State.getCurrentTemplateId());
        }
    }

    async function loadPatientWeek(patientId) {
        try {
            const week = await State.loadPatientWeek(patientId);
            if (patientId !== selectedId) return; // another patient was chosen meanwhile
            State.setWeekPlan(week || {}, patientId, State.getLoadedActivity(patientId));
            if (week) UI.toastInfo(`Semana de ${State.getPatient(patientId)?.firstName} cargada`);
        } catch (e) {
            UI.toastError('No se pudo cargar la semana del paciente: ' + e.message);
        }
    }

    /**
     * The patient's daily target and goal go to the planner header
     */
    function updatePatientInfo() {
        const context = selectedId ? State.getPatientContext(selectedId) : null;
        if (!context) return;
        if (dailyTarget) dailyTarget.value = context.targetCalories;
        if (dietGoal) dietGoal.value = context.goal;
    }

    /**
     * Save current week plan to patient
     */
    async function saveToPatient() {
        if (!selectedId) {
            UI.toastError('Primero elegí un paciente');
            return;
        }

        const weekPlan = State.getWeekPlan();
        const hasMeals = Object.values(weekPlan).some(day => 
            Object.values(day).some(meal => meal)
        );

        if (!hasMeals) {
            UI.toastWarning('No hay comidas para guardar');
            return;
        }

        try {
            const target = parseInt(dailyTarget?.value) || 2000;
            await State.savePlannerToPatient(selectedId, weekPlan, target);
            UI.toastSuccess(`Plan guardado para ${State.getPatient(selectedId)?.firstName}`);
        } catch (error) {
            UI.toastError(error.message);
        }
    }

    return { init, getSelectedId: () => selectedId };
})();
