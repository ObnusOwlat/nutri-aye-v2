// Fase 5: display names of categories and units in Spanish (ids stay in English)
const { LABELS } = require('../../labels');

function translateCatalogNames(db) {
    const category = db.prepare('UPDATE categories SET display_name = ? WHERE id = ?');
    for (const [id, name] of Object.entries({ ...LABELS.ingredientCategory, ...LABELS.mealCategory })) category.run(name, id);
    const ABBREVIATIONS = { gram: 'g', milliliter: 'ml', ounce: 'oz', cup: 'taza', tablespoon: 'cda', teaspoon: 'cdta' };
    const unit = db.prepare('UPDATE units SET abbreviation = ? WHERE id = ?');
    for (const [id, abbreviation] of Object.entries(ABBREVIATIONS)) unit.run(abbreviation, id);
}

module.exports = { translateCatalogNames };
