// Recipes with ingredients and nutrition
const express = require('express');
const recipes = require('../repos/recipes');
const { validate } = require('../validation');
const { recipeCreate, recipeUpdate } = require('../validation/catalog');
const { notFound, badRequest, conflict, pageParams, sendPage } = require('../lib/http');

const router = express.Router();

function checkIngredients(items) {
    const missing = recipes.missingIngredients(items);
    if (missing.length) throw badRequest(`Alimento(s) inexistente(s): ${missing.join(', ')}`);
}

router.get('/api/recipes', (req, res) => {
    const paging = pageParams(req.query);
    const { rows, total } = recipes.list({ search: req.query.search, category: req.query.category, ...paging });
    sendPage(res, rows, paging, total);
});

router.get('/api/recipes/:id', (req, res) => {
    const recipe = recipes.getById(req.params.id, { withNutrients: true });
    if (!recipe) throw notFound('Receta');
    res.json({ success: true, data: recipe });
});

router.post('/api/recipes', validate(recipeCreate), (req, res) => {
    checkIngredients(req.body.ingredients);
    res.status(201).json({ success: true, data: recipes.create(req.body) });
});

router.put('/api/recipes/:id', validate(recipeUpdate), (req, res) => {
    if (req.body.ingredients) checkIngredients(req.body.ingredients);
    const updated = recipes.update(req.params.id, req.body);
    if (!updated) throw notFound('Receta');
    res.json({ success: true, data: updated });
});

router.delete('/api/recipes/:id', (req, res) => {
    try {
        if (!recipes.remove(req.params.id)) throw notFound('Receta');
    } catch (error) {
        if (error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') throw conflict('La receta está asignada a un plan de paciente');
        throw error;
    }
    res.json({ success: true });
});

module.exports = router;
