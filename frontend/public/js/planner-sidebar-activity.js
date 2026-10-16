/**
 * planner-sidebar-activity.js - "Actividad" tab of the planner's left column
 * (common activities, 2024 Compendium, by group) and the wger exercise catalog
 * in the right panel, which takes the place of the nutrients in Actividad mode.
 * Both are dragged onto a day of the grid in "Actividad" mode, or tapped to
 * choose the day. Kcal are estimated in the grid (planner-energy.js).
 */

const PlannerSidebarActivity = (function() {
    let panel, exPanel, activityList, exSearch, exMuscle, exCategory, exList;
    let searchTimer = null;
    let exercises = new Map();   // shown exercises by id, for drag/tap
    const esc = (t) => UI.escapeHtml(t);

    function init() {
        panel = document.querySelector('[data-sidebar-panel="activity"]');
        if (!panel) return;
        exPanel = document.getElementById('planner-exercises');
        activityList = panel.querySelector('#sidebar-activity-list');
        exSearch = exPanel.querySelector('#sidebar-exercise-search');
        exMuscle = exPanel.querySelector('#sidebar-exercise-muscle');
        exCategory = exPanel.querySelector('#sidebar-exercise-category');
        exList = exPanel.querySelector('#sidebar-exercise-list');

        [exSearch, exMuscle, exCategory].forEach(el => el.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(searchExercises, 250);
        }));
        [panel, exPanel].forEach(el => {
            el.addEventListener('dragstart', (e) => {
                const source = sourceOf(e.target.closest('[data-source]'));
                if (!source) return;
                e.dataTransfer.setData(PlannerActivityGrid.DRAG_NEW, JSON.stringify(source));
                e.dataTransfer.effectAllowed = 'copy';
                if (State.getMode() !== 'activity') State.setMode('activity');
            });
            el.addEventListener('click', (e) => {
                const source = sourceOf(e.target.closest('[data-source]'));
                if (source) chooseDay(source);
            });
        });
        // Activity mode shows this tab
        State.subscribe('plannerMode:changed', (mode) => { if (mode === 'activity') PlannerSidebar.showTab('activity'); });
        State.subscribe('activities:loaded', renderActivities);
        State.subscribe('state:ready', loadFilters);
        if (State.isReady()) loadFilters();
    }

    // { kind, refId, name, activityId } of a list row
    function sourceOf(row) {
        if (!row) return null;
        if (row.dataset.source === 'activity') {
            const a = PlannerEnergy.getActivity(row.dataset.id);
            return a && { kind: 'activity', refId: a.id, name: a.name, activityId: a.id };
        }
        const ex = exercises.get(row.dataset.id);
        return ex && { kind: 'exercise', refId: String(ex.id), name: ex.name, activityId: ex.activityId };
    }

    function chooseDay(source) {
        const options = State.DAYS.map(d => `<option value="${d}">${esc(UI.label('day', d))}</option>`).join('');
        UI.openModal({
            title: `Agregar "${source.name}"`,
            content: `<div class="form-group"><label class="form-label" for="act-pick-day">Día</label>
                <select class="form-select" id="act-pick-day">${options}</select></div>`,
            confirmText: 'Agregar',
            cancelText: 'Cancelar',
            onConfirm: () => {
                State.setMode('activity');
                PlannerActivityGrid.add(document.getElementById('act-pick-day').value, source);
            }
        });
    }

    function renderActivities() {
        const groups = {};
        for (const a of PlannerEnergy.list()) (groups[a.category] = groups[a.category] || []).push(a);
        activityList.innerHTML = Object.entries(groups).map(([category, list], i) => `
            <details class="sidebar-group" ${i === 0 ? 'open' : ''}>
                <summary>${esc(category)} <span>(${list.length})</span></summary>
                ${list.map(a => `<div class="sidebar-drag" draggable="true" data-source="activity" data-id="${esc(a.id)}"
                    title="Arrastrá a un día de la semana o tocá para elegirlo">${esc(a.name)} <small>${UI.formatDecimal(a.adult.met)} MET</small></div>`).join('')}
            </details>`).join('');
    }

    async function loadFilters() {
        try {
            const filters = await State._api('GET', '/api/exercises/filters');
            exMuscle.innerHTML = '<option value="">Músculo</option>' + filters.muscles.map(m => `<option>${esc(m)}</option>`).join('');
            exCategory.innerHTML = '<option value="">Zona</option>' + filters.categories.map(c => `<option>${esc(c)}</option>`).join('');
            searchExercises();
        } catch (error) {
            exList.innerHTML = `<p class="sidebar-note">No se pudieron cargar los ejercicios: ${esc(error.message)}</p>`;
        }
    }

    async function searchExercises() {
        const params = new URLSearchParams({ limit: 30, search: exSearch.value, muscle: exMuscle.value, category: exCategory.value });
        try {
            const res = await fetch(`/api/exercises?${params}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
            exercises = new Map(json.data.map(e => [String(e.id), e]));
            const more = json.pagination.total - json.data.length;
            exList.innerHTML = json.data.map(e => `
                <div class="sidebar-exercise" draggable="true" data-source="exercise" data-id="${esc(String(e.id))}" title="Arrastrá a un día de la semana o tocá para elegirlo">
                    ${e.image ? `<img src="${esc(e.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<div class="sidebar-exercise__noimg">🏋</div>'}
                    <div>
                        <strong>${esc(e.name)}</strong>${e.translated ? '' : ' <small class="sidebar-tag">en inglés</small>'}
                        <div class="sidebar-note">${esc(e.category)}${e.muscles.length ? ' · ' + esc(e.muscles.join(', ')) : ''}</div>
                        <div class="sidebar-note sidebar-note--small">${esc(e.equipment.join(', ') || 'Sin equipo')} · ${esc(e.license || '')}${e.author ? ', ' + esc(e.author) : ''} (wger)</div>
                    </div>
                </div>`).join('') + (more > 0 ? `<p class="sidebar-note">y ${UI.formatNumber(more)} más: afiná la búsqueda.</p>` : '')
                || '<p class="sidebar-note">Sin resultados.</p>';
        } catch (error) {
            exList.innerHTML = `<p class="sidebar-note">No se pudo buscar: ${esc(error.message)}</p>`;
        }
    }

    document.addEventListener('DOMContentLoaded', init);
    return {};
})();
