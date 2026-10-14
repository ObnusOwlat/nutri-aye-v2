/**
 * planner-sidebar-routines.js - "Rutinas" in the planner's left column
 * (Actividad tab). A routine is dragged onto one day of the grid, or tapped to
 * choose the day, and its items go after what the day already has: routines
 * stack. When the routine has different sessions (upper / lower body), it asks
 * which one. The whole week is applied or added from 🏋 Rutinas.
 */

const PlannerSidebarRoutines = (function() {
    let listEl;
    const esc = (t) => UI.escapeHtml(t ?? '');

    function init() {
        listEl = document.getElementById('sidebar-routine-list');
        if (!listEl) return;
        listEl.addEventListener('dragstart', (e) => {
            const row = e.target.closest('[data-routine]');
            if (!row) return;
            e.dataTransfer.setData(PlannerActivityGrid.DRAG_ROUTINE, row.dataset.routine);
            e.dataTransfer.effectAllowed = 'copy';
            if (State.getMode() !== 'activity') State.setMode('activity');
        });
        listEl.addEventListener('click', (e) => {
            const row = e.target.closest('[data-routine]');
            if (row) chooseDay(row.dataset.routine);
        });
        State.subscribe('routines:updated', render);
        const load = () => PlannerRoutines.reload().catch(error => {
            listEl.innerHTML = `<p class="sidebar-note">No se pudieron cargar las rutinas: ${esc(error.message)}</p>`;
        });
        State.subscribe('state:ready', load);
        if (State.isReady()) load();
    }

    function render() {
        const routines = PlannerRoutines.list();
        listEl.innerHTML = routines.map(r => `
            <div class="sidebar-drag" draggable="true" data-routine="${esc(r.id)}" title="Arrastrá a un día para sumarla ahí, o tocá para elegir el día">
                ${esc(r.name)} <small>${sessionsOf(r).length > 1 ? `${sessionsOf(r).length} sesiones` : '1 sesión'}</small>
            </div>`).join('') || '<p class="sidebar-note">Todavía no hay rutinas. Guardá una semana desde 🏋 Rutinas.</p>';
    }

    // Different days of a routine: [{ label: 'Lun y Vie', items }]; equal days count once
    function sessionsOf(routine) {
        const sessions = new Map();
        for (const { short, items } of PlannerRoutines.daysOf(routine.activityPlan)) {
            const key = JSON.stringify(items.map(({ id, ...rest }) => rest));
            if (!sessions.has(key)) sessions.set(key, { days: [], items });
            sessions.get(key).days.push(short);
        }
        return [...sessions.values()].map(s => ({ label: s.days.join(', '), items: s.items }));
    }

    const find = (id) => PlannerRoutines.list().find(r => r.id === id);

    function addTo(day, routine, items) {
        State.setMode('activity');
        State.appendDayActivities(day, items);
        UI.toastSuccess(`${routine.name} sumada al ${UI.label('day', day).toLowerCase()}`);
    }

    // Drop on a day: one session goes straight in; several ask which one
    function dropOn(day, routineId) {
        const routine = find(routineId);
        if (!routine) return;
        const sessions = sessionsOf(routine);
        if (!sessions.length) return UI.toastError('La rutina no tiene actividades');
        if (sessions.length === 1) return addTo(day, routine, sessions[0].items);
        UI.openModal({
            title: `¿Qué sesión de "${routine.name}"?`,
            content: `<p class="text-muted">Se suma al ${esc(UI.label('day', day).toLowerCase())}, después de lo que ya tiene.</p>
                ${sessions.map((s, i) => `<label class="routines__session"><input type="radio" name="routine-session" value="${i}" ${i ? '' : 'checked'}>
                    <span><strong>${esc(s.label)}:</strong> ${esc(s.items.map(it => it.name).join(', '))}</span></label>`).join('')}`,
            confirmText: 'Sumar',
            cancelText: 'Cancelar',
            onConfirm: () => {
                const index = Number(document.querySelector('input[name="routine-session"]:checked')?.value || 0);
                addTo(day, routine, sessions[index].items);
            }
        });
    }

    function chooseDay(routineId) {
        const routine = find(routineId);
        if (!routine) return;
        const options = State.DAYS.map(d => `<option value="${d}">${esc(UI.label('day', d))}</option>`).join('');
        UI.openModal({
            title: `Sumar "${routine.name}" a un día`,
            content: `<div class="form-group"><label class="form-label" for="routine-pick-day">Día</label>
                <select class="form-select" id="routine-pick-day">${options}</select></div>`,
            confirmText: 'Seguir',
            cancelText: 'Cancelar',
            onConfirm: () => {
                const day = document.getElementById('routine-pick-day').value;
                setTimeout(() => dropOn(day, routineId), 0); // after this modal closes
            }
        });
    }

    document.addEventListener('DOMContentLoaded', init);
    return { dropOn };
})();
