// Nutrient totals of many recipes at once (planner side panel). Read only.
// ctx = { orgId }. Amounts are per recipe as saved (sum of its ingredients).
const { db } = require('../db/connection');
const { KEY_NUTRIENTS, FOLDED_IDS } = require('../lib/key-nutrients');

const NUTRIENT_COLUMNS = 'id, COALESCE(name_es, name) AS name, name AS nameEn, unit, nutrient_group AS "group"';
const amountOf = (nutrientId) =>
    `(SELECT amount FROM ingredient_nutrients WHERE ingredient_id = i.id AND nutrient_id = ${nutrientId})`;

// One column per key nutrient: USDA id -> duplicate USDA id -> ingredient column
const keySums = KEY_NUTRIENTS.map(k => {
    const sources = [amountOf(k.id), k.fallback && amountOf(k.fallback), `i.${k.column}`].filter(Boolean);
    return `SUM(ri.grams / 100.0 * COALESCE(${sources.join(', ')})) AS n${k.id}`;
}).join(',\n');

const stmts = {
    usable: db.prepare('SELECT 1 FROM recipes WHERE id = @id AND org_id = @orgId AND deactivated_at IS NULL'),
    keyMeta: db.prepare(`SELECT ${NUTRIENT_COLUMNS} FROM nutrients WHERE id IN (${KEY_NUTRIENTS.map(k => k.id).join(',')})`)
};

const round = (n) => (n == null ? null : Math.round(n * 1000) / 1000);

function forRecipes(ctx, recipeIds) {
    const unique = [...new Set(recipeIds)];
    const ids = unique.filter(id => stmts.usable.get({ id, orgId: ctx.orgId }));
    const skipped = unique.filter(id => !ids.includes(id));
    const keyMeta = new Map(stmts.keyMeta.all().map(n => [n.id, n]));
    const nutrients = KEY_NUTRIENTS.filter(k => keyMeta.has(k.id)).map(k => ({ ...keyMeta.get(k.id), key: true }));
    const recipes = Object.fromEntries(ids.map(id => [id, {}]));
    if (!ids.length) return { nutrients, recipes, skipped };

    const marks = ids.map(() => '?').join(',');
    const keyRows = db.prepare(`
        SELECT ri.recipe_id, ${keySums}
        FROM recipe_ingredients ri JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.recipe_id IN (${marks}) GROUP BY ri.recipe_id
    `).all(...ids);
    for (const row of keyRows) {
        for (const n of nutrients) recipes[row.recipe_id][n.id] = round(row[`n${n.id}`]);
    }

    // Every other USDA nutrient the ingredients have
    const restRows = db.prepare(`
        SELECT ri.recipe_id, n.id, COALESCE(n.name_es, n.name) AS name, n.name AS nameEn, n.unit,
               n.nutrient_group AS "group", SUM(inut.amount * ri.grams / 100.0) AS amount
        FROM recipe_ingredients ri
        JOIN ingredient_nutrients inut ON inut.ingredient_id = ri.ingredient_id
        JOIN nutrients n ON n.id = inut.nutrient_id
        WHERE ri.recipe_id IN (${marks})
        GROUP BY ri.recipe_id, n.id
        ORDER BY n.rank, n.id
    `).all(...ids);
    const seen = new Set();
    for (const { recipe_id: recipeId, amount, ...meta } of restRows) {
        if (FOLDED_IDS.has(meta.id)) continue;
        if (!seen.has(meta.id)) {
            seen.add(meta.id);
            nutrients.push({ ...meta, key: false });
        }
        recipes[recipeId][meta.id] = round(amount);
    }
    return { nutrients, recipes, skipped };
}

module.exports = { forRecipes };
