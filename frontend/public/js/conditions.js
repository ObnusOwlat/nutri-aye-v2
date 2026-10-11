/**
 * conditions.js - Medical Conditions Management
 */
const Conditions = (function() {
    let currentPatientId = null;

    function render(patientId) {
        currentPatientId = patientId;
        const content = document.querySelector('.patient-tab-content[data-tab="conditions"]');
        if (!content) return;

        const conditions = State.getPatientConditions(patientId);
        const allergies = conditions.filter(c => c.type === 'allergy');
        const intolerances = conditions.filter(c => c.type === 'intolerance');
        const medical = conditions.filter(c => c.type === 'condition');
        const medications = conditions.filter(c => c.type === 'medication');

        content.innerHTML = `
            <div class="conditions-section">
                <div class="conditions-section__header">
                    <h4>Health Profile</h4>
                    <button class="btn btn--primary btn--sm" id="btn-add-condition">+ Agregar condición</button>
                </div>

                ${allergies.length > 0 ? `<div class="conditions-group conditions-group--danger"><h5>Allergies</h5>${renderList(allergies)}</div>` : ''}
                ${intolerances.length > 0 ? `<div class="conditions-group conditions-group--warning"><h5>Intolerances</h5>${renderList(intolerances)}</div>` : ''}
                ${medical.length > 0 ? `<div class="conditions-group"><h5>Condiciones médicas</h5>${renderList(medical)}</div>` : ''}
                ${medications.length > 0 ? `<div class="conditions-group"><h5>Medicación</h5>${renderList(medications)}</div>` : ''}
                ${conditions.length === 0 ? `<div class="empty-state"><div class="empty-state__icon"></div><p class="empty-state__text">Sin condiciones registradas</p></div>` : ''}
            </div>
        `;
    }

    function renderList(conditions) {
        return `<div class="conditions-list">${conditions.map(c => `
            <div class="condition-card severity-${c.severity}" data-id="${c.id}">
                <div class="condition-card__header">
                    <span class="condition-card__name">${UI.escapeHtml(c.name)}</span>
                    <span class="condition-card__severity severity-${c.severity}">${UI.label('severity', c.severity)}</span>
                </div>
                ${c.description ? `<p class="condition-card__description">${UI.escapeHtml(c.description)}</p>` : ''}
                ${c.dietaryNotes ? `<div><strong>Notas dietarias:</strong> ${UI.escapeHtml(c.dietaryNotes)}</div>` : ''}
                ${c.medications ? `<div><strong>Medicación:</strong> ${UI.escapeHtml(c.medications)}</div>` : ''}
                <div class="condition-card__actions">
                    <button class="btn btn--secondary btn--sm btn-edit-condition" data-id="${c.id}">Editar</button>
                    <button class="btn btn--danger btn--sm btn-delete-condition" data-id="${c.id}">Desactivar</button>
                </div>
            </div>
        `).join('')}</div>`;
    }

    function showAddModal() {
        if (!currentPatientId) return;
        UI.openModal({ title: 'Agregar condición', content: createForm(), confirmText: 'Agregar', onConfirm: handleSave, size: 'medium' });
    }

    function showEditModal(id) {
        const c = State.getPatientConditions(currentPatientId).find(x => x.id === id);
        if (!c) return;
        UI.openModal({ title: 'Editar condición', content: createForm(c), confirmText: 'Guardar', onConfirm: () => handleSave(id), size: 'medium' });
    }

    function createForm(condition = {}) {
        return `
            <div class="form-group">
                <label class="form-label" for="condition-type">Tipo *</label>
                <select id="condition-type" class="form-select" required>
                    ${State.CONDITION_TYPES.map(t => `<option value="${t}" ${condition.type === t ? 'selected' : ''}>${UI.label('conditionType', t)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label" for="condition-name">Nombre *</label>
                <input type="text" id="condition-name" class="form-input" value="${UI.escapeHtml(condition.name ? UI.escapeHtml(condition.name) : '')}" placeholder="e.g., Gluten Intolerance" required>
            </div>
            <div class="form-group">
                <label class="form-label" for="condition-severity">Severidad</label>
                <select id="condition-severity" class="form-select">
                    ${State.CONDITION_SEVERITIES.map(s => `<option value="${s}" ${condition.severity === s ? 'selected' : ''}>${UI.label('severity', s)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label" for="condition-description">Descripción</label>
                <textarea id="condition-description" class="form-input" rows="2">${UI.escapeHtml(condition.description || '')}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label" for="condition-dietary">Notas dietarias</label>
                <textarea id="condition-dietary" class="form-input" rows="2">${UI.escapeHtml(condition.dietaryNotes || '')}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label" for="condition-medications">Medicación</label>
                <textarea id="condition-medications" class="form-input" rows="2">${UI.escapeHtml(condition.medications || '')}</textarea>
            </div>
        `;
    }

    async function handleSave(existingId) {
        const data = {
            type: document.getElementById('condition-type')?.value,
            name: document.getElementById('condition-name')?.value.trim(),
            severity: document.getElementById('condition-severity')?.value,
            description: document.getElementById('condition-description')?.value.trim(),
            dietaryNotes: document.getElementById('condition-dietary')?.value.trim(),
            medications: document.getElementById('condition-medications')?.value.trim()
        };
        if (!data.name) { UI.toastError('El nombre es obligatorio'); return false; }
        try {
            if (existingId) { await State.updatePatientCondition(existingId, data); UI.toastSuccess('Condición actualizada'); }
            else { await State.addPatientCondition(currentPatientId, data); UI.toastSuccess('Condición agregada'); }
            render(currentPatientId); return true;
        } catch (e) { UI.toastError(e.message); return false; }
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('#btn-add-condition')) showAddModal();
        if (e.target.closest('.btn-edit-condition')) showEditModal(e.target.closest('.btn-edit-condition').dataset.id);
        if (e.target.closest('.btn-delete-condition')) {
            const id = e.target.closest('.btn-delete-condition').dataset.id;
            UI.confirmDanger('¿Desactivar esta condición?', async () => { await State.deletePatientCondition(id); UI.toastSuccess('Condición desactivada'); render(currentPatientId); });
        }
    });

    return { render };
})();
