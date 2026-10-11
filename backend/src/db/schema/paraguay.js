// Paraguay first: foods available in the country (available_py = 1, shown with
// ⭐ and first in searches) and fixes of odd translations in catalog names.
// Names edited by hand are kept. Also run by import-usda.js / import-foods.js.
const { isAvailableInPy, fixName } = require('../../lib/paraguay');

function markParaguayFoods(db) {
    const columns = db.prepare('PRAGMA table_info(ingredients)').all().map(c => c.name);
    if (!columns.includes('available_py')) db.exec('ALTER TABLE ingredients ADD COLUMN available_py INTEGER NOT NULL DEFAULT 0');

    const rows = db.prepare('SELECT id, org_id, name, name_en, source_category, name_edited FROM ingredients').all();
    const setName = db.prepare('UPDATE ingredients SET name = ? WHERE id = ?');
    const setPy = db.prepare('UPDATE ingredients SET available_py = ? WHERE id = ?');
    let renamed = 0;
    for (const row of rows) {
        let name = row.name;
        if (!row.org_id && !row.name_edited) {
            const fixed = fixName(name);
            if (fixed !== name) { setName.run(fixed, row.id); name = fixed; renamed++; }
        }
        setPy.run(isAvailableInPy({ name, nameEn: row.name_en, sourceCategory: row.source_category, orgId: row.org_id }) ? 1 : 0, row.id);
    }
    db.exec('CREATE INDEX IF NOT EXISTS idx_ingredients_py ON ingredients(available_py)');
    return { foods: rows.length, renamed };
}

module.exports = { markParaguayFoods };
