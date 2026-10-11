/**
 * patient-form.js - Add/edit patient modal; saves to the server first,
 * then updates the browser state
 */

const PatientForm = (function() {
    function showAddModal() {
        UI.openModal({
            title: 'Add New Patient',
            content: createPatientFormHtml(),
            confirmText: 'Add Patient',
            size: 'large',
            onConfirm: () => handleSavePatient(null),
            footerSpaceBetween: true
        });
    }

    function showEditModal(id) {
        const patient = State.getPatient(id);
        if (!patient) return;

        UI.openModal({
            title: 'Edit Patient',
            content: createPatientFormHtml(patient),
            confirmText: 'Save Changes',
            size: 'large',
            onConfirm: () => handleSavePatient(id),
            footerSpaceBetween: true
        });
    }

    // Delegated once: works even if the user answers before the modal finishes opening
    document.addEventListener('change', (e) => {
        if (e.target.id !== 'patient-physically-active') return;
        document.getElementById('physical-activity-details')?.classList.toggle('hidden', e.target.value !== 'yes');
    });

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
                                   value="${UI.escapeHtml(patient.firstName || '')}" 
                                   placeholder="John" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="patient-lastName">Last Name *</label>
                            <input type="text" id="patient-lastName" class="form-input" 
                                   value="${UI.escapeHtml(patient.lastName || '')}" 
                                   placeholder="Doe" required>
                        </div>
                    </div>
                    <div class="patient-form__row">
                        <div class="form-group">
                            <label class="form-label" for="patient-email">Email</label>
                            <input type="email" id="patient-email" class="form-input" 
                                   value="${UI.escapeHtml(patient.email || '')}" 
                                   placeholder="john@example.com">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="patient-phone">Phone</label>
                            <input type="tel" id="patient-phone" class="form-input" 
                                   value="${UI.escapeHtml(patient.phone || '')}" 
                                   placeholder="+1234567890">
                        </div>
                    </div>
                    <div class="patient-form__row">
                        <div class="form-group">
                            <label class="form-label" for="patient-dob">Date of Birth</label>
                            <input type="date" id="patient-dob" class="form-input" 
                                   value="${UI.escapeHtml(patient.dateOfBirth || '')}">
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
                               value="${UI.escapeHtml(patient.address?.street || '')}" 
                               placeholder="123 Main St">
                    </div>
                    <div class="patient-form__row">
                        <div class="form-group">
                            <label class="form-label" for="patient-city">City</label>
                            <input type="text" id="patient-city" class="form-input" 
                                   value="${UI.escapeHtml(patient.address?.city || '')}" 
                                   placeholder="New York">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="patient-zip">ZIP Code</label>
                            <input type="text" id="patient-zip" class="form-input" 
                                   value="${UI.escapeHtml(patient.address?.zipCode || '')}" 
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
                                   value="${UI.escapeHtml(patient.emergencyContact?.name || '')}" 
                                   placeholder="Jane Doe">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="patient-ec-phone">Contact Phone</label>
                            <input type="tel" id="patient-ec-phone" class="form-input" 
                                   value="${UI.escapeHtml(patient.emergencyContact?.phone || '')}" 
                                   placeholder="+1234567890">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="patient-ec-relation">Relationship</label>
                        <input type="text" id="patient-ec-relation" class="form-input" 
                               value="${UI.escapeHtml(patient.emergencyContact?.relation || '')}" 
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
                                       value="${UI.escapeHtml(patient.physicalActivity?.frequency || '')}" min="1" max="7" placeholder="e.g., 4">
                            </div>
                        </div>
                        <div class="patient-form__row">
                            <div class="form-group">
                                <label class="form-label" for="patient-activity-duration">Duración (minutos/sesión)</label>
                                <input type="number" id="patient-activity-duration" class="form-input" 
                                       value="${UI.escapeHtml(patient.physicalActivity?.duration || '')}" min="1" max="300" placeholder="e.g., 45">
                            </div>
                            <div class="form-group">
                                <label class="form-label" for="patient-activity-calories">Calorías quemadas/semana (est.)</label>
                                <input type="number" id="patient-activity-calories" class="form-input" 
                                       value="${UI.escapeHtml(patient.physicalActivity?.caloriesBurned || '')}" min="0" max="20000" placeholder="e.g., 1500">
                            </div>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="patient-activity-types">Tipos de ejercicio</label>
                            <input type="text" id="patient-activity-types" class="form-input" 
                                   value="${UI.escapeHtml(patient.physicalActivity?.types || '')}" 
                                   placeholder="Ej: Cardio, Pesas, Natación, Yoga">
                        </div>
                    </div>
                </div>

                <div class="patient-form__section">
                    <h4 class="patient-form__section-title">Notes</h4>
                    <div class="form-group">
                        <label class="form-label" for="patient-notes">General Notes</label>
                        <textarea id="patient-notes" class="form-input" rows="3" 
                                  placeholder="Any additional notes about this patient...">${UI.escapeHtml(patient.notes || '')}</textarea>
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

    const text = (id) => document.getElementById(id)?.value.trim() || '';
    const number = (id) => parseInt(document.getElementById(id)?.value) || null;

    function readForm() {
        return {
            firstName: text('patient-firstName'),
            lastName: text('patient-lastName'),
            email: text('patient-email'),
            phone: text('patient-phone'),
            dateOfBirth: text('patient-dob') || null,
            gender: text('patient-gender') || null,
            address: { street: text('patient-street'), city: text('patient-city'), zipCode: text('patient-zip') },
            emergencyContact: { name: text('patient-ec-name'), phone: text('patient-ec-phone'), relation: text('patient-ec-relation') },
            // Physical activity is kept only in this browser until Fase 4
            physicalActivity: {
                active: text('patient-physically-active') === 'yes',
                level: text('patient-activity-level') || null,
                frequency: number('patient-activity-frequency'),
                duration: number('patient-activity-duration'),
                caloriesBurned: number('patient-activity-calories'),
                types: text('patient-activity-types') || null
            },
            notes: text('patient-notes'),
            status: text('patient-status') || 'active'
        };
    }

    async function handleSavePatient(existingId) {
        const data = readForm();
        if (!data.firstName) {
            UI.toastError('First name is required');
            return false;
        }
        if (!data.lastName) {
            UI.toastError('Last name is required');
            return false;
        }

        try {
            const response = await fetch(existingId ? `/api/patients/${existingId}` : '/api/patients', {
                method: existingId ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (!result.success) {
                UI.toastError(result.error || 'Failed to save patient to database');
                return false;
            }

            // Server data wins; fields the server does not store yet (physical activity) are kept
            const saved = { ...data, ...result.data };
            if (existingId) {
                State.updatePatient(existingId, saved);
                UI.toastSuccess('Patient updated');
            } else {
                State.addPatient(saved);
                UI.toastSuccess('Patient added');
            }
            return true;
        } catch (error) {
            console.error('Error saving patient:', error);
            UI.toastError('Error connecting to server: ' + error.message);
            return false;
        }
    }

    return { showAddModal, showEditModal };
})();
