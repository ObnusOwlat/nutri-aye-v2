// Ingredients: search, CRUD, bulk import and full nutrient detail.
// Catalog foods (USDA, calories-in) have org_id NULL: every consultorio reads
// them, nobody edits them. Foods a consultorio creates are its own.
// ctx = { orgId, userId } in every function.
const { db, unaccent } = require('../db/connection');
const { NUTRIENT_FIELDS } = require('../nutrient-fields');
const { transformIngredient } = require('../transforms');
const { newId, nowIso } = require('../lib/http');
const { subgroupOf, formOf } = require('../lib/food-classify');

const COLUMNS = NUTRIENT_FIELDS.map(f => f.column);
const VISIBLE = '(org_id IS NULL OR org_id = @orgId) AND deactivated_at IS NULL';

const stmts = {
    // Visible to the consultorio (catalog or own), active
    byId: db.prepare(`SELECT * FROM v_ingredient_with_category WHERE id = @id AND ${VISIBLE}`),
    own: db.prepare('SELECT 1 FROM ingredients WHERE id = @id AND org_id = @orgId AND deactivated_at IS NULL'),
    insert: db.prepare(`
        INSERT INTO ingredients (id, org_id, source, name, category_id, unit_id, subgroup, food_form, available_py, created_at, updated_at, ${COLUMNS.join(', ')})
        VALUES (@id, @orgId, 'user', @name, @category, @unit, @subgroup, @foodForm, 1, @now, @now, ${COLUMNS.map(c => `@${c}`).join(', ')})
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
    setGroups: db.prepare('UPDATE ingredients SET subgroup = @subgroup, food_form = @foodForm WHERE id = @id'),
    groupSource: db.prepare('SELECT i.name, i.name_en, i.source_category, i.category_id FROM ingredients i WHERE i.id = ?')
};

// Subgroup ("origen") and form from the names: own foods are classified like the catalog
function groupsOf({ name, nameEn = null, category, sourceCategory = null }) {
    const food = { name, nameEn, category, sourceCategory };
    return { subgroup: subgroupOf(food), foodForm: formOf(food) };
}

function reclassify(id) {
    const row = stmts.groupSource.get(id);
    if (row) stmts.setGroups.run({ id, ...groupsOf({ name: row.name, nameEn: row.name_en, category: row.category_id, sourceCategory: row.source_category }) });
}



// API object -> named statement params (missing nutrients: null on update, 0 on insert)
function toParams(data, missing) {
    const params = { name: data.name ?? null, category: data.category ?? null, unit: data.unit ?? null };
    for (const { column, key } of NUTRIENT_FIELDS) params[column] = data[key] ?? missing;
    return params;
}

const list = (value) => (Array.isArray(value) ? value : String(value || '').split(',')).map(v => String(v).trim()).filter(Boolean);
const inList = (column, values, where, params) => {
    if (!values.length) return;
    where.push(`${column} IN (${values.map(() => '?').join(',')})`);
    params.push(...values);
};

// Conditions shared by the list and the counts. Skipping a filter counts every
// value of it: the tree shows how many foods each option would give.
function filters(ctx, { search = '', category = '', subgroup = '', form = '', source = '', scope = '', py = '' }, skip = []) {
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
    // Whole categories OR chosen subgroups ("category.subgroup"): "Verduras" + "Vaca"
    // gives every vegetable and the beef, not the foods that are both
    if (!skip.includes('category')) {
        const categories = list(category), subgroups = list(subgroup).filter(s => s.includes('.'));
        const parts = [];
        if (categories.length) {
            parts.push(`category_id IN (${categories.map(() => '?').join(',')})`);
            params.push(...categories);
        }
        if (subgroups.length) {
            parts.push(`(category_id || '.' || COALESCE(subgroup, 'other')) IN (${subgroups.map(() => '?').join(',')})`);
            params.push(...subgroups);
        }
        if (parts.length) where.push(`(${parts.join(' OR ')})`);
    }
    if (!skip.includes('form')) {
        const forms = list(form);
        const known = forms.filter(f => f !== 'none');
        if (forms.includes('none')) {
            where.push(`(food_form IS NULL${known.length ? ` OR food_form IN (${known.map(() => '?').join(',')})` : ''})`);
            params.push(...known);
        } else inList('food_form', known, where, params);
    }
    if (!skip.includes('py') && (py === '1' || py === 1 || py === true)) where.push('available_py = 1');
    if (source === 'usda') {
        where.push("source LIKE 'usda%'"); // both USDA datasets
    } else if (source) {
        where.push('source = ?');
        params.push(source);
    }
    return { whereSql: where.join(' AND '), params, terms };
}

// Counts for the filter tree: per category and subgroup (with the chosen
// forms) and per form (with the chosen categories/subgroups)
function facets(ctx, query) {
    const tree = filters(ctx, query, ['category']);
    const byGroup = db.prepare(`
        SELECT category_id AS category, COALESCE(subgroup, 'other') AS subgroup, COUNT(*) AS n
        FROM ingredients WHERE ${tree.whereSql} GROUP BY 1, 2
    `).all(...tree.params);
    const byForm = filters(ctx, query, ['form']);
    const forms = db.prepare(`
        SELECT COALESCE(food_form, 'none') AS form, COUNT(*) AS n FROM ingredients WHERE ${byForm.whereSql} GROUP BY 1
    `).all(...byForm.params);

    const categories = {};
    for (const { category, subgroup, n } of byGroup) {
        const entry = categories[category] || (categories[category] = { total: 0, subgroups: {} });
        entry.total += n;
        entry.subgroups[subgroup] = n;
    }
    const byPy = filters(ctx, query, ['py']);
    const py = db.prepare(`SELECT COUNT(*) AS n FROM ingredients WHERE ${byPy.whereSql} AND available_py = 1`).get(...byPy.params).n;
    return { categories, forms: Object.fromEntries(forms.map(f => [f.form, f.n])), py };
}

// scope: 'own' (the consultorio's foods), 'catalog' (shared foods) or both
function search(ctx, { sort, order, limit, offset, ...query }) {
    const { whereSql, params, terms } = filters(ctx, query);

    // Searching without an explicit sort: names starting with the first word
    // first, then shorter (more basic) names: "Limón, crudo" before drinks
    const sortColumn = ['name', 'kcal_per_100g', 'category'].includes(sort) ? sort : 'name';
    // Without an explicit sort, foods found in Paraguay (⭐) go first
    let orderBy = `${sort ? '' : 'available_py DESC, '}${sortColumn} ${order === 'desc' ? 'DESC' : 'ASC'}`;
    const orderParams = [];
    if (terms.length && !sort) {
        orderBy = 'available_py DESC, unaccent(name) LIKE ? DESC, LENGTH(name) ASC, name ASC';
        orderParams.push(`${terms[0]}%`);
    }

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
    const params = toParams(data, 0);
    stmts.insert.run({ ...params, ...groupsOf({ ...data, category: params.category }), id, orgId: ctx.orgId, now: nowIso() });
    return getById(ctx, id);
}

// Only the consultorio's own foods; null = not found or catalog (read-only)
function update(ctx, id, data) {
    if (!isOwn(ctx, id)) return null;
    stmts.update.run({ ...toParams(data, null), id, orgId: ctx.orgId, now: nowIso() });
    if (data.name != null || data.category != null) reclassify(id);
    return getById(ctx, id);
}

// Deactivated foods disappear from searches; recipes that use them keep working
const deactivate = (ctx, id) => stmts.deactivate.run({ id, orgId: ctx.orgId, userId: ctx.userId, now: nowIso() }).changes > 0;
const reactivate = (ctx, id) => stmts.reactivate.run({ id, orgId: ctx.orgId }).changes > 0;

const bulkCreate = db.transaction((ctx, items) => {
    const now = nowIso();
    for (const item of items) {
        const params = toParams(item, 0);
        stmts.insert.run({ ...params, ...groupsOf({ ...item, category: params.category }), id: newId(), orgId: ctx.orgId, now });
    }
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

module.exports = { search, facets, getById, isOwn, create, update, deactivate, reactivate, bulkCreate, listLibrary };
