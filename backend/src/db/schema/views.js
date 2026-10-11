// Views for recipe nutrition and ingredients with category

function createViews(db) {
    // ==========================================
    // VIEWS for complex queries
    // ==========================================
    
    db.exec(`
        CREATE VIEW IF NOT EXISTS v_recipe_nutrition AS
        SELECT 
            ri.recipe_id,
            r.name as recipe_name,
            SUM(i.kcal_per_100g * ri.grams / 100) as total_calories,
            SUM(i.protein_per_100g * ri.grams / 100) as total_protein,
            SUM(i.carbs_per_100g * ri.grams / 100) as total_carbs,
            SUM(i.fat_per_100g * ri.grams / 100) as total_fat,
            SUM(i.saturated_fat_per_100g * ri.grams / 100) as total_saturated_fat,
            SUM(i.sugar_per_100g * ri.grams / 100) as total_sugar,
            SUM(i.fiber_per_100g * ri.grams / 100) as total_fiber
        FROM recipe_ingredients ri
        JOIN ingredients i ON ri.ingredient_id = i.id
        JOIN recipes r ON ri.recipe_id = r.id
        GROUP BY ri.recipe_id;
        
        CREATE VIEW IF NOT EXISTS v_ingredient_with_category AS
        SELECT 
            i.*,
            c.name as category,
            c.display_name as category_display
        FROM ingredients i
        JOIN categories c ON i.category_id = c.id;
    `);
}

module.exports = { createViews };
