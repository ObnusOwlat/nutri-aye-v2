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
            footerSpaceBetween: true,
            onOpen: bindPhysicalActivityToggle
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
            footerSpaceBetween: true,
            onOpen: bindPhysicalActivityToggle
        });
    }

    /**
     * Bind physical activity toggle event
     */
    function bindPhysicalActivityToggle() {
        const select = document.getElementById('patient-physically-active');
        const details = document.getElementById('physical-activity-details');
        
        if (select && details) {
            select.addEventListener('change', () => {
                details.classList.toggle('hidden', select.value !== 'yes');
            });
        }
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
                    <h4 class="patient-form__section-title">Actividad Física</h4>
                    <div class="form-group">
                        <label class="form-label" for="patient-physically-active">¿Realiza actividad física?</label>
                        <select id="patient-physically-active" class="form-select">
                            <option value="no" ${!patient.physicalActivity?.active || patient.physicalActivity?.active === 'no' ? 'selected' : ''}>No</option>
                            <option value="yes" ${patient.physicalActivity?.active === true || patient.physicalActivity?.active === 'yes' ? 'selected' : ''}>Sí</option>
                        </select>
                    </div>
                    <div id="physical-activity-details" class="${patient.physicalActivity?.active ? '' : 'hidden'}">
                        <div class="patient-form__row">
                            <div class="form-group">
                                <label class="form-label" for="patient-activity-level">Nivel de actividad</label>
                                <select id="patient-activity-level" class="form-select">
                                    <option value="">Seleccionar...</option>
                                    <option value="sedentary" ${patient.physicalActivity?.level === 'sedentary' ? 'selected' : ''}>Sedentario</option>
                                    <option value="light" ${patient.physicalActivity?.level === 'light' ? 'selected' : ''}>Ligera</option>
                                    <option value="moderate" ${patient.physicalActivity?.level === 'moderate' ? 'selected' : ''}>Moderada</option>
                                    <option value="active" ${patient.physicalActivity?.level === 'active' ? 'selected' : ''}>Activa</option>
                                    <option value="very_active" ${patient.physicalActivity?.level === 'very_active' ? 'selected' : ''}>Muy Activa</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="patient-activity-frequency">Frecuencia (días/semana)</label>
                                <input type="number" id="patient-activity-frequency" class="form-input" 
                                       value="${patient.physicalActivity?.frequency || ''}" min="1" max="7" placeholder="e.g., 4">
                            </div>
                        </div>
                        <div class="patient-form__row">
                            <div class="form-group">
                                <label class="form-label" for="patient-activity-duration">Duración (minutos/sesión)</label>
                                <input type="number" id="patient-activity-duration" class="form-input" 
                                       value="${patient.physicalActivity?.duration || ''}" min="1" max="300" placeholder="e.g., 45">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="patient-activity-calories">Calorías quemadas/semana (est.)</label>
                                <input type="number" id="patient-activity-calories" class="form-input" 
                                       value="${patient.physicalActivity?.caloriesBurned || ''}" min="0" max="20000" placeholder="e.g., 1500">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="patient-activity-types">Tipos de ejercicio</label>
                            <input type="text" id="patient-activity-types" class="form-input" 
                                   value="${patient.physicalActivity?.types || ''}" 
                                   placeholder="Ej: Cardio, Pesas, Natación, Yoga">
                        </div>
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
     * Handle save patient - now syncs to backend first, then updates local state
     */
    async function handleSavePatient(existingId) {
        // Generate ID for new patients if not editing existing
        const patientId = existingId || State.generateId();
        
        const data = {
            id: patientId,
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
            physicalActivity: {
                active: document.getElementById('patient-physically-active')?.value === 'yes',
                level: document.getElementById('patient-activity-level')?.value || null,
                frequency: parseInt(document.getElementById('patient-activity-frequency')?.value) || null,
                duration: parseInt(document.getElementById('patient-activity-duration')?.value) || null,
                caloriesBurned: parseInt(document.getElementById('patient-activity-calories')?.value) || null,
                types: document.getElementById('patient-activity-types')?.value.trim() || null
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
            // FIRST: Send to API (backend database)
            let apiResponse;
            const apiUrl = existingId ? `/api/patients/${existingId}` : '/api/patients';
            const apiMethod = existingId ? 'PUT' : 'POST';
            
            const response = await fetch(apiUrl, {
                method: apiMethod,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            apiResponse = await response.json();
            
            if (!apiResponse.success) {
                UI.toastError(apiResponse.error || 'Failed to save patient to database');
                return false;
            }

            // API SUCCESS: Now update local State with the data from the server
            // This ensures we have the correct ID and any server-side processing
            if (existingId) {
                State.updatePatient(existingId, apiResponse.data);
                UI.toastSuccess('Patient updated');
            } else {
                // New patient - add to state with data from API response
                // The API returns the created patient with real ID
                State.addPatient(apiResponse.data);
                UI.toastSuccess('Patient added');
            }
            
            return true;
        } catch (error) {
            console.error('Error saving patient:', error);
            UI.toastError('Error connecting to server: ' + error.message);
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
        if (!patient) {
            console.warn('Patient not found in State, fetching from API...');
            // Fetch from API and add to state
            fetch(`/api/patients/${id}`)
                .then(res => res.json())
                .then(response => {
                    if (response.success && response.data) {
                        // Add to state using updatePatient (which handles existing patients)
                        // First check if it exists
                        const exists = State.getPatient(id);
                        if (!exists) {
                            // Need to add - use the raw data
                            const p = response.data;
                            State.addPatient({
                                firstName: p.firstName,
                                lastName: p.lastName,
                                email: p.email,
                                phone: p.phone,
                                dateOfBirth: p.dateOfBirth,
                                gender: p.gender,
                                address: p.address,
                                emergencyContact: p.emergencyContact,
                                notes: p.notes
                            });
                        }
                        // Now open with the ID
                        doOpenPatientProfile(id);
                    } else {
                        console.error('Patient not found in database:', id);
                        UI.toastError('This patient no longer exists');
                    }
                })
                .catch(err => {
                    console.error('Error loading patient:', err);
                    UI.toastError('Error loading patient');
                });
            return;
        }

        doOpenPatientProfile(id);
    }

    function doOpenPatientProfile(id) {
        currentPatientId = id;

        // Hide list, show profile
        document.getElementById('patients-list-container')?.classList.add('hidden');
        patientProfile?.classList.remove('hidden');

        // Get patient from State
        const patient = State.getPatient(id);
        if (!patient) return;

        // Render profile header
        renderProfileHeader(patient);

        // Load first tab
        switchPatientTab('overview');

        // Fetch fresh patient data from API to get billingClientId
        fetch(`/api/patients/${id}`)
            .then(res => res.json())
            .then(response => {
                if (response.success && response.data) {
                    const freshData = response.data;
                    // Update with fresh data from API (includes billingClientId)
                    State.updatePatient(id, {
                        ...patient,
                        ...freshData,
                        billingClientId: freshData.billingClientId
                    });
                }
            })
            .catch(err => console.error('Error fetching patient:', err));
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
                <button class="btn btn--secondary" data-action="edit-patient" data-patient-id="${patient.id}">Edit Patient</button>
                <button class="btn btn--secondary" data-action="export-patient" data-patient-id="${patient.id}">Export</button>
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
            case 'dashboard':
                if (typeof PatientDashboard !== 'undefined') PatientDashboard.render(currentPatientId);
                break;
            case 'billing':
                loadBillingTab(currentPatientId);
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
     * Load billing tab content
     */
    async function loadBillingTab(patientId) {
        // Use the currentPatientId if patientId is not provided
        if (!patientId) {
            patientId = currentPatientId;
        }
        
        // Final fallback: try to get patient ID from State
        if (!patientId && currentPatientId) {
            patientId = currentPatientId;
        }
        
        if (!patientId) {
            // Try to find any patient from State as last resort
            const patients = State.getPatients();
            if (patients && patients.length > 0) {
                patientId = patients[0].id;
            }
        }
        
        if (!patientId) {
            console.error('No patient ID found');
            const billingContent = document.querySelector('[data-tab="billing"]');
            if (billingContent) {
                billingContent.innerHTML = '<div class="empty-state"><p>No patient selected</p></div>';
            }
            return;
        }

        // Find the billing content element
        let content = document.querySelector('.patient-tab-content[data-tab="billing"]');
        if (!content) {
            content = document.getElementById('patient-profile')?.querySelector('[data-tab="billing"]');
        }
        
        if (!content) {
            console.error('Could not find billing content element');
            return;
        }

        // Show loading
        content.innerHTML = '<div class="patient-billing"><div class="loading">Loading...</div></div>';

        // Fetch patient from API to get billingClientId
        try {
            const res = await fetch(`/api/patients/${patientId}`);
            
            if (!res.ok) {
                content.innerHTML = `<div class="empty-state"><p>Error: HTTP ${res.status}</p></div>`;
                return;
            }
            
            const response = await res.json();
            
            if (!response.success) {
                content.innerHTML = `<div class="empty-state"><p>Error: ${response.error || 'Failed'}</p></div>`;
                return;
            }
            
            var patient = response.data;
            console.log('Got patient:', patient?.firstName, patient?.lastName, 'billingClientId:', patient?.billingClientId);
        } catch (err) {
            content.innerHTML = `<div class="empty-state"><p>Error: ${err.message}</p></div>`;
            return;
        }

        const billingClientId = patient?.billingClientId;

        if (!billingClientId) {
            // Not linked yet - show link button
            content.innerHTML = `
                <div class="patient-billing">
                    <div class="patient-billing__not-linked">
                        <div class="empty-state">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            <h3>Not Linked to Billing</h3>
                            <p>This patient is not yet linked to the billing system. Link them to create invoices and track payments.</p>
                            <button class="btn btn-primary" data-action="sync-billing" data-patient-id="${patientId}">
                                Link to Billing & Create Client
                            </button>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        // Show billing info - fetch from API
        content.innerHTML = `
            <div class="patient-billing">
                <div class="patient-billing__loading">
                    <div class="loading">Loading billing information...</div>
                </div>
            </div>
        `;

        // Fetch billing data
        fetch(`/api/patients/${patientId}/billing`)
            .then(res => res.json())
            .then(response => {
                if (!response.success) {
                    content.innerHTML = `<div class="empty-state"><p>Error loading billing: ${response.error}</p></div>`;
                    return;
                }

                const { client, invoices, quotes, linked } = response.data;

                if (!linked) {
                    content.innerHTML = `
                        <div class="patient-billing__not-linked">
                            <div class="empty-state">
                                <p>Patient not linked to billing.</p>
                                <button class="btn btn-primary" data-action="sync-billing" data-patient-id="${patientId}">
                                    Link to Billing
                                </button>
                            </div>
                        </div>
                    `;
                    return;
                }

                // Calculate totals
                const totalRevenue = invoices.filter(i => i.status === 'PAID').reduce((sum, i) => sum + i.total, 0);
                const pendingAmount = invoices.filter(i => i.status === 'UNPAID').reduce((sum, i) => sum + i.total, 0);

                content.innerHTML = `
                    <div class="patient-billing">
                        <div class="patient-billing__header">
                            <div class="patient-billing__client">
                                <h4>Billing Client</h4>
                                <p><strong>${UI.escapeHtml(client?.name || 'Unknown')}</strong></p>
                                <p>${UI.escapeHtml(client?.email || '')}</p>
                                <p>${UI.escapeHtml(client?.phone || '')}</p>
                                <span class="badge badge-paid">Linked</span>
                            </div>
                            <div class="patient-billing__stats">
                                <div class="stat-card">
                                    <h5>Total Revenue</h5>
                                    <div class="stat-value money">$${totalRevenue.toFixed(2)}</div>
                                </div>
                                <div class="stat-card">
                                    <h5>Pending</h5>
                                    <div class="stat-value warning">$${pendingAmount.toFixed(2)}</div>
                                </div>
                                <div class="stat-card">
                                    <h5>Invoices</h5>
                                    <div class="stat-value">${invoices.length}</div>
                                </div>
                                <div class="stat-card">
                                    <h5>Quotes</h5>
                                    <div class="stat-value">${quotes.length}</div>
                                </div>
                            </div>
                        </div>

                        <div class="patient-billing__actions">
                            <button class="btn btn-primary" data-action="create-invoice" data-patient-id="${patientId}">
                                + Create Invoice
                            </button>
                            <button class="btn btn-secondary" data-action="open-billing">
                                Open Billing System
                            </button>
                        </div>

                        ${invoices.length > 0 ? `
                            <div class="patient-billing__section">
                                <h4>Recent Invoices</h4>
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Invoice #</th>
                                            <th>Date</th>
                                            <th>Total</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${invoices.slice(0, 5).map(inv => `
                                            <tr>
                                                <td>${inv.invoice_number}</td>
                                                <td>${new Date(inv.date).toLocaleDateString()}</td>
                                                <td>$${inv.total.toFixed(2)}</td>
                                                <td><span class="badge badge-${inv.status.toLowerCase()}">${inv.status}</span></td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : ''}

                        ${quotes.length > 0 ? `
                            <div class="patient-billing__section">
                                <h4>Active Quotes</h4>
                                <table class="data-table">
                                    <thead>
                                        <tr>
                                            <th>Quote #</th>
                                            <th>Valid Until</th>
                                            <th>Total</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        ${quotes.slice(0, 5).map(q => `
                                            <tr>
                                                <td>${q.quote_number}</td>
                                                <td>${new Date(q.valid_until).toLocaleDateString()}</td>
                                                <td>$${q.total.toFixed(2)}</td>
                                                <td><span class="badge badge-${q.status.toLowerCase()}">${q.status}</span></td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                        ` : ''}
                    </div>
                `;
            })
            .catch(err => {
                console.error('Error loading billing:', err);
                content.innerHTML = `<div class="empty-state"><p>Error connecting to billing system</p></div>`;
            });
    }

    /**
     * Sync patient to billing
     */
    async function syncPatientToBilling(patientId) {
        try {
            // Show loading state in the button
            const btn = event.target;
            const originalText = btn.textContent;
            btn.disabled = true;
            btn.textContent = 'Linking...';
            
            const response = await fetch(`/api/patients/${patientId}/sync-to-billing`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            
            const result = await response.json();
            
            if (!result.success) {
                UI.toastError(result.error || 'Failed to sync to billing');
                btn.disabled = false;
                btn.textContent = originalText;
                return;
            }

            UI.toastSuccess(result.alreadyLinked ? 'Patient already linked to billing' : 'Patient linked to billing successfully!');
            
            // Refresh the billing tab
            loadBillingTab(patientId);
            
        } catch (error) {
            console.error('Sync error:', error);
            UI.toastError('Error connecting to billing system');
        }
    }

    /**
     * Create invoice from patient
     */
    async function createInvoiceFromPatient(patientId) {
        try {
            // Fetch patient from API to get billingClientId
            const res = await fetch(`/api/patients/${patientId}`);
            const response = await res.json();
            
            if (!response.success || !response.data.billingClientId) {
                UI.toastError('Patient not linked to billing. Please link first.');
                return;
            }

            // Open billing in new tab with client selected
            window.open(`/billing?clientId=${response.data.billingClientId}`, '_blank');
        } catch (err) {
            console.error('Error creating invoice:', err);
            UI.toastError('Error connecting to billing system');
        }
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
        exportPatient,
        syncPatientToBilling,
        createInvoiceFromPatient
    };
})();

document.addEventListener('DOMContentLoaded', () => Patients.init());
