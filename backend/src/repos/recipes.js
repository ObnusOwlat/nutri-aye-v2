// Recipes of a consultorio: one loader for list/detail/sync, transactional writes.
// ctx = { orgId, userId }. "Delete" deactivates; plans that use the recipe keep it.
const { db } = require('../db/connection');
const { transformRecipe } = require('../transforms');
const { newId, nowIso } = require('../lib/http');

const RECIPE_SELECT = `
    SELECT r.*, c.name AS category, c.display_name AS category_display,
           COALESCE(n.total_calories, 0) AS total_calories, COALESCE(n.total_protein, 0) AS total_protein,
           COALESCE(n.total_carbs, 0) AS total_carbs, COALESCE(n.total_fat, 0) AS total_fat
    FROM recipes r
    JOIN categories c ON r.category_id = c.id
    LEFT JOIN v_recipe_nutrition n ON n.recipe_id = r.id
`;

const stmts = {
    byId: db.prepare(`${RECIPE_SELECT} WHERE r.id = @id AND r.org_id = @orgId AND r.deactivated_at IS NULL`),
    insert: db.prepare(`
        INSERT INTO recipes (id, org_id, name, category_id, instructions, notes, created_at, updated_at)
        VALUES (@id, @orgId, @name, @category, @instructions, @notes, @now, @now)
    `),
    update: db.prepare(`
        UPDATE recipes SET name = COALESCE(@name, name), category_id = COALESCE(@category, category_id),
            instructions = COALESCE(@instructions, instructions), notes = COALESCE(@notes, notes), updated_at = @now
        WHERE id = @id AND org_id = @orgId
    `),
    deactivate: db.prepare(`
        UPDATE recipes SET deactivated_at = @now, deactivated_by = @userId
        WHERE id = @id AND org_id = @orgId AND deactivated_at IS NULL
    `),
    reactivate: db.prepare('UPDATE recipes SET deactivated_at = NULL, deactivated_by = NULL WHERE id = @id AND org_id = @orgId'),
    clearIngredients: db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?'),
    insertIngredient: db.prepare('INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, grams) VALUES (?, ?, ?, ?)'),
    // Catalog or own, active
    ingredientUsable: db.prepare('SELECT 1 FROM ingredients WHERE id = @id AND (org_id IS NULL OR org_id = @orgId) AND deactivated_at IS NULL'),
    nutrients: db.prepare(`
        SELECT n.id, COALESCE(n.name_es, n.name) AS name, n.name AS nameEn, n.unit, n.nutrient_group AS "group",
               SUM(inut.amount * ri.grams / 100) AS amount
        FROM recipe_ingredients ri
        JOIN ingredient_nutrients inut ON inut.ingredient_id = ri.ingredient_id
        JOIN nutrients n ON n.id = inut.nutrient_id
        WHERE ri.recipe_id = ?
        GROUP BY n.id
        ORDER BY n.rank, n.id
    `)
};

// Ingredients of many recipes in one query (no N+1)
function attachIngredients(recipes) {
    if (!recipes.length) return [];
    const ids = recipes.map(r => r.id);
    const rows = db.prepare(`
        SELECT ri.recipe_id, ri.ingredient_id, ri.grams, i.name AS ingredient_name
        FROM recipe_ingredients ri JOIN ingredients i ON i.id = ri.ingredient_id
        WHERE ri.recipe_id IN (${ids.map(() => '?').join(',')})
        ORDER BY ri.rowid
    `).all(...ids);
    const byRecipe = new Map(ids.map(id => [id, []]));
    for (const row of rows) {
        byRecipe.get(row.recipe_id).push({ ingredientId: row.ingredient_id, ingredientName: row.ingredient_name, grams: row.grams });
    }
    return recipes.map(r => ({ ...transformRecipe(r), ingredients: byRecipe.get(r.id) }));
}

function list(ctx, { search = '', category = '', limit, offset }) {
    const where = ['r.org_id = ?', 'r.deactivated_at IS NULL'];
    const params = [ctx.orgId];
    if (search) {
        where.push('unaccent(r.name) LIKE unaccent(?)');
        params.push(`%${search}%`);
    }
    if (category) {
        where.push('r.category_id = ?');
        params.push(category);
    }
    const whereSql = where.join(' AND ');
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM recipes r WHERE ${whereSql}`).get(...params);
    const rows = db.prepare(`${RECIPE_SELECT} WHERE ${whereSql} ORDER BY r.name LIMIT ? OFFSET ?`).all(...params, limit, offset);
    return { rows: attachIngredients(rows), total };
}

const listAll = (ctx) => attachIngredients(
    db.prepare(`${RECIPE_SELECT} WHERE r.org_id = ? AND r.deactivated_at IS NULL ORDER BY r.name`).all(ctx.orgId)
);

function getById(ctx, id, { withNutrients = false } = {}) {
    const row = stmts.byId.get({ id, orgId: ctx.orgId });
    if (!row) return null;
    const [recipe] = attachIngredients([row]);
    return withNutrients ? { ...recipe, nutrients: stmts.nutrients.all(id) } : recipe;
}

const exists = (ctx, id) => !!stmts.byId.get({ id, orgId: ctx.orgId });

// Ids of recipe ingredients the consultorio cannot use (for a 400 before writing)
const missingIngredients = (ctx, items = []) => items.map(i => i.ingredientId)
    .filter(id => !stmts.ingredientUsable.get({ id, orgId: ctx.orgId }));

function replaceIngredients(recipeId, items) {
    stmts.clearIngredients.run(recipeId);
    // The same ingredient twice is merged (recipe_ingredients is unique per pair)
    const grams = new Map();
    for (const { ingredientId, grams: g } of items) grams.set(ingredientId, (grams.get(ingredientId) || 0) + g);
    for (const [ingredientId, g] of grams) stmts.insertIngredient.run(newId(), recipeId, ingredientId, g);
}

const create = db.transaction((ctx, data) => {
    const id = newId();
    stmts.insert.run({ id, orgId: ctx.orgId, name: data.name, category: data.category, instructions: data.instructions ?? '', notes: data.notes ?? '', now: nowIso() });
    replaceIngredients(id, data.ingredients);
    return getById(ctx, id);
});

const update = db.transaction((ctx, id, data) => {
    if (!exists(ctx, id)) return null;
    stmts.update.run({
        id, orgId: ctx.orgId, name: data.name ?? null, category: data.category ?? null,
        instructions: data.instructions ?? null, notes: data.notes ?? null, now: nowIso()
    });
    if (data.ingredients) replaceIngredients(id, data.ingredients);
    return getById(ctx, id);
});

const deactivate = (ctx, id) => stmts.deactivate.run({ id, orgId: ctx.orgId, userId: ctx.userId, now: nowIso() }).changes > 0;
const reactivate = (ctx, id) => stmts.reactivate.run({ id, orgId: ctx.orgId }).changes > 0;

module.exports = { list, listAll, getById, exists, missingIngredients, create, update, deactivate, reactivate };
