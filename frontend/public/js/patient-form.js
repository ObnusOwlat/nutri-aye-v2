/**
 * patient-form.js - Add/edit patient modal (saved in the server through State)
 */

const PatientForm = (function() {
    function showAddModal() {
        UI.openModal({
            title: 'Nuevo paciente',
            content: createPatientFormHtml(),
            confirmText: 'Agregar paciente',
            size: 'large',
            onConfirm: () => handleSavePatient(null),
            footerSpaceBetween: true
        });
    }

    function showEditModal(id) {
        const patient = State.getPatient(id);
        if (!patient) return;

        UI.openModal({
            title: 'Editar paciente',
            content: createPatientFormHtml(patient),
            confirmText: 'Guardar cambios',
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
                    <h4 class="patient-form__section-title">Datos básicos</h4>
                    <div class="patient-form__row">
                        <div class="form-group">
                            <label class="form-label" for="patient-firstName">Nombre *</label>
                            <input type="text" id="patient-firstName" class="form-input" 
                                   value="${UI.escapeHtml(patient.firstName || '')}" 
                                   placeholder="Juan" required>
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="patient-lastName">Apellido *</label>
                            <input type="text" id="patient-lastName" class="form-input" 
                                   value="${UI.escapeHtml(patient.lastName || '')}" 
                                   placeholder="Pérez" required>
                        </div>
                    </div>
                    <div class="patient-form__row">
                        <div class="form-group">
                            <label class="form-label" for="patient-email">Email</label>
                            <input type="email" id="patient-email" class="form-input" 
                                   value="${UI.escapeHtml(patient.email || '')}" 
                                   placeholder="juan@ejemplo.com">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="patient-phone">Teléfono</label>
                            <input type="tel" id="patient-phone" class="form-input" 
                                   value="${UI.escapeHtml(patient.phone || '')}" 
                                   placeholder="0981 123456">
                        </div>
                    </div>
                    <div class="patient-form__row">
                        <div class="form-group">
                            <label class="form-label" for="patient-dob">Fecha de nacimiento</label>
                            <input type="date" id="patient-dob" class="form-input" 
                                   value="${UI.escapeHtml(patient.dateOfBirth || '')}">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="patient-gender">Sexo</label>
                            <select id="patient-gender" class="form-select">
                                <option value="">Elegir...</option>
                                ${State.GENDERS.map(g => 
                                    `<option value="${g}" ${patient.gender === g ? 'selected' : ''}>${UI.label('gender', g)}</option>`
                                ).join('')}
                            </select>
                        </div>
                    </div>
                </div>

                <div class="patient-form__section">
                    <h4 class="patient-form__section-title">Dirección</h4>
                    <div class="form-group">
                        <label class="form-label" for="patient-street">Dirección</label>
                        <input type="text" id="patient-street" class="form-input" 
                               value="${UI.escapeHtml(patient.address?.street || '')}" 
                               placeholder="Av. Mcal. López 1234">
                    </div>
                    <div class="patient-form__row">
                        <div class="form-group">
                            <label class="form-label" for="patient-city">Ciudad</label>
                            <input type="text" id="patient-city" class="form-input" 
                                   value="${UI.escapeHtml(patient.address?.city || '')}" 
                                   placeholder="Asunción">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="patient-zip">Código postal</label>
                            <input type="text" id="patient-zip" class="form-input" 
                                   value="${UI.escapeHtml(patient.address?.zipCode || '')}" 
                                   placeholder="1209">
                        </div>
                    </div>
                </div>

                <div class="patient-form__section">
                    <h4 class="patient-form__section-title">Contacto de emergencia</h4>
                    <div class="patient-form__row">
                        <div class="form-group">
                            <label class="form-label" for="patient-ec-name">Nombre del contacto</label>
                            <input type="text" id="patient-ec-name" class="form-input" 
                                   value="${UI.escapeHtml(patient.emergencyContact?.name || '')}" 
                                   placeholder="María Pérez">
                        </div>
                        <div class="form-group">
                            <label class="form-label" for="patient-ec-phone">Teléfono del contacto</label>
                            <input type="tel" id="patient-ec-phone" class="form-input" 
                                   value="${UI.escapeHtml(patient.emergencyContact?.phone || '')}" 
                                   placeholder="0981 123456">
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label" for="patient-ec-relation">Parentesco</label>
                        <input type="text" id="patient-ec-relation" class="form-input" 
                               value="${UI.escapeHtml(patient.emergencyContact?.relation || '')}" 
                               placeholder="Cónyuge, madre, padre…">
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
                    <h4 class="patient-form__section-title">Notas</h4>
                    <div class="form-group">
                        <label class="form-label" for="patient-notes">Notas generales</label>
                        <textarea id="patient-notes" class="form-input" rows="3" 
                                  placeholder="Notas sobre el paciente...">${UI.escapeHtml(patient.notes || '')}</textarea>
                    </div>
                </div>

                <div class="patient-form__section">
                    <h4 class="patient-form__section-title">Estado</h4>
                    <div class="form-group">
                        <label class="form-label" for="patient-status">Estado del paciente</label>
                        <select id="patient-status" class="form-select">
                            <option value="active" ${patient.status === 'active' || !patient.status ? 'selected' : ''}>Activo</option>
                            <option value="inactive" ${patient.status === 'inactive' ? 'selected' : ''}>Inactivo</option>
                            <option value="archived" ${patient.status === 'archived' ? 'selected' : ''}>Archivado</option>
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
            UI.toastError('El nombre es obligatorio');
            return false;
        }
        if (!data.lastName) {
            UI.toastError('El apellido es obligatorio');
            return false;
        }

        try {
            if (existingId) {
                await State.updatePatient(existingId, data);
                UI.toastSuccess('Paciente actualizado');
            } else {
                await State.addPatient(data);
                UI.toastSuccess('Paciente agregado');
            }
            return true;
        } catch (error) {
            UI.toastError(error.message);
            return false;
        }
    }

    return { showAddModal, showEditModal };
})();
