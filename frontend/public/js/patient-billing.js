/**
 * patient-billing.js - "Cobros" tab of the patient profile (internal, no fiscal
 * value): balance, receipts and quotes of the patient, and buttons to create
 * them (the patient is linked to a billing client the first time).
 */

const PatientBilling = (function() {
    let container = null;
    let patientId = null;

    const api = (method, path, body) => State._api(method, path, body);
    const esc = (v) => UI.escapeHtml(v ?? '');
    const money = (n) => UI.formatMoney(n);

    async function render(id, element) {
        if (!id || !element) return;
        patientId = id;
        bind(element);
        element.innerHTML = '<div class="patient-billing"><div class="loading">Cargando cobros...</div></div>';
        try {
            const billing = await api('GET', `/api/patients/${encodeURIComponent(id)}/billing`);
            if (patientId !== id) return; // another patient was opened meanwhile
            element.innerHTML = `<div class="patient-billing">${actionsHtml()}${billing.linked ? linkedHtml(billing) : notLinkedHtml()}</div>`;
        } catch (error) {
            element.innerHTML = `<div class="empty-state"><p>${esc(error.message)}</p></div>`;
        }
    }

    // One delegated listener per container; any billing change redraws the open tab
    function bind(element) {
        if (container === element) return;
        container = element;
        container.addEventListener('click', onClick);
        container.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.dataset.open) e.target.click(); });
        UI.on('billing:changed', () => {
            if (patientId && container.classList.contains('active')) render(patientId, container);
        });
    }

    async function onClick(e) {
        const row = e.target.closest('[data-open]');
        if (row) { BillingDetail.open(row.dataset.kind, row.dataset.open); return; }
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (action === 'new-invoice' || action === 'new-quote') create(action === 'new-invoice' ? 'invoice' : 'quote');
    }

    // Links the patient (once) and opens the editor with their client
    async function create(kind) {
        const id = patientId;
        try {
            const client = await api('POST', `/api/patients/${encodeURIComponent(id)}/sync-to-billing`);
            BillingEditor.open(kind, null, { clientId: client.id });
        } catch (error) {
            UI.toastError(error.message);
        }
    }

    const actionsHtml = () => `
        <div class="patient-billing__actions">
            <button class="btn btn--secondary btn--sm" type="button" data-action="new-quote">+ Presupuesto</button>
            <button class="btn btn--primary btn--sm" type="button" data-action="new-invoice">+ Recibo</button>
        </div>`;

    const notLinkedHtml = () => `
        <div class="empty-state">
            <h3>Todavía sin cobros</h3>
            <p>Al crear el primer recibo o presupuesto, el paciente queda vinculado como cliente.</p>
        </div>`;

    function linkedHtml({ client, invoices, quotes, balance }) {
        const active = invoices.filter(i => i.status !== 'CANCELLED');
        const paid = active.reduce((sum, i) => sum + i.paidAmount, 0);
        return `
            <div class="patient-billing__header">
                <div class="patient-billing__client">
                    <h4>Cliente de cobros</h4>
                    <p><strong>${esc(client.name)}</strong>${client.vatId ? ` · RUC ${esc(client.vatId)}` : ''}</p>
                    <p>${esc([client.phone, client.email].filter(Boolean).join(' · '))}</p>
                </div>
                <div class="billing__stats">
                    ${stat('Pagado', money(paid), 'money')}
                    ${stat('Saldo', money(balance), balance > 0 ? 'warning' : '')}
                    ${stat('Recibos', UI.formatNumber(active.length))}
                    ${stat('Presupuestos', UI.formatNumber(quotes.length))}
                </div>
            </div>
            ${table('Recibos', 'invoice', ['N.º', 'Fecha', 'Total', 'Saldo', 'Estado'],
                invoices.map(i => [i.id, i.invoiceNumber, UI.formatDate(i.date || i.createdAt), money(i.total), money(i.balance), Billing.badge('invoiceStatus', i.status)]))}
            ${table('Presupuestos', 'quote', ['N.º', 'Fecha', 'Total', 'Válido hasta', 'Estado'],
                quotes.map(q => [q.id, q.quoteNumber, UI.formatDate(q.date || q.createdAt), money(q.total), UI.formatDate(q.validUntil), Billing.badge('quoteStatus', q.status)]))}`;
    }

    const stat = (label, value, modifier = '') => `
        <div class="stat-card"><h5>${label}</h5><div class="stat-value ${modifier}">${value}</div></div>`;

    // rows: [id, number, ...cells already formatted, badge]
    function table(title, kind, headers, rows) {
        if (!rows.length) return '';
        return `
            <div class="patient-billing__section">
                <h4>${title}</h4>
                <div class="table-scroll"><table class="data-table">
                    <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                    <tbody>${rows.map(([id, number, ...cells]) => `
                        <tr class="billing__row" data-open="${esc(id)}" data-kind="${kind}" tabindex="0">
                            <td><strong>${esc(number)}</strong></td>${cells.map(c => `<td>${c}</td>`).join('')}
                        </tr>`).join('')}</tbody>
                </table></div>
            </div>`;
    }

    return { render };
})();
