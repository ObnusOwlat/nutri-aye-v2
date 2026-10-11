// Patient meal plans and progress check-ins ("delete" deactivates)
const express = require('express');
const patients = require('../../repos/patients');
const plans = require('../../repos/plans');
const { tracked } = require('../../audit/log');
const { validate } = require('../../validation');
const schemas = require('../../validation/patients');
const { notFound } = require('../../lib/http');

const router = express.Router();

router.param('patientId', (req, res, next, id) => {
    next(patients.exists(req.ctx, id) ? undefined : notFound('Paciente'));
});

router.post('/api/patients/:patientId/plans', validate(schemas.planCreate), (req, res) => {
    const plan = tracked(req.ctx, 'plan', null, () => plans.createPlan(req.ctx, req.params.patientId, req.body));
    res.status(201).json({ success: true, data: plan });
});

router.put('/api/patients/:patientId/plans/:planId', validate(schemas.planUpdate), (req, res) => {
    const { patientId, planId } = req.params;
    const plan = tracked(req.ctx, 'plan', planId, () => plans.updatePlan(req.ctx, patientId, planId, req.body));
    if (!plan) throw notFound('Plan');
    res.json({ success: true, data: plan });
});

router.delete('/api/patients/:patientId/plans/:planId', (req, res) => {
    const { patientId, planId } = req.params;
    if (!tracked(req.ctx, 'plan', planId, () => plans.deactivatePlan(req.ctx, patientId, planId))) throw notFound('Plan');
    res.json({ success: true });
});

router.post('/api/patients/:patientId/progress', validate(schemas.progressCreate), (req, res) => {
    const entry = tracked(req.ctx, 'progress', null, () => plans.createProgress(req.params.patientId, req.body));
    res.status(201).json({ success: true, data: entry });
});

router.put('/api/patients/:patientId/progress/:progressId', validate(schemas.progressUpdate), (req, res) => {
    const { patientId, progressId } = req.params;
    const entry = tracked(req.ctx, 'progress', progressId, () => plans.updateProgress(patientId, progressId, req.body));
    if (!entry) throw notFound('Seguimiento');
    res.json({ success: true, data: entry });
});

router.delete('/api/patients/:patientId/progress/:progressId', (req, res) => {
    const { patientId, progressId } = req.params;
    if (!tracked(req.ctx, 'progress', progressId, () => plans.deactivateProgress(req.ctx, patientId, progressId))) throw notFound('Seguimiento');
    res.json({ success: true });
});

module.exports = router;
