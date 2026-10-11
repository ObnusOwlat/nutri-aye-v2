// Shared ingredient queries
const { db } = require('../db/connection');

// Full nutrient profile (per 100 g) and household portions of one ingredient
function getIngredientDetails(id) {
    const nutrients = db.prepare(`
        SELECT n.id, COALESCE(n.name_es, n.name) AS name, n.name AS nameEn, n.unit, n.nutrient_group AS "group", inut.amount
        FROM ingredient_nutrients inut
        JOIN nutrients n ON n.id = inut.nutrient_id
        WHERE inut.ingredient_id = ?
        ORDER BY n.rank, n.id
    `).all(id);
    const portions = db.prepare(`
        SELECT amount, unit, modifier, gram_weight AS gramWeight
        FROM ingredient_portions WHERE ingredient_id = ? ORDER BY sequence, id
    `).all(id);
    return { nutrients, portions };
}

// USDA catalog rows are served through the API, not synced/backed up,
// unless a recipe uses them (8k+ foods do not fit in localStorage)
const LIBRARY_INGREDIENTS_SQL = `
    SELECT * FROM v_ingredient_with_category
    WHERE source NOT LIKE 'usda%'
       OR id IN (SELECT ingredient_id FROM recipe_ingredients)
`;

module.exports = { getIngredientDetails, LIBRARY_INGREDIENTS_SQL };
