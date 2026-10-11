// Fase 5: Spanish names for categories, units and the basic food catalog (ids stay in English)
const fs = require('fs');
const path = require('path');
const { LABELS } = require('../../labels');

const BASIC_NAMES = path.join(__dirname, '..', '..', '..', '..', 'foods-data', 'translations', 'calories-in-names-es.json');

function translateCatalogNames(db) {
    const category = db.prepare('UPDATE categories SET display_name = ? WHERE id = ?');
    for (const [id, name] of Object.entries({ ...LABELS.ingredientCategory, ...LABELS.mealCategory })) category.run(name, id);
    const ABBREVIATIONS = { gram: 'g', milliliter: 'ml', ounce: 'oz', cup: 'taza', tablespoon: 'cda', teaspoon: 'cdta' };
    const unit = db.prepare('UPDATE units SET abbreviation = ? WHERE id = ?');
    for (const [id, abbreviation] of Object.entries(ABBREVIATIONS)) unit.run(abbreviation, id);
}

// calories-in foods: Spanish name, English kept in name_en (search finds both).
// Names someone edited by hand are kept.
function translateBasicFoods(db) {
    if (!fs.existsSync(BASIC_NAMES)) return;
    const names = JSON.parse(fs.readFileSync(BASIC_NAMES, 'utf8'));
    const update = db.prepare(`
        UPDATE ingredients SET name_en = COALESCE(name_en, name), name = ?
        WHERE source = 'calories_in' AND COALESCE(name_en, name) = ? AND COALESCE(name_edited, 0) = 0
    `);
    for (const [english, spanish] of Object.entries(names)) update.run(spanish, english);
}

module.exports = { translateCatalogNames, translateBasicFoods };
