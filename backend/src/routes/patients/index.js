// Patients CRUD (deactivate instead of delete)
const express = require('express');
const patients = require('../../repos/patients');
const { validate } = require('../../validation');
const { patientCreate, patientUpdate } = require('../../validation/patients');
const { notFound, pageParams, sendPage } = require('../../lib/http');

const router = express.Router();

router.get('/api/patients', (req, res) => {
    const paging = pageParams(req.query);
    const { rows, total } = patients.list(req.ctx, { search: req.query.search, ...paging });
    sendPage(res, rows, paging, total);
});

router.get('/api/patients/:id', (req, res) => {
    const patient = patients.getDetail(req.ctx, req.params.id);
    if (!patient) throw notFound('Paciente');
    res.json({ success: true, data: patient });
});

router.post('/api/patients', validate(patientCreate), (req, res) => {
    res.status(201).json({ success: true, data: patients.create(req.ctx, req.body) });
});

router.put('/api/patients/:id', validate(patientUpdate), (req, res) => {
    const updated = patients.update(req.ctx, req.params.id, req.body);
    if (!updated) throw notFound('Paciente');
    res.json({ success: true, data: updated });
});

// "Delete" deactivates: the patient and their history stay in the database
router.delete('/api/patients/:id', (req, res) => {
    if (!patients.deactivate(req.ctx, req.params.id)) throw notFound('Paciente');
    res.json({ success: true });
});

router.post('/api/patients/:id/reactivate', (req, res) => {
    if (!patients.reactivate(req.ctx, req.params.id)) throw notFound('Paciente');
    res.json({ success: true, data: patients.getById(req.ctx, req.params.id) });
});

module.exports = router;
