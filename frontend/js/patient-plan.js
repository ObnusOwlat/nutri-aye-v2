/**
 * patient-plan.js - Patient Meal Plans
 */
const PatientPlan = (function() {
    let currentPatientId = null;

    function render(patientId) {
        currentPatientId = patientId;
        const content = document.querySelector('[data-tab="plans"]');
        if (!content) return;

        const plans = State.getPatientPlans(patientId);
        const active = plans.find(p => p.status === 'active');

        content.innerHTML = `
            <div class="plans-section">
                <div class="plans-section__header">
                    <h4>Meal Plans</h4>
                    <button class="btn btn--primary btn--sm" id="btn-create-plan">+ Create Plan</button>
                </div>

                ${active ? `
                    <div class="active-plan">
                        <div class="active-plan__badge">Active</div>
                        <h3>${UI.escapeHtml(active.name)}</h3>
                        <p>Goal: ${UI.capitalize(active.dietGoal)} | Target: ${active.dailyTarget} kcal/day | Started: ${active.startDate}</p>
                        ${active.notes ? `<p>${UI.escapeHtml(active.notes)}</p>` : ''}
                        <div class="active-plan__actions">
                            <button class="btn btn--primary btn-view-plan" data-id="${active.id}">Edit</button>
                            <button class="btn btn--secondary btn-complete-plan" data-id="${active.id}">Complete</button>
                        </div>
                    </div>
                ` : `<div class="empty-state"><div class="empty-state__icon"></div><p class="empty-state__text">No meal plans</p></div>`}

                ${plans.filter(p => p.status !== 'active').length > 0 ? `
                    <div class="plans-history">
                        <h5>History</h5>
                        ${plans.filter(p => p.status !== 'active').map(plan => `
                            <div class="plan-card">
                                <div>
                                    <strong>${UI.escapeHtml(plan.name)}</strong>
                                    <p>${UI.capitalize(plan.dietGoal)} | ${plan.dailyTarget} kcal | ${plan.startDate} - ${plan.endDate || 'ongoing'}</p>
                                    <span class="plan-card__status status-${plan.status}">${UI.capitalize(plan.status)}</span>
                                </div>
                                <div class="plan-card__actions">
                                    <button class="btn btn--secondary btn--sm btn-view-plan" data-id="${plan.id}">View</button>
                                    <button class="btn btn--danger btn--sm btn-delete-plan" data-id="${plan.id}">Delete</button>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    function showCreateModal() {
        if (!currentPatientId) return;
        const today = new Date().toISOString().split('T')[0];
        const latest = State.getLatestMetrics(currentPatientId);
        const conditions = State.getPatientConditions(currentPatientId);

        let suggested = 2000;
        if (latest?.weight && latest?.height) {
            const bmr = 10 * latest.weight + 6.25 * latest.height - 5 * State.calculateAge(State.getPatient(currentPatientId)?.dateOfBirth);
            const mult = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
            suggested = Math.round(bmr * (mult[latest.activityLevel] || 1.55));
        }

        const content = document.createElement('div');
        content.innerHTML = `
            <div class="form-group">
                <label class="form-label" for="plan-name">Plan Name *</label>
                <input type="text" id="plan-name" class="form-input" placeholder="e.g., Week 1 - Deficit" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="plan-goal">Goal</label>
                    <select id="plan-goal" class="form-select">
                        ${State.DIET_GOALS.map(g => `<option value="${g}">${UI.capitalize(g)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="plan-calories">Daily Target (kcal)</label>
                    <input type="number" id="plan-calories" class="form-input" value="${suggested}" min="500" max="10000">
                    <p class="form-hint">Suggested: ${suggested} kcal</p>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="plan-start">Start Date</label>
                    <input type="date" id="plan-start" class="form-input" value="${today}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="plan-end">End Date</label>
                    <input type="date" id="plan-end" class="form-input">
                </div>
            </div>
            ${conditions.length > 0 ? `
                <div class="form-group">
                    <label class="form-label">Dietary Considerations</label>
                    <div>${conditions.map(c => `<span class="condition-tag severity-${c.severity}">${UI.escapeHtml(c.name)}</span>`).join(' ')}</div>
                </div>
            ` : ''}
            <div class="form-group">
                <label class="form-label" for="plan-notes">Notes</label>
                <textarea id="plan-notes" class="form-input" rows="2"></textarea>
            </div>
        `;

        UI.openModal({ title: 'Create Meal Plan', content, confirmText: 'Create', onConfirm: handleCreate, size: 'medium' });
    }

    function handleCreate() {
        const data = {
            name: document.getElementById('plan-name')?.value.trim(),
            dietGoal: document.getElementById('plan-goal')?.value,
            dailyTarget: parseInt(document.getElementById('plan-calories')?.value) || 2000,
            startDate: document.getElementById('plan-start')?.value,
            endDate: document.getElementById('plan-end')?.value || null,
            notes: document.getElementById('plan-notes')?.value?.trim(),
            status: 'active'
        };
        if (!data.name) { UI.toastError('Name is required'); return false; }
        try {
            const plan = State.addPatientPlan(currentPatientId, data);
            UI.toastSuccess('Plan created'); render(currentPatientId); openEditor(plan.id); return true;
        } catch (e) { UI.toastError(e.message); return false; }
    }

    function openEditor(planId) {
        const plan = State.getPatientPlans(currentPatientId).find(p => p.id === planId);
        if (!plan) return;

        const content = document.createElement('div');
        content.className = 'plan-editor';
        content.innerHTML = `<div class="plan-editor__header"><h4>${UI.escapeHtml(plan.name)}</h4><p>Target: ${plan.dailyTarget} kcal/day</p></div><div class="plan-editor__grid" id="plan-editor-grid">${renderGrid(plan)}</div>`;

        UI.openModal({ title: 'Edit Plan', content, confirmText: 'Done', hideCancel: true, size: 'fullscreen', onConfirm: () => { render(currentPatientId); return true; } });
        setTimeout(() => bindEditorEvents(planId), 100);
    }

    function renderGrid(plan) {
        return State.DAYS.map(day => {
            const meals = plan.weekPlan?.[day] || {};
            return `<div class="plan-editor__day">
                <div class="plan-editor__day-header">${UI.capitalize(day)}</div>
                ${State.VALID_MEAL_TYPES.map(type => {
                    const recipeId = meals[type];
                    const recipe = recipeId ? State.getRecipe(recipeId) : null;
                    return `<div class="plan-editor__meal" data-day="${day}" data-meal="${type}">
                        <span>${UI.capitalize(type)}</span>
                        ${recipe ? `<span>${UI.escapeHtml(recipe.name)}</span><span>${UI.formatCalories(recipe.totalKcal)}</span>` : '<span>+ Add</span>'}
                    </div>`;
                }).join('')}
                <div>Total: ${UI.formatCalories(State.getPatientDailyCalories(currentPatientId, day))} / ${plan.dailyTarget}</div>
            </div>`;
        }).join('');
    }

    function bindEditorEvents(planId) {
        document.querySelectorAll('.plan-editor__meal').forEach(m => m.addEventListener('click', () => showRecipeSelect(planId, m.dataset.day, m.dataset.meal)));
    }

    function showRecipeSelect(planId, day, meal) {
        const recipes = State.getRecipes();
        const plan = State.getPatientPlans(currentPatientId).find(p => p.id === planId);
        const current = plan?.weekPlan?.[day]?.[meal];

        const content = document.createElement('div');
        content.innerHTML = `
            <p>Select recipe for <strong>${UI.capitalize(meal)}</strong> on <strong>${UI.capitalize(day)}</strong>:</p>
            <input type="text" id="plan-recipe-search" class="form-input" placeholder="Search..." style="margin: 16px 0">
            <div id="plan-recipe-list">${renderRecipeList(recipes, current)}</div>
            ${current ? '<button class="btn btn--danger btn--sm" id="btn-remove-meal" style="margin-top:16px">Remove</button>' : ''}
        `;

        UI.openModal({ title: 'Select Recipe', content, hideFooter: true, size: 'medium' });

        requestAnimationFrame(() => {
            document.getElementById('plan-recipe-search')?.addEventListener('input', e => {
                const val = (e.target.value || '').toLowerCase();
                const filtered = recipes.filter(r => r.name.toLowerCase().includes(val));
                document.getElementById('plan-recipe-list').innerHTML = renderRecipeList(filtered, current);
                bindSelection(planId, day, meal);
            });
            bindSelection(planId, day, meal);
            document.getElementById('btn-remove-meal')?.addEventListener('click', () => updateMeal(planId, day, meal, null));
        });
    }

    function renderRecipeList(recipes, currentId) {
        if (!recipes.length) return '<p style="text-align:center;padding:20px;color:var(--color-text-light)">No recipes found</p>';
        return recipes.map(r => `<div class="ingredient-select__item ${r.id === currentId ? 'selected' : ''}" data-id="${r.id}">
            <span><span class="category-badge category-badge--${r.category}">${UI.capitalize(r.category)}</span> ${UI.escapeHtml(r.name)}</span>
            <span>${UI.formatCalories(r.totalKcal)}</span>
        </div>`).join('');
    }

    function bindSelection(planId, day, meal) {
        document.querySelectorAll('.ingredient-select__item').forEach(i => i.addEventListener('click', () => updateMeal(planId, day, meal, i.dataset.id)));
    }

    function updateMeal(planId, day, meal, recipeId) {
        const plan = State.getPatientPlans(currentPatientId).find(p => p.id === planId);
        if (!plan) return;
        const wp = { ...plan.weekPlan, [day]: { ...plan.weekPlan[day], [meal]: recipeId } };
        State.updatePatientPlan(planId, { weekPlan: wp });
        const grid = document.getElementById('plan-editor-grid');
        if (grid) { const updated = State.getPatientPlans(currentPatientId).find(p => p.id === planId); grid.innerHTML = renderGrid(updated); bindEditorEvents(planId); }
        UI.closeModal();
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('#btn-create-plan')) showCreateModal();
        if (e.target.closest('.btn-view-plan')) openEditor(e.target.closest('.btn-view-plan').dataset.id);
        if (e.target.closest('.btn-complete-plan')) UI.confirm('Mark as completed?', () => { State.updatePatientPlan(e.target.closest('.btn-complete-plan').dataset.id, { status: 'completed' }); UI.toastSuccess('Completed'); render(currentPatientId); });
        if (e.target.closest('.btn-delete-plan')) UI.confirmDanger('Delete plan?', () => { State.deletePatientPlan(e.target.closest('.btn-delete-plan').dataset.id); UI.toastSuccess('Deleted'); render(currentPatientId); });
    });

    return { render };
})();
