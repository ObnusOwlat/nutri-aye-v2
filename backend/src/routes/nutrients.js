// Nutrient catalog and richest foods per nutrient
const express = require('express');
const { db } = require('../db/connection');
const { serverError } = require('../lib/errors');
const { transformIngredient } = require('../transforms');

const router = express.Router();

// GET /api/nutrients - Nutrient catalog with how many ingredients have each one
router.get('/api/nutrients', (req, res) => {
    try {
        const { group = '' } = req.query;
        const nutrients = db.prepare(`
            SELECT n.id, COALESCE(n.name_es, n.name) AS name, n.name AS nameEn, n.unit, n.nutrient_group AS "group",
                   (SELECT COUNT(*) FROM ingredient_nutrients inut WHERE inut.nutrient_id = n.id) AS ingredientCount
            FROM nutrients n
            WHERE (? = '' OR n.nutrient_group = ?)
            ORDER BY n.rank, n.id
        `).all(group, group);
        res.json({ success: true, data: nutrients });
    } catch (error) {
        serverError(res, error);
    }
});

// GET /api/nutrients/:id/ingredients - Ingredients richest in a nutrient (per 100 g)
router.get('/api/nutrients/:id/ingredients', (req, res) => {
    try {
        const nutrient = db.prepare('SELECT id, COALESCE(name_es, name) AS name, name AS nameEn, unit, nutrient_group AS "group" FROM nutrients WHERE id = ?').get(req.params.id);
        if (!nutrient) {
            return res.status(404).json({ success: false, error: 'Nutrient not found' });
        }

        const { category = '', order = 'desc' } = req.query;
        const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
        const rows = db.prepare(`
            SELECT v.*, inut.amount AS nutrient_amount
            FROM ingredient_nutrients inut
            JOIN v_ingredient_with_category v ON v.id = inut.ingredient_id
            WHERE inut.nutrient_id = ? AND (? = '' OR v.category_id = ?)
            ORDER BY inut.amount ${order === 'asc' ? 'ASC' : 'DESC'}
            LIMIT ?
        `).all(nutrient.id, category, category, limit);

        res.json({
            success: true,
            nutrient,
            data: rows.map(r => ({ ...transformIngredient(r), amountPer100g: r.nutrient_amount }))
        });
    } catch (error) {
        serverError(res, error);
    }
});

module.exports = router;
