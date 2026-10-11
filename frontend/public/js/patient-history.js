/**
 * patient-history.js - "Historial" tab of the patient profile: every recorded
 * change of the patient: data, measurements, conditions, plans, check-ins and planner weeks
 */

const PatientHistory = (function() {
    async function render(patientId, element) {
        if (!patientId || !element) return;
        element.innerHTML = '<p class="text-muted">Cargando historial...</p>';
        try {
            const res = await fetch(`/api/patients/${encodeURIComponent(patientId)}/history?limit=200`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
            element.innerHTML = `<div class="patient-history">${AuditView.listHtml(json.data, { showPatient: false })}</div>`;
        } catch (error) {
            element.innerHTML = `<p class="text-muted">${UI.escapeHtml(error.message)}</p>`;
        }
    }

    return { render };
})();
