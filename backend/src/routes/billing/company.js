// Billing dashboard, company profile and PDF config
const express = require('express');
const company = require('../../repos/billing/company');
const { tracked } = require('../../audit/log');
const { validate } = require('../../validation');
const schemas = require('../../validation/billing');
const { badRequest } = require('../../lib/http');

const router = express.Router();

router.get('/billing-api/dashboard/stats', (req, res) => {
    res.json({ success: true, data: company.dashboard(req.ctx) });
});

router.get('/billing-api/company', (req, res) => {
    res.json({ success: true, data: company.get(req.ctx) });
});

router.put('/billing-api/company', validate(schemas.company), (req, res) => {
    res.json({ success: true, data: tracked(req.ctx, 'company', company.getRow(req.ctx)?.id, () => company.save(req.ctx, req.body)) });
});

router.get('/billing-api/pdf-config', (req, res) => {
    res.json({ success: true, data: company.getPdfConfig(req.ctx) });
});

router.put('/billing-api/pdf-config', validate(schemas.pdfConfig), (req, res) => {
    const config = tracked(req.ctx, 'pdf_config', company.getPdfConfig(req.ctx)?.id, () => company.savePdfConfig(req.ctx, req.body));
    if (!config) throw badRequest('Primero configurá los datos del consultorio');
    res.json({ success: true, data: config });
});

module.exports = router;
