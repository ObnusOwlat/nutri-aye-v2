// Daily nutritional targets of a patient and their manual adjustments
const express = require('express');
const patients = require('../repos/patients');
const targets = require('../repos/targets');
const { record } = require('../audit/log');
const { validate, z } = require('../validation');
const { notFound } = require('../lib/http');

const router = express.Router();

const amount = z.coerce.number().min(0).max(100000).nullable();
const overridesSchema = z.object({
    energy: z.coerce.number().int().min(500).max(10000).nullable().optional(),
    nutrients: z.record(z.string().regex(/^\d+$/), amount).optional()
});

router.param('patientId', (req, res, next, id) => next(patients.exists(req.ctx, id) ? undefined : notFound('Paciente')));

router.get('/api/patients/:patientId/targets', (req, res) => {
    res.json({ success: true, data: targets.targetsFor(req.ctx, req.params.patientId) });
});

// Only the keys sent change; null = back to the automatic value
router.put('/api/patients/:patientId/targets', validate(overridesSchema), (req, res) => {
    const { patientId } = req.params;
    targets.saveOverrides(req.ctx, patientId, req.body);
    const changes = {};
    if (req.body.energy !== undefined) changes.energy = [null, req.body.energy];
    for (const [id, value] of Object.entries(req.body.nutrients || {})) changes[`nutrient_${id}`] = [null, value];
    record(req.ctx, { action: 'update', entity: 'targets', entityId: patientId, patientId, changes });
    res.json({ success: true, data: targets.targetsFor(req.ctx, patientId) });
});

module.exports = router;
