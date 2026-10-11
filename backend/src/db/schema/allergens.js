// Allergens of every food (computed: Open Food Facts taxonomy + local rules,
// kept as JSON in ingredients.allergen_tags),
// the consultorio's manual corrections per food (add or remove, never deleted),
// and the structured allergen of each allergy/intolerance of a patient.
const { tagFood, allergensInText } = require('../../lib/allergen-tags');

function tagAllFoods(db, onlyIds = null) {
    const rows = onlyIds
        ? db.prepare(`SELECT id, name, name_en FROM ingredients WHERE id IN (${onlyIds.map(() => '?').join(',')})`).all(...onlyIds)
        : db.prepare('SELECT id, name, name_en FROM ingredients').all();
    const set = db.prepare('UPDATE ingredients SET allergen_tags = ? WHERE id = ?');
    for (const row of rows) set.run(JSON.stringify(tagFood({ name: row.name, nameEn: row.name_en })), row.id);
    return rows.length;
}

function createAllergenTables(db) {
    const foodColumns = db.prepare('PRAGMA table_info(ingredients)').all().map(c => c.name);
    // [{ allergen, source: 'off' | 'rules', term }]
    if (!foodColumns.includes('allergen_tags')) db.exec('ALTER TABLE ingredients ADD COLUMN allergen_tags TEXT');
    db.exec(`
        CREATE TABLE IF NOT EXISTS ingredient_allergen_overrides (
            org_id TEXT NOT NULL REFERENCES organizations(id),
            ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
            allergen TEXT NOT NULL,
            present INTEGER,               -- 1 add, 0 remove, NULL back to automatic
            updated_at TEXT NOT NULL,
            updated_by TEXT,
            PRIMARY KEY (org_id, ingredient_id, allergen)
        );
    `);
    const columns = db.prepare('PRAGMA table_info(patient_conditions)').all().map(c => c.name);
    if (!columns.includes('allergens')) db.exec('ALTER TABLE patient_conditions ADD COLUMN allergens TEXT'); // comma list

    // Handwritten allergies and intolerances -> structured allergens
    const conditions = db.prepare("SELECT id, name, description FROM patient_conditions WHERE type IN ('allergy', 'intolerance') AND allergens IS NULL").all();
    const set = db.prepare('UPDATE patient_conditions SET allergens = ? WHERE id = ?');
    for (const c of conditions) {
        const found = allergensInText(`${c.name} ${c.description || ''}`);
        if (found.length) set.run(found.join(','), c.id);
    }
    tagAllFoods(db);
}

module.exports = { createAllergenTables, tagAllFoods };
