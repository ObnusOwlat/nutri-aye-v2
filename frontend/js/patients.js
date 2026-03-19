/**
 * patients.js - Patient Management
 * 
 * Handles patient CRUD operations, list view,
 * and patient profile navigation.
 */

const Patients = (function() {
    // DOM Elements
    let patientsList, searchInput;
    let currentPatientId = null;
    let patientProfile = null;

    // Search debounce
    let searchTimer = null;

    /**
     * Initialize patients module
     */
    function init() {
        cacheElements();
        bindEvents();
        subscribeToState();
        renderPatientsList();

        console.log('[Patients] Initialized');
    }

    /**
     * Cache DOM elements
     */
    function cacheElements() {
        patientsList = document.getElementById('patients-list');
        searchInput = document.getElementById('patient-search');
        patientProfile = document.getElementById('patient-profile');
    }

    /**
     * Bind events
     */
    function bindEvents() {
        // Add patient button
        document.getElementById('btn-add-patient')?.addEventListener('click', showAddModal);

        // Search
        searchInput?.addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                renderPatientsList(e.target.value);
            }, 300);
        });

        // Patient list click (delegation)
        patientsList?.addEventListener('click', handleListClick);

        // Back to list button
        document.getElementById('btn-back-to-list')?.addEventListener('click', closePatientProfile);

        // Patient tabs
        patientProfile?.querySelectorAll('.patient-tabs__tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                switchPatientTab(e.target.dataset.tab);
            });
        });
    }

    /**
     * Subscribe to state changes
     */
    function subscribeToState() {
        State.subscribe('patients:updated', renderPatientsList);
    }

    /**
     * Handle patient list clicks
     */
    function handleListClick(e) {
        const card = e.target.closest('.patient-card');
        if (!card) return;

        const id = card.dataset.id;

        if (e.target.closest('.btn-edit')) {
            showEditModal(id);
        } else if (e.target.closest('.btn-delete')) {
            showDeleteConfirmation(id);
        } else {
            openPatientProfile(id);
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
                    <p class="empty-state__text">${searchQuery ? 'No patients match your search' : 'No patients yet'}</p>
                    <p class="empty-state__hint">${searchQuery ? 'Try a different search term' : 'Add your first patient to get started'}</p>
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
                            ${age ? `${age} years` : ''}
                            ${patient.gender ? ` | ${UI.capitalize(patient.gender)}` : ''}
                            ${patient.email ? ` | ${UI.escapeHtml(patient.email)}` : ''}
                        </p>
                        <div class="patient-card__stats">
                            ${latestMetrics ? `
                                <span class="patient-card__stat">
                                    <strong>${latestMetrics.weight?.toFixed(1) || '-'}</strong> kg
                                </span>
                                <span class="patient-card__stat">
                                    <strong>${bmi?.toFixed(1) || '-'}</strong> BMI
                                </span>
                            ` : '<span class="patient-card__stat text-muted">No metrics</span>'}
                            ${activePlan ? `
                                <span class="patient-card__stat patient-card__stat--active">
                                    Active Plan
                                </span>
                            ` : ''}
                        </div>
                    </div>
                    <div class="patient-card__actions">
                        <button class="btn btn--secondary btn--sm btn-edit" data-id="${patient.id}">Edit</button>
                        <button class="btn btn--danger btn--sm btn-delete" data-id="${patient.id}">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    /**
     * Show add patient modal
     */
    function showAddModal() {
        const formHtml = createPatientFormHtml();

        UI.openModal({
            title: 'Add New Patient',
            content: formHtml,
            confirmText: 'Add Patient',
            size: 'large',
            onConfirm: handleSavePatient,
            footerSpaceBetween: true
        });
    }

    /**
     * Show edit patient modal
     */
    function showEditModal(id) {
        const patient = State.getPatient(id);
        if (!patient) return;

        const formHtml = createPatientFormHtml(patient);

        UI.openModal({
            title: 'Edit Patient',
            content: formHtml,
            confirmText: 'Save Changes',
            size: 'large',
            onConfirm: () => handleSavePatient(id),
            footerSpaceBetween: true
        });
    }

    /**
     * Create patient form HTML string
     */
    function createPatientFormHtml(patient = {}) {
        return `
            <div class="patient-form">
                <div class="patient-form__section">
                    <h4 class="patient-form__section-title">Basic Information</h4>
                    <div class="patient-form__row">
                        <div class="form-group">
                            <label class="form-label" for="patient-firstName">First Name *</label>
                            <input type="text" id="patient-firstName" class="form-input" 
                                   value="${patient.firstName ? UI.escapeHtml(patient.firstName) : ''}" 
                                   placeholder="John" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="patient-lastName">Last Name *</label>
                            <input type="text" id="patient-lastName" class="form-input" 
                                   value="${patient.lastName ? UI.escapeHtml(patient.lastName) : ''}" 
                                   placeholder="Doe" required>
                        </div>
                    </div>
                    <div class="patient-form__row">
                        <div class="form-group">
                            <label class="form-label" for="patient-email">Email</label>
                            <input type="email" id="patient-email" class="form-input" 
                                   value="${patient.email || ''}" 
                                   placeholder="john@example.com">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="patient-phone">Phone</label>
                            <input type="tel" id="patient-phone" class="form-input" 
                                   value="${patient.phone || ''}" 
                                   placeholder="+1234567890">
                        </div>
                    </div>
                    <div class="patient-form__row">
                        <div class="form-group">
                            <label class="form-label" for="patient-dob">Date of Birth</label>
                            <input type="date" id="patient-dob" class="form-input" 
                                   value="${patient.dateOfBirth || ''}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="patient-gender">Gender</label>
                            <select id="patient-gender" class="form-select">
                                <option value="">Select...</option>
                                ${State.GENDERS.map(g => 
                                    `<option value="${g}" ${patient.gender === g ? 'selected' : ''}>${UI.capitalize(g)}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                </div>

                <div class="patient-form__section">
                    <h4 class="patient-form__section-title">Address</h4>
                    <div class="form-group">
                        <label class="form-label" for="patient-street">Street Address</label>
                        <input type="text" id="patient-street" class="form-input" 
                               value="${patient.address?.street || ''}" 
                               placeholder="123 Main St">
                    </div>
                    <div class="patient-form__row">
                        <div class="form-group">
                            <label class="form-label" for="patient-city">City</label>
                            <input type="text" id="patient-city" class="form-input" 
                                   value="${patient.address?.city || ''}" 
                                   placeholder="New York">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="patient-zip">ZIP Code</label>
                            <input type="text" id="patient-zip" class="form-input" 
                                   value="${patient.address?.zipCode || ''}" 
                                   placeholder="10001">
                        </div>
                    </div>
                </div>

                <div class="patient-form__section">
                    <h4 class="patient-form__section-title">Emergency Contact</h4>
                    <div class="patient-form__row">
                        <div class="form-group">
                            <label class="form-label" for="patient-ec-name">Contact Name</label>
                            <input type="text" id="patient-ec-name" class="form-input" 
                                   value="${patient.emergencyContact?.name || ''}" 
                                   placeholder="Jane Doe">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="patient-ec-phone">Contact Phone</label>
                            <input type="tel" id="patient-ec-phone" class="form-input" 
                                   value="${patient.emergencyContact?.phone || ''}" 
                                   placeholder="+1234567890">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="patient-ec-relation">Relationship</label>
                        <input type="text" id="patient-ec-relation" class="form-input" 
                               value="${patient.emergencyContact?.relation || ''}" 
                               placeholder="Spouse, Parent, etc.">
                    </div>
                </div>

                <div class="patient-form__section">
                    <h4 class="patient-form__section-title">Notes</h4>
                    <div class="form-group">
                        <label class="form-label" for="patient-notes">General Notes</label>
                        <textarea id="patient-notes" class="form-input" rows="3" 
                                  placeholder="Any additional notes about this patient...">${patient.notes || ''}</textarea>
                    </div>
                </div>

                <div class="patient-form__section">
                    <h4 class="patient-form__section-title">Status</h4>
                    <div class="form-group">
                        <label class="form-label" for="patient-status">Patient Status</label>
                        <select id="patient-status" class="form-select">
                            <option value="active" ${patient.status === 'active' || !patient.status ? 'selected' : ''}>Active</option>
                            <option value="inactive" ${patient.status === 'inactive' ? 'selected' : ''}>Inactive</option>
                            <option value="archived" ${patient.status === 'archived' ? 'selected' : ''}>Archived</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Handle save patient
     */
    function handleSavePatient(existingId) {
        const data = {
            firstName: document.getElementById('patient-firstName')?.value.trim(),
            lastName: document.getElementById('patient-lastName')?.value.trim(),
            email: document.getElementById('patient-email')?.value.trim(),
            phone: document.getElementById('patient-phone')?.value.trim(),
            dateOfBirth: document.getElementById('patient-dob')?.value || null,
            gender: document.getElementById('patient-gender')?.value || null,
            address: {
                street: document.getElementById('patient-street')?.value.trim(),
                city: document.getElementById('patient-city')?.value.trim(),
                zipCode: document.getElementById('patient-zip')?.value.trim()
            },
            emergencyContact: {
                name: document.getElementById('patient-ec-name')?.value.trim(),
                phone: document.getElementById('patient-ec-phone')?.value.trim(),
                relation: document.getElementById('patient-ec-relation')?.value.trim()
            },
            notes: document.getElementById('patient-notes')?.value.trim(),
            status: document.getElementById('patient-status')?.value || 'active'
        };

        if (!data.firstName) {
            UI.toastError('First name is required');
            return false;
        }
        if (!data.lastName) {
            UI.toastError('Last name is required');
            return false;
        }

        try {
            if (existingId) {
                State.updatePatient(existingId, data);
                UI.toastSuccess('Patient updated');
            } else {
                State.addPatient(data);
                UI.toastSuccess('Patient added');
            }
            return true;
        } catch (error) {
            UI.toastError(error.message);
            return false;
        }
    }

    /**
     * Show delete confirmation
     */
    function showDeleteConfirmation(id) {
        const patient = State.getPatient(id);
        if (!patient) return;

        UI.confirmDanger(
            `Delete patient "${patient.firstName} ${patient.lastName}"? This will also delete all their metrics, conditions, plans, and progress data.`,
            () => {
                State.deletePatient(id);
                UI.toastSuccess('Patient deleted');
                if (currentPatientId === id) closePatientProfile();
            }
        );
    }

    // ==========================================
    // PATIENT PROFILE
    // ==========================================

    /**
     * Open patient profile
     */
    function openPatientProfile(id) {
        const patient = State.getPatient(id);
        if (!patient) return;

        currentPatientId = id;

        // Hide list, show profile
        document.getElementById('patients-list-container')?.classList.add('hidden');
        patientProfile?.classList.remove('hidden');

        // Render profile header
        renderProfileHeader(patient);

        // Load first tab
        switchPatientTab('overview');
    }

    /**
     * Close patient profile and return to list
     */
    function closePatientProfile() {
        currentPatientId = null;
        patientProfile?.classList.add('hidden');
        document.getElementById('patients-list-container')?.classList.remove('hidden');
    }

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
                <button class="btn btn--secondary" onclick="Patients.showEditModal('${patient.id}')">Edit Patient</button>
                <button class="btn btn--secondary" onclick="Patients.exportPatient('${patient.id}')">Export</button>
            </div>
        `;
    }

    /**
     * Switch between profile tabs
     */
    function switchPatientTab(tabName) {
        if (!currentPatientId) return;

        // Update tab buttons
        patientProfile?.querySelectorAll('.patient-tabs__tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });

        // Update tab content
        patientProfile?.querySelectorAll('.patient-tab-content').forEach(content => {
            content.classList.toggle('active', content.dataset.tab === tabName);
        });

        // Load tab content
        const patient = State.getPatient(currentPatientId);
        switch (tabName) {
            case 'overview':
                loadOverviewTab(patient);
                break;
            case 'metrics':
                if (typeof Metrics !== 'undefined') Metrics.render(currentPatientId);
                break;
            case 'conditions':
                if (typeof Conditions !== 'undefined') Conditions.render(currentPatientId);
                break;
            case 'plans':
                if (typeof PatientPlan !== 'undefined') PatientPlan.render(currentPatientId);
                break;
            case 'progress':
                if (typeof Progress !== 'undefined') Progress.render(currentPatientId);
                break;
        }
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

    /**
     * Export patient data
     */
    function exportPatient(id) {
        const data = State.exportPatientData(id);
        if (!data) {
            UI.toastError('Patient not found');
            return;
        }

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `patient_${data.patient.firstName}_${data.patient.lastName}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        UI.toastSuccess('Patient data exported');
    }

    return {
        init,
        showAddModal,
        showEditModal,
        openPatientProfile,
        closePatientProfile,
        exportPatient
    };
})();

document.addEventListener('DOMContentLoaded', () => Patients.init());
