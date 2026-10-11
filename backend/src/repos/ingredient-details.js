// A food's full profile (key nutrients first, every nutrient by group, household
// portions in Spanish) and "duplicate and edit" of catalog foods.
const fs = require('fs');
const path = require('path');
const { db } = require('../db/connection');
const { KEY_NUTRIENTS } = require('../lib/key-nutrients');
const { NUTRIENT_FIELDS } = require('../nutrient-fields');
const ingredients = require('./ingredients');
const { nowIso } = require('../lib/http');

const PORTIONS_ES_FILE = path.join(__dirname, '..', '..', '..', 'foods-data', 'translations', 'portions-es.json');
const PORTIONS_ES = fs.existsSync(PORTIONS_ES_FILE) ? JSON.parse(fs.readFileSync(PORTIONS_ES_FILE, 'utf8')) : {};

const NUTRIENT_COLUMNS = 'n.id, COALESCE(n.name_es, n.name) AS name, n.name AS nameEn, n.unit, n.nutrient_group AS "group"';
const stmts = {
    row: db.prepare('SELECT * FROM ingredients WHERE id = ?'),
    nutrients: db.prepare(`
        SELECT ${NUTRIENT_COLUMNS}, inut.amount FROM ingredient_nutrients inut
        JOIN nutrients n ON n.id = inut.nutrient_id WHERE inut.ingredient_id = ? ORDER BY n.rank, n.id
    `),
    nutrient: db.prepare(`SELECT ${NUTRIENT_COLUMNS} FROM nutrients n WHERE n.id = ?`),
    portions: db.prepare('SELECT amount, unit, modifier, gram_weight FROM ingredient_portions WHERE ingredient_id = ? ORDER BY sequence, id'),
    copyNutrients: db.prepare('INSERT INTO ingredient_nutrients (ingredient_id, nutrient_id, amount) SELECT ?, nutrient_id, amount FROM ingredient_nutrients WHERE ingredient_id = ?'),
    copyPortions: db.prepare(`
        INSERT INTO ingredient_portions (ingredient_id, sequence, amount, unit, modifier, gram_weight)
        SELECT ?, sequence, amount, unit, modifier, gram_weight FROM ingredient_portions WHERE ingredient_id = ?
    `)
};

// "1 taza, picado (128 g)": USDA describes the portion in modifier or unit
function portionLabel(p) {
    const text = p.modifier || p.unit || 'porción';
    const spanish = PORTIONS_ES[text] || text;
    const amount = p.amount && p.amount !== 1 ? `${Number(p.amount).toLocaleString('es-PY')} ` : '1 ';
    return `${amount}${spanish}`;
}

/**
 * keyNutrients: the summary list (from the USDA rows, or the food's own
 * per-100 g columns for own and basic-catalog foods); nutrients: everything.
 */
function getDetails(ctx, id) {
    const ingredient = ingredients.getById(ctx, id);
    if (!ingredient) return null;
    const row = stmts.row.get(id);
    const nutrients = stmts.nutrients.all(id);
    const byId = new Map(nutrients.map(n => [n.id, n]));

    const keyNutrients = KEY_NUTRIENTS.map(k => {
        const found = byId.get(k.id) || (k.fallback && byId.get(k.fallback));
        if (found) return found;
        const meta = stmts.nutrient.get(k.id);
        const amount = row[k.column];
        return meta && amount ? { ...meta, amount } : null;
    }).filter(Boolean);

    const portions = stmts.portions.all(id).map(p => ({ label: portionLabel(p), gramWeight: p.gram_weight }));
    return { ...ingredient, keyNutrients, nutrients, portions, editable: ingredients.isOwn(ctx, id) };
}

// Own copy of any visible food (catalog or own), with every nutrient and portion
const duplicate = db.transaction((ctx, id, name) => {
    const source = ingredients.getById(ctx, id);
    if (!source) return null;
    const copy = { ...source, name: name || `${source.name} (copia)` };
    for (const { key } of NUTRIENT_FIELDS) copy[key] = source[key] ?? 0;
    const created = ingredients.create(ctx, copy);
    stmts.copyNutrients.run(created.id, id);
    stmts.copyPortions.run(created.id, id);
    db.prepare('UPDATE ingredients SET name_en = ?, updated_at = ? WHERE id = ?').run(source.nameEn ?? null, nowIso(), created.id);
    return ingredients.getById(ctx, created.id);
});

module.exports = { getDetails, duplicate, portionLabel };
