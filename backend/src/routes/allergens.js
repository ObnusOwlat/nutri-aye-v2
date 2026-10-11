// Allergens: the list (14 of EU Regulation 1169/2011) and the consultorio's
// corrections of a food's allergens (catalog or own). Writes go to the activity log.
const express = require('express');
const allergens = require('../repos/allergens');
const ingredients = require('../repos/ingredients');
const { record } = require('../audit/log');
const { validate, z } = require('../validation');
const { ALLERGENS } = require('../lib/allergen-tags');
const { notFound } = require('../lib/http');

const router = express.Router();

router.get('/api/allergens', (req, res) => {
    res.json({
        success: true, data: allergens.catalog(),
        source: 'Alérgenos de alimentos: taxonomía de Open Food Facts (ODbL) y reglas propias. Es una ayuda: revisá siempre la etiqueta.'
    });
});

const overrideSchema = z.object({
    allergen: z.enum(Object.keys(ALLERGENS)),
    present: z.boolean().nullable()       // true add, false remove, null automatic
});

router.put('/api/ingredients/:id/allergens', validate(overrideSchema), (req, res) => {
    if (!ingredients.getById(req.ctx, req.params.id)) throw notFound('Alimento');
    const { allergen, present } = req.body;
    const data = allergens.setOverride(req.ctx, req.params.id, allergen, present);
    record(req.ctx, { action: 'update', entity: 'ingredient', entityId: req.params.id, changes: { [`alérgeno ${allergen}`]: [null, present] } });
    res.json({ success: true, data });
});

module.exports = router;
