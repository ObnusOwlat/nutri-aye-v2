// Exercise routines of the consultorio (planner, 🏃 Actividad)
const express = require('express');
const routines = require('../repos/activity-templates');
const { tracked } = require('../audit/log');
const { validate } = require('../validation');
const { routineCreate, routineUpdate } = require('../validation/routines');
const { notFound } = require('../lib/http');

const router = express.Router();

router.get('/api/activity-templates', (req, res) => {
    res.json({ success: true, data: routines.list(req.ctx) });
});

router.post('/api/activity-templates', validate(routineCreate), (req, res) => {
    res.status(201).json({ success: true, data: tracked(req.ctx, 'routine', null, () => routines.create(req.ctx, req.body)) });
});

router.put('/api/activity-templates/:id', validate(routineUpdate), (req, res) => {
    const updated = tracked(req.ctx, 'routine', req.params.id, () => routines.update(req.ctx, req.params.id, req.body));
    if (!updated) throw notFound('Rutina');
    res.json({ success: true, data: updated });
});

router.delete('/api/activity-templates/:id', (req, res) => {
    if (!tracked(req.ctx, 'routine', req.params.id, () => routines.deactivate(req.ctx, req.params.id))) throw notFound('Rutina');
    res.json({ success: true });
});

module.exports = router;
