// Allergens of foods and recipes for a consultorio: computed tags
// (ingredients.allergen_tags) plus its manual corrections (ingredient_allergen_overrides),
// and the cross-check against a patient's allergies and intolerances.
const { db } = require('../db/connection');
const { ALLERGENS, allergensInText, shortOf } = require('../lib/allergen-tags');
const { tagAllFoods } = require('../db/schema/allergens');
const { nowIso } = require('../lib/http');

const stmts = {
    upsertOverride: db.prepare(`
        INSERT INTO ingredient_allergen_overrides (org_id, ingredient_id, allergen, present, updated_at, updated_by)
        VALUES (@orgId, @ingredientId, @allergen, @present, @now, @userId)
        ON CONFLICT (org_id, ingredient_id, allergen) DO UPDATE SET present = excluded.present, updated_at = excluded.updated_at, updated_by = excluded.updated_by
    `)
};

/**
 * { ingredientId: [{ allergen, label, source: 'off'|'rules'|'manual', term }] }
 * Manual removals hide a computed tag; manual additions add one.
 */
function forIngredients(ctx, ids) {
    const unique = [...new Set(ids.filter(Boolean))];
    const result = Object.fromEntries(unique.map(id => [id, []]));
    if (!unique.length) return result;
    const marks = unique.map(() => '?').join(',');
    const auto = db.prepare(`SELECT id, allergen_tags FROM ingredients WHERE id IN (${marks})`).all(...unique)
        .flatMap(row => { try { return JSON.parse(row.allergen_tags || '[]').map(t => ({ ...t, ingredient_id: row.id })); } catch { return []; } });
    const manual = db.prepare(`SELECT ingredient_id, allergen, present FROM ingredient_allergen_overrides
                               WHERE org_id = ? AND present IS NOT NULL AND ingredient_id IN (${marks})`).all(ctx.orgId, ...unique);
    const removed = new Set(manual.filter(m => m.present === 0).map(m => `${m.ingredient_id}|${m.allergen}`));
    for (const a of auto) {
        if (!removed.has(`${a.ingredient_id}|${a.allergen}`)) result[a.ingredient_id].push({ allergen: a.allergen, label: shortOf(a.allergen), source: a.source, term: a.term });
    }
    for (const m of manual.filter(m => m.present === 1)) {
        const list = result[m.ingredient_id];
        if (!list.some(a => a.allergen === m.allergen)) list.push({ allergen: m.allergen, label: shortOf(m.allergen), source: 'manual', term: null });
    }
    return result;
}

// Adds "allergens" to ingredient objects of the API
function attach(ctx, ingredients) {
    const map = forIngredients(ctx, ingredients.map(i => i?.id));
    return ingredients.map(i => (i ? { ...i, allergens: map[i.id] || [] } : i));
}

// present: true (add), false (remove), null (back to automatic)
function setOverride(ctx, ingredientId, allergen, present) {
    stmts.upsertOverride.run({ orgId: ctx.orgId, ingredientId, allergen, present: present == null ? null : present ? 1 : 0, now: nowIso(), userId: ctx.userId });
    return forIngredients(ctx, [ingredientId])[ingredientId];
}

// Own foods are tagged again when their name changes
const retag = (ids) => tagAllFoods(db, ids);

/**
 * What a patient must avoid: [{ allergen, label, type, severity, block, condition }]
 * block = severe allergy (choosing the food asks for confirmation)
 */
function patientAllergens(conditions) {
    const out = [];
    for (const c of conditions.filter(c => ['allergy', 'intolerance'].includes(c.type))) {
        const ids = c.allergens?.length ? c.allergens : allergensInText(`${c.name} ${c.description || ''}`);
        for (const allergen of ids) {
            if (!ALLERGENS[allergen]) continue;
            const block = c.type === 'allergy' && c.severity === 'severe';
            const existing = out.find(o => o.allergen === allergen);
            if (existing) { existing.block = existing.block || block; continue; }
            out.push({ allergen, label: shortOf(allergen), type: c.type, severity: c.severity, block, condition: c.name });
        }
    }
    return out;
}

/**
 * Conflicts of a list of foods (recipe lines) with the patient:
 * [{ allergen, label, ingredient, block, type }]
 */
function conflicts(ctx, avoid, lines) {
    if (!avoid.length || !lines.length) return [];
    const tags = forIngredients(ctx, lines.map(l => l.ingredientId));
    const found = [];
    for (const line of lines) {
        for (const tag of tags[line.ingredientId] || []) {
            const hit = avoid.find(a => a.allergen === tag.allergen);
            if (hit) found.push({ allergen: tag.allergen, label: tag.label, ingredient: line.ingredientName, block: hit.block, type: hit.type });
        }
    }
    return found;
}

const catalog = () => Object.entries(ALLERGENS).map(([id, a]) => ({ id, label: a.label, short: a.short }));

module.exports = { forIngredients, attach, setOverride, retag, patientAllergens, conflicts, catalog };
