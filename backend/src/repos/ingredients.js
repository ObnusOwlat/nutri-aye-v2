// Ingredients: search, CRUD, bulk import and full nutrient detail
const { db, unaccent } = require('../db/connection');
const { NUTRIENT_FIELDS } = require('../nutrient-fields');
const { transformIngredient } = require('../transforms');
const { newId, nowIso } = require('../lib/http');

const COLUMNS = NUTRIENT_FIELDS.map(f => f.column);

const stmts = {
    byId: db.prepare('SELECT * FROM v_ingredient_with_category WHERE id = ?'),
    exists: db.prepare('SELECT 1 FROM ingredients WHERE id = ?'),
    insert: db.prepare(`
        INSERT INTO ingredients (id, name, category_id, unit_id, created_at, updated_at, ${COLUMNS.join(', ')})
        VALUES (@id, @name, @category, @unit, @now, @now, ${COLUMNS.map(c => `@${c}`).join(', ')})
    `),
    update: db.prepare(`
        UPDATE ingredients SET
            name = COALESCE(@name, name),
            name_edited = CASE WHEN @name IS NOT NULL THEN 1 ELSE name_edited END,
            category_id = COALESCE(@category, category_id),
            unit_id = COALESCE(@unit, unit_id),
            updated_at = @now,
            ${COLUMNS.map(c => `${c} = COALESCE(@${c}, ${c})`).join(',\n            ')}
        WHERE id = @id
    `),
    remove: db.prepare('DELETE FROM ingredients WHERE id = ?'),
    usedInRecipes: db.prepare('SELECT COUNT(*) AS n FROM recipe_ingredients WHERE ingredient_id = ?'),
    nutrients: db.prepare(`
        SELECT n.id, COALESCE(n.name_es, n.name) AS name, n.name AS nameEn, n.unit, n.nutrient_group AS "group", inut.amount
        FROM ingredient_nutrients inut
        JOIN nutrients n ON n.id = inut.nutrient_id
        WHERE inut.ingredient_id = ?
        ORDER BY n.rank, n.id
    `),
    portions: db.prepare(`
        SELECT amount, unit, modifier, gram_weight AS gramWeight
        FROM ingredient_portions WHERE ingredient_id = ? ORDER BY sequence, id
    `)
};

// USDA catalog rows are served through the API, not synced/backed up,
// unless a recipe uses them (8k+ foods do not fit in localStorage)
const LIBRARY_WHERE = "source NOT LIKE 'usda%' OR id IN (SELECT ingredient_id FROM recipe_ingredients)";

// API object -> named statement params (missing nutrients: null on update, 0 on insert)
function toParams(data, missing) {
    const params = { name: data.name ?? null, category: data.category ?? null, unit: data.unit ?? null };
    for (const { column, key } of NUTRIENT_FIELDS) params[column] = data[key] ?? missing;
    return params;
}

function search({ search = '', category = '', source = '', sort, order, limit, offset }) {
    const where = ['1=1'];
    const params = [];

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

const getById = (id) => transformIngredient(stmts.byId.get(id));
const exists = (id) => !!stmts.exists.get(id);

// Full nutrient profile (per 100 g) and household portions
function getDetails(id) {
    const ingredient = getById(id);
    if (!ingredient) return null;
    return { ...ingredient, nutrients: stmts.nutrients.all(id), portions: stmts.portions.all(id) };
}

function create(data) {
    const id = newId();
    stmts.insert.run({ ...toParams(data, 0), id, now: nowIso() });
    return getById(id);
}

function update(id, data) {
    if (!exists(id)) return null;
    stmts.update.run({ ...toParams(data, null), id, now: nowIso() });
    return getById(id);
}

// false = not found; throws a conflict upstream when recipes use it
const remove = (id) => stmts.remove.run(id).changes > 0;
const recipeUsage = (id) => stmts.usedInRecipes.get(id).n;

const bulkCreate = db.transaction((items) => {
    const now = nowIso();
    for (const item of items) stmts.insert.run({ ...toParams(item, 0), id: newId(), now });
    return items.length;
});

const listLibrary = () => db.prepare(`SELECT * FROM v_ingredient_with_category WHERE ${LIBRARY_WHERE}`).all().map(transformIngredient);

module.exports = { search, getById, getDetails, exists, create, update, remove, recipeUsage, bulkCreate, listLibrary, LIBRARY_WHERE };
