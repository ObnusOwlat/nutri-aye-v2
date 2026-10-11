// Ingredients: list/search, CRUD, bulk import. "Delete" deactivates.
const express = require('express');
const ingredients = require('../repos/ingredients');
const { validate } = require('../validation');
const { ingredientCreate, ingredientUpdate, ingredientBulk } = require('../validation/catalog');
const { HttpError, notFound, pageParams, sendPage } = require('../lib/http');

const router = express.Router();

// Catalog foods are shared by every consultorio and cannot be changed
function ownOrThrow(req) {
    if (ingredients.isOwn(req.ctx, req.params.id)) return;
    if (ingredients.getById(req.ctx, req.params.id)) {
        throw new HttpError(403, 'Los alimentos del catálogo no se pueden modificar', 'CATALOG_READONLY');
    }
    throw notFound('Alimento');
}

router.get('/api/ingredients', (req, res) => {
    const paging = pageParams(req.query);
    const { search, category, source, sort, order } = req.query;
    const { rows, total } = ingredients.search(req.ctx, { search, category, source, sort, order, ...paging });
    sendPage(res, rows, paging, total);
});

router.get('/api/ingredients/:id', (req, res) => {
    const ingredient = ingredients.getDetails(req.ctx, req.params.id);
    if (!ingredient) throw notFound('Alimento');
    res.json({ success: true, data: ingredient });
});

router.post('/api/ingredients/bulk', validate(ingredientBulk), (req, res) => {
    const count = ingredients.bulkCreate(req.ctx, req.body.ingredients);
    res.json({ success: true, data: { count } });
});

router.post('/api/ingredients', validate(ingredientCreate), (req, res) => {
    res.status(201).json({ success: true, data: ingredients.create(req.ctx, req.body) });
});

router.put('/api/ingredients/:id', validate(ingredientUpdate), (req, res) => {
    ownOrThrow(req);
    res.json({ success: true, data: ingredients.update(req.ctx, req.params.id, req.body) });
});

router.delete('/api/ingredients/:id', (req, res) => {
    ownOrThrow(req);
    ingredients.deactivate(req.ctx, req.params.id);
    res.json({ success: true });
});

router.post('/api/ingredients/:id/reactivate', (req, res) => {
    if (!ingredients.reactivate(req.ctx, req.params.id)) throw notFound('Alimento');
    res.json({ success: true, data: ingredients.getById(req.ctx, req.params.id) });
});

module.exports = router;
