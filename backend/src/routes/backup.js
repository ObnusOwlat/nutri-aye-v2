// Full backup export (import disabled until rebuilt)
const express = require('express');
const { db } = require('../db/connection');
const { serverError } = require('../lib/errors');
const { transformIngredient, transformPatient, transformMetric, transformCondition, transformRecipe } = require('../transforms');
const { LIBRARY_INGREDIENTS_SQL } = require('../queries/ingredients');

const router = express.Router();

router.get('/api/backup/export', (req, res) => {
    try {
        const backup = {
            version: '3.0-normalized',
            exportedAt: new Date().toISOString(),
            ingredients: db.prepare(LIBRARY_INGREDIENTS_SQL).all().map(transformIngredient),
            recipes: db.prepare(`
                SELECT r.*, c.name as category, c.display_name as category_display,
                   n.total_calories, n.total_protein, n.total_carbs, n.total_fat
            FROM recipes r
            JOIN categories c ON r.category_id = c.id
            LEFT JOIN v_recipe_nutrition n ON n.recipe_id = r.id
            `).all().map(r => {
                const ingredients = db.prepare('SELECT * FROM recipe_ingredients WHERE recipe_id = ?').all(r.id);
                return { ...transformRecipe(r), ingredients };
            }),
            patients: db.prepare('SELECT * FROM patients').all().map(transformPatient),
            patientMetrics: db.prepare('SELECT * FROM patient_metrics').all().map(transformMetric),
            patientConditions: db.prepare('SELECT * FROM patient_conditions').all().map(transformCondition),
            patientPlans: db.prepare('SELECT * FROM patient_plans').all(),
            patientProgress: db.prepare('SELECT * FROM patient_progress').all()
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=meal-prep-backup.json');
        res.json(backup);
    } catch (error) {
        serverError(res, error);
    }
});

// POST /api/backup/import - disabled: the previous implementation could wipe
// tables and lost data on round trip. Rebuilt with validation in Fase 1.
router.post('/api/backup/import', (req, res) => {
    res.status(503).json({ success: false, error: 'La importación de respaldos está deshabilitada temporalmente', code: 'IMPORT_DISABLED' });
});

module.exports = router;
