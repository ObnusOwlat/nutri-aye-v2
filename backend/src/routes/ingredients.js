// Ingredients: list/search, CRUD, bulk import
const express = require('express');
const ingredients = require('../repos/ingredients');
const { validate } = require('../validation');
const { ingredientCreate, ingredientUpdate, ingredientBulk } = require('../validation/catalog');
const { notFound, conflict, pageParams, sendPage } = require('../lib/http');

const router = express.Router();

router.get('/api/ingredients', (req, res) => {
    const paging = pageParams(req.query);
    const { search, category, source, sort, order } = req.query;
    const { rows, total } = ingredients.search({ search, category, source, sort, order, ...paging });
    sendPage(res, rows, paging, total);
});

router.get('/api/ingredients/:id', (req, res) => {
    const ingredient = ingredients.getDetails(req.params.id);
    if (!ingredient) throw notFound('Alimento');
    res.json({ success: true, data: ingredient });
});

router.post('/api/ingredients/bulk', validate(ingredientBulk), (req, res) => {
    const count = ingredients.bulkCreate(req.body.ingredients);
    res.json({ success: true, data: { count } });
});

router.post('/api/ingredients', validate(ingredientCreate), (req, res) => {
    res.status(201).json({ success: true, data: ingredients.create(req.body) });
});

router.put('/api/ingredients/:id', validate(ingredientUpdate), (req, res) => {
    const updated = ingredients.update(req.params.id, req.body);
    if (!updated) throw notFound('Alimento');
    res.json({ success: true, data: updated });
});

router.delete('/api/ingredients/:id', (req, res) => {
    const usage = ingredients.recipeUsage(req.params.id);
    if (usage) throw conflict(`El alimento se usa en ${usage} receta(s); quitalo de ellas antes de borrarlo`);
    if (!ingredients.remove(req.params.id)) throw notFound('Alimento');
    res.json({ success: true });
});

module.exports = router;
