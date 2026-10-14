/**
 * planner-routines.js - Exercise routines (templates of a week of physical
 * activity) in the planner's 🏃 Actividad mode: apply one to the week (or add it
 * on top of what the week has, so routines stack), save the
 * week as a routine, update, rename or deactivate it. Routines are separate
 * from the diet templates. Server: /api/activity-templates.
 */

const PlannerRoutines = (function() {
    const api = (method, path, body) => State._api(method, path, body);
    const esc = (v) => UI.escapeHtml(v ?? '');
    const SHORT_DAYS = { monday: 'Lun', tuesday: 'Mar', wednesday: 'Mié', thursday: 'Jue', friday: 'Vie', saturday: 'Sáb', sunday: 'Dom' };
    let routines = [];

    function init() {
        const button = document.getElementById('btn-routines');
        if (!button) return;
        button.addEventListener('click', open);
        const sync = () => { button.hidden = State.getMode() !== 'activity'; };
        State.subscribe('plannerMode:changed', sync);
        sync();
    }

    const planOf = () => State.getActivityPlan();
    const itemsIn = (plan) => Object.values(plan || {}).reduce((n, items) => n + (items?.length || 0), 0);

    // "Lun 5 · Mié 5 · Vie 5" (number of exercises or activities per day)
    const daysSummary = (plan) => State.DAYS.filter(d => plan[d]?.length).map(d => `${SHORT_DAYS[d]} ${plan[d].length}`).join(' · ') || 'Sin actividades';
    // What each day has: [{ day, short, items }]
    const daysOf = (plan) => State.DAYS.filter(d => plan?.[d]?.length).map(d => ({ day: d, short: SHORT_DAYS[d], items: plan[d] }));

    // The consultorio's routines (also shown in the left column)
    async function reload() {
        routines = await api('GET', '/api/activity-templates');
        State.emit('routines:updated', routines);
        return routines;
    }
    const list = () => routines;

    async function open() {
        try {
            await reload();
        } catch (error) {
            UI.toastError(error.message);
            return;
        }
        const weekItems = itemsIn(planOf());
        UI.openModal({
            title: 'Rutinas de ejercicio',
            size: 'large',
            hideFooter: true,
            content: `
                <div class="routines">
                    <p class="text-muted">Semanas de actividad física listas para aplicar a un paciente. Son aparte de las plantillas de dieta.</p>
                    <div class="routines__save">
                        <button class="btn btn--primary btn--sm" type="button" data-action="save-new" ${weekItems ? '' : 'disabled'}>+ Guardar la semana actual como rutina</button>
                        <small class="text-muted">${weekItems ? `La semana tiene ${UI.plural(weekItems, 'actividad', 'actividades')}.` : 'Agregá ejercicios a la semana para poder guardarla.'}</small>
                    </div>
                    <ul class="routines__list">${routines.map(routineHtml).join('') || '<li class="text-muted">Todavía no hay rutinas.</li>'}</ul>
                </div>`
        });
        document.querySelector('.routines').addEventListener('click', onClick);
    }

    function routineHtml(r) {
        return `
            <li class="routines__item" data-id="${esc(r.id)}">
                <div class="routines__info">
                    <h4>${esc(r.name)} <span class="routines__level routines__level--${esc(r.level)}">${esc(UI.label('routineLevel', r.level))}</span></h4>
                    ${r.description ? `<p>${esc(r.description)}</p>` : ''}
                    <details class="routines__content">
                        <summary>${esc(daysSummary(r.activityPlan))}</summary>
                        <ul>${daysOf(r.activityPlan).map(d => `<li><strong>${d.short}:</strong> ${esc(d.items.map(i => i.name).join(', '))}</li>`).join('')}</ul>
                    </details>
                </div>
                <div class="routines__actions">
                    <button class="btn btn--primary btn--sm" type="button" data-action="apply" title="Borra las actividades de la semana y pone esta rutina">Aplicar a la semana</button>
                    <button class="btn btn--primary btn--sm" type="button" data-action="stack" title="Agrega la rutina a lo que la semana ya tiene, sin borrar nada">+ Sumar a la semana</button>
                    <details class="routines__more">
                        <summary class="btn btn--secondary btn--sm">⋯ Más</summary>
                        <div class="routines__menu">
                            <button class="btn btn--secondary btn--sm" type="button" data-action="overwrite" title="Cambia el contenido de la rutina por la semana que está en pantalla">Reemplazar rutina con la semana actual</button>
                            <button class="btn btn--secondary btn--sm" type="button" data-action="edit">Editar nombre y descripción</button>
                            <button class="btn btn--danger btn--sm" type="button" data-action="deactivate">Desactivar</button>
                        </div>
                    </details>
                </div>
            </li>`;
    }

    function onClick(e) {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (!action) return;
        const routine = routines.find(r => r.id === e.target.closest('[data-id]')?.dataset.id);
        if (action === 'save-new') return editForm(null);
        if (!routine) return;
        if (action === 'apply') apply(routine);
        if (action === 'stack') stack(routine);
        if (action === 'edit') editForm(routine);
        if (action === 'overwrite') confirm(`¿Cambiar el contenido de la rutina "${routine.name}"? Hoy tiene: ${daysSummary(routine.activityPlan)}. Va a quedar con lo que está en pantalla: ${daysSummary(planOf())}.`, 'Sí, reemplazar la rutina',
            () => save(routine.id, { activityPlan: planOf() }, 'Rutina actualizada'));
        if (action === 'deactivate') confirm(`¿Desactivar la rutina "${routine.name}"? Queda en el historial y no se borra.`, 'Desactivar',
            async () => { await api('DELETE', `/api/activity-templates/${encodeURIComponent(routine.id)}`); UI.toastSuccess('Rutina desactivada'); await reload(); });
    }

    function apply(routine) {
        const run = () => {
            State.replaceActivityPlan(routine.activityPlan);
            const patient = PlannerPatient.getSelectedId();
            UI.toastSuccess(patient ? `Rutina "${routine.name}" aplicada. Tocá «Guardar» para guardarla en el paciente.` : `Rutina "${routine.name}" aplicada a la semana`);
            UI.closeModal();
        };
        if (!itemsIn(planOf())) return run();
        confirm(`La semana ya tiene actividades. ¿Reemplazarlas por la rutina "${routine.name}"?`, 'Reemplazar', async () => { run(); return true; }, false);
    }

    function stack(routine) {
        State.appendActivityPlan(routine.activityPlan);
        const patient = PlannerPatient.getSelectedId();
        UI.toastSuccess(`Rutina "${routine.name}" sumada a la semana${patient ? '. Tocá «Guardar» para guardarla en el paciente.' : ''}`);
        UI.closeModal();
    }

    // A confirmation that goes back to the list when cancelled; fn runs on confirm
    function confirm(message, confirmText, fn, reopen = true) {
        UI.openModal({
            title: 'Rutinas de ejercicio', content: `<p>${esc(message)}</p>`, confirmText, cancelText: 'Volver',
            onConfirm: async () => {
                await fn();
                if (reopen) await open();
                return !reopen;
            },
            onCancel: () => open()
        });
    }

    function editForm(routine) {
        const levels = ['beginner', 'intermediate', 'advanced'];
        UI.openModal({
            title: routine ? 'Editar rutina' : 'Guardar la semana como rutina',
            content: `
                <form class="routines__form" autocomplete="off">
                    <label class="form-group"><span class="form-label">Nombre *</span>
                        <input class="form-input" name="name" maxlength="120" value="${esc(routine?.name)}" placeholder="Ej.: Fuerza 3 días principiante" required></label>
                    <label class="form-group"><span class="form-label">Nivel</span>
                        <select class="form-select" name="level">${levels.map(l => `<option value="${l}" ${routine?.level === l ? 'selected' : ''}>${esc(UI.label('routineLevel', l))}</option>`).join('')}</select></label>
                    <label class="form-group"><span class="form-label">Descripción</span>
                        <textarea class="form-input" name="description" rows="2" maxlength="500">${esc(routine?.description)}</textarea></label>
                    ${routine ? '' : `<p class="text-muted">Se guarda la semana de actividad que está en pantalla: ${esc(daysSummary(planOf()))}.</p>`}
                </form>`,
            confirmText: routine ? 'Guardar cambios' : 'Guardar rutina',
            onCancel: () => open(),
            onConfirm: async () => {
                const data = Object.fromEntries(new FormData(document.querySelector('.routines__form')));
                if (!data.name.trim()) throw new Error('Escribí un nombre para la rutina');
                const body = { name: data.name.trim(), level: data.level, description: data.description.trim() };
                if (routine) await save(routine.id, body, 'Rutina actualizada');
                else {
                    await api('POST', '/api/activity-templates', { ...body, activityPlan: planOf() });
                    UI.toastSuccess('Rutina guardada');
                    await reload();
                }
                await open();
                return false;
            }
        });
    }

    async function save(id, body, message) {
        await api('PUT', `/api/activity-templates/${encodeURIComponent(id)}`, body);
        UI.toastSuccess(message);
        await reload();
    }

    document.addEventListener('DOMContentLoaded', init);

    return { open, reload, list, daysOf };
})();
