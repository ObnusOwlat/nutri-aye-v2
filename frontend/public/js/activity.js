/**
 * activity.js - "Actividad" tab (admins): who changed what and when in the
 * consultorio, with filters by user, type, action and dates
 */

const Activity = (function() {
    let container = null;
    let page = 1;
    let filters = {};

    function init() {
        container = document.getElementById('activity');
        if (!container) return;
        UI.on('app:tabChanged', ({ tab }) => { if (tab === 'activity') show(); });
        // The app may reopen on this tab before the session is confirmed
        Auth.ready.then(() => { if (App.currentTab === 'activity') show(); });
    }

    async function show() {
        if (Auth.current()?.role !== 'admin') return;
        if (!container.dataset.ready) await renderShell();
        load(1);
    }

    async function renderShell() {
        const users = await request('/api/users').catch(() => []);
        const options = (map) => Object.entries(map).map(([v, l]) => `<option value="${v}">${UI.escapeHtml(l)}</option>`).join('');
        container.innerHTML = `
            <form class="activity__filters" data-form="filters">
                <select class="form-select" name="userId"><option value="">Todos los usuarios</option>
                    ${users.map(u => `<option value="${UI.escapeHtml(u.id)}">${UI.escapeHtml(u.name)}</option>`).join('')}</select>
                <select class="form-select" name="entity"><option value="">Todo tipo de dato</option>${options(AuditView.ENTITIES)}</select>
                <select class="form-select" name="action"><option value="">Toda acción</option>${options(AuditView.ACTIONS)}</select>
                <label>Desde <input class="form-input" type="date" name="from"></label>
                <label>Hasta <input class="form-input" type="date" name="to"></label>
                <button class="btn btn--primary btn--sm" type="submit">Filtrar</button>
            </form>
            <div class="activity__results"></div>
            <div class="activity__pager"></div>`;
        container.dataset.ready = '1';

        container.querySelector('[data-form=filters]').addEventListener('submit', (e) => {
            e.preventDefault();
            filters = Object.fromEntries([...new FormData(e.target)].filter(([, v]) => v));
            load(1);
        });
        container.querySelector('.activity__pager').addEventListener('click', (e) => {
            const target = e.target.closest('[data-page]');
            if (target) load(Number(target.dataset.page));
        });
    }

    async function request(path) {
        const res = await fetch(path);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || `Error ${res.status}`);
        return json.data;
    }

    async function load(pageNumber) {
        page = pageNumber;
        const results = container.querySelector('.activity__results');
        const pager = container.querySelector('.activity__pager');
        results.innerHTML = '<p class="text-muted">Cargando...</p>';
        try {
            const query = new URLSearchParams({ ...filters, page, limit: 50 });
            const res = await fetch(`/api/activity?${query}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            results.innerHTML = AuditView.listHtml(json.data);
            const { totalPages, total } = json.pagination;
            pager.innerHTML = totalPages > 1 ? `
                <button class="btn btn--secondary btn--sm" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Anterior</button>
                <span>Página ${page} de ${totalPages} · ${total} movimientos</span>
                <button class="btn btn--secondary btn--sm" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Siguiente</button>` : '';
        } catch (error) {
            results.innerHTML = `<p class="text-muted">${UI.escapeHtml(error.message)}</p>`;
            pager.innerHTML = '';
        }
    }

    document.addEventListener('DOMContentLoaded', init);

    return { show };
})();
