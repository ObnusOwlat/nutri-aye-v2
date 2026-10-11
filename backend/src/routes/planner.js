// Weekly planner per patient
const express = require('express');
const planner = require('../repos/planner');
const patients = require('../repos/patients');
const { validate } = require('../validation');
const { plannerCreate, plannerUpdate } = require('../validation/planner');
const { notFound, badRequest } = require('../lib/http');

const router = express.Router();

function checkPatient(req, { patientId }) {
    if (patientId && !patients.exists(req.ctx, patientId)) throw badRequest('El paciente no existe');
}

router.get('/api/planner', (req, res) => {
    res.json({ success: true, data: planner.list(req.ctx, { patientId: req.query.patientId }) });
});

router.post('/api/planner', validate(plannerCreate), (req, res) => {
    checkPatient(req, req.body);
    res.status(201).json({ success: true, data: planner.create(req.ctx, req.body) });
});

router.put('/api/planner/:id', validate(plannerUpdate), (req, res) => {
    checkPatient(req, req.body);
    // Recipes that exist only in a browser (until Fase 4) are skipped and reported
    const skipped = planner.missingRecipes(req.ctx, req.body.meals);
    const meals = req.body.meals?.filter(m => !skipped.includes(m.recipeId));
    const updated = planner.update(req.ctx, req.params.id, { ...req.body, meals });
    if (!updated) throw notFound('Planificación');
    res.json({ success: true, data: updated, skippedMeals: skipped.length });
});

router.delete('/api/planner/:id', (req, res) => {
    if (!planner.deactivate(req.ctx, req.params.id)) throw notFound('Planificación');
    res.json({ success: true });
});

module.exports = router;
