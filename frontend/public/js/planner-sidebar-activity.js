/**
 * planner-sidebar-activity.js - "Actividad" tab of the planner's left column:
 * estimated kcal of an activity for the patient (MET, 2024 Compendium; weight
 * from the patient's latest measurement) and the wger exercise catalog.
 * Nothing is saved yet: it is a calculator to plan alongside the diet.
 */

const PlannerSidebarActivity = (function() {
    let panel, activitySelect, minutesInput, timesInput, weightInput, result, exSearch, exMuscle, exCategory, exList;
    let activities = [];
    let searchTimer = null;
    const esc = (t) => UI.escapeHtml(t);

    async function init() {
        panel = document.querySelector('[data-sidebar-panel="activity"]');
        if (!panel) return;
        activitySelect = panel.querySelector('#sidebar-activity');
        minutesInput = panel.querySelector('#sidebar-activity-minutes');
        timesInput = panel.querySelector('#sidebar-activity-times');
        weightInput = panel.querySelector('#sidebar-activity-weight');
        result = panel.querySelector('#sidebar-activity-result');
        exSearch = panel.querySelector('#sidebar-exercise-search');
        exMuscle = panel.querySelector('#sidebar-exercise-muscle');
        exCategory = panel.querySelector('#sidebar-exercise-category');
        exList = panel.querySelector('#sidebar-exercise-list');

        [activitySelect, minutesInput, timesInput, weightInput].forEach(el => el.addEventListener('change', estimate));
        [exSearch, exMuscle, exCategory].forEach(el => el.addEventListener('input', () => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(searchExercises, 250);
        }));
        exList.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-activity-id]');
            if (!btn) return;
            activitySelect.value = btn.dataset.activityId;
            estimate();
            panel.querySelector('.sidebar-activity__calc').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
        State.subscribe('plannerPatient:changed', () => { weightInput.value = ''; estimate(); });
        State.subscribe('state:ready', load);
        if (State.isReady()) load();
    }

    async function load() {
        if (activities.length) return;
        try {
            const [acts, filters] = await Promise.all([State._api('GET', '/api/activities'), State._api('GET', '/api/exercises/filters')]);
            activities = acts;
            const groups = {};
            for (const a of acts) (groups[a.category] = groups[a.category] || []).push(a);
            activitySelect.innerHTML = Object.entries(groups).map(([cat, list]) =>
                `<optgroup label="${esc(cat)}">${list.map(a => `<option value="${esc(a.id)}">${esc(a.name)}</option>`).join('')}</optgroup>`).join('');
            activitySelect.value = 'caminar_rapido';
            exMuscle.innerHTML = '<option value="">Músculo</option>' + filters.muscles.map(m => `<option>${esc(m)}</option>`).join('');
            exCategory.innerHTML = '<option value="">Zona</option>' + filters.categories.map(c => `<option>${esc(c)}</option>`).join('');
            estimate();
            searchExercises();
        } catch (error) {
            result.innerHTML = `<p class="sidebar-note">No se pudieron cargar las actividades: ${esc(error.message)}</p>`;
        }
    }

    async function estimate() {
        if (!activities.length) return;
        const patientId = PlannerSidebar.getPatientId();
        const params = new URLSearchParams({ activityId: activitySelect.value, minutes: minutesInput.value || 30 });
        if (patientId) params.set('patientId', patientId);
        if (weightInput.value) params.set('weightKg', weightInput.value);
        if (!patientId && !weightInput.value) {
            result.innerHTML = '<p class="sidebar-note">Elegí un paciente o escribí un peso para calcular.</p>';
            return;
        }
        try {
            const r = await State._api('GET', `/api/activities/kcal?${params}`);
            const times = Math.max(1, parseInt(timesInput.value, 10) || 1);
            result.innerHTML = `
                <div class="sidebar-activity__kcal">${UI.formatNumber(r.kcal)} <small>kcal por sesión</small></div>
                <div class="sidebar-note">${UI.plural(times, 'vez', 'veces')} por semana ≈ <strong>${UI.formatNumber(r.kcal * times)} kcal/semana</strong>
                    (≈ ${UI.formatNumber(Math.round(r.kcal * times / 7))} kcal/día)</div>
                <div class="sidebar-note sidebar-note--small">${UI.formatDecimal(r.met)} MET · ${UI.formatDecimal(r.weightKg)} kg${r.age != null ? ` · ${r.age} años` : ''} · ${esc(r.table)}, código ${esc(r.code)}</div>`;
        } catch (error) {
            result.innerHTML = `<p class="sidebar-note">${esc(error.message)}</p>`;
        }
    }

    async function searchExercises() {
        const params = new URLSearchParams({ limit: 30, search: exSearch.value, muscle: exMuscle.value, category: exCategory.value });
        try {
            const res = await fetch(`/api/exercises?${params}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
            const more = json.pagination.total - json.data.length;
            exList.innerHTML = json.data.map(e => `
                <div class="sidebar-exercise">
                    ${e.image ? `<img src="${esc(e.image)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : '<div class="sidebar-exercise__noimg">🏋</div>'}
                    <div>
                        <strong>${esc(e.name)}</strong>${e.translated ? '' : ' <small class="sidebar-tag">en inglés</small>'}
                        <div class="sidebar-note">${esc(e.category)}${e.muscles.length ? ' · ' + esc(e.muscles.join(', ')) : ''}</div>
                        <div class="sidebar-note sidebar-note--small">${esc(e.equipment.join(', ') || 'Sin equipo')} · ${esc(e.license || '')}${e.author ? ', ' + esc(e.author) : ''} (wger)</div>
                        <button class="btn btn--secondary btn--sm" data-activity-id="${esc(e.activityId)}">Estimar kcal</button>
                    </div>
                </div>`).join('') + (more > 0 ? `<p class="sidebar-note">y ${UI.formatNumber(more)} más: afiná la búsqueda.</p>` : '')
                || '<p class="sidebar-note">Sin resultados.</p>';
        } catch (error) {
            exList.innerHTML = `<p class="sidebar-note">No se pudo buscar: ${esc(error.message)}</p>`;
        }
    }

    document.addEventListener('DOMContentLoaded', init);
    return { estimate };
})();
