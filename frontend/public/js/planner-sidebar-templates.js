/**
 * planner-sidebar-templates.js - "Plantillas" in the planner's left column
 * (Comidas mode). Day templates (one day, breakfast to dinner) and the days of
 * each template week are dragged onto a day of the grid, or tapped to choose
 * the day: they fill the empty meals, and ask before replacing. Template weeks
 * are added ("Sumar", only empty meals) or replace the week being edited.
 * 💾 on a day header saves that day as a new day template.
 */

const PlannerSidebarTemplates = (function() {
    const DRAG_DAY = 'text/x-meal-day';
    let dayList, weekList;
    let dayTemplates = [];
    const esc = (t) => UI.escapeHtml(t ?? '');

    function init() {
        dayList = document.getElementById('sidebar-day-template-list');
        weekList = document.getElementById('sidebar-week-template-list');
        if (!dayList) return;

        const panel = dayList.closest('[data-sidebar-panel]');
        panel.addEventListener('dragstart', (e) => {
            const row = e.target.closest('[data-meals]');
            if (!row) return;
            e.dataTransfer.setData(DRAG_DAY, JSON.stringify({ name: row.dataset.name, meals: JSON.parse(row.dataset.meals) }));
            e.dataTransfer.effectAllowed = 'copy';
        });
        panel.addEventListener('click', onPanelClick);
        bindGrid();

        State.subscribe('dietTemplates:updated', render);
        State.subscribe('recipes:updated', render);
        State.subscribe('state:ready', reload);
        if (State.isReady()) reload();
    }

    async function reload() {
        try {
            dayTemplates = await State._api('GET', '/api/day-templates');
        } catch (error) {
            dayList.innerHTML = `<p class="sidebar-note">No se pudieron cargar las plantillas: ${esc(error.message)}</p>`;
            return;
        }
        render();
    }

    // --- Lists
    const recipeNames = (meals) => State.VALID_MEAL_TYPES.map(m => State.getRecipe(meals[m])?.name).filter(Boolean);
    const filled = (meals) => recipeNames(meals || {}).length > 0;

    function dayRow(name, meals, extra = '') {
        const names = recipeNames(meals);
        return `
            <div class="sidebar-drag sidebar-day" draggable="true" data-name="${esc(name)}" data-meals="${esc(JSON.stringify(meals))}"
                 title="${esc(names.join(' · '))}">
                <span>${esc(name)} <small>${UI.plural(names.length, 'comida')}</small></span>${extra}
            </div>`;
    }

    // Different days of a template week; equal days count once ('Lun, Mié')
    function daysOf(weekPlan) {
        const groups = new Map();
        for (const day of State.DAYS) {
            const meals = weekPlan?.[day];
            if (!filled(meals)) continue;
            const key = JSON.stringify(State.VALID_MEAL_TYPES.map(m => meals[m] || null));
            if (!groups.has(key)) groups.set(key, { days: [], meals });
            groups.get(key).days.push(UI.label('day', day).slice(0, 3));
        }
        return [...groups.values()];
    }

    function render() {
        dayList.innerHTML = dayTemplates.map(t => dayRow(t.name, t.meals,
            `<button class="sidebar-day__off" type="button" data-deactivate="${esc(t.id)}" title="Quitar plantilla">×</button>`)).join('')
            || '<p class="sidebar-note">Todavía no hay plantillas de día. Usá 💾 en la cabecera de un día.</p>';

        weekList.innerHTML = State.getDietTemplates().filter(t => daysOf(t.weekPlan).length).map(t => `
            <details class="sidebar-week">
                <summary>${esc(t.name)} <small>${UI.formatNumber(t.dailyTarget)} kcal</small></summary>
                <div class="sidebar-week__actions">
                    <button class="btn btn--secondary btn--sm" type="button" data-week="${esc(t.id)}" data-replace="0" title="Completa solo las comidas vacías de la semana">+ Sumar</button>
                    <button class="btn btn--secondary btn--sm" type="button" data-week="${esc(t.id)}" data-replace="1" title="Reemplaza la semana entera">Reemplazar</button>
                </div>
                ${daysOf(t.weekPlan).map(g => dayRow(`${t.name} · ${g.days.join(', ')}`, g.meals)).join('')}
            </details>`).join('') || '<p class="sidebar-note">Ninguna plantilla de semana tiene comidas cargadas.</p>';
    }

    function onPanelClick(e) {
        const off = e.target.closest('[data-deactivate]');
        if (off) return deactivate(off.dataset.deactivate);
        const week = e.target.closest('[data-week]');
        if (week) return applyWeek(week.dataset.week, week.dataset.replace === '1');
        const row = e.target.closest('[data-meals]');
        if (row) chooseDay(row.dataset.name, JSON.parse(row.dataset.meals));
    }

    // --- Applying
    function warnUnsuitable(text, recipeIds) {
        const bad = [...new Set(recipeIds)].filter(id => PlannerSidebar.isUnsuitable(id)).length;
        if (bad) UI.toastWarning(`${text}. ${UI.plural(bad, 'receta no apta', 'recetas no aptas')} para el paciente: revisá las ⚠`);
        else UI.toastSuccess(text);
    }

    // Meals that already have another recipe: ask whether to replace them
    function applyDay(day, name, meals) {
        const current = State.getDayMeals(day);
        const clashes = State.VALID_MEAL_TYPES.filter(m => meals[m] && State.getRecipe(meals[m]) && current[m] && current[m] !== meals[m]);
        const done = (replace) => {
            State.fillDay(day, meals, replace);
            warnUnsuitable(`${name} en el ${UI.label('day', day).toLowerCase()}`, Object.values(meals).filter(Boolean));
        };
        if (!clashes.length) return done(false);
        UI.openModal({
            title: `${UI.label('day', day)} ya tiene comidas`,
            content: `<p>Ya hay ${esc(clashes.map(m => UI.label('mealType', m).toLowerCase()).join(', '))}.</p>
                <label class="routines__session"><input type="radio" name="day-template-mode" value="fill" checked> <span>Completar solo lo vacío</span></label>
                <label class="routines__session"><input type="radio" name="day-template-mode" value="replace"> <span>Reemplazar lo que ya está</span></label>`,
            confirmText: 'Aplicar',
            cancelText: 'Cancelar',
            onConfirm: () => done(document.querySelector('input[name="day-template-mode"]:checked')?.value === 'replace')
        });
    }

    function chooseDay(name, meals) {
        const options = State.DAYS.map(d => `<option value="${d}">${esc(UI.label('day', d))}</option>`).join('');
        UI.openModal({
            title: `Poner "${name}" en un día`,
            content: `<div class="form-group"><label class="form-label" for="day-template-pick">Día</label>
                <select class="form-select" id="day-template-pick">${options}</select></div>`,
            confirmText: 'Seguir',
            cancelText: 'Cancelar',
            onConfirm: () => {
                const day = document.getElementById('day-template-pick').value;
                setTimeout(() => applyDay(day, name, meals), 0); // after this modal closes
            }
        });
    }

    function applyWeek(templateId, replace) {
        const template = State.getDietTemplate(templateId);
        if (!template) return;
        const ids = Object.values(template.weekPlan || {}).flatMap(d => Object.values(d || {})).filter(Boolean);
        const done = () => {
            State.fillWeek(template.weekPlan, replace);
            warnUnsuitable(`${template.name} ${replace ? 'reemplazó la semana' : 'sumada a la semana'}`, ids);
        };
        if (!replace) return done();
        UI.confirm(`¿Reemplazar toda la semana por "${template.name}"? Las comidas que hay ahora se quitan.`, done);
    }

    // Drop on a day of the grid (redrawn often: delegation)
    function bindGrid() {
        const grid = document.getElementById('week-grid');
        grid?.addEventListener('dragover', (e) => {
            const card = e.target.closest('.day-card');
            if (!card || !e.dataTransfer.types.includes(DRAG_DAY) || State.getMode() === 'activity') return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            grid.querySelectorAll('.day-card--drop').forEach(c => c !== card && c.classList.remove('day-card--drop'));
            card.classList.add('day-card--drop');
        });
        grid?.addEventListener('dragleave', (e) => {
            if (!e.relatedTarget || !e.target.closest('.day-card')?.contains(e.relatedTarget)) e.target.closest('.day-card')?.classList.remove('day-card--drop');
        });
        grid?.addEventListener('drop', (e) => {
            const card = e.target.closest('.day-card');
            const data = e.dataTransfer.getData(DRAG_DAY);
            if (!card || !data) return;
            e.preventDefault();
            e.stopPropagation();
            card.classList.remove('day-card--drop');
            const { name, meals } = JSON.parse(data);
            applyDay(card.dataset.day, name, meals);
        });
        grid?.addEventListener('click', (e) => {
            const save = e.target.closest('[data-save-day]');
            if (save) { e.stopPropagation(); saveDay(save.dataset.saveDay); }
        });
    }

    // --- Saving and removing day templates
    function saveDay(day) {
        const meals = State.getDayMeals(day);
        const names = recipeNames(meals);
        if (!names.length) return;
        UI.openModal({
            title: `Guardar el ${UI.label('day', day).toLowerCase()} como plantilla`,
            content: `<div class="form-group"><label class="form-label" for="day-template-name">Nombre</label>
                <input class="form-input" id="day-template-name" maxlength="120" placeholder="Ej.: Día liviano 1.500 kcal"></div>
                <p class="sidebar-note">${esc(names.join(' · '))}</p>`,
            confirmText: 'Guardar',
            cancelText: 'Cancelar',
            onConfirm: async () => {
                const name = document.getElementById('day-template-name').value.trim() || `${UI.label('day', day)} (${UI.formatCalories(State.getDailyCalories(day))})`;
                try {
                    dayTemplates = [...dayTemplates, await State._api('POST', '/api/day-templates', { name, meals })]
                        .sort((a, b) => a.name.localeCompare(b.name, 'es'));
                    render();
                    PlannerSidebar.showTab('templates');
                    UI.toastSuccess(`Plantilla «${name}» guardada`);
                } catch (error) {
                    UI.toastError('No se pudo guardar la plantilla: ' + error.message);
                }
            }
        });
    }

    function deactivate(id) {
        const template = dayTemplates.find(t => t.id === id);
        if (!template) return;
        UI.confirmDanger(`¿Quitar la plantilla «${template.name}»? Se desactiva; las semanas que ya la usan no cambian.`, async () => {
            try {
                await State._api('DELETE', `/api/day-templates/${encodeURIComponent(id)}`);
                dayTemplates = dayTemplates.filter(t => t.id !== id);
                render();
            } catch (error) {
                UI.toastError('No se pudo quitar la plantilla: ' + error.message);
            }
        }, 'Quitar');
    }

    document.addEventListener('DOMContentLoaded', init);
    return { reload };
})();
