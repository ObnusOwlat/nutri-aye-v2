// Ingredients: search, CRUD, bulk import and full nutrient detail.
// Catalog foods (USDA, calories-in) have org_id NULL: every consultorio reads
// them, nobody edits them. Foods a consultorio creates are its own.
// ctx = { orgId, userId } in every function.
const { db, unaccent } = require('../db/connection');
const { NUTRIENT_FIELDS } = require('../nutrient-fields');
const { transformIngredient } = require('../transforms');
const { newId, nowIso } = require('../lib/http');

const COLUMNS = NUTRIENT_FIELDS.map(f => f.column);
const VISIBLE = '(org_id IS NULL OR org_id = @orgId) AND deactivated_at IS NULL';

const stmts = {
    // Visible to the consultorio (catalog or own), active
    byId: db.prepare(`SELECT * FROM v_ingredient_with_category WHERE id = @id AND ${VISIBLE}`),
    own: db.prepare('SELECT 1 FROM ingredients WHERE id = @id AND org_id = @orgId AND deactivated_at IS NULL'),
    insert: db.prepare(`
        INSERT INTO ingredients (id, org_id, source, name, category_id, unit_id, created_at, updated_at, ${COLUMNS.join(', ')})
        VALUES (@id, @orgId, 'user', @name, @category, @unit, @now, @now, ${COLUMNS.map(c => `@${c}`).join(', ')})
    `),
    update: db.prepare(`
        UPDATE ingredients SET
            name = COALESCE(@name, name),
            name_edited = CASE WHEN @name IS NOT NULL THEN 1 ELSE name_edited END,
            category_id = COALESCE(@category, category_id),
            unit_id = COALESCE(@unit, unit_id),
            updated_at = @now,
            ${COLUMNS.map(c => `${c} = COALESCE(@${c}, ${c})`).join(',\n            ')}
        WHERE id = @id AND org_id = @orgId
    `),
    deactivate: db.prepare(`
        UPDATE ingredients SET deactivated_at = @now, deactivated_by = @userId
        WHERE id = @id AND org_id = @orgId AND deactivated_at IS NULL
    `),
    reactivate: db.prepare('UPDATE ingredients SET deactivated_at = NULL, deactivated_by = NULL WHERE id = @id AND org_id = @orgId'),
};


// API object -> named statement params (missing nutrients: null on update, 0 on insert)
function toParams(data, missing) {
    const params = { name: data.name ?? null, category: data.category ?? null, unit: data.unit ?? null };
    for (const { column, key } of NUTRIENT_FIELDS) params[column] = data[key] ?? missing;
    return params;
}

// scope: 'own' (the consultorio's foods), 'catalog' (shared foods) or both
function search(ctx, { search = '', category = '', source = '', scope = '', sort, order, limit, offset }) {
    const where = ['(org_id IS NULL OR org_id = ?)', 'deactivated_at IS NULL'];
    const params = [ctx.orgId];
    if (scope === 'own') where.push('org_id IS NOT NULL');
    if (scope === 'catalog') where.push('org_id IS NULL');

    // Every word must appear in the Spanish or English name, in any order,
    // ignoring accents and case ("pollo pechuga", "limon")
    const terms = unaccent(search).split(/\s+/).filter(Boolean);
    for (const term of terms) {
        where.push('(unaccent(name) LIKE ? OR unaccent(name_en) LIKE ?)');
        params.push(`%${term}%`, `%${term}%`);
    }
    if (category) {
        where.push('category_id = ?');
        params.push(category);
    }
    if (source === 'usda') {
        where.push("source LIKE 'usda%'"); // both USDA datasets
    } else if (source) {
        where.push('source = ?');
        params.push(source);
    }

    // Searching without an explicit sort: names starting with the first word
    // first, then shorter (more basic) names: "Limón, crudo" before drinks
    const sortColumn = ['name', 'kcal_per_100g', 'category'].includes(sort) ? sort : 'name';
    let orderBy = `${sortColumn} ${order === 'desc' ? 'DESC' : 'ASC'}`;
    const orderParams = [];
    if (terms.length && !sort) {
        orderBy = 'unaccent(name) LIKE ? DESC, LENGTH(name) ASC, name ASC';
        orderParams.push(`${terms[0]}%`);
    }

    const whereSql = where.join(' AND ');
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM v_ingredient_with_category WHERE ${whereSql}`).get(...params);
    const rows = db.prepare(`
        SELECT * FROM v_ingredient_with_category WHERE ${whereSql}
        ORDER BY ${orderBy} LIMIT ? OFFSET ?
    `).all(...params, ...orderParams, limit, offset);
    return { rows: rows.map(transformIngredient), total };
}

const getById = (ctx, id) => transformIngredient(stmts.byId.get({ id, orgId: ctx.orgId }));
const isOwn = (ctx, id) => !!stmts.own.get({ id, orgId: ctx.orgId });

function create(ctx, data) {
    const id = newId();
    stmts.insert.run({ ...toParams(data, 0), id, orgId: ctx.orgId, now: nowIso() });
    return getById(ctx, id);
}

// Only the consultorio's own foods; null = not found or catalog (read-only)
function update(ctx, id, data) {
    if (!isOwn(ctx, id)) return null;
    stmts.update.run({ ...toParams(data, null), id, orgId: ctx.orgId, now: nowIso() });
    return getById(ctx, id);
}

// Deactivated foods disappear from searches; recipes that use them keep working
const deactivate = (ctx, id) => stmts.deactivate.run({ id, orgId: ctx.orgId, userId: ctx.userId, now: nowIso() }).changes > 0;
const reactivate = (ctx, id) => stmts.reactivate.run({ id, orgId: ctx.orgId }).changes > 0;

const bulkCreate = db.transaction((ctx, items) => {
    const now = nowIso();
    for (const item of items) stmts.insert.run({ ...toParams(item, 0), id: newId(), orgId: ctx.orgId, now });
    return items.length;
});

// What the browser keeps: own and calories-in foods, plus catalog foods used in
// the consultorio's recipes (8k+ USDA foods do not fit in localStorage)
const LIBRARY_SQL = `
    SELECT * FROM v_ingredient_with_category
    WHERE (deactivated_at IS NULL AND source NOT LIKE 'usda%' AND (org_id IS NULL OR org_id = @orgId))
       OR id IN (SELECT ri.ingredient_id FROM recipe_ingredients ri JOIN recipes r ON r.id = ri.recipe_id WHERE r.org_id = @orgId)
`;
const listLibrary = (ctx) => db.prepare(LIBRARY_SQL).all({ orgId: ctx.orgId }).map(transformIngredient);

module.exports = { search, getById, isOwn, create, update, deactivate, reactivate, bulkCreate, listLibrary };
