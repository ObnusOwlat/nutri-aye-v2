// Exercise catalog (wger) and physical activities with estimated kcal (MET). Read only.
const express = require('express');
const exercises = require('../repos/exercises');
const patients = require('../repos/patients');
const { validate } = require('../validation');
const { activityKcalQuery } = require('../validation/exercises');
const { notFound, badRequest, pageParams, sendPage } = require('../lib/http');
const { ageOf } = require('../lib/age');

const router = express.Router();

// GET /api/exercises?search=&category=&muscle=&equipment=&page=&limit=
router.get('/api/exercises', (req, res) => {
    const paging = pageParams(req.query);
    const { search, category, muscle, equipment } = req.query;
    const { rows, total } = exercises.listExercises({
        search: String(search || ''), category: String(category || ''),
        muscle: String(muscle || ''), equipment: String(equipment || ''), ...paging
    });
    sendPage(res, rows, paging, total);
});

// GET /api/exercises/filters - categories, muscles and equipment, with sources/licenses
router.get('/api/exercises/filters', (req, res) => {
    res.json({ success: true, data: exercises.filters(), sources: exercises.sources() });
});

// GET /api/activities - activities with their MET values (adults and 60+)
router.get('/api/activities', (req, res) => {
    res.json({ success: true, data: exercises.listActivities(), source: exercises.sources().activities });
});

// GET /api/activities/kcal?activityId=&minutes=&patientId= (or &weightKg=&age=)
// The patient's weight is their latest measurement.
router.get('/api/activities/kcal', validate(activityKcalQuery, 'query'), (req, res) => {
    const { activityId, minutes, patientId } = req.query;
    let { weightKg, age } = req.query;
    const activity = exercises.getActivity(activityId);
    if (!activity) throw notFound('Actividad');
    if (patientId) {
        const patient = patients.getDetail(req.ctx, patientId);
        if (!patient) throw notFound('Paciente');
        weightKg = weightKg ?? patient.metrics?.find(m => m.weight)?.weight;
        age = age ?? ageOf(patient.dateOfBirth);
    }
    if (!weightKg) throw badRequest('Falta el peso: cargá una medición del paciente o indicá weightKg');
    res.json({ success: true, data: exercises.estimateKcal(activity, { minutes, weightKg, age: age ?? null }) });
});

module.exports = router;
