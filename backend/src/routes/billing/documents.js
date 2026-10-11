// Invoices (/billing-api/invoices) and quotes (/billing-api/quotes)
const express = require('express');
const { invoices, quotes } = require('../../repos/billing/documents');
const clients = require('../../repos/billing/clients');
const { tracked } = require('../../audit/log');
const { validate } = require('../../validation');
const schemas = require('../../validation/billing');
const { notFound, badRequest, pageParams, sendPage } = require('../../lib/http');

const router = express.Router();

function mount(path, repo, schema, label, entity) {
    const checkClient = (req, res, next) => next(clients.exists(req.ctx, req.body.clientId) ? undefined : badRequest('El cliente no existe'));

    router.get(path, (req, res) => {
        const paging = pageParams(req.query);
        const { rows, total } = repo.list(req.ctx, { clientId: req.query.clientId, status: req.query.status, ...paging });
        sendPage(res, rows, paging, total);
    });

    router.get(`${path}/:id`, (req, res) => {
        const doc = repo.getById(req.ctx, req.params.id, { withCompany: true });
        if (!doc) throw notFound(label);
        res.json({ success: true, data: doc });
    });

    router.post(path, validate(schema), checkClient, (req, res) => {
        res.status(201).json({ success: true, data: tracked(req.ctx, entity, null, () => repo.create(req.ctx, req.body)) });
    });

    router.put(`${path}/:id`, validate(schema), checkClient, (req, res) => {
        const updated = tracked(req.ctx, entity, req.params.id, () => repo.update(req.ctx, req.params.id, req.body));
        if (!updated) throw notFound(label);
        res.json({ success: true, data: updated });
    });

    router.delete(`${path}/:id`, (req, res) => {
        if (!tracked(req.ctx, entity, req.params.id, () => repo.deactivate(req.ctx, req.params.id))) throw notFound(label);
        res.json({ success: true });
    });
}

mount('/billing-api/invoices', invoices, schemas.invoice, 'Factura', 'invoice');
mount('/billing-api/quotes', quotes, schemas.quote, 'Presupuesto', 'quote');

module.exports = router;
