// Recipes with ingredients and nutrition. "Delete" deactivates.
const express = require('express');
const recipes = require('../repos/recipes');
const { validate } = require('../validation');
const { recipeCreate, recipeUpdate } = require('../validation/catalog');
const { notFound, badRequest, pageParams, sendPage } = require('../lib/http');

const router = express.Router();

function checkIngredients(req, items) {
    const missing = recipes.missingIngredients(req.ctx, items);
    if (missing.length) throw badRequest(`Alimento(s) inexistente(s): ${missing.join(', ')}`);
}

router.get('/api/recipes', (req, res) => {
    const paging = pageParams(req.query);
    const { rows, total } = recipes.list(req.ctx, { search: req.query.search, category: req.query.category, ...paging });
    sendPage(res, rows, paging, total);
});

router.get('/api/recipes/:id', (req, res) => {
    const recipe = recipes.getById(req.ctx, req.params.id, { withNutrients: true });
    if (!recipe) throw notFound('Receta');
    res.json({ success: true, data: recipe });
});

router.post('/api/recipes', validate(recipeCreate), (req, res) => {
    checkIngredients(req, req.body.ingredients);
    res.status(201).json({ success: true, data: recipes.create(req.ctx, req.body) });
});

router.put('/api/recipes/:id', validate(recipeUpdate), (req, res) => {
    if (req.body.ingredients) checkIngredients(req, req.body.ingredients);
    const updated = recipes.update(req.ctx, req.params.id, req.body);
    if (!updated) throw notFound('Receta');
    res.json({ success: true, data: updated });
});

router.delete('/api/recipes/:id', (req, res) => {
    if (!recipes.deactivate(req.ctx, req.params.id)) throw notFound('Receta');
    res.json({ success: true });
});

router.post('/api/recipes/:id/reactivate', (req, res) => {
    if (!recipes.reactivate(req.ctx, req.params.id)) throw notFound('Receta');
    res.json({ success: true, data: recipes.getById(req.ctx, req.params.id) });
});

module.exports = router;
