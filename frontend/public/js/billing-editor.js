/**
 * billing-editor.js - Modal to create or edit a receipt or a quote: client
 * (existing or new), item rows with a live total, discount, dates and notes.
 * The server recomputes the totals; a receipt's status comes from its payments.
 */

const BillingEditor = (function() {
    const KIND = {
        invoice: { path: 'invoices', title: 'recibo', dateLabel: 'Vence el', dateKey: 'dueDate' },
        quote: { path: 'quotes', title: 'presupuesto', dateLabel: 'Válido hasta', dateKey: 'validUntil' }
    };
    const api = (method, path, body) => State._api(method, path, body);
    const esc = (v) => UI.escapeHtml(v ?? '');
    let items = [];

    const itemHtml = (item, i) => `
        <div class="billing-items__row" data-row="${i}">
            <input class="form-input" data-field="description" value="${esc(item.description)}" placeholder="Consulta nutricional" aria-label="Descripción" maxlength="500">
            <input class="form-input num" type="number" min="1" step="any" data-field="quantity" value="${esc(item.quantity)}" aria-label="Cantidad">
            <input class="form-input num" type="number" min="0" step="1000" data-field="unitPrice" value="${esc(item.unitPrice)}" aria-label="Precio unitario">
            <span class="billing-items__amount num">${UI.formatMoney(item.quantity * item.unitPrice)}</span>
            <button class="btn btn--secondary btn--sm" type="button" data-remove="${i}" aria-label="Quitar ítem" ${items.length === 1 ? 'disabled' : ''}>×</button>
        </div>`;

    function itemsHtml() {
        return `<div class="billing-items__head"><span>Descripción</span><span>Cant.</span><span>Precio (₲)</span><span>Importe</span><span></span></div>
            ${items.map(itemHtml).join('')}`;
    }

    function totalsHtml(root) {
        const subtotal = items.reduce((sum, i) => sum + (Number(i.quantity) || 0) * (Number(i.unitPrice) || 0), 0);
        const discount = Number(root.querySelector('[name=discount]').value) || 0;
        return `Subtotal ${UI.formatMoney(subtotal)} · Descuento ${UI.formatMoney(discount)} · <strong>Total ${UI.formatMoney(Math.max(0, subtotal - discount))}</strong>`;
    }

    async function clientOptions(selected) {
        const clients = await api('GET', '/billing-api/clients?limit=100').catch(() => []);
        return `<option value="">Elegí un cliente…</option>
            <option value="__new">+ Cliente nuevo</option>
            ${clients.map(c => `<option value="${esc(c.id)}" ${c.id === selected ? 'selected' : ''}>${esc(c.name)}${c.vatId ? ` (RUC ${esc(c.vatId)})` : ''}</option>`).join('')}`;
    }

    /**
     * kind: invoice | quote. doc: existing document to edit (optional).
     * preset: { clientId } when created from a patient.
     */
    async function open(kind, doc = null, preset = {}) {
        const k = KIND[kind];
        items = doc?.items?.length ? doc.items.map(i => ({ ...i })) : [{ description: 'Consulta nutricional', quantity: 1, unitPrice: 0 }];
        const clientId = doc?.clientId || preset.clientId || '';
        const today = State._today();
        UI.openModal({
            title: doc ? `Editar ${k.title} ${esc(doc.invoiceNumber || doc.quoteNumber)}` : `Nuevo ${k.title}`,
            size: 'large',
            content: `
                <form class="billing-editor" autocomplete="off">
                    <div class="billing-editor__grid">
                        <label class="form-group"><span class="form-label">Cliente</span>
                            <select class="form-select" name="clientId" required>${await clientOptions(clientId)}</select></label>
                        <label class="form-group"><span class="form-label">Fecha</span>
                            <input class="form-input" type="date" name="date" value="${esc((doc?.date || today).slice(0, 10))}"></label>
                        <label class="form-group"><span class="form-label">${k.dateLabel}</span>
                            <input class="form-input" type="date" name="${k.dateKey}" value="${esc((doc?.[k.dateKey] || '').slice(0, 10))}"></label>
                    </div>
                    <fieldset class="billing-editor__new-client" hidden>
                        <legend>Cliente nuevo</legend>
                        <input class="form-input" name="newName" placeholder="Nombre y apellido o razón social" maxlength="200">
                        <input class="form-input" name="newVatId" placeholder="RUC o C.I. (opcional)" maxlength="50">
                        <input class="form-input" name="newPhone" placeholder="Teléfono (0981…)" maxlength="50">
                    </fieldset>
                    <div class="billing-items">${itemsHtml()}</div>
                    <button class="btn btn--secondary btn--sm" type="button" data-action="add-item">+ Agregar ítem</button>
                    <div class="billing-editor__grid">
                        <label class="form-group"><span class="form-label">Descuento (₲)</span>
                            <input class="form-input" type="number" min="0" step="1000" name="discount" value="${esc(doc?.discount || 0)}"></label>
                        <label class="form-group billing-editor__notes"><span class="form-label">Notas</span>
                            <textarea class="form-input" name="notes" rows="2" maxlength="5000">${esc(doc?.notes || '')}</textarea></label>
                    </div>
                    <p class="billing-editor__totals" data-slot="totals"></p>
                    <p class="text-muted billing-editor__legend">Documento interno sin valor fiscal.</p>
                </form>`,
            confirmText: doc ? 'Guardar cambios' : `Crear ${k.title}`,
            onConfirm: () => save(kind, doc)
        });
        bind(); // the content is already in the modal: no typing is lost
    }

    function bind() {
        const root = document.querySelector('.billing-editor');
        const redraw = () => { root.querySelector('.billing-items').innerHTML = itemsHtml(); updateTotals(); };
        const updateTotals = () => { root.querySelector('[data-slot=totals]').innerHTML = totalsHtml(root); };
        root.addEventListener('input', (e) => {
            const row = e.target.closest('[data-row]');
            if (row) {
                const item = items[row.dataset.row];
                const field = e.target.dataset.field;
                item[field] = field === 'description' ? e.target.value : Number(e.target.value) || 0;
                row.querySelector('.billing-items__amount').textContent = UI.formatMoney(item.quantity * item.unitPrice);
            }
            updateTotals();
        });
        root.addEventListener('change', (e) => {
            if (e.target.name === 'clientId') root.querySelector('.billing-editor__new-client').hidden = e.target.value !== '__new';
        });
        root.addEventListener('click', (e) => {
            if (e.target.closest('[data-action=add-item]')) { items.push({ description: '', quantity: 1, unitPrice: 0 }); redraw(); }
            const remove = e.target.closest('[data-remove]');
            if (remove && items.length > 1) { items.splice(Number(remove.dataset.remove), 1); redraw(); }
        });
        updateTotals();
    }

    async function save(kind, doc) {
        const k = KIND[kind];
        const form = document.querySelector('.billing-editor');
        const value = (name) => form.querySelector(`[name=${name}]`)?.value.trim() || '';
        let clientId = value('clientId');
        const clean = items.filter(i => i.description.trim());
        if (!clientId) throw new Error('Elegí un cliente');
        if (!clean.length) throw new Error('Agregá al menos un ítem con descripción');
        if (clientId === '__new') {
            if (!value('newName')) throw new Error('Escribí el nombre del cliente nuevo');
            clientId = (await api('POST', '/billing-api/clients', { name: value('newName'), vatId: value('newVatId') || null, phone: value('newPhone') || null })).id;
        }
        const body = {
            clientId, date: value('date') || null, [k.dateKey]: value(k.dateKey) || null,
            discount: Number(value('discount')) || 0, notes: value('notes'),
            items: clean.map(i => ({ description: i.description.trim(), quantity: Number(i.quantity) || 1, unitPrice: Number(i.unitPrice) || 0, type: i.type || 'SERVICE' }))
        };
        if (kind === 'quote') body.status = doc?.status || 'DRAFT';
        const saved = doc
            ? await api('PUT', `/billing-api/${k.path}/${encodeURIComponent(doc.id)}`, body)
            : await api('POST', `/billing-api/${k.path}`, body);
        UI.toastSuccess(doc ? 'Cambios guardados' : `${k.title[0].toUpperCase()}${k.title.slice(1)} ${saved.invoiceNumber || saved.quoteNumber} creado`);
        Billing.refresh();
        await BillingDetail.open(kind, saved.id); // replaces this modal
        return false;
    }

    return { open };
})();
