// Full nutrient profile (USDA): source columns, nutrients, values, portions

function createNutrientTables(db) {
    // ==========================================
    // FULL NUTRIENT PROFILE (USDA FoodData Central)
    // The fixed *_per_100g columns keep the common nutrients for the
    // frontend; ingredient_nutrients holds every nutrient the source has.
    // ==========================================

    const ingredientCols = db.prepare('PRAGMA table_info(ingredients)').all().map(c => c.name);
    const addIngredientCol = (name, def) => {
        if (!ingredientCols.includes(name)) db.exec(`ALTER TABLE ingredients ADD COLUMN ${name} ${def}`);
    };
    addIngredientCol('source', "TEXT NOT NULL DEFAULT 'user'"); // user | calories_in | usda_foundation | usda_sr_legacy
    addIngredientCol('fdc_id', 'INTEGER');
    addIngredientCol('ndb_number', 'INTEGER');
    addIngredientCol('source_category', 'TEXT');
    addIngredientCol('name_en', 'TEXT');                       // original USDA name (name holds the Spanish one)
    addIngredientCol('name_edited', 'INTEGER NOT NULL DEFAULT 0'); // 1 = renamed by a user, re-imports keep it

    db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_ingredients_fdc_id ON ingredients(fdc_id);
        CREATE INDEX IF NOT EXISTS idx_ingredients_source ON ingredients(source);

        CREATE TABLE IF NOT EXISTS nutrients (
            id INTEGER PRIMARY KEY,              -- USDA nutrient id
            name TEXT NOT NULL,
            unit TEXT NOT NULL,
            number TEXT,                          -- USDA nutrient number (e.g. 203 = protein)
            rank INTEGER,                         -- USDA display order
            nutrient_group TEXT NOT NULL DEFAULT 'other',
            name_es TEXT
        );

        CREATE TABLE IF NOT EXISTS ingredient_nutrients (
            ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
            nutrient_id INTEGER NOT NULL REFERENCES nutrients(id),
            amount REAL NOT NULL,                 -- per 100 g
            PRIMARY KEY (ingredient_id, nutrient_id)
        ) WITHOUT ROWID;

        CREATE INDEX IF NOT EXISTS idx_ingredient_nutrients_nutrient ON ingredient_nutrients(nutrient_id, amount);

        CREATE TABLE IF NOT EXISTS ingredient_portions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ingredient_id TEXT NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
            amount REAL,
            unit TEXT,                            -- cup, tbsp, piece...
            modifier TEXT,                        -- "chopped", "1 medium"...
            gram_weight REAL NOT NULL,
            sequence INTEGER
        );

        CREATE INDEX IF NOT EXISTS idx_ingredient_portions_ingredient ON ingredient_portions(ingredient_id);
    `);

    if (!db.prepare('PRAGMA table_info(nutrients)').all().some(c => c.name === 'name_es')) {
        db.exec('ALTER TABLE nutrients ADD COLUMN name_es TEXT');
    }
}

module.exports = { createNutrientTables };
