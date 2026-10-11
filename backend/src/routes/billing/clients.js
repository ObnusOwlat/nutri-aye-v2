// Billing clients
const express = require('express');
const clients = require('../../repos/billing/clients');
const { validate } = require('../../validation');
const schemas = require('../../validation/billing');
const { notFound, pageParams, sendPage } = require('../../lib/http');

const router = express.Router();

router.get('/billing-api/clients', (req, res) => {
    const paging = pageParams(req.query);
    const { rows, total } = clients.list(req.ctx, { search: req.query.search, ...paging });
    sendPage(res, rows, paging, total);
});

router.get('/billing-api/clients/:id', (req, res) => {
    const client = clients.getById(req.ctx, req.params.id);
    if (!client) throw notFound('Cliente');
    res.json({ success: true, data: client });
});

router.post('/billing-api/clients', validate(schemas.client), (req, res) => {
    res.status(201).json({ success: true, data: clients.create(req.ctx, req.body) });
});

router.put('/billing-api/clients/:id', validate(schemas.client), (req, res) => {
    const updated = clients.update(req.ctx, req.params.id, req.body);
    if (!updated) throw notFound('Cliente');
    res.json({ success: true, data: updated });
});

// "Delete" deactivates; their invoices and quotes stay
router.delete('/billing-api/clients/:id', (req, res) => {
    if (!clients.deactivate(req.ctx, req.params.id)) throw notFound('Cliente');
    res.json({ success: true });
});

module.exports = router;
