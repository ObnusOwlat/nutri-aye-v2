// Patient metrics, conditions and allergies ("delete" deactivates)
const express = require('express');
const patients = require('../../repos/patients');
const { validate } = require('../../validation');
const { metricCreate, conditionCreate } = require('../../validation/patients');
const { notFound } = require('../../lib/http');

const router = express.Router();

// 404 for every route under a patient that does not exist
router.param('patientId', (req, res, next, id) => {
    next(patients.exists(req.ctx, id) ? undefined : notFound('Paciente'));
});

router.post('/api/patients/:patientId/metrics', validate(metricCreate), (req, res) => {
    res.status(201).json({ success: true, data: patients.addMetric(req.params.patientId, req.body) });
});

router.delete('/api/patients/:patientId/metrics/:metricId', (req, res) => {
    if (!patients.deactivateMetric(req.ctx, req.params.patientId, req.params.metricId)) throw notFound('Medición');
    res.json({ success: true });
});

router.post('/api/patients/:patientId/conditions', validate(conditionCreate), (req, res) => {
    res.status(201).json({ success: true, data: patients.addCondition(req.params.patientId, req.body) });
});

router.delete('/api/patients/:patientId/conditions/:conditionId', (req, res) => {
    if (!patients.deactivateCondition(req.ctx, req.params.patientId, req.params.conditionId)) throw notFound('Condición');
    res.json({ success: true });
});

router.get('/api/patients/:patientId/allergies', (req, res) => {
    res.json({ success: true, data: patients.allergies(req.params.patientId) });
});

module.exports = router;
