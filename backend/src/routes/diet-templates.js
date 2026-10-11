// Diet templates of the consultorio (planner). Default templates cannot be deactivated.
const express = require('express');
const templates = require('../repos/diet-templates');
const { tracked } = require('../audit/log');
const { validate } = require('../validation');
const { templateCreate, templateUpdate } = require('../validation/patients');
const { notFound, conflict } = require('../lib/http');

const router = express.Router();

router.get('/api/diet-templates', (req, res) => {
    res.json({ success: true, data: templates.list(req.ctx) });
});

router.post('/api/diet-templates', validate(templateCreate), (req, res) => {
    res.status(201).json({ success: true, data: tracked(req.ctx, 'template', null, () => templates.create(req.ctx, req.body)) });
});

router.put('/api/diet-templates/:id', validate(templateUpdate), (req, res) => {
    const updated = tracked(req.ctx, 'template', req.params.id, () => templates.update(req.ctx, req.params.id, req.body));
    if (!updated) throw notFound('Plantilla');
    res.json({ success: true, data: updated });
});

router.delete('/api/diet-templates/:id', (req, res) => {
    const template = templates.getById(req.ctx, req.params.id);
    if (!template) throw notFound('Plantilla');
    if (template.isDefault) throw conflict('Las plantillas predeterminadas no se pueden desactivar');
    tracked(req.ctx, 'template', req.params.id, () => templates.deactivate(req.ctx, req.params.id));
    res.json({ success: true });
});

module.exports = router;
