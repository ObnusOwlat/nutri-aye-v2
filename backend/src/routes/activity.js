// Audit log: consultorio activity (admin) and one patient's history
const express = require('express');
const audit = require('../audit/log');
const patients = require('../repos/patients');
const { notFound, pageParams, sendPage } = require('../lib/http');

const router = express.Router();

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const dateOrNull = (value) => (DATE.test(value || '') ? value : null);

router.get('/api/activity', (req, res) => {
    const paging = pageParams(req.query, { defaultLimit: 50, maxLimit: 200 });
    const { userId, entity, action, patientId } = req.query;
    const { rows, total } = audit.list(req.ctx, {
        userId, entity, action, patientId, from: dateOrNull(req.query.from), to: dateOrNull(req.query.to), ...paging
    });
    sendPage(res, rows, paging, total);
});

router.get('/api/patients/:id/history', (req, res) => {
    if (!patients.exists(req.ctx, req.params.id)) throw notFound('Paciente');
    const paging = pageParams(req.query, { defaultLimit: 50, maxLimit: 200 });
    const { rows, total } = audit.list(req.ctx, { patientId: req.params.id, ...paging });
    sendPage(res, rows, paging, total);
});

module.exports = router;
