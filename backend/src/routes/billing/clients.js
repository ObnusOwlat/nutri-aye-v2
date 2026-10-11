// Billing clients
const express = require('express');
const clients = require('../../repos/billing/clients');
const { validate } = require('../../validation');
const schemas = require('../../validation/billing');
const { notFound, conflict, pageParams, sendPage } = require('../../lib/http');

const router = express.Router();

router.get('/billing-api/clients', (req, res) => {
    const paging = pageParams(req.query);
    const { rows, total } = clients.list({ search: req.query.search, ...paging });
    sendPage(res, rows, paging, total);
});

router.get('/billing-api/clients/:id', (req, res) => {
    const client = clients.getById(req.params.id);
    if (!client) throw notFound('Cliente');
    res.json({ success: true, data: client });
});

router.post('/billing-api/clients', validate(schemas.client), (req, res) => {
    res.status(201).json({ success: true, data: clients.create(req.body) });
});

router.put('/billing-api/clients/:id', validate(schemas.client), (req, res) => {
    const updated = clients.update(req.params.id, req.body);
    if (!updated) throw notFound('Cliente');
    res.json({ success: true, data: updated });
});

router.delete('/billing-api/clients/:id', (req, res) => {
    const documents = clients.documentCount(req.params.id);
    if (documents) throw conflict(`El cliente tiene ${documents} factura(s) o presupuesto(s)`);
    if (!clients.remove(req.params.id)) throw notFound('Cliente');
    res.json({ success: true });
});

module.exports = router;
