/**
 * patient-history.js - "Historial" tab of the patient profile: every recorded
 * change of the patient, their measurements, conditions and planner weeks
 */

const PatientHistory = (function() {
    async function render(patientId, element) {
        if (!patientId || !element) return;
        element.innerHTML = '<p class="text-muted">Cargando historial...</p>';
        try {
            const res = await fetch(`/api/patients/${encodeURIComponent(patientId)}/history?limit=200`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
            const note = '<p class="text-muted patient-history__note">Lo cargado solo en este navegador (planes, seguimiento) aparecerá aquí cuando se guarde en el servidor (Fase 4).</p>';
            element.innerHTML = `<div class="patient-history">${AuditView.listHtml(json.data, { showPatient: false })}${note}</div>`;
        } catch (error) {
            element.innerHTML = `<p class="text-muted">${UI.escapeHtml(error.message)}</p>`;
        }
    }

    return { render };
})();
