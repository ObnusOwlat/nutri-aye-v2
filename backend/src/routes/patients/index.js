// Patients CRUD
const express = require('express');
const patients = require('../../repos/patients');
const { validate } = require('../../validation');
const { patientCreate, patientUpdate } = require('../../validation/patients');
const { notFound, pageParams, sendPage } = require('../../lib/http');

const router = express.Router();

router.get('/api/patients', (req, res) => {
    const paging = pageParams(req.query);
    const { rows, total } = patients.list({ search: req.query.search, ...paging });
    sendPage(res, rows, paging, total);
});

router.get('/api/patients/:id', (req, res) => {
    const patient = patients.getDetail(req.params.id);
    if (!patient) throw notFound('Paciente');
    res.json({ success: true, data: patient });
});

router.post('/api/patients', validate(patientCreate), (req, res) => {
    res.status(201).json({ success: true, data: patients.create(req.body) });
});

router.put('/api/patients/:id', validate(patientUpdate), (req, res) => {
    const updated = patients.update(req.params.id, req.body);
    if (!updated) throw notFound('Paciente');
    res.json({ success: true, data: updated });
});

router.delete('/api/patients/:id', (req, res) => {
    if (!patients.remove(req.params.id)) throw notFound('Paciente');
    res.json({ success: true });
});

module.exports = router;
