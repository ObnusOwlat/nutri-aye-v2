// Payment methods
const express = require('express');
const methods = require('../../repos/billing/payment-methods');
const { tracked } = require('../../audit/log');
const { validate } = require('../../validation');
const schemas = require('../../validation/billing');
const { notFound } = require('../../lib/http');

const router = express.Router();

router.get('/billing-api/payment-methods', (req, res) => {
    res.json({ success: true, data: methods.list(req.ctx) });
});

router.post('/billing-api/payment-methods', validate(schemas.paymentMethod), (req, res) => {
    res.status(201).json({ success: true, data: tracked(req.ctx, 'payment_method', null, () => methods.create(req.ctx, req.body)) });
});

router.put('/billing-api/payment-methods/:id', validate(schemas.paymentMethod), (req, res) => {
    const updated = tracked(req.ctx, 'payment_method', req.params.id, () => methods.update(req.ctx, req.params.id, req.body));
    if (!updated) throw notFound('Medio de pago');
    res.json({ success: true, data: updated });
});

router.delete('/billing-api/payment-methods/:id', (req, res) => {
    if (!tracked(req.ctx, 'payment_method', req.params.id, () => methods.deactivate(req.ctx, req.params.id))) throw notFound('Medio de pago');
    res.json({ success: true });
});

module.exports = router;
