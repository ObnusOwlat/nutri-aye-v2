/**
 * billing.js - "Cobros" tab (internal, no fiscal value, in ₲): receipts, quotes
 * and what each client owes. Creating and editing is in billing-editor.js, the
 * detail with payments in billing-detail.js, printing in billing-print.js.
 */

const Billing = (function() {
    let container = null;
    let view = 'invoices'; // invoices | quotes | balances
    let status = '';
    let page = 1;

    const VIEWS = { invoices: 'Recibos', quotes: 'Presupuestos', balances: 'Saldos' };
    const api = (method, path, body) => State._api(method, path, body);
    const esc = (v) => UI.escapeHtml(v ?? '');

    function init() {
        container = document.getElementById('billing');
        if (!container) return;
        UI.on('app:tabChanged', ({ tab }) => { if (tab === 'billing') show(); });
        Auth.ready.then(() => { if (App.currentTab === 'billing') show(); });
        container.addEventListener('click', onClick);
        container.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset.open) e.target.click(); });
        container.addEventListener('change', (e) => {
            if (e.target.name === 'status') { status = e.target.value; load(1); }
        });
    }

    function show() {
        if (!container.dataset.ready) renderShell();
        load(page);
    }

    function renderShell() {
        const isAdmin = Auth.current()?.role === 'admin';
        container.innerHTML = `
            <div class="billing__header">
                <div>
                    <h2 class="section-title">Cobros</h2>
                    <p class="text-muted">Recibos internos en guaraníes. No tienen valor fiscal.</p>
                </div>
                <div class="billing__actions">
                    ${isAdmin ? '<button class="btn btn--secondary" type="button" data-action="company">Datos del consultorio</button>' : ''}
                    <button class="btn btn--secondary" type="button" data-action="new-quote">+ Presupuesto</button>
                    <button class="btn btn--primary" type="button" data-action="new-invoice">+ Recibo</button>
                </div>
            </div>
            <div class="billing__stats" data-slot="stats"></div>
            <div class="billing__toolbar">
                <div class="billing__views" role="tablist">
                    ${Object.entries(VIEWS).map(([id, label]) => `<button class="billing__view" type="button" role="tab" data-view="${id}">${label}</button>`).join('')}
                </div>
                <select class="form-select billing__status" name="status" aria-label="Estado"></select>
            </div>
            <div class="billing__list" data-slot="list"></div>
            <div class="activity__pager" data-slot="pager"></div>`;
        container.dataset.ready = '1';
    }

    function onClick(e) {
        const target = e.target.closest('[data-action], [data-view], [data-page], [data-open]');
        if (!target) return;
        if (target.dataset.view) { view = target.dataset.view; status = ''; load(1); return; }
        if (target.dataset.page) { load(Number(target.dataset.page)); return; }
        if (target.dataset.open) { BillingDetail.open(target.dataset.kind, target.dataset.open); return; }
        const action = target.dataset.action;
        if (action === 'new-invoice') BillingEditor.open('invoice');
        if (action === 'new-quote') BillingEditor.open('quote');
        if (action === 'company') BillingCompany.open();
        if (action === 'patient') openPatient(target.dataset.patient);
    }

    function openPatient(id) {
        App.switchTab('patients');
        PatientProfile.open(id, 'billing');
    }

    async function load(pageNumber) {
        page = pageNumber;
        const list = container.querySelector('[data-slot=list]');
        const pager = container.querySelector('[data-slot=pager]');
        container.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === view));
        renderStatusFilter();
        list.innerHTML = '<p class="text-muted">Cargando...</p>';
        loadStats();
        try {
            if (view === 'balances') {
                list.innerHTML = balancesHtml(await api('GET', '/billing-api/balances'));
                pager.innerHTML = '';
                return;
            }
            const query = new URLSearchParams({ page, limit: 50, ...(status ? { status } : {}) });
            const res = await fetch(`/billing-api/${view}?${query}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            list.innerHTML = documentsHtml(json.data);
            const { totalPages, total } = json.pagination;
            pager.innerHTML = totalPages > 1 ? `
                <button class="btn btn--secondary btn--sm" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>Anterior</button>
                <span>Página ${page} de ${totalPages} · ${UI.formatNumber(total)} documentos</span>
                <button class="btn btn--secondary btn--sm" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>Siguiente</button>` : '';
        } catch (error) {
            list.innerHTML = `<p class="text-muted">${esc(error.message)}</p>`;
            pager.innerHTML = '';
        }
    }

    function renderStatusFilter() {
        const select = container.querySelector('[name=status]');
        const group = view === 'invoices' ? 'invoiceStatus' : view === 'quotes' ? 'quoteStatus' : null;
        select.hidden = !group;
        if (!group) return;
        const options = Object.keys(State.labels?.[group] || {});
        select.innerHTML = `<option value="">Todos los estados</option>` +
            options.map(v => `<option value="${v}" ${v === status ? 'selected' : ''}>${esc(UI.label(group, v))}</option>`).join('');
    }

    async function loadStats() {
        const slot = container.querySelector('[data-slot=stats]');
        try {
            const s = await api('GET', '/billing-api/dashboard/stats');
            slot.innerHTML = [
                stat('Cobrado', UI.formatMoney(s.totalRevenue), 'money'),
                stat('Por cobrar', UI.formatMoney(s.pendingRevenue), 'warning'),
                stat('Recibos', UI.formatNumber(s.totalInvoices)),
                stat('Presupuestos', UI.formatNumber(s.totalQuotes))
            ].join('');
        } catch { slot.innerHTML = ''; }
    }

    const stat = (label, value, modifier = '') => `
        <div class="stat-card"><h5>${label}</h5><div class="stat-value ${modifier}">${value}</div></div>`;

    const badge = (group, value) =>
        `<span class="badge badge-${esc(String(value).toLowerCase())}">${esc(UI.label(group, value))}</span>`;

    function documentsHtml(rows) {
        const invoice = view === 'invoices';
        if (!rows.length) {
            return `<div class="empty-state"><p>Todavía no hay ${invoice ? 'recibos' : 'presupuestos'}${status ? ' con ese estado' : ''}.</p></div>`;
        }
        const head = invoice ? ['N.º', 'Fecha', 'Cliente', 'Total', 'Saldo', 'Estado'] : ['N.º', 'Fecha', 'Cliente', 'Total', 'Válido hasta', 'Estado'];
        const body = rows.map(d => `
            <tr class="billing__row" data-open="${esc(d.id)}" data-kind="${invoice ? 'invoice' : 'quote'}" tabindex="0">
                <td><strong>${esc(invoice ? d.invoiceNumber : d.quoteNumber)}</strong></td>
                <td>${UI.formatDate(d.date || d.createdAt)}</td>
                <td>${esc(d.clientName || '-')}</td>
                <td class="num">${UI.formatMoney(d.total)}</td>
                <td class="num">${invoice ? UI.formatMoney(d.balance) : UI.formatDate(d.validUntil)}</td>
                <td>${badge(invoice ? 'invoiceStatus' : 'quoteStatus', d.status)}</td>
            </tr>`).join('');
        return table(head, body);
    }

    function balancesHtml(rows) {
        if (!rows.length) return '<div class="empty-state"><p>Todavía no hay recibos emitidos.</p></div>';
        const body = rows.map(r => `
            <tr>
                <td>${r.patientId ? `<a href="#" data-action="patient" data-patient="${esc(r.patientId)}">${esc(r.name)}</a>` : esc(r.name)}</td>
                <td>${esc(r.phone || '')}</td>
                <td class="num">${UI.formatNumber(r.receipts)}</td>
                <td class="num">${UI.formatMoney(r.invoiced)}</td>
                <td class="num">${UI.formatMoney(r.paid)}</td>
                <td class="num"><strong class="${r.balance > 0 ? 'text-warning' : ''}">${UI.formatMoney(r.balance)}</strong></td>
            </tr>`).join('');
        return table(['Cliente', 'Teléfono', 'Recibos', 'Facturado', 'Pagado', 'Saldo'], body);
    }

    const table = (head, body) => `
        <div class="table-scroll"><table class="data-table">
            <thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead>
            <tbody>${body}</tbody>
        </table></div>`;

    // Called after any change so the list, the stats and the patient tab are fresh
    function refresh() {
        if (container?.dataset.ready && App.currentTab === 'billing') load(page);
        UI.emit('billing:changed');
    }

    document.addEventListener('DOMContentLoaded', init);

    return { refresh, badge };
})();
