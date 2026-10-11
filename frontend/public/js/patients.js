/**
 * patients.js - Patient list: search, delete, export.
 * The form, profile and billing tab live in patient-form.js,
 * patient-profile.js and patient-billing.js.
 */

const Patients = (function() {
    let patientsList, searchInput;
    let searchTimer = null;

    function init() {
        patientsList = document.getElementById('patients-list');
        searchInput = document.getElementById('patient-search');

        document.getElementById('btn-add-patient')?.addEventListener('click', PatientForm.showAddModal);
        searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => renderPatientsList(e.target.value), 300);
        });
        patientsList?.addEventListener('click', handleListClick);
        State.subscribe('patients:updated', () => renderPatientsList(searchInput?.value || ''));

        PatientProfile.init();
        renderPatientsList();
    }

    function handleListClick(e) {
        const card = e.target.closest('.patient-card');
        if (!card) return;
        const id = card.dataset.id;

        if (e.target.closest('.btn-edit')) {
            PatientForm.showEditModal(id);
        } else if (e.target.closest('.btn-delete')) {
            showDeleteConfirmation(id);
        } else {
            PatientProfile.open(id);
        }
    }

    /**
     * Render patients list
     */
    function renderPatientsList(searchQuery = '') {
        const patients = State.searchPatients(searchQuery);

        if (patients.length === 0) {
            patientsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state__icon"></div>
                    <p class="empty-state__text">${searchQuery ? 'Ningún paciente coincide con la búsqueda' : 'Todavía no hay pacientes'}</p>
                    <p class="empty-state__hint">${searchQuery ? 'Try a different search term' : 'Agregá tu primer paciente para empezar'}</p>
                </div>
            `;
            return;
        }

        patientsList.innerHTML = patients.map(patient => {
            const latestMetrics = State.getLatestMetrics(patient.id);
            const activePlan = State.getActivePlan(patient.id);
            const age = State.calculateAge(patient.dateOfBirth);
            const bmi = latestMetrics?.bmi;

            return `
                <div class="patient-card" data-id="${patient.id}">
                    <div class="patient-card__avatar">
                        ${patient.firstName?.[0] || '?'}${patient.lastName?.[0] || ''}
                    </div>
                    <div class="patient-card__info">
                        <h4 class="patient-card__name">${UI.escapeHtml(patient.firstName)} ${UI.escapeHtml(patient.lastName)}</h4>
                        <p class="patient-card__meta">
                            ${age ? `${age} años` : ''}
                            ${patient.gender ? ` | ${UI.label('gender', patient.gender)}` : ''}
                            ${patient.email ? ` | ${UI.escapeHtml(patient.email)}` : ''}
                        </p>
                        <div class="patient-card__stats">
                            ${latestMetrics ? `
                                <span class="patient-card__stat">
                                    <strong>${UI.formatDecimal(latestMetrics.weight, 1) || '-'}</strong> kg
                                </span>
                                <span class="patient-card__stat">
                                    <strong>${UI.formatDecimal(bmi)}</strong> IMC
                                </span>
                            ` : '<span class="patient-card__stat text-muted">Sin mediciones</span>'}
                            ${activePlan ? `
                                <span class="patient-card__stat patient-card__stat--active">
                                    Plan activo
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    <div class="patient-card__actions">
                        <button class="btn btn--secondary btn--sm btn-edit" data-id="${patient.id}">Editar</button>
                        <button class="btn btn--danger btn--sm btn-delete" data-id="${patient.id}">Desactivar</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Deactivate in the server (nothing is deleted; the patient can be reactivated)
     */
    function showDeleteConfirmation(id) {
        const patient = State.getPatient(id);
        if (!patient) return;

        UI.confirmDanger(
            `¿Desactivar a ${patient.firstName} ${patient.lastName}? Deja de aparecer en la lista, pero su historia queda guardada y se puede reactivar.`,
            async () => {
                await State.deletePatient(id);
                UI.toastSuccess('Paciente desactivado');
                if (PatientProfile.getCurrentId() === id) PatientProfile.close();
            }
        );
    }

    /**
     * Export patient data
     */
    function exportPatient(id) {
        const data = State.exportPatientData(id);
        if (!data) {
            UI.toastError('Paciente no encontrado');
            return;
        }

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `paciente_${data.patient.firstName}_${data.patient.lastName}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        UI.toastSuccess('Datos del paciente exportados');
    }

    return { init, exportPatient };
})();

document.addEventListener('DOMContentLoaded', () => Patients.init());
