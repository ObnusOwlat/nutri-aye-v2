// Nutrient catalog and richest foods per nutrient
const express = require('express');
const { db } = require('../db/connection');
const { transformIngredient } = require('../transforms');
const { notFound } = require('../lib/http');

const router = express.Router();

const NUTRIENT_COLUMNS = 'id, COALESCE(name_es, name) AS name, name AS nameEn, unit, nutrient_group AS "group"';

const stmts = {
    catalog: db.prepare(`
        SELECT ${NUTRIENT_COLUMNS},
               (SELECT COUNT(*) FROM ingredient_nutrients inut WHERE inut.nutrient_id = n.id) AS ingredientCount
        FROM nutrients n WHERE (@group = '' OR nutrient_group = @group) ORDER BY rank, id
    `),
    byId: db.prepare(`SELECT ${NUTRIENT_COLUMNS} FROM nutrients WHERE id = ?`)
};

// GET /api/nutrients?group= - catalog with how many ingredients have each one
router.get('/api/nutrients', (req, res) => {
    res.json({ success: true, data: stmts.catalog.all({ group: String(req.query.group || '') }) });
});

// GET /api/nutrients/:id/ingredients - ingredients richest in a nutrient (per 100 g)
router.get('/api/nutrients/:id/ingredients', (req, res) => {
    const nutrient = stmts.byId.get(req.params.id);
    if (!nutrient) throw notFound('Nutriente');

    const category = String(req.query.category || '');
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const rows = db.prepare(`
        SELECT v.*, inut.amount AS nutrient_amount
        FROM ingredient_nutrients inut
        JOIN v_ingredient_with_category v ON v.id = inut.ingredient_id
        WHERE inut.nutrient_id = ? AND (? = '' OR v.category_id = ?)
        ORDER BY inut.amount ${req.query.order === 'asc' ? 'ASC' : 'DESC'}
        LIMIT ?
    `).all(nutrient.id, category, category, limit);

    res.json({
        success: true,
        nutrient,
        data: rows.map(r => ({ ...transformIngredient(r), amountPer100g: r.nutrient_amount }))
    });
});

module.exports = router;
