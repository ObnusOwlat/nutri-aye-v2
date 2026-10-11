/**
 * billing-detail.js - Detail of a receipt or quote: items, totals, payments
 * (register / remove), void a receipt, turn a quote into a receipt, change a
 * quote's status, edit and print. Nothing is deleted: payments are deactivated
 * and receipts voided, all in the audit log.
 */

const BillingDetail = (function() {
    const api = (method, path, body) => State._api(method, path, body);
    const esc = (v) => UI.escapeHtml(v ?? '');
    const path = (kind, id) => `/billing-api/${kind === 'invoice' ? 'invoices' : 'quotes'}/${encodeURIComponent(id)}`;
    let current = null; // { kind, doc }

    async function open(kind, id) {
        let doc, methods = [];
        try {
            [doc, methods] = await Promise.all([
                api('GET', path(kind, id)),
                kind === 'invoice' ? api('GET', '/billing-api/payment-methods').catch(() => []) : []
            ]);
        } catch (error) {
            UI.toastError(error.message);
            return;
        }
        current = { kind, doc };
        const number = doc.invoiceNumber || doc.quoteNumber;
        UI.openModal({
            title: `${kind === 'invoice' ? 'Recibo' : 'Presupuesto'} ${number}`,
            size: 'large',
            content: `<div class="billing-detail">${headerHtml(kind, doc)}${itemsHtml(doc)}
                ${kind === 'invoice' ? paymentsHtml(doc, methods) : quoteActionsHtml(doc)}
                ${actionsHtml(kind, doc)}</div>`,
            confirmText: 'Imprimir',
            cancelText: 'Cerrar',
            onConfirm: () => { BillingPrint.print(kind, doc); return false; }
        });
        document.querySelector('.billing-detail').addEventListener('click', onClick);
        document.querySelector('.billing-detail').addEventListener('submit', onSubmit);
        document.querySelector('.billing-detail').addEventListener('change', onChange);
    }

    function headerHtml(kind, doc) {
        const group = kind === 'invoice' ? 'invoiceStatus' : 'quoteStatus';
        const second = kind === 'invoice' ? ['Vence', doc.dueDate] : ['Válido hasta', doc.validUntil];
        return `
            <div class="billing-detail__header">
                <div><span class="form-label">Cliente</span><strong>${esc(doc.clientName || '-')}</strong>
                    ${doc.clientVatId ? `<small>RUC ${esc(doc.clientVatId)}</small>` : ''}</div>
                <div><span class="form-label">Fecha</span>${UI.formatDate(doc.date || doc.createdAt)}</div>
                <div><span class="form-label">${second[0]}</span>${UI.formatDate(second[1])}</div>
                <div><span class="form-label">Estado</span>${Billing.badge(group, doc.status)}</div>
            </div>`;
    }

    function itemsHtml(doc) {
        const rows = doc.items.map(i => `<tr><td>${esc(i.description)}</td><td class="num">${UI.formatNumber(i.quantity)}</td>
            <td class="num">${UI.formatMoney(i.unitPrice)}</td><td class="num">${UI.formatMoney(i.quantity * i.unitPrice)}</td></tr>`).join('');
        const extra = doc.discount ? `<tr><td colspan="3" class="num">Descuento</td><td class="num">− ${UI.formatMoney(doc.discount)}</td></tr>` : '';
        return `
            <table class="data-table billing-detail__items">
                <thead><tr><th>Descripción</th><th class="num">Cant.</th><th class="num">Precio</th><th class="num">Importe</th></tr></thead>
                <tbody>${rows || '<tr><td colspan="4" class="text-muted">Sin ítems</td></tr>'}</tbody>
                <tfoot>${extra}<tr><td colspan="3" class="num"><strong>Total</strong></td><td class="num"><strong>${UI.formatMoney(doc.total)}</strong></td></tr></tfoot>
            </table>
            ${doc.notes ? `<p class="billing-detail__notes">${esc(doc.notes)}</p>` : ''}`;
    }

    function paymentsHtml(doc, methods) {
        const rows = doc.payments.map(p => `
            <li><span>${UI.formatDate(p.date)}</span><span>${esc(p.methodName || 'Sin especificar')}</span>
                <strong class="num">${UI.formatMoney(p.amount)}</strong>
                <span class="text-muted">${esc(p.notes || '')}${p.createdByName ? ` · ${esc(p.createdByName)}` : ''}</span>
                <button class="btn btn--secondary btn--sm" type="button" data-remove-payment="${esc(p.id)}">Quitar</button></li>`).join('');
        const canPay = doc.status !== 'CANCELLED' && doc.balance > 0;
        return `
            <section class="billing-detail__payments">
                <h4>Pagos <small class="text-muted">Pagado ${UI.formatMoney(doc.paidAmount)} · Saldo <strong>${UI.formatMoney(doc.balance)}</strong></small></h4>
                ${rows ? `<ul class="billing-payments">${rows}</ul>` : '<p class="text-muted">Todavía no hay pagos.</p>'}
                ${canPay ? `
                <form class="billing-pay" data-form="payment">
                    <input class="form-input num" type="number" name="amount" min="1" step="any" value="${Math.round(doc.balance)}" aria-label="Monto (₲)" required>
                    <input class="form-input" type="date" name="date" value="${State._today()}" aria-label="Fecha del pago">
                    <select class="form-select" name="methodId" aria-label="Medio de pago">
                        <option value="">Sin especificar</option>
                        ${methods.map(m => `<option value="${esc(m.id)}" ${m.isDefault ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
                    </select>
                    <input class="form-input" name="notes" placeholder="Nota (opcional)" maxlength="1000">
                    <button class="btn btn--primary btn--sm" type="submit">Registrar pago</button>
                </form>` : ''}
            </section>`;
    }

    function quoteActionsHtml(doc) {
        const options = ['DRAFT', 'SENT', 'REJECTED', 'EXPIRED'];
        if (doc.status === 'ACCEPTED') return '<p class="text-muted">Este presupuesto ya se convirtió en recibo.</p>';
        return `
            <div class="billing-detail__quote">
                <label>Estado <select class="form-select" name="quoteStatus">
                    ${options.map(s => `<option value="${s}" ${s === doc.status ? 'selected' : ''}>${esc(UI.label('quoteStatus', s))}</option>`).join('')}
                </select></label>
                ${doc.status !== 'REJECTED' ? '<button class="btn btn--primary btn--sm" type="button" data-action="convert">Convertir en recibo</button>' : ''}
            </div>`;
    }

    function actionsHtml(kind, doc) {
        if (doc.status === 'CANCELLED') return '<p class="billing-detail__voided">Recibo anulado: se conserva con su número.</p>';
        const editable = kind === 'quote' ? doc.status !== 'ACCEPTED' : true;
        return `
            <div class="billing-detail__actions">
                ${editable ? '<button class="btn btn--secondary btn--sm" type="button" data-action="edit">Editar</button>' : ''}
                ${kind === 'invoice' ? '<button class="btn btn--danger btn--sm" type="button" data-action="void">Anular recibo</button>' : ''}
            </div>`;
    }

    // Runs a change, then shows the document again
    async function run(fn, message) {
        try {
            await fn();
            if (message) UI.toastSuccess(message);
            Billing.refresh();
        } catch (error) {
            UI.toastError(error.message);
        }
        await open(current.kind, current.doc.id);
    }

    // A confirmation that comes back to the detail when cancelled
    function ask(title, message, confirmText, fn) {
        const { kind, doc } = current;
        UI.openModal({
            title, content: `<p>${esc(message)}</p>`, confirmText, cancelText: 'Volver', className: 'danger-dialog',
            onConfirm: async () => { await run(fn); return false; },
            onCancel: () => open(kind, doc.id)
        });
    }

    function onClick(e) {
        const { kind, doc } = current;
        const remove = e.target.closest('[data-remove-payment]');
        if (remove) {
            ask('Quitar pago', 'El pago se desactiva (queda en el historial) y el saldo vuelve a subir.', 'Quitar pago',
                async () => { await api('DELETE', `/billing-api/payments/${encodeURIComponent(remove.dataset.removePayment)}`); UI.toastSuccess('Pago quitado'); });
            return;
        }
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (action === 'edit') BillingEditor.open(kind, doc);
        if (action === 'void') {
            ask('Anular recibo', `El recibo ${doc.invoiceNumber} queda anulado: no se borra ni se reutiliza su número.`, 'Anular',
                async () => { await api('POST', `${path('invoice', doc.id)}/void`); UI.toastSuccess('Recibo anulado'); });
        }
        if (action === 'convert') convert(doc);
    }

    async function convert(doc) {
        try {
            const invoice = await api('POST', `${path('quote', doc.id)}/convert`);
            UI.toastSuccess(`Recibo ${invoice.invoiceNumber} creado`);
            Billing.refresh();
            await open('invoice', invoice.id);
        } catch (error) {
            UI.toastError(error.message);
        }
    }

    function onSubmit(e) {
        if (e.target.dataset.form !== 'payment') return;
        e.preventDefault();
        const data = Object.fromEntries(new FormData(e.target));
        const body = { amount: Number(data.amount), date: data.date || null, methodId: data.methodId || null, notes: data.notes || '' };
        e.target.querySelector('[type=submit]').disabled = true;
        run(() => api('POST', `${path('invoice', current.doc.id)}/payments`, body), 'Pago registrado');
    }

    function onChange(e) {
        if (e.target.name !== 'quoteStatus') return;
        const doc = current.doc;
        run(() => api('PUT', path('quote', doc.id), {
            clientId: doc.clientId, date: doc.date, validUntil: doc.validUntil, discount: doc.discount,
            notes: doc.notes, status: e.target.value
        }), 'Estado actualizado');
    }

    return { open };
})();
