/**
 * patient-profile.js - Patient profile: header, tabs and overview
 */

const PatientProfile = (function() {
    let currentPatientId = null;
    let patientProfile = null;

    function init() {
        patientProfile = document.getElementById('patient-profile');
        document.getElementById('btn-back-to-list')?.addEventListener('click', close);

        patientProfile?.querySelectorAll('.patient-tabs__tab').forEach(tab => {
            tab.addEventListener('click', (e) => switchTab(e.target.dataset.tab));
        });

        // Header buttons (Edit, Export)
        patientProfile?.addEventListener('click', (e) => {
            const button = e.target.closest('[data-action]');
            if (!button) return;
            if (button.dataset.action === 'edit-patient') PatientForm.showEditModal(button.dataset.patientId);
            if (button.dataset.action === 'export-patient') Patients.exportPatient(button.dataset.patientId);
        });

        // Keep the open profile up to date after an edit
        State.subscribe('patients:updated', () => {
            const patient = currentPatientId && State.getPatient(currentPatientId);
            if (patient) renderProfileHeader(patient);
        });
    }

    /**
     * Open a profile; patients missing in this browser are fetched from the server
     */
    async function open(id) {
        if (!State.getPatient(id)) {
            try {
                const response = await (await fetch(`/api/patients/${id}`)).json();
                if (!response.success) {
                    UI.toastError('This patient no longer exists');
                    return;
                }
                // Keep the server id: a new local id would open an empty profile
                State.addPatient({ ...response.data, id });
            } catch (err) {
                console.error('Error loading patient:', err);
                UI.toastError('Error loading patient');
                return;
            }
        }
        show(id);
    }

    function show(id) {
        const patient = State.getPatient(id);
        if (!patient) return;
        currentPatientId = id;

        document.getElementById('patients-list-container')?.classList.add('hidden');
        patientProfile?.classList.remove('hidden');
        renderProfileHeader(patient);
        switchTab('overview');

        // Fresh server data (billing link, edits made on another computer)
        fetch(`/api/patients/${id}`)
            .then(res => res.json())
            .then(response => {
                if (response.success) State.updatePatient(id, { ...State.getPatient(id), ...response.data });
            })
            .catch(err => console.error('Error fetching patient:', err));
    }

    function close() {
        currentPatientId = null;
        patientProfile?.classList.add('hidden');
        document.getElementById('patients-list-container')?.classList.remove('hidden');
    }

    const getCurrentId = () => currentPatientId;

    /**
     * Render profile header
     */
    function renderProfileHeader(patient) {
        const header = patientProfile?.querySelector('.patient-profile__header');
        if (!header) return;

        const latestMetrics = State.getLatestMetrics(patient.id);
        const age = State.calculateAge(patient.dateOfBirth);
        const bmi = latestMetrics?.bmi;
        const bmiCategory = latestMetrics?.bmiCategory;

        header.innerHTML = `
            <div class="patient-profile__avatar">
                ${patient.firstName?.[0] || '?'}${patient.lastName?.[0] || ''}
            </div>
            <div class="patient-profile__info">
                <h2 class="patient-profile__name">${UI.escapeHtml(patient.firstName)} ${UI.escapeHtml(patient.lastName)}</h2>
                <p class="patient-profile__meta">
                    ${age ? `${age} years old` : ''}
                    ${patient.gender ? `• ${UI.capitalize(patient.gender)}` : ''}
                    ${patient.email ? `• ${UI.escapeHtml(patient.email)}` : ''}
                    ${patient.phone ? `• ${UI.escapeHtml(patient.phone)}` : ''}
                </p>
                <div class="patient-profile__stats">
                    ${latestMetrics ? `
                        <div class="patient-profile__stat">
                            <span class="patient-profile__stat-value">${latestMetrics.weight?.toFixed(1) || '-'}</span>
                            <span class="patient-profile__stat-label">Weight (kg)</span>
                        </div>
                        <div class="patient-profile__stat">
                            <span class="patient-profile__stat-value">${bmi?.toFixed(1) || '-'}</span>
                            <span class="patient-profile__stat-label">BMI (${bmiCategory ? UI.capitalize(bmiCategory) : '-'})</span>
                        </div>
                        ${latestMetrics.height ? `
                            <div class="patient-profile__stat">
                                <span class="patient-profile__stat-value">${latestMetrics.height}</span>
                                <span class="patient-profile__stat-label">Height (cm)</span>
                            </div>
                        ` : ''}
                    ` : `
                        <p class="text-muted">No metrics recorded yet</p>
                    `}
                </div>
            </div>
            <div class="patient-profile__actions">
                <button class="btn btn--secondary" data-action="edit-patient" data-patient-id="${patient.id}">Edit Patient</button>
                <button class="btn btn--secondary" data-action="export-patient" data-patient-id="${patient.id}">Export</button>
            </div>
        `;
    }

    function switchTab(tabName) {
        if (!currentPatientId) return;

        patientProfile?.querySelectorAll('.patient-tabs__tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        patientProfile?.querySelectorAll('.patient-tab-content').forEach(content => {
            content.classList.toggle('active', content.dataset.tab === tabName);
        });

        const renderers = {
            overview: () => loadOverviewTab(State.getPatient(currentPatientId)),
            metrics: () => Metrics.render(currentPatientId),
            conditions: () => Conditions.render(currentPatientId),
            plans: () => PatientPlan.render(currentPatientId),
            progress: () => Progress.render(currentPatientId),
            billing: () => PatientBilling.render(currentPatientId, patientProfile.querySelector('.patient-tab-content[data-tab="billing"]')),
            history: () => PatientHistory.render(currentPatientId, patientProfile.querySelector('.patient-tab-content[data-tab="history"]'))
        };
        renderers[tabName]?.();
    }

    /**
     * Load overview tab content
     */
    function loadOverviewTab(patient) {
        const content = patientProfile?.querySelector('[data-tab="overview"]');
        if (!content) return;

        const latestMetrics = State.getLatestMetrics(patient.id);
        const conditions = State.getPatientConditions(patient.id);
        const activePlan = State.getActivePlan(patient.id);
        const allergies = State.getAllergies(patient.id);

        content.innerHTML = `
            <div class="patient-overview">
                <div class="patient-overview__section">
                    <h4>Contact Information</h4>
                    <dl class="patient-info-list">
                        ${patient.email ? `<dt>Email:</dt><dd>${UI.escapeHtml(patient.email)}</dd>` : ''}
                        ${patient.phone ? `<dt>Phone:</dt><dd>${UI.escapeHtml(patient.phone)}</dd>` : ''}
                        ${patient.address?.city ? `<dt>Location:</dt><dd>${UI.escapeHtml(patient.address.city)}</dd>` : ''}
                    </dl>
                </div>

                ${allergies.length > 0 ? `
                    <div class="patient-overview__section patient-overview__section--warning">
                        <h4>Allergies & Intolerances</h4>
                        <ul class="patient-allergies">
                            ${allergies.map(a => `
                                <li class="severity-${a.severity}">
                                    <strong>${UI.escapeHtml(a.name)}</strong>
                                    ${a.dietaryNotes ? `- ${UI.escapeHtml(a.dietaryNotes)}` : ''}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}

                ${conditions.filter(c => c.type === 'condition').length > 0 ? `
                    <div class="patient-overview__section">
                        <h4>Medical Conditions</h4>
                        <ul class="patient-conditions">
                            ${conditions.filter(c => c.type === 'condition').map(c => `
                                <li>
                                    <strong>${UI.escapeHtml(c.name)}</strong>
                                    <span class="severity-${c.severity}">${UI.capitalize(c.severity)}</span>
                                    ${c.dietaryNotes ? `<br><small>${UI.escapeHtml(c.dietaryNotes)}</small>` : ''}
                                </li>
                            `).join('')}
                        </ul>
                    </div>
                ` : ''}

                ${activePlan ? `
                    <div class="patient-overview__section patient-overview__section--success">
                        <h4>Active Meal Plan</h4>
                        <p><strong>${UI.escapeHtml(activePlan.name)}</strong></p>
                        <p>Goal: ${UI.capitalize(activePlan.dietGoal)} • Target: ${activePlan.dailyTarget} kcal/day</p>
                        <p>Started: ${activePlan.startDate}</p>
                    </div>
                ` : `
                    <div class="patient-overview__section">
                        <h4>Meal Plan</h4>
                        <p class="text-muted">No active meal plan. Go to "Plans" tab to create one.</p>
                    </div>
                `}

                ${patient.notes ? `
                    <div class="patient-overview__section">
                        <h4>Notes</h4>
                        <p>${UI.escapeHtml(patient.notes)}</p>
                    </div>
                ` : ''}
            </div>
        `;
    }

    return { init, open, close, getCurrentId };
})();
