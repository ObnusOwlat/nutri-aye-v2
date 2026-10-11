// Sync for the browser cache (pull; push is a no-op until Fase 4)
const express = require('express');
const { db } = require('../db/connection');
const { serverError } = require('../lib/errors');
const { transformIngredient, transformPatient, transformMetric, transformCondition, transformRecipe } = require('../transforms');
const { LIBRARY_INGREDIENTS_SQL } = require('../queries/ingredients');

const router = express.Router();

// SYNC ENDPOINTS - For populating localStorage

// GET /api/sync/init - Full sync (for initial load)
router.get('/api/sync/init', (req, res) => {
    try {
        const ingredients = db.prepare(LIBRARY_INGREDIENTS_SQL).all().map(transformIngredient);
        
        const recipesRaw = db.prepare(`
            SELECT r.*, c.name as category, c.display_name as category_display,
                   n.total_calories, n.total_protein, n.total_carbs, n.total_fat
            FROM recipes r
            JOIN categories c ON r.category_id = c.id
            LEFT JOIN v_recipe_nutrition n ON n.recipe_id = r.id
        `).all();
        
        const recipes = recipesRaw.map(r => {
            const ingredients = db.prepare(`
                SELECT ri.*, i.name as ingredient_name, i.kcal_per_100g,
                       i.protein_per_100g, i.carbs_per_100g, i.fat_per_100g
                FROM recipe_ingredients ri 
                JOIN ingredients i ON ri.ingredient_id = i.id
                WHERE ri.recipe_id = ?
            `).all(r.id);
            
            return {
                ...transformRecipe(r),
                ingredients: ingredients.map(ri => ({
                    ingredientId: ri.ingredient_id,
                    grams: ri.grams
                }))
            };
        });
        
        const patients = db.prepare('SELECT * FROM patients').all().map(transformPatient);
        const patientMetrics = db.prepare('SELECT * FROM patient_metrics').all().map(transformMetric);
        const patientConditions = db.prepare('SELECT * FROM patient_conditions').all().map(transformCondition);
        
        res.json({
            success: true,
            data: {
                ingredients,
                recipes,
                patients,
                patientMetrics,
                patientConditions,
                weekPlan: {},
                currentTemplateId: null,
                dietProfile: { goal: 'maintenance', dailyTarget: 2000 },
                dietTemplates: [
                    { id: 'tpl-1', name: 'Weight Loss 1500', description: 'Caloric deficit', goal: 'deficit', dailyTarget: 1500, isDefault: false },
                    { id: 'tpl-2', name: 'Maintenance 2000', description: 'Maintain weight', goal: 'maintenance', dailyTarget: 2000, isDefault: true },
                    { id: 'tpl-3', name: 'Muscle Gain 3000', description: 'Caloric surplus', goal: 'bulking', dailyTarget: 3000, isDefault: false }
                ]
            }
        });
    } catch (error) {
        serverError(res, error);
    }
});

// POST /api/sync/push - Receive data from frontend (for backup/restore)
router.post('/api/sync/push', (req, res) => {
    try {
        // This endpoint receives data from frontend localStorage
        // For now, just acknowledge receipt (full bidirectional sync would be more complex)
        res.json({ success: true, message: 'Data received', timestamp: new Date().toISOString() });
    } catch (error) {
        serverError(res, error);
    }
});

// GET /api/sync/pull - Pull data for frontend (same as init)
router.get('/api/sync/pull', (req, res) => {
    try {
        const ingredients = db.prepare(LIBRARY_INGREDIENTS_SQL).all().map(transformIngredient);
        
        const recipesRaw = db.prepare(`
            SELECT r.*, c.name as category, c.display_name as category_display,
                   n.total_calories, n.total_protein, n.total_carbs, n.total_fat
            FROM recipes r
            JOIN categories c ON r.category_id = c.id
            LEFT JOIN v_recipe_nutrition n ON n.recipe_id = r.id
        `).all();
        
        const recipes = recipesRaw.map(r => {
            const ingredients = db.prepare(`
                SELECT ri.*, i.name as ingredient_name, i.kcal_per_100g,
                       i.protein_per_100g, i.carbs_per_100g, i.fat_per_100g
                FROM recipe_ingredients ri 
                JOIN ingredients i ON ri.ingredient_id = i.id
                WHERE ri.recipe_id = ?
            `).all(r.id);
            
            return {
                ...transformRecipe(r),
                ingredients: ingredients.map(ri => ({
                    ingredientId: ri.ingredient_id,
                    grams: ri.grams
                }))
            };
        });
        
        const patients = db.prepare('SELECT * FROM patients').all().map(transformPatient);
        const patientMetrics = db.prepare('SELECT * FROM patient_metrics').all().map(transformMetric);
        const patientConditions = db.prepare('SELECT * FROM patient_conditions').all().map(transformCondition);

        // Week plan and diet profile live only in the browser: not sent, so a
        // sync does not overwrite them
        res.json({
            ingredients,
            recipes,
            patients,
            patientMetrics,
            patientConditions
        });
    } catch (error) {
        serverError(res, error);
    }
});

module.exports = router;
