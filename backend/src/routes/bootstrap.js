// Everything the app needs after login, in one request (replaces the old browser sync)
const express = require('express');
const ingredients = require('../repos/ingredients');
const recipes = require('../repos/recipes');
const patients = require('../repos/patients');
const plans = require('../repos/plans');
const templates = require('../repos/diet-templates');

const router = express.Router();

router.get('/api/bootstrap', (req, res) => {
    res.json({
        success: true,
        data: {
            ingredients: ingredients.listLibrary(req.ctx),
            recipes: recipes.listAll(req.ctx),
            patients: patients.listAll(req.ctx),
            patientMetrics: patients.listAllMetrics(req.ctx),
            patientConditions: patients.listAllConditions(req.ctx),
            patientPlans: plans.listAllPlans(req.ctx),
            patientProgress: plans.listAllProgress(req.ctx),
            dietTemplates: templates.list(req.ctx)
        }
    });
});

module.exports = router;
