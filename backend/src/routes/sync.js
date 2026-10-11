// Pull for the browser cache (removed in Fase 4, when the frontend reads the API directly)
const express = require('express');
const ingredients = require('../repos/ingredients');
const recipes = require('../repos/recipes');
const patients = require('../repos/patients');

const router = express.Router();

// Week plan and diet profile live only in the browser: not sent, so a
// sync does not overwrite them
router.get('/api/sync/pull', (req, res) => {
    res.json({
        success: true,
        data: {
            ingredients: ingredients.listLibrary(),
            recipes: recipes.listAll(),
            patients: patients.listAll(),
            patientMetrics: patients.listAllMetrics(),
            patientConditions: patients.listAllConditions()
        }
    });
});

module.exports = router;
