/**
 * planner-sidebar.js - Left column of the planner: tabs Paciente / Recetas /
 * Actividad (Recetas only in Comidas mode, Actividad only in Actividad mode;
 * body[data-planner-mode] also swaps the right panel: nutrients or exercises). This file has the tabs, the patient sheet and the patient's recipe
 * warnings (from GET /api/patients/:id/recipe-suggestions), which the grid
 * uses to mark planned meals with ⚠. Recipes and activity live in
 * planner-sidebar-recipes.js and planner-sidebar-activity.js.
 */

const PlannerSidebar = (function() {
    let root, patientBody;
    let patientId = null;
    let suggestions = null;            // last response for the patient: { patient, data }
    const byRecipe = new Map();        // recipeId -> suggestion (score, reasons, warnings)
    let requestId = 0;

    function init() {
        root = document.getElementById('planner-sidebar');
        if (!root) return;
        patientBody = root.querySelector('#planner-sidebar-patient');

        root.querySelector('.planner-sidebar__tabs').addEventListener('click', (e) => {
            const tab = e.target.closest('[data-sidebar-tab]');
            if (tab) showTab(tab.dataset.sidebarTab);
        });

        // Wide page only on the planner tab
        UI.on('app:tabChanged', ({ tab }) => { document.body.dataset.tab = tab; });
        State.subscribe('plannerMode:changed', onMode);
        onMode(State.getMode());
        State.subscribe('plannerPatient:changed', setPatient);
        State.subscribe('patients:updated', () => patientId && loadSuggestions());
        State.subscribe('recipes:updated', () => patientId && loadSuggestions());
        State.subscribe('weekPlan:updated', renderPatient);
        renderPatient();
    }

    function showTab(name) {
        root.querySelectorAll('[data-sidebar-tab]').forEach(t => t.classList.toggle('active', t.dataset.sidebarTab === name));
        root.querySelectorAll('[data-sidebar-panel]').forEach(p => { p.hidden = p.dataset.sidebarPanel !== name; });
    }

    // Each mode shows only its own tab: Recetas for meals, Actividad for activity
    function onMode(mode) {
        document.body.dataset.plannerMode = mode;
        const own = mode === 'activity' ? 'activity' : 'recipes';
        const active = root.querySelector('[data-sidebar-tab].active')?.dataset.sidebarTab;
        if (active !== 'patient' && active !== own) showTab(own);
    }

    function setPatient(id) {
        patientId = id || null;
        suggestions = null;
        byRecipe.clear();
        renderPatient();
        if (patientId) loadSuggestions(); else changed();
    }

    // Every recipe of the consultorio, ranked for the patient (also gives the warnings)
    async function loadSuggestions() {
        const current = ++requestId, id = patientId;
        try {
            const res = await fetch(`/api/patients/${encodeURIComponent(id)}/recipe-suggestions?limit=200`);
            const json = await res.json();
            if (!res.ok || json.success === false) throw new Error(json.error || `Error ${res.status}`);
            if (current !== requestId) return;
            suggestions = json;
            byRecipe.clear();
            json.data.forEach(s => byRecipe.set(s.recipeId, s));
            renderPatient();
            changed();
        } catch (error) {
            if (current === requestId) UI.toastError('No se pudieron calcular las sugerencias: ' + error.message);
        }
    }

    // The grid and the recipes tab redraw with the new warnings/ranking
    const changed = () => State.emit('plannerSuggestions:updated', { patientId, suggestions });

    const warningsFor = (recipeId) => (patientId ? byRecipe.get(recipeId)?.warnings || [] : []);
    // A severe allergy of the patient is in the recipe: choosing it asks first
    const isBlocked = (recipeId) => !!(patientId && byRecipe.get(recipeId)?.blocked);
    // An allergen, or far over a limit of a condition: hidden from the suggestions, asks before adding
    const isUnsuitable = (recipeId) => !!(patientId && byRecipe.get(recipeId)?.unsuitable);

    function weekWarnings() {
        const week = State.getWeekPlan();
        const ids = new Set(Object.values(week).flatMap(day => Object.values(day)).filter(Boolean));
        return [...ids].map(id => ({ recipe: State.getRecipe(id), warnings: warningsFor(id) }))
            .filter(x => x.recipe && x.warnings.length);
    }

    const esc = (t) => UI.escapeHtml(t);
    const item = (labelText, value) => (value ? `<div class="sidebar-fact"><span>${labelText}</span><strong>${value}</strong></div>` : '');

    function renderPatient() {
        if (!patientBody) return;
        const context = patientId ? State.getPatientContext(patientId) : null;
        if (!context) {
            patientBody.innerHTML = '<p class="sidebar-note">Elegí un paciente arriba para ver su ficha, las alertas de la semana y recetas sugeridas para él o ella.</p>';
            return;
        }
        const p = context.patient, m = context.latestMetrics;
        const age = State.calculateAge(p.dateOfBirth);
        const info = suggestions?.patient;

        const conditions = context.conditions.map(c => `
            <li><strong>${esc(c.name)}</strong> <small>${esc(UI.label('conditionType', c.type))}${c.severity ? ' · ' + esc(UI.label('severity', c.severity)) : ''}</small>
                ${c.dietaryNotes ? `<div class="sidebar-note">${esc(c.dietaryNotes)}</div>` : ''}</li>`).join('');

        const rules = (info?.rules || []).map(r => `<li title="${esc(r.source)}">${esc(r.label)}</li>`).join('');
        const allergens = (info?.allergens || []).map(esc).join(', ');
        const alerts = weekWarnings().map(({ recipe, warnings }) =>
            `<li><strong>${esc(recipe.name)}</strong><br><small>${warnings.map(esc).join('<br>')}</small></li>`).join('');

        patientBody.innerHTML = `
            <h4 class="sidebar-title">${esc(p.firstName)} ${esc(p.lastName)}</h4>
            ${item('Edad', age != null ? UI.plural(age, 'año') : '')}
            ${item('Sexo', UI.label('gender', p.gender))}
            ${item('Peso', m?.weight ? `${UI.formatDecimal(m.weight)} kg` : '')}
            ${item('IMC', m?.bmi ? `${UI.formatDecimal(m.bmi)} (${UI.label('bmiCategory', State.getBMICategory(m.bmi))})` : '')}
            ${item('Objetivo', UI.label('dietGoal', context.goal))}
            ${item('Meta', `${UI.formatNumber(context.targetCalories)} kcal/día`)}
            ${m ? '' : '<p class="sidebar-note">Sin mediciones registradas.</p>'}

            <h5 class="sidebar-subtitle">Condiciones</h5>
            ${conditions ? `<ul class="sidebar-list">${conditions}</ul>` : '<p class="sidebar-note">Sin condiciones cargadas.</p>'}

            ${rules ? `<h5 class="sidebar-subtitle">Reglas que se aplican</h5><ul class="sidebar-list sidebar-list--tags">${rules}</ul>` : ''}
            ${allergens ? `<p class="sidebar-allergens">⚠ Evitar: ${allergens}</p>` : ''}

            <h5 class="sidebar-subtitle">Alertas de la semana</h5>
            ${alerts ? `<ul class="sidebar-list sidebar-list--alerts">${alerts}</ul>`
                     : `<p class="sidebar-note">${suggestions ? 'Ninguna receta de la semana choca con el paciente.' : 'Calculando…'}</p>`}
            <p class="sidebar-note sidebar-note--small">Sugerencias orientativas por reglas (OMS, ADA, KDIGO, NASEM). Decide la nutricionista.</p>`;
    }

    return { init, warningsFor, isBlocked, isUnsuitable, getPatientId: () => patientId, getSuggestions: () => suggestions, showTab };
})();

document.addEventListener('DOMContentLoaded', () => PlannerSidebar.init());
