// Food subgroups ("origen") and preparation forms on every food, plus the
// category fix of the basic catalog (calories-in foods came mostly as "mixed").
// Also used by import-usda.js / import-foods.js after importing.
const { subgroupOf, formOf, basicCategoryOf } = require('../../lib/food-classify');

function addColumn(db, table, column, type) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

// Recomputes subgroup and form; basic foods also get their category unless
// someone edited the food by hand (name_edited = 1)
function classifyFoods(db) {
    const rows = db.prepare('SELECT id, name, name_en, source, source_category, category_id, name_edited FROM ingredients').all();
    const setCategory = db.prepare('UPDATE ingredients SET category_id = ? WHERE id = ?');
    const setGroups = db.prepare('UPDATE ingredients SET subgroup = ?, food_form = ? WHERE id = ?');
    let recategorized = 0;
    for (const row of rows) {
        let category = row.category_id;
        if (row.source === 'calories_in' && !row.name_edited) {
            const fixed = basicCategoryOf(row.name);
            if (fixed && fixed !== category) {
                setCategory.run(fixed, row.id);
                category = fixed;
                recategorized++;
            }
        }
        const food = { category, sourceCategory: row.source_category, name: row.name, nameEn: row.name_en };
        setGroups.run(subgroupOf(food), formOf(food), row.id);
    }
    return { foods: rows.length, recategorized };
}

function addFoodGroups(db) {
    addColumn(db, 'ingredients', 'subgroup', 'TEXT');
    addColumn(db, 'ingredients', 'food_form', 'TEXT');
    db.exec('CREATE INDEX IF NOT EXISTS idx_ingredients_category_subgroup ON ingredients(category_id, subgroup)');
    classifyFoods(db);
}

module.exports = { addFoodGroups, classifyFoods };
