/**
 * conditions.js - Medical Conditions Management
 */
const Conditions = (function() {
    let currentPatientId = null;

    function render(patientId) {
        currentPatientId = patientId;
        const content = document.querySelector('[data-tab="conditions"]');
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
                    <button class="btn btn--primary btn--sm" id="btn-add-condition">+ Add Condition</button>
                </div>

                ${allergies.length > 0 ? `<div class="conditions-group conditions-group--danger"><h5>Allergies</h5>${renderList(allergies)}</div>` : ''}
                ${intolerances.length > 0 ? `<div class="conditions-group conditions-group--warning"><h5>Intolerances</h5>${renderList(intolerances)}</div>` : ''}
                ${medical.length > 0 ? `<div class="conditions-group"><h5>Medical Conditions</h5>${renderList(medical)}</div>` : ''}
                ${medications.length > 0 ? `<div class="conditions-group"><h5>Medications</h5>${renderList(medications)}</div>` : ''}
                ${conditions.length === 0 ? `<div class="empty-state"><div class="empty-state__icon"></div><p class="empty-state__text">No conditions recorded</p></div>` : ''}
            </div>
        `;
    }

    function renderList(conditions) {
        return `<div class="conditions-list">${conditions.map(c => `
            <div class="condition-card severity-${c.severity}" data-id="${c.id}">
                <div class="condition-card__header">
                    <span class="condition-card__name">${UI.escapeHtml(c.name)}</span>
                    <span class="condition-card__severity severity-${c.severity}">${UI.capitalize(c.severity)}</span>
                </div>
                ${c.description ? `<p class="condition-card__description">${UI.escapeHtml(c.description)}</p>` : ''}
                ${c.dietaryNotes ? `<div><strong>Dietary Notes:</strong> ${UI.escapeHtml(c.dietaryNotes)}</div>` : ''}
                ${c.medications ? `<div><strong>Medications:</strong> ${UI.escapeHtml(c.medications)}</div>` : ''}
                <div class="condition-card__actions">
                    <button class="btn btn--secondary btn--sm btn-edit-condition" data-id="${c.id}">Edit</button>
                    <button class="btn btn--danger btn--sm btn-delete-condition" data-id="${c.id}">Delete</button>
                </div>
            </div>
        `).join('')}</div>`;
    }

    function showAddModal() {
        if (!currentPatientId) return;
        UI.openModal({ title: 'Add Condition', content: createForm(), confirmText: 'Add', onConfirm: handleSave, size: 'medium' });
    }

    function showEditModal(id) {
        const c = State.getPatientConditions(currentPatientId).find(x => x.id === id);
        if (!c) return;
        UI.openModal({ title: 'Edit Condition', content: createForm(c), confirmText: 'Save', onConfirm: () => handleSave(id), size: 'medium' });
    }

    function createForm(condition = {}) {
        return `
            <div class="form-group">
                <label class="form-label" for="condition-type">Type *</label>
                <select id="condition-type" class="form-select" required>
                    ${State.CONDITION_TYPES.map(t => `<option value="${t}" ${condition.type === t ? 'selected' : ''}>${UI.capitalize(t)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label" for="condition-name">Name *</label>
                <input type="text" id="condition-name" class="form-input" value="${condition.name ? UI.escapeHtml(condition.name) : ''}" placeholder="e.g., Gluten Intolerance" required>
            </div>
            <div class="form-group">
                <label class="form-label" for="condition-severity">Severity</label>
                <select id="condition-severity" class="form-select">
                    ${State.CONDITION_SEVERITIES.map(s => `<option value="${s}" ${condition.severity === s ? 'selected' : ''}>${UI.capitalize(s)}</option>`).join('')}
                </select>
            </div>
            <div class="form-group">
                <label class="form-label" for="condition-description">Description</label>
                <textarea id="condition-description" class="form-input" rows="2">${condition.description || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label" for="condition-dietary">Dietary Notes</label>
                <textarea id="condition-dietary" class="form-input" rows="2">${condition.dietaryNotes || ''}</textarea>
            </div>
            <div class="form-group">
                <label class="form-label" for="condition-medications">Medications</label>
                <textarea id="condition-medications" class="form-input" rows="2">${condition.medications || ''}</textarea>
            </div>
        `;
    }

    function handleSave(existingId) {
        const data = {
            type: document.getElementById('condition-type')?.value,
            name: document.getElementById('condition-name')?.value.trim(),
            severity: document.getElementById('condition-severity')?.value,
            description: document.getElementById('condition-description')?.value.trim(),
            dietaryNotes: document.getElementById('condition-dietary')?.value.trim(),
            medications: document.getElementById('condition-medications')?.value.trim()
        };
        if (!data.name) { UI.toastError('Name is required'); return false; }
        try {
            if (existingId) { State.updatePatientCondition(existingId, data); UI.toastSuccess('Updated'); }
            else { State.addPatientCondition(currentPatientId, data); UI.toastSuccess('Added'); }
            render(currentPatientId); return true;
        } catch (e) { UI.toastError(e.message); return false; }
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('#btn-add-condition')) showAddModal();
        if (e.target.closest('.btn-edit-condition')) showEditModal(e.target.closest('.btn-edit-condition').dataset.id);
        if (e.target.closest('.btn-delete-condition')) {
            UI.confirmDanger('Delete this condition?', () => { State.deletePatientCondition(e.target.closest('.btn-delete-condition').dataset.id); UI.toastSuccess('Deleted'); render(currentPatientId); });
        }
    });

    return { render };
})();
