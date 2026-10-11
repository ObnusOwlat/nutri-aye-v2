// Ingredients: list/search, CRUD, bulk import. "Delete" deactivates.
const express = require('express');
const ingredients = require('../repos/ingredients');
const details = require('../repos/ingredient-details');
const { tracked, record } = require('../audit/log');
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

// ?search=&category=a,b&subgroup=protein.beef,protein.pork&form=raw,cooked,none&source=&scope=
router.get('/api/ingredients', (req, res) => {
    const paging = pageParams(req.query);
    const { search, category, subgroup, form, source, scope, sort, order } = req.query;
    const { rows, total } = ingredients.search(req.ctx, { search, category, subgroup, form, source, scope, sort, order, ...paging });
    sendPage(res, rows, paging, total);
});

// Counts per category/subgroup and per form for the filter tree (same filters)
router.get('/api/ingredients/facets', (req, res) => {
    const { search, category, subgroup, form, source, scope } = req.query;
    res.json({ success: true, data: ingredients.facets(req.ctx, { search, category, subgroup, form, source, scope }) });
});

router.get('/api/ingredients/:id', (req, res) => {
    const ingredient = details.getDetails(req.ctx, req.params.id);
    if (!ingredient) throw notFound('Alimento');
    res.json({ success: true, data: ingredient });
});

router.post('/api/ingredients/bulk', validate(ingredientBulk), (req, res) => {
    const count = ingredients.bulkCreate(req.ctx, req.body.ingredients);
    record(req.ctx, { action: 'import', entity: 'ingredient', changes: { count: [null, count] } });
    res.json({ success: true, data: { count } });
});

router.post('/api/ingredients', validate(ingredientCreate), (req, res) => {
    res.status(201).json({ success: true, data: tracked(req.ctx, 'ingredient', null, () => ingredients.create(req.ctx, req.body)) });
});

router.put('/api/ingredients/:id', validate(ingredientUpdate), (req, res) => {
    ownOrThrow(req);
    res.json({ success: true, data: tracked(req.ctx, 'ingredient', req.params.id, () => ingredients.update(req.ctx, req.params.id, req.body)) });
});

router.delete('/api/ingredients/:id', (req, res) => {
    ownOrThrow(req);
    tracked(req.ctx, 'ingredient', req.params.id, () => ingredients.deactivate(req.ctx, req.params.id));
    res.json({ success: true });
});

// "Duplicate and edit": an own copy of a catalog food, with every nutrient and portion
router.post('/api/ingredients/:id/duplicate', (req, res) => {
    const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 200) : '';
    const copy = tracked(req.ctx, 'ingredient', null, () => details.duplicate(req.ctx, req.params.id, name));
    if (!copy) throw notFound('Alimento');
    res.status(201).json({ success: true, data: copy });
});

router.post('/api/ingredients/:id/reactivate', (req, res) => {
    if (!tracked(req.ctx, 'ingredient', req.params.id, () => ingredients.reactivate(req.ctx, req.params.id))) throw notFound('Alimento');
    res.json({ success: true, data: ingredients.getById(req.ctx, req.params.id) });
});

module.exports = router;
