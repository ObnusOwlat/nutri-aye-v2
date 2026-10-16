// Meal day templates of the consultorio (planner, Comidas)
const express = require('express');
const dayTemplates = require('../repos/day-templates');
const { tracked } = require('../audit/log');
const { validate } = require('../validation');
const { dayTemplateCreate, dayTemplateUpdate } = require('../validation/day-templates');
const { notFound } = require('../lib/http');

const router = express.Router();

router.get('/api/day-templates', (req, res) => {
    res.json({ success: true, data: dayTemplates.list(req.ctx) });
});

router.post('/api/day-templates', validate(dayTemplateCreate), (req, res) => {
    res.status(201).json({ success: true, data: tracked(req.ctx, 'dayTemplate', null, () => dayTemplates.create(req.ctx, req.body)) });
});

router.put('/api/day-templates/:id', validate(dayTemplateUpdate), (req, res) => {
    const updated = tracked(req.ctx, 'dayTemplate', req.params.id, () => dayTemplates.update(req.ctx, req.params.id, req.body));
    if (!updated) throw notFound('Plantilla de día');
    res.json({ success: true, data: updated });
});

router.delete('/api/day-templates/:id', (req, res) => {
    if (!tracked(req.ctx, 'dayTemplate', req.params.id, () => dayTemplates.deactivate(req.ctx, req.params.id))) throw notFound('Plantilla de día');
    res.json({ success: true });
});

module.exports = router;
