/**
 * planner-templates.js - Diet templates of the planner: selector, add/edit/delete modals
 */

const PlannerTemplates = (function() {
    let templateSelect, dietGoal, dietTarget, dailyTarget;
    let selectedId = null;

    function init() {
        templateSelect = document.getElementById('planner-template-select');
        dietGoal = document.getElementById('planner-diet-goal');
        dietTarget = document.getElementById('planner-diet-target');
        dailyTarget = document.getElementById('daily-target');

        templateSelect?.addEventListener('change', handleTemplateChange);
        document.getElementById('btn-manage-templates')?.addEventListener('click', showTemplateModal);
        State.subscribe('template:changed', (templateId) => {
            selectedId = templateId;
            populateTemplateSelector();
        });
        State.subscribe('dietTemplates:updated', populateTemplateSelector);
        populateTemplateSelector();
    }

    // Manual calories: no template applies any more
    function clearSelection() {
        if (templateSelect) templateSelect.value = '';
        selectedId = null;
    }

    /**
     * Populate template selector
     */
    function populateTemplateSelector() {
        if (!templateSelect) return;
        
        const templates = State.getDietTemplates();
        const currentTemplateId = State.getCurrentTemplateId();

        templateSelect.innerHTML = templates.map(t => 
            `<option value="${UI.escapeHtml(t.id)}">${UI.escapeHtml(t.name)} (${t.dailyTarget} kcal)</option>`
        ).join('');

        // Restore current selection
        if (currentTemplateId && templates.find(t => t.id === currentTemplateId)) {
            templateSelect.value = currentTemplateId;
            selectedId = currentTemplateId;
        } else if (templates.length > 0) {
            templateSelect.value = templates[0].id;
            selectedId = templates[0].id;
            State.setCurrentTemplate(templates[0].id);
        }

        updateDietInfo();
    }

    /**
     * Update diet info display
     */
    function updateDietInfo() {
        const profile = State.getDietProfile();
        if (dietGoal) dietGoal.textContent = UI.capitalize(profile.goal);
        if (dietTarget) dietTarget.textContent = `${profile.dailyTarget} kcal/day`;
        if (dailyTarget) dailyTarget.value = profile.dailyTarget;
    }

    /**
     * Handle template selection change
     */
    function handleTemplateChange() {
        const templateId = templateSelect?.value;
        
        if (templateId) {
            selectedId = templateId;
            State.setCurrentTemplate(templateId);
        }
        
        updateDietInfo();
    }

    /**
     * Show template management modal
     */
    function showTemplateModal() {
        const templates = State.getDietTemplates();
        
        const content = `
            <div class="template-manager">
                <p style="margin-bottom: 16px; color: var(--color-text-light);">Create and manage diet plan templates that can be applied to patients.</p>
                <div class="template-list">
                    ${templates.map(t => `
                        <div class="template-item ${t.isDefault ? 'template-item--default' : ''}" data-id="${t.id}">
                            <div class="template-item__info">
                                <h4>${UI.escapeHtml(t.name)}</h4>
                                <p>${UI.escapeHtml(t.description || 'No description')}</p>
                                <div class="template-item__meta">
                                    <span class="template-badge template-badge--${t.goal}">${UI.capitalize(t.goal)}</span>
                                    <span>${t.dailyTarget} kcal/day</span>
                                    ${t.isDefault ? '<span class="template-badge template-badge--default">Default</span>' : ''}
                                </div>
                            </div>
                            <div class="template-item__actions">
                                <button class="btn btn--secondary btn--sm btn-edit-template" data-id="${t.id}">Edit</button>
                                ${!t.isDefault ? `<button class="btn btn--danger btn--sm btn-delete-template" data-id="${t.id}">Delete</button>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div style="margin-top: 20px; text-align: center;">
                    <button class="btn btn--primary" data-action="add-template">+ Add Template</button>
                </div>
            </div>
        `;

        UI.openModal({
            title: 'Manage Diet Templates',
            content,
            size: 'large',
            hideFooter: true
        });
    }

    /**
     * Show add template modal
     */
    function showAddTemplateModal() {
        const content = `
            <div class="form-group">
                <label class="form-label">Template Name *</label>
                <input type="text" id="tpl-name" class="form-input" placeholder="e.g., Weight Loss 1500">
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <input type="text" id="tpl-description" class="form-input" placeholder="Brief description...">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Goal</label>
                    <select id="tpl-goal" class="form-select">
                        ${State.DIET_GOALS.map(g => `<option value="${g}">${UI.capitalize(g)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Daily Calories</label>
                    <input type="number" id="tpl-calories" class="form-input" value="2000" min="800" max="10000">
                </div>
            </div>
        `;

        UI.openModal({
            title: 'Add Diet Template',
            content,
            confirmText: 'Add Template',
            onConfirm: async () => {
                const name = document.getElementById('tpl-name')?.value.trim();
                const description = document.getElementById('tpl-description')?.value.trim();
                const goal = document.getElementById('tpl-goal')?.value;
                const calories = parseInt(document.getElementById('tpl-calories')?.value) || 2000;

                if (!name) {
                    UI.toastError('Template name is required');
                    return false;
                }

                await State.addDietTemplate({ name, description, goal, dailyTarget: calories });
                UI.toastSuccess('Template added');
                showTemplateModal(); // Refresh the modal
                populateTemplateSelector(); // Refresh the selector
                return true;
            }
        });
    }

    /**
     * Show edit template modal
     */
    function showEditTemplateModal(templateId) {
        const template = State.getDietTemplate(templateId);
        if (!template) return;

        const content = `
            <div class="form-group">
                <label class="form-label">Template Name *</label>
                <input type="text" id="tpl-name" class="form-input" value="${UI.escapeHtml(template.name)}" placeholder="e.g., Weight Loss 1500">
            </div>
            <div class="form-group">
                <label class="form-label">Description</label>
                <input type="text" id="tpl-description" class="form-input" value="${UI.escapeHtml(template.description || '')}" placeholder="Brief description...">
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label">Goal</label>
                    <select id="tpl-goal" class="form-select">
                        ${State.DIET_GOALS.map(g => `<option value="${g}" ${template.goal === g ? 'selected' : ''}>${UI.capitalize(g)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Daily Calories</label>
                    <input type="number" id="tpl-calories" class="form-input" value="${UI.escapeHtml(template.dailyTarget)}" min="800" max="10000">
                </div>
            </div>
        `;

        UI.openModal({
            title: 'Edit Diet Template',
            content,
            confirmText: 'Save Changes',
            onConfirm: async () => {
                const name = document.getElementById('tpl-name')?.value.trim();
                const description = document.getElementById('tpl-description')?.value.trim();
                const goal = document.getElementById('tpl-goal')?.value;
                const calories = parseInt(document.getElementById('tpl-calories')?.value) || 2000;

                if (!name) {
                    UI.toastError('Template name is required');
                    return false;
                }

                await State.updateDietTemplate(templateId, { name, description, goal, dailyTarget: calories });
                UI.toastSuccess('Template updated');
                showTemplateModal(); // Refresh the modal
                populateTemplateSelector(); // Refresh the selector
                return true;
            }
        });
    }

    /**
     * Handle template modal actions
     */
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="add-template"]')) {
            showAddTemplateModal();
        }
        if (e.target.closest('.btn-edit-template')) {
            const id = e.target.closest('.btn-edit-template').dataset.id;
            showEditTemplateModal(id);
        }
        if (e.target.closest('.btn-delete-template')) {
            const id = e.target.closest('.btn-delete-template').dataset.id;
            UI.confirmDanger('¿Desactivar esta plantilla?', async () => {
                await State.deleteDietTemplate(id);
                UI.toastSuccess('Template deleted');
                showTemplateModal(); // Refresh the modal
                populateTemplateSelector(); // Refresh the selector
            });
        }
    });

    return { init, populateTemplateSelector, updateDietInfo, clearSelection, getSelectedId: () => selectedId };
})();
