// Lookup tables, ingredients, recipes and recipe ingredients

function createCatalogTables(db) {
    // ==========================================
    // NUTRITIONAL_REFERENCES - Lookup tables
    // ==========================================
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            display_name TEXT NOT NULL
        );
        
        CREATE TABLE IF NOT EXISTS units (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            abbreviation TEXT NOT NULL
        );
        
        INSERT OR IGNORE INTO categories (id, name, display_name) VALUES
            ('breakfast', 'breakfast', 'Breakfast'),
            ('lunch', 'lunch', 'Lunch'),
            ('dinner', 'dinner', 'Dinner'),
            ('afternoon_snack', 'afternoon_snack', 'Afternoon Snack'),
            ('snack', 'snack', 'Snack');
            
        INSERT OR IGNORE INTO units (id, name, abbreviation) VALUES
            ('gram', 'gram', 'g'),
            ('milliliter', 'milliliter', 'ml'),
            ('ounce', 'ounce', 'oz'),
            ('cup', 'cup', 'cup'),
            ('tablespoon', 'tablespoon', 'tbsp'),
            ('teaspoon', 'teaspoon', 'tsp');
    `);

    // ==========================================
    // INGREDIENTS (1NF - Atomic values)
    // ==========================================
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS ingredients (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category_id TEXT NOT NULL REFERENCES categories(id),
            unit_id TEXT NOT NULL DEFAULT 'gram' REFERENCES units(id),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now')),
            -- Basic Macros (per 100g)
            kcal_per_100g REAL NOT NULL DEFAULT 0,
            protein_per_100g REAL DEFAULT 0,
            carbs_per_100g REAL DEFAULT 0,
            fat_per_100g REAL DEFAULT 0,
            saturated_fat_per_100g REAL DEFAULT 0,
            polyunsaturated_fat_per_100g REAL DEFAULT 0,
            monounsaturated_fat_per_100g REAL DEFAULT 0,
            sugar_per_100g REAL DEFAULT 0,
            fiber_per_100g REAL DEFAULT 0,
            cholesterol_per_100g REAL DEFAULT 0,
            sodium_per_100g REAL DEFAULT 0,
            -- Vitamins (per 100g)
            vitamin_a_per_100g REAL DEFAULT 0,
            vitamin_b1_per_100g REAL DEFAULT 0,
            vitamin_b2_per_100g REAL DEFAULT 0,
            vitamin_b3_per_100g REAL DEFAULT 0,
            vitamin_b5_per_100g REAL DEFAULT 0,
            vitamin_b6_per_100g REAL DEFAULT 0,
            vitamin_b9_per_100g REAL DEFAULT 0,
            vitamin_b12_per_100g REAL DEFAULT 0,
            vitamin_c_per_100g REAL DEFAULT 0,
            vitamin_d_per_100g REAL DEFAULT 0,
            vitamin_e_per_100g REAL DEFAULT 0,
            vitamin_k_per_100g REAL DEFAULT 0,
            -- Minerals (per 100g)
            magnesium_per_100g REAL DEFAULT 0,
            calcium_per_100g REAL DEFAULT 0,
            phosphorus_per_100g REAL DEFAULT 0,
            potassium_per_100g REAL DEFAULT 0,
            iron_per_100g REAL DEFAULT 0,
            selenium_per_100g REAL DEFAULT 0,
            zinc_per_100g REAL DEFAULT 0,
            manganese_per_100g REAL DEFAULT 0,
            copper_per_100g REAL DEFAULT 0
        );
        
        CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(name COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_ingredients_category ON ingredients(category_id);
        CREATE INDEX IF NOT EXISTS idx_ingredients_kcal ON ingredients(kcal_per_100g);
    `);

    // ==========================================
    // RECIPES (1NF - Atomic values)
    // ==========================================
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS recipes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            category_id TEXT NOT NULL REFERENCES categories(id),
            instructions TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        
        CREATE INDEX IF NOT EXISTS idx_recipes_name ON recipes(name COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_recipes_category ON recipes(category_id);
    `);

    // ==========================================
    // RECIPE_INGREDIENTS (2NF - Junction table)
    // ==========================================
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS recipe_ingredients (
            id TEXT PRIMARY KEY,
            recipe_id TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
            ingredient_id TEXT NOT NULL REFERENCES ingredients(id),
            grams REAL NOT NULL DEFAULT 100,
            UNIQUE(recipe_id, ingredient_id)
        );
        
        CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe ON recipe_ingredients(recipe_id);
        CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient ON recipe_ingredients(ingredient_id);
    `);
}

module.exports = { createCatalogTables };
