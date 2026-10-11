// Food group categories and category clean-up for old rows
const { INGREDIENT_CATEGORIES, MEAL_CATEGORIES } = require('../../constants');

function migrateCategories(db) {
    // ==========================================
    // FOOD GROUP CATEGORIES (ingredients use food groups, recipes use meal types)
    // ==========================================

    db.exec(`
        INSERT OR IGNORE INTO categories (id, name, display_name) VALUES
            ('protein', 'protein', 'Protein'),
            ('carbs', 'carbs', 'Carbs'),
            ('fats', 'fats', 'Fats'),
            ('vegetables', 'vegetables', 'Vegetables'),
            ('fruits', 'fruits', 'Fruits'),
            ('dairy', 'dairy', 'Dairy'),
            ('mixed', 'mixed', 'Mixed');
    `);

    // Ingredients created with a meal type as category (old validation) -> 'mixed'
    db.prepare(`
        UPDATE ingredients SET category_id = 'mixed'
        WHERE category_id NOT IN (${INGREDIENT_CATEGORIES.map(() => '?').join(', ')})
    `).run(...INGREDIENT_CATEGORIES);

    // Recipes created with a food group as category (old validation) -> 'lunch'
    db.prepare(`
        UPDATE recipes SET category_id = 'lunch'
        WHERE category_id NOT IN (${MEAL_CATEGORIES.map(() => '?').join(', ')})
    `).run(...MEAL_CATEGORIES);
}

module.exports = { migrateCategories };
