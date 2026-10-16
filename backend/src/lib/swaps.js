// Simple swaps for the recipe suggestions (beta). When a food of a recipe has
// an allergen of the patient and belongs to one of these groups, the first
// alternative without the patient's allergens is suggested instead, and the
// recipe stays suitable. The recipe itself does not change.
const { db } = require('../db/connection');
const { plain } = require('./diet-rules');

const SWAP_GROUPS = [
    {
        id: 'oil',
        match: (name) => /^aceite\b/.test(name) && !/pescado|salmon|bacalao|higado/.test(name),
        alternatives: [
            { id: 'usda-171025', short: 'aceite de girasol' },
            { id: 'usda-171413', short: 'aceite de oliva' },
            { id: 'miuv2y78bqcqeglh2sv79740774mnaw6wkaz', short: 'aceite de canola' }
        ]
    },
    {
        id: 'milk',
        match: (name) => /^leche\b/.test(name) && !/\bde (almendra|arroz|soja|coco|avena)/.test(name),
        alternatives: [
            { id: 'q48bcqwu1zsfvonvskr2royq5jxdnnsqixu8', short: 'leche de arroz' },
            { id: 'sxh8a2w8eskbdh2trpx8my5vjsk8e6ctmjne', short: 'leche de almendras' },
            { id: 'e1sbqp4b15s9ujvu8ctxqk3w0kyyfkmmowo1', short: 'leche de coco' }
        ]
    }
];

const exists = db.prepare('SELECT 1 FROM ingredients WHERE id = ? AND deactivated_at IS NULL');

/**
 * The alternative for a food of a recipe: { id, short } or null.
 * avoid: the patient's allergens; tagsOf(ids) -> { id: [{ allergen }] }
 */
function swapFor(ingredientName, avoid, tagsOf) {
    const group = SWAP_GROUPS.find(g => g.match(plain(ingredientName)));
    if (!group) return null;
    const tags = tagsOf(group.alternatives.map(a => a.id));
    return group.alternatives.find(a => exists.get(a.id)
        && !(tags[a.id] || []).some(t => avoid.some(x => x.allergen === t.allergen))) || null;
}

module.exports = { SWAP_GROUPS, swapFor };
