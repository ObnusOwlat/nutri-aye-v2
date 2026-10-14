/**
 * planner-activity-grid.js - The planner grid in "Actividad" mode: the same day
 * cards, with exercises and activities stacked one over another. Items come
 * dragged from the left column (or move between days); a click edits them.
 * Each day compares what the meals give with what the day needs.
 */

const PlannerActivityGrid = (function() {
    const DRAG_NEW = 'text/x-activity';      // JSON of a new item, from the sidebar
    const DRAG_MOVE = 'text/x-activity-move'; // "day|id" of an item of the grid
    const DRAG_ROUTINE = 'text/x-activity-routine'; // id of a routine, from the sidebar
    const esc = (t) => UI.escapeHtml(t);
    const INTENSITY = { low: 'suave', moderate: 'moderada', high: 'intensa' };

    const who = () => PlannerEnergy.person(PlannerSidebar.getPatientId());

    function detail(item) {
        if (item.kind === 'exercise') {
            const parts = [`${item.sets || '?'} × ${item.reps || '?'}`];
            if (item.weightKg) parts.push(`${UI.formatDecimal(item.weightKg)} kg`);
            parts.push(`${item.restSec ?? 60}" desc.`);
            return parts.join(' · ');
        }
        return `${UI.formatNumber(item.minutes || 0)} min`;
    }

    function itemHtml(day, item, person) {
        const kcal = PlannerEnergy.itemKcal(item, person);
        return `
            <div class="act-item act-item--${item.kind}" draggable="true" data-day="${day}" data-id="${esc(item.id)}" title="Tocá para editar · arrastrá para mover">
                <div class="act-item__name">${esc(item.name)}</div>
                <div class="act-item__detail">${esc(detail(item))}${kcal != null ? ` · <strong>${UI.formatNumber(kcal)} kcal</strong>` : ''}</div>
                <button class="act-item__remove" data-remove="${esc(item.id)}" data-day="${day}" title="Quitar">×</button>
            </div>`;
    }

    // Header line: energy of the activity and meals vs. need
    function balanceHtml(day, person) {
        const { need, activity } = PlannerEnergy.dayNeed(day, person);
        const eats = State.getDailyCalories(day);
        if (!person) return `<div class="act-balance">Gasto: elegí un paciente</div>`;
        if (need == null) return `<div class="act-balance">Actividad ${UI.formatNumber(activity)} kcal<br><small>Faltan peso, talla, edad o sexo</small></div>`;
        const ratio = need ? eats / need : 1;
        const state = !eats ? '' : ratio < 0.9 ? 'low' : ratio > 1.1 ? 'high' : 'ok';
        const hint = { low: 'come menos de lo que gasta', high: 'come más de lo que gasta', ok: 'equilibrado', '': 'sin comidas' }[state];
        return `
            <div class="act-balance act-balance--${state || 'none'}" title="Necesita = reposo (Mifflin-St Jeor) × ${UI.formatDecimal(PlannerEnergy.BASE_FACTOR)} + actividad del día">
                <span>Actividad <strong>${UI.formatNumber(activity)}</strong> kcal</span>
                <span>Come <strong>${UI.formatNumber(eats)}</strong> / necesita <strong>${UI.formatNumber(need)}</strong>${state === 'low' || state === 'high' ? ' ⚠' : ''}</span>
                <small>${hint}</small>
            </div>`;
    }

    function html(days, labels, todayIndex) {
        const person = who();
        return days.map((day, index) => {
            const items = State.getDayActivities(day);
            return `
                <div class="day-card day-card--activity" data-day="${day}">
                    <div class="day-card__header ${index === todayIndex ? 'day-card__header--today' : ''}">${labels[day]}${index === todayIndex ? ' (Hoy)' : ''}</div>
                    <div class="day-card__content">
                        ${balanceHtml(day, person)}
                        ${items.map(i => itemHtml(day, i, person)).join('')}
                        <div class="act-drop" data-day="${day}">+ Arrastrá un ejercicio o actividad</div>
                    </div>
                </div>`;
        }).join('');
    }

    // --- Editing
    function edit(day, id) {
        const item = State.getDayActivities(day).find(i => i.id === id);
        if (!item) return;
        const num = (field, label, value, attrs) => `
            <div class="form-group"><label class="form-label" for="act-${field}">${label}</label>
                <input class="form-input" type="number" id="act-${field}" value="${value ?? ''}" ${attrs}></div>`;
        const intensity = `
            <div class="form-group"><label class="form-label" for="act-intensity">Intensidad</label>
                <select class="form-select" id="act-intensity">${Object.entries(INTENSITY)
                    .map(([v, t]) => `<option value="${v}" ${(item.intensity || 'moderate') === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`;
        const fields = item.kind === 'exercise'
            ? `<div class="act-form">${num('sets', 'Series', item.sets, 'min="1" max="20"')}${num('reps', 'Repeticiones', item.reps, 'min="1" max="200"')}
               ${num('weightKg', 'Carga (kg)', item.weightKg, 'min="0" max="500" step="0.5"')}${num('restSec', 'Descanso (seg)', item.restSec ?? 60, 'min="0" max="900" step="5"')}</div>${intensity}`
            : `<div class="act-form">${num('minutes', 'Minutos', item.minutes, 'min="1" max="600"')}</div>
               <p class="text-muted">La intensidad ya está en la actividad elegida (Compendio 2024).</p>`;
        UI.openModal({
            title: item.name,
            content: `${fields}
                <div class="form-group"><label class="form-label" for="act-notes">Notas</label>
                    <input class="form-input" id="act-notes" maxlength="300" value="${esc(item.notes || '')}"></div>`,
            confirmText: 'Guardar',
            cancelText: 'Cancelar',
            onConfirm: () => {
                const value = (f) => { const v = document.getElementById(`act-${f}`)?.value; return v === '' || v == null ? null : Number(v); };
                const changes = { notes: document.getElementById('act-notes').value.trim() || null };
                const level = document.getElementById('act-intensity');
                if (level) changes.intensity = level.value;
                if (item.kind === 'exercise') Object.assign(changes, { sets: value('sets'), reps: value('reps'), weightKg: value('weightKg'), restSec: value('restSec') });
                else changes.minutes = value('minutes');
                State.updateActivity(day, id, changes);
            }
        });
    }

    // --- Events (delegated on the grid; only act in activity mode)
    function bind(grid) {
        grid.addEventListener('click', (e) => {
            if (State.getMode() !== 'activity') return;
            const remove = e.target.closest('[data-remove]');
            if (remove) { State.removeActivity(remove.dataset.day, remove.dataset.remove); return; }
            const item = e.target.closest('.act-item');
            if (item) edit(item.dataset.day, item.dataset.id);
        });
        grid.addEventListener('dragstart', (e) => {
            const item = e.target.closest('.act-item');
            if (!item || State.getMode() !== 'activity') return;
            e.dataTransfer.setData(DRAG_MOVE, `${item.dataset.day}|${item.dataset.id}`);
            e.dataTransfer.effectAllowed = 'move';
        });
        grid.addEventListener('dragover', (e) => {
            const card = e.target.closest('.day-card--activity');
            const types = e.dataTransfer.types;
            if (!card || ![DRAG_NEW, DRAG_MOVE, DRAG_ROUTINE].some(t => types.includes(t))) return;
            e.preventDefault();
            grid.querySelectorAll('.day-card--drop').forEach(c => c !== card && c.classList.remove('day-card--drop'));
            card.classList.add('day-card--drop');
        });
        grid.addEventListener('dragleave', (e) => { if (!e.relatedTarget?.closest?.('.day-card--drop')) grid.querySelectorAll('.day-card--drop').forEach(c => c.classList.remove('day-card--drop')); });
        grid.addEventListener('drop', (e) => {
            const card = e.target.closest('.day-card--activity');
            if (!card) return;
            e.preventDefault();
            card.classList.remove('day-card--drop');
            const day = card.dataset.day;
            const before = e.target.closest('.act-item')?.dataset.id || null;
            const moved = e.dataTransfer.getData(DRAG_MOVE);
            if (moved) {
                const [fromDay, id] = moved.split('|');
                if (id !== before) State.moveActivity(fromDay, id, day, before);
                return;
            }
            const routineId = e.dataTransfer.getData(DRAG_ROUTINE);
            if (routineId) { PlannerSidebarRoutines.dropOn(day, routineId); return; }
            const raw = e.dataTransfer.getData(DRAG_NEW);
            if (raw) add(day, JSON.parse(raw));
        });
    }

    // New item with sensible defaults (editable right after)
    function add(day, source) {
        const item = source.kind === 'exercise'
            ? { kind: 'exercise', refId: String(source.refId), name: source.name, activityId: source.activityId, sets: 3, reps: 12, restSec: 60, intensity: 'moderate' }
            : { kind: 'activity', refId: source.refId, name: source.name, activityId: source.activityId, minutes: 30 };
        State.addActivity(day, item);
        UI.toastSuccess(`${source.name} en ${UI.label('day', day)}`);
    }

    return { html, bind, add, DRAG_NEW, DRAG_ROUTINE };
})();
