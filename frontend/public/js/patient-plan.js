/**
 * patient-plan.js - Patient Meal Plans
 */
const PatientPlan = (function() {
    let currentPatientId = null;

    function render(patientId) {
        currentPatientId = patientId;
        const content = document.querySelector('.patient-tab-content[data-tab="plans"]');
        if (!content) return;

        const plans = State.getPatientPlans(patientId);
        const active = plans.find(p => p.status === 'active');

        content.innerHTML = `
            <div class="plans-section">
                <div class="plans-section__header">
                    <h4>Planes</h4>
                    <button class="btn btn--primary btn--sm" id="btn-create-plan">+ Crear plan</button>
                </div>

                ${active ? `
                    <div class="active-plan">
                        <div class="active-plan__badge">Activo</div>
                        <h3>${UI.escapeHtml(active.name)}</h3>
                        <p>Objetivo: ${UI.label('dietGoal', active.dietGoal)} | ${UI.formatNumber(active.dailyTarget)} kcal/día | Desde el ${UI.formatDate(active.startDate)}</p>
                        ${active.notes ? `<p>${UI.escapeHtml(active.notes)}</p>` : ''}
                        <div class="active-plan__actions">
                            <button class="btn btn--primary btn-view-plan" data-id="${active.id}">Editar</button>
                            <button class="btn btn--secondary btn-complete-plan" data-id="${active.id}">Complete</button>
                        </div>
                    </div>
                ` : `<div class="empty-state"><div class="empty-state__icon"></div><p class="empty-state__text">Sin planes</p></div>`}

                ${plans.filter(p => p.status !== 'active').length > 0 ? `
                    <div class="plans-history">
                        <h5>History</h5>
                        ${plans.filter(p => p.status !== 'active').map(plan => `
                            <div class="plan-card">
                                <div>
                                    <strong>${UI.escapeHtml(plan.name)}</strong>
                                    <p>${UI.label('dietGoal', plan.dietGoal)} | ${UI.formatNumber(plan.dailyTarget)} kcal | ${UI.formatDate(plan.startDate)} - ${plan.endDate ? UI.formatDate(plan.endDate) : 'en curso'}</p>
                                    <span class="plan-card__status status-${plan.status}">${UI.label('planStatus', plan.status)}</span>
                                </div>
                                <div class="plan-card__actions">
                                    <button class="btn btn--secondary btn--sm btn-view-plan" data-id="${plan.id}">Ver</button>
                                    <button class="btn btn--danger btn--sm btn-delete-plan" data-id="${plan.id}">Desactivar</button>
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
                <label class="form-label" for="plan-name">Nombre del plan *</label>
                <input type="text" id="plan-name" class="form-input" placeholder="ej.: Semana 1 - Déficit" required>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="plan-goal">Objetivo</label>
                    <select id="plan-goal" class="form-select">
                        ${State.DIET_GOALS.map(g => `<option value="${g}">${UI.label('dietGoal', g)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="plan-calories">Objetivo diario (kcal)</label>
                    <input type="number" id="plan-calories" class="form-input" value="${suggested}" min="500" max="10000">
                    <p class="form-hint">Suggested: ${suggested} kcal</p>
                </div>
            </div>
            <div class="form-row">
                <div class="form-group">
                    <label class="form-label" for="plan-start">Fecha de inicio</label>
                    <input type="date" id="plan-start" class="form-input" value="${today}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="plan-end">Fecha de fin</label>
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
                <label class="form-label" for="plan-notes">Notas</label>
                <textarea id="plan-notes" class="form-input" rows="2"></textarea>
            </div>
        `;

        UI.openModal({ title: 'Crear plan de alimentación', content, confirmText: 'Crear', onConfirm: handleCreate, size: 'medium' });
    }

    async function handleCreate() {
        const data = {
            name: document.getElementById('plan-name')?.value.trim(),
            dietGoal: document.getElementById('plan-goal')?.value,
            dailyTarget: parseInt(document.getElementById('plan-calories')?.value) || 2000,
            startDate: document.getElementById('plan-start')?.value,
            endDate: document.getElementById('plan-end')?.value || null,
            notes: document.getElementById('plan-notes')?.value?.trim(),
            status: 'active'
        };
        if (!data.name) { UI.toastError('El nombre es obligatorio'); return false; }
        try {
            const plan = await State.addPatientPlan(currentPatientId, data);
            UI.toastSuccess('Plan creado'); render(currentPatientId); openEditor(plan.id); return true;
        } catch (e) { UI.toastError(e.message); return false; }
    }

    function openEditor(planId) {
        const plan = State.getPatientPlans(currentPatientId).find(p => p.id === planId);
        if (!plan) return;

        const content = document.createElement('div');
        content.className = 'plan-editor';
        content.innerHTML = `<div class="plan-editor__header"><h4>${UI.escapeHtml(plan.name)}</h4><p>${UI.formatNumber(plan.dailyTarget)} kcal/día</p></div><div class="plan-editor__grid" id="plan-editor-grid">${renderGrid(plan)}</div>`;

        UI.openModal({ title: 'Editar plan', content, confirmText: 'Listo', hideCancel: true, size: 'fullscreen', onConfirm: () => { render(currentPatientId); return true; } });
        setTimeout(() => bindEditorEvents(planId), 100);
    }

    function renderGrid(plan) {
        return State.DAYS.map(day => {
            const meals = plan.weekPlan?.[day] || {};
            return `<div class="plan-editor__day">
                <div class="plan-editor__day-header">${UI.label('day', day)}</div>
                ${State.VALID_MEAL_TYPES.map(type => {
                    const recipeId = meals[type];
                    const recipe = recipeId ? State.getRecipe(recipeId) : null;
                    return `<div class="plan-editor__meal" data-day="${day}" data-meal="${type}">
                        <span>${UI.label('mealType', type)}</span>
                        ${recipe ? `<span>${UI.escapeHtml(recipe.name)}</span><span>${UI.formatCalories(recipe.nutrition?.calories || 0)}</span>` : '<span>+ Agregar</span>'}
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
            <p>Elegir receta para <strong>${UI.label('mealType', meal)}</strong> el <strong>${UI.label('day', day)}</strong>:</p>
            <input type="text" id="plan-recipe-search" class="form-input" placeholder="Buscar..." style="margin: 16px 0">
            <div id="plan-recipe-list">${renderRecipeList(recipes, current)}</div>
            ${current ? '<button class="btn btn--danger btn--sm" id="btn-remove-meal" style="margin-top:16px">Quitar</button>' : ''}
        `;

        UI.openModal({ title: 'Elegir receta', content, hideFooter: true, size: 'medium' });

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
        if (!recipes.length) return '<p style="text-align:center;padding:20px;color:var(--color-text-light)">No se encontraron recetas</p>';
        return recipes.map(r => `<div class="ingredient-select__item ${r.id === currentId ? 'selected' : ''}" data-id="${r.id}">
            <span><span class="category-badge category-badge--${r.category}">${UI.label('mealCategory', r.category)}</span> ${UI.escapeHtml(r.name)}</span>
            <span>${UI.formatCalories(r.nutrition?.calories || 0)}</span>
        </div>`).join('');
    }

    function bindSelection(planId, day, meal) {
        document.querySelectorAll('.ingredient-select__item').forEach(i => i.addEventListener('click', () => updateMeal(planId, day, meal, i.dataset.id)));
    }

    async function updateMeal(planId, day, meal, recipeId) {
        const plan = State.getPatientPlans(currentPatientId).find(p => p.id === planId);
        if (!plan) return;
        const wp = { ...plan.weekPlan, [day]: { ...plan.weekPlan[day], [meal]: recipeId } };
        try {
            await State.updatePatientPlan(planId, { weekPlan: wp });
        } catch (error) {
            UI.toastError(error.message);
            return;
        }
        const grid = document.getElementById('plan-editor-grid');
        if (grid) { const updated = State.getPatientPlans(currentPatientId).find(p => p.id === planId); grid.innerHTML = renderGrid(updated); bindEditorEvents(planId); }
        UI.closeModal();
    }

    document.addEventListener('click', (e) => {
        if (e.target.closest('#btn-create-plan')) showCreateModal();
        if (e.target.closest('.btn-view-plan')) openEditor(e.target.closest('.btn-view-plan').dataset.id);
        const complete = e.target.closest('.btn-complete-plan')?.dataset.id;
        if (complete) UI.confirm('¿Marcar el plan como completado?', async () => { await State.updatePatientPlan(complete, { status: 'completed' }); UI.toastSuccess('Plan completado'); render(currentPatientId); });
        const remove = e.target.closest('.btn-delete-plan')?.dataset.id;
        if (remove) UI.confirmDanger('¿Desactivar este plan?', async () => { await State.deletePatientPlan(remove); UI.toastSuccess('Plan desactivado'); render(currentPatientId); });
    });

    return { render };
})();
