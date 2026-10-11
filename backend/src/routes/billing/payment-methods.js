// Payment methods
const express = require('express');
const methods = require('../../repos/billing/payment-methods');
const { validate } = require('../../validation');
const schemas = require('../../validation/billing');
const { notFound } = require('../../lib/http');

const router = express.Router();

router.get('/billing-api/payment-methods', (req, res) => {
    res.json({ success: true, data: methods.list(req.ctx) });
});

router.post('/billing-api/payment-methods', validate(schemas.paymentMethod), (req, res) => {
    res.status(201).json({ success: true, data: methods.create(req.ctx, req.body) });
});

router.put('/billing-api/payment-methods/:id', validate(schemas.paymentMethod), (req, res) => {
    const updated = methods.update(req.ctx, req.params.id, req.body);
    if (!updated) throw notFound('Medio de pago');
    res.json({ success: true, data: updated });
});

router.delete('/billing-api/payment-methods/:id', (req, res) => {
    if (!methods.deactivate(req.ctx, req.params.id)) throw notFound('Medio de pago');
    res.json({ success: true });
});

module.exports = router;
