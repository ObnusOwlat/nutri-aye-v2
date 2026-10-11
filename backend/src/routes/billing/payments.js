// Payments, voiding receipts, quote -> receipt and client balances
const express = require('express');
const payments = require('../../repos/billing/payments');
const balances = require('../../repos/billing/balances');
const { invoices } = require('../../repos/billing/documents');
const { quoteToInvoice } = require('../../repos/billing/convert');
const { tracked, record, diff } = require('../../audit/log');
const { snapshot } = require('../../audit/entities');
const { validate } = require('../../validation');
const schemas = require('../../validation/billing');
const { notFound, badRequest, conflict } = require('../../lib/http');

const router = express.Router();
const money = (n) => `₲ ${Math.round(n).toLocaleString('es-PY')}`;

// The payment and the receipt's new status are both recorded
function withReceipt(ctx, invoiceId, fn) {
    return tracked(ctx, 'invoice', invoiceId, fn);
}

router.post('/billing-api/invoices/:id/payments', validate(schemas.payment), (req, res) => {
    const result = withReceipt(req.ctx, req.params.id, () => {
        const r = payments.create(req.ctx, req.params.id, req.body);
        if (r.payment) record(req.ctx, { action: 'create', entity: 'payment', entityId: r.payment.id, changes: diff(null, snapshot('payment', r.payment.id, req.ctx)) });
        return r;
    });
    if (result.error === 'notFound') throw notFound('Recibo');
    if (result.error === 'cancelled') throw conflict('El recibo está anulado');
    if (result.error === 'method') throw badRequest('El medio de pago no existe');
    if (result.error === 'overpaid') throw badRequest(`El pago supera el saldo del recibo (${money(result.balance)})`);
    res.status(201).json({ success: true, data: invoices.getById(req.ctx, req.params.id) });
});

router.delete('/billing-api/payments/:id', (req, res) => {
    const invoiceId = payments.invoiceIdOf(req.ctx, req.params.id);
    if (!invoiceId) throw notFound('Pago');
    withReceipt(req.ctx, invoiceId, () => tracked(req.ctx, 'payment', req.params.id, () => payments.deactivate(req.ctx, req.params.id)));
    res.json({ success: true, data: invoices.getById(req.ctx, invoiceId) });
});

function voidReceipt(req, res) {
    const result = withReceipt(req.ctx, req.params.id, () => {
        const r = payments.voidInvoice(req.ctx, req.params.id);
        return r === 'ok' ? { ok: true } : r === 'notFound' ? null : { r };
    });
    if (!result) throw notFound('Recibo');
    if (result.r === 'paid') throw conflict('El recibo tiene pagos: quitalos antes de anularlo');
    res.json({ success: true, data: invoices.getById(req.ctx, req.params.id) });
}
router.post('/billing-api/invoices/:id/void', voidReceipt);
// Issued receipts are never removed: "delete" voids them
router.delete('/billing-api/invoices/:id', voidReceipt);

router.post('/billing-api/quotes/:id/convert', (req, res) => {
    const result = tracked(req.ctx, 'quote', req.params.id, () => {
        const r = quoteToInvoice(req.ctx, req.params.id);
        if (r.invoice) record(req.ctx, { action: 'create', entity: 'invoice', entityId: r.invoice.id, changes: diff(null, snapshot('invoice', r.invoice.id, req.ctx)) });
        return r;
    });
    if (result.error === 'notFound') throw notFound('Presupuesto');
    if (result.error === 'converted') throw conflict('El presupuesto ya fue aceptado o rechazado');
    res.status(201).json({ success: true, data: result.invoice });
});

router.get('/billing-api/balances', (req, res) => {
    res.json({ success: true, data: balances.list(req.ctx, { onlyOwing: req.query.owing === '1' }) });
});

module.exports = router;
