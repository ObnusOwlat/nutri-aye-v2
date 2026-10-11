// Recipe suggestions for a patient (conditions, allergies, daily needs). Read only.
const express = require('express');
const suggestions = require('../repos/suggestions');
const { validate } = require('../validation');
const { suggestionsQuery } = require('../validation/suggestions');
const { notFound } = require('../lib/http');

const router = express.Router();

// GET /api/patients/:id/recipe-suggestions?mealType=&limit=&week=id1,id2&days=7
router.get('/api/patients/:id/recipe-suggestions', validate(suggestionsQuery, 'query'), (req, res) => {
    const { mealType, limit, week, days } = req.query;
    const result = suggestions.forPatient(req.ctx, req.params.id, { mealType, limit, weekRecipeIds: week, days });
    if (!result) throw notFound('Paciente');
    res.json({ success: true, ...result });
});

module.exports = router;
