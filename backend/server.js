/**
 * Meal Prep Planner - Normalized Database Backend
 * 
 * Database Schema (3NF Normalization):
 * - ingredients: Ingredient master data
 * - recipes: Recipe master data  
 * - recipe_ingredients: Recipe-Ingr relationship (junction table)
 * - patients: Patient master data
 * - patient_metrics: Patient measurements
 * - patient_conditions: Patient medical conditions/allergies
 * - patient_plans: Patient meal plans
 * - patient_plan_meals: Meal assignments per plan
 * - patient_progress: Weekly progress tracking
 */

const express = require('express');
const cors = require('cors');
const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ==========================================
// BILLING API ENDPOINTS (Unified - same database)
// ==========================================

// Redirect /billing to main app with billing tab
app.get('/billing', (req, res) => {
    res.redirect('/?tab=billing');
});

// Redirect /billing/* to main app with billing tab
app.get('/billing/*', (req, res) => {
    res.redirect('/?tab=billing');
});

// ==========================================
// SERVE FRONTEND
// ==========================================

// Serve static frontend files
app.use(express.static(path.join(__dirname, '..', 'frontend')));

// Serve index.html for root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'index.html'));
});

// ==========================================
// DATABASE INITIALIZATION (3NF Normalized)
// ==========================================

const dbPath = path.join(__dirname, 'db', 'database.sqlite');
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
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

    // ==========================================
    // PATIENTS (1NF - Atomic values)
    // ==========================================
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS patients (
            id TEXT PRIMARY KEY,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            date_of_birth TEXT,
            gender TEXT,
            street TEXT DEFAULT '',
            city TEXT DEFAULT '',
            zip_code TEXT DEFAULT '',
            emergency_name TEXT DEFAULT '',
            emergency_phone TEXT DEFAULT '',
            emergency_relation TEXT DEFAULT '',
            notes TEXT DEFAULT '',
            photo TEXT,
            status TEXT DEFAULT 'active',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        
        CREATE INDEX IF NOT EXISTS idx_patients_name ON patients(first_name COLLATE NOCASE, last_name COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_patients_email ON patients(email COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_patients_phone ON patients(phone);
    `);

    // ==========================================
    // PATIENT_METRICS (2NF - Depends on patient PK)
    // ==========================================
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS patient_metrics (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
            date TEXT NOT NULL,
            weight REAL,
            height REAL,
            bmi REAL,
            bmi_category TEXT,
            body_fat REAL,
            muscle_mass REAL,
            waist REAL,
            chest REAL,
            hips REAL,
            activity_level TEXT DEFAULT 'moderate',
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        
        CREATE INDEX IF NOT EXISTS idx_patient_metrics_patient ON patient_metrics(patient_id);
        CREATE INDEX IF NOT EXISTS idx_patient_metrics_date ON patient_metrics(patient_id, date DESC);
    `);

    // ==========================================
    // PATIENT_CONDITIONS (2NF - Allergen tracking)
    // ==========================================
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS patient_conditions (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            severity TEXT DEFAULT 'mild',
            description TEXT DEFAULT '',
            dietary_notes TEXT DEFAULT '',
            medications TEXT DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        
        CREATE INDEX IF NOT EXISTS idx_patient_conditions_patient ON patient_conditions(patient_id);
        CREATE INDEX IF NOT EXISTS idx_patient_conditions_type ON patient_conditions(type);
    `);

    // ==========================================
    // PATIENT_PLANS (2NF - Depends on patient PK)
    // ==========================================
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS patient_plans (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            diet_goal TEXT DEFAULT 'maintenance',
            daily_target INTEGER DEFAULT 2000,
            start_date TEXT NOT NULL,
            end_date TEXT,
            notes TEXT DEFAULT '',
            status TEXT DEFAULT 'active',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        
        CREATE INDEX IF NOT EXISTS idx_patient_plans_patient ON patient_plans(patient_id);
        CREATE INDEX IF NOT EXISTS idx_patient_plans_status ON patient_plans(patient_id, status);
    `);

    // ==========================================
    // PATIENT_PLAN_MEALS (2NF - Junction)
    // ==========================================
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS patient_plan_meals (
            id TEXT PRIMARY KEY,
            patient_plan_id TEXT NOT NULL REFERENCES patient_plans(id) ON DELETE CASCADE,
            day_of_week TEXT NOT NULL,
            meal_type TEXT NOT NULL,
            recipe_id TEXT REFERENCES recipes(id),
            UNIQUE(patient_plan_id, day_of_week, meal_type)
        );
        
        CREATE INDEX IF NOT EXISTS idx_patient_plan_meals_plan ON patient_plan_meals(patient_plan_id);
        CREATE INDEX IF NOT EXISTS idx_patient_plan_meals_recipe ON patient_plan_meals(recipe_id);
    `);

    // ==========================================
    // PATIENT_PROGRESS (2NF - Depends on patient PK)
    // ==========================================
    
    db.exec(`
        CREATE TABLE IF NOT EXISTS patient_progress (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
            date TEXT NOT NULL,
            weight REAL,
            adherence INTEGER DEFAULT 0,
            energy_level INTEGER DEFAULT 5,
            sleep_quality INTEGER DEFAULT 5,
            mood INTEGER DEFAULT 5,
            symptoms TEXT DEFAULT '[]',
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );
        
        CREATE INDEX IF NOT EXISTS idx_patient_progress_patient ON patient_progress(patient_id);
        CREATE INDEX IF NOT EXISTS idx_patient_progress_date ON patient_progress(patient_id, date DESC);
    `);

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

    console.log('[DB] Normalized database initialized (3NF)');
}

// ==========================================
// API ENDPOINTS - INGREDIENTS
// ==========================================

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'normalized_3nf'
    });
});

// GET /api/ingredients - List with search, filter, pagination
app.get('/api/ingredients', (req, res) => {
    try {
        const { 
            search = '', 
            category = '',
            page = 1, 
            limit = 50,
            sort = 'name',
            order = 'asc'
        } = req.query;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const offset = (pageNum - 1) * limitNum;

        let whereClause = '1=1';
        const params = [];

        // Search filter (uses index)
        if (search) {
            whereClause += ' AND LOWER(name) LIKE ?';
            params.push(`%${search.toLowerCase()}%`);
        }

        // Category filter (uses index)
        if (category) {
            whereClause += ' AND category_id = ?';
            params.push(category);
        }

        // Sorting
        const sortColumn = ['name', 'kcal_per_100g', 'category'].includes(sort) ? sort : 'name';
        const sortOrder = order === 'desc' ? 'DESC' : 'ASC';

        // Get total count
        const countStmt = db.prepare(`SELECT COUNT(*) as total FROM v_ingredient_with_category WHERE ${whereClause}`);
        const { total } = countStmt.get(...params);

        // Get paginated results
        const query = `
            SELECT * FROM v_ingredient_with_category 
            WHERE ${whereClause}
            ORDER BY ${sortColumn} ${sortOrder}
            LIMIT ? OFFSET ?
        `;
        
        const stmt = db.prepare(query);
        const ingredients = stmt.all(...params, limitNum, offset);

        // Transform to camelCase for frontend
        const transformed = ingredients.map(transformIngredient);

        res.json({
            success: true,
            data: transformed,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('[Ingredients] List error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/ingredients/:id
app.get('/api/ingredients/:id', (req, res) => {
    try {
        const stmt = db.prepare('SELECT * FROM v_ingredient_with_category WHERE id = ?');
        const ingredient = stmt.get(req.params.id);
        
        if (!ingredient) {
            return res.status(404).json({ success: false, error: 'Ingredient not found' });
        }

        res.json({ success: true, data: transformIngredient(ingredient) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/ingredients - Create ingredient
app.post('/api/ingredients', (req, res) => {
    try {
        const data = req.body;
        
        // Validation
        const validCategories = ['breakfast', 'lunch', 'dinner', 'afternoon_snack', 'snack'];
        
        if (!data.name || !data.name.trim()) {
            return res.status(400).json({ success: false, error: 'Name is required' });
        }
        
        if (data.category && !validCategories.includes(data.category)) {
            return res.status(400).json({ success: false, error: `Invalid category. Must be one of: ${validCategories.join(', ')}` });
        }
        
        if (data.kcalPer100g !== undefined && data.kcalPer100g < 0) {
            return res.status(400).json({ success: false, error: 'kcalPer100g cannot be negative' });
        }
        
        const id = data.id || uuidv4();
        const now = new Date().toISOString();

        const stmt = db.prepare(`
            INSERT INTO ingredients (
                id, name, category_id, unit_id, created_at, updated_at,
                kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g,
                saturated_fat_per_100g, polyunsaturated_fat_per_100g, monounsaturated_fat_per_100g,
                sugar_per_100g, fiber_per_100g, cholesterol_per_100g, sodium_per_100g,
                vitamin_a_per_100g, vitamin_b1_per_100g, vitamin_b2_per_100g, vitamin_b3_per_100g,
                vitamin_b5_per_100g, vitamin_b6_per_100g, vitamin_b9_per_100g, vitamin_b12_per_100g,
                vitamin_c_per_100g, vitamin_d_per_100g, vitamin_e_per_100g, vitamin_k_per_100g,
                magnesium_per_100g, calcium_per_100g, phosphorus_per_100g, potassium_per_100g,
                iron_per_100g, selenium_per_100g, zinc_per_100g, manganese_per_100g, copper_per_100g
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        stmt.run(
            id, data.name.trim(), data.category || 'breakfast', data.unit || 'gram', now, now,
            data.kcalPer100g || 0,
            data.proteinPer100g || 0,
            data.carbsPer100g || 0,
            data.fatPer100g || 0,
            data.saturatedFatPer100g || 0,
            data.polyunsaturatedFatPer100g || 0,
            data.monounsaturatedFatPer100g || 0,
            data.sugarPer100g || 0,
            data.fiberPer100g || 0,
            data.cholesterolPer100g || 0,
            data.sodiumPer100g || 0,
            data.vitaminAPer100g || 0,
            data.vitaminB1Per100g || 0,
            data.vitaminB2Per100g || 0,
            data.vitaminB3Per100g || 0,
            data.vitaminB5Per100g || 0,
            data.vitaminB6Per100g || 0,
            data.vitaminB9Per100g || 0,
            data.vitaminB12Per100g || 0,
            data.vitaminCPer100g || 0,
            data.vitaminDPer100g || 0,
            data.vitaminEPer100g || 0,
            data.vitaminKPer100g || 0,
            data.magnesiumPer100g || 0,
            data.calciumPer100g || 0,
            data.phosphorusPer100g || 0,
            data.potassiumPer100g || 0,
            data.ironPer100g || 0,
            data.seleniumPer100g || 0,
            data.zincPer100g || 0,
            data.manganesePer100g || 0,
            data.copperPer100g || 0
        );

        const created = db.prepare('SELECT * FROM v_ingredient_with_category WHERE id = ?').get(id);
        res.json({ success: true, data: transformIngredient(created) });
    } catch (error) {
        console.error('[Ingredients] Create error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/ingredients/:id
app.put('/api/ingredients/:id', (req, res) => {
    try {
        const data = req.body;
        const now = new Date().toISOString();

        const stmt = db.prepare(`
            UPDATE ingredients SET
                name = COALESCE(?, name),
                category_id = COALESCE(?, category_id),
                unit_id = COALESCE(?, unit_id),
                updated_at = ?,
                kcal_per_100g = COALESCE(?, kcal_per_100g),
                protein_per_100g = COALESCE(?, protein_per_100g),
                carbs_per_100g = COALESCE(?, carbs_per_100g),
                fat_per_100g = COALESCE(?, fat_per_100g),
                saturated_fat_per_100g = COALESCE(?, saturated_fat_per_100g),
                polyunsaturated_fat_per_100g = COALESCE(?, polyunsaturated_fat_per_100g),
                monounsaturated_fat_per_100g = COALESCE(?, monounsaturated_fat_per_100g),
                sugar_per_100g = COALESCE(?, sugar_per_100g),
                fiber_per_100g = COALESCE(?, fiber_per_100g),
                cholesterol_per_100g = COALESCE(?, cholesterol_per_100g),
                sodium_per_100g = COALESCE(?, sodium_per_100g)
            WHERE id = ?
        `);

        stmt.run(
            data.name, data.category, data.unit, now,
            data.kcalPer100g, data.proteinPer100g, data.carbsPer100g, data.fatPer100g,
            data.saturatedFatPer100g, data.polyunsaturatedFatPer100g, data.monounsaturatedFatPer100g,
            data.sugarPer100g, data.fiberPer100g, data.cholesterolPer100g, data.sodiumPer100g,
            req.params.id
        );

        const updated = db.prepare('SELECT * FROM v_ingredient_with_category WHERE id = ?').get(req.params.id);
        res.json({ success: true, data: transformIngredient(updated) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/ingredients/:id
app.delete('/api/ingredients/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM ingredients WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/ingredients/bulk - Bulk import
app.post('/api/ingredients/bulk', (req, res) => {
    try {
        const { ingredients } = req.body;
        if (!Array.isArray(ingredients)) {
            return res.status(400).json({ success: false, error: 'ingredients must be an array' });
        }

        const insertStmt = db.prepare(`
            INSERT OR REPLACE INTO ingredients (
                id, name, category_id, unit_id, created_at, updated_at,
                kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g
            ) VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), ?, ?, ?, ?)
        `);

        const insertMany = db.transaction((items) => {
            for (const item of items) {
                insertStmt.run(
                    item.id || uuidv4(),
                    item.name,
                    item.category || 'protein',
                    item.unit || 'gram',
                    item.kcalPer100g || 0,
                    item.proteinPer100g || 0,
                    item.carbsPer100g || 0,
                    item.fatPer100g || 0
                );
            }
        });

        insertMany(ingredients);
        res.json({ success: true, count: ingredients.length });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// API ENDPOINTS - RECIPES
// ==========================================

// GET /api/recipes - List with search, filter, pagination
app.get('/api/recipes', (req, res) => {
    try {
        const { 
            search = '', 
            category = '',
            page = 1, 
            limit = 50 
        } = req.query;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const offset = (pageNum - 1) * limitNum;

        let whereClause = '1=1';
        const params = [];

        if (search) {
            whereClause += ' AND LOWER(r.name) LIKE ?';
            params.push(`%${search.toLowerCase()}%`);
        }

        if (category) {
            whereClause += ' AND r.category_id = ?';
            params.push(category);
        }

        const countStmt = db.prepare(`
            SELECT COUNT(*) as total FROM recipes r WHERE ${whereClause}
        `);
        const { total } = countStmt.get(...params);

        const query = `
            SELECT 
                r.*,
                c.name as category,
                c.display_name as category_display,
                COALESCE(vn.total_calories, 0) as total_calories,
                COALESCE(vn.total_protein, 0) as total_protein,
                COALESCE(vn.total_carbs, 0) as total_carbs,
                COALESCE(vn.total_fat, 0) as total_fat
            FROM recipes r
            JOIN categories c ON r.category_id = c.id
            LEFT JOIN v_recipe_nutrition vn ON r.id = vn.recipe_id
            WHERE ${whereClause}
            ORDER BY r.name ASC
            LIMIT ? OFFSET ?
        `;

        const recipes = db.prepare(query).all(...params, limitNum, offset);

        // Get ingredients for each recipe
        const recipesWithIngredients = recipes.map(recipe => {
            const ingredients = db.prepare(`
                SELECT ri.*, i.name as ingredient_name, i.kcal_per_100g
                FROM recipe_ingredients ri
                JOIN ingredients i ON ri.ingredient_id = i.id
                WHERE ri.recipe_id = ?
            `).all(recipe.id);

            return {
                ...transformRecipe(recipe),
                ingredients: ingredients.map(ri => ({
                    ingredientId: ri.ingredient_id,
                    ingredientName: ri.ingredient_name,
                    grams: ri.grams
                }))
            };
        });

        res.json({
            success: true,
            data: recipesWithIngredients,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('[Recipes] List error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/recipes/:id
app.get('/api/recipes/:id', (req, res) => {
    try {
        const recipe = db.prepare(`
            SELECT r.*, c.name as category, c.display_name as category_display
            FROM recipes r
            JOIN categories c ON r.category_id = c.id
            WHERE r.id = ?
        `).get(req.params.id);

        if (!recipe) {
            return res.status(404).json({ success: false, error: 'Recipe not found' });
        }

        const ingredients = db.prepare(`
            SELECT ri.*, i.name as ingredient_name, i.kcal_per_100g,
                   i.protein_per_100g, i.carbs_per_100g, i.fat_per_100g
            FROM recipe_ingredients ri
            JOIN ingredients i ON ri.ingredient_id = i.id
            WHERE ri.recipe_id = ?
        `).all(req.params.id);

        res.json({
            success: true,
            data: {
                ...transformRecipe(recipe),
                ingredients: ingredients.map(ri => ({
                    ingredientId: ri.ingredient_id,
                    ingredientName: ri.ingredient_name,
                    grams: ri.grams
                }))
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/recipes
app.post('/api/recipes', (req, res) => {
    try {
        const { name, category, instructions, notes, ingredients = [] } = req.body;
        const id = req.body.id || uuidv4();
        const now = new Date().toISOString();

        db.prepare(`
            INSERT INTO recipes (id, name, category_id, instructions, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, name, category || 'protein', instructions || '', notes || '', now, now);

        // Insert recipe ingredients
        const insertIng = db.prepare(`
            INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, grams)
            VALUES (?, ?, ?, ?)
        `);

        for (const ing of ingredients) {
            insertIng.run(uuidv4(), id, ing.ingredientId, ing.grams || 100);
        }

        const recipe = db.prepare(`
            SELECT r.*, c.name as category, c.display_name as category_display
            FROM recipes r JOIN categories c ON r.category_id = c.id
            WHERE r.id = ?
        `).get(id);

        res.json({ success: true, data: transformRecipe(recipe) });
    } catch (error) {
        console.error('[Recipes] Create error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/recipes/:id
app.put('/api/recipes/:id', (req, res) => {
    try {
        const { name, category, instructions, notes, ingredients } = req.body;
        const now = new Date().toISOString();

        db.prepare(`
            UPDATE recipes SET
                name = ?,
                category_id = ?,
                instructions = ?,
                notes = ?,
                updated_at = ?
            WHERE id = ?
        `).run(name, category || 'protein', instructions || '', notes || '', now, req.params.id);

        // Update ingredients if provided
        if (ingredients) {
            db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(req.params.id);
            
            const insertIng = db.prepare(`
                INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, grams)
                VALUES (?, ?, ?, ?)
            `);

            for (const ing of ingredients) {
                insertIng.run(uuidv4(), req.params.id, ing.ingredientId, ing.grams || 100);
            }
        }

        const recipe = db.prepare(`
            SELECT r.*, c.name as category, c.display_name as category_display
            FROM recipes r JOIN categories c ON r.category_id = c.id
            WHERE r.id = ?
        `).get(req.params.id);

        res.json({ success: true, data: transformRecipe(recipe) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/recipes/:id
app.delete('/api/recipes/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM recipes WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// API ENDPOINTS - PATIENTS
// ==========================================

// GET /api/patients
app.get('/api/patients', (req, res) => {
    try {
        const { search = '', page = 1, limit = 50 } = req.query;
        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const offset = (pageNum - 1) * limitNum;

        let whereClause = '1=1';
        const params = [];

        if (search) {
            whereClause += ' AND (LOWER(first_name) LIKE ? OR LOWER(last_name) LIKE ? OR LOWER(email) LIKE ? OR phone LIKE ?)';
            const s = `%${search.toLowerCase()}%`;
            params.push(s, s, s, s);
        }

        const { total } = db.prepare(`SELECT COUNT(*) as total FROM patients WHERE ${whereClause}`).get(...params);

        const patients = db.prepare(`
            SELECT * FROM patients WHERE ${whereClause}
            ORDER BY last_name, first_name
            LIMIT ? OFFSET ?
        `).all(...params, limitNum, offset);

        res.json({
            success: true,
            data: patients.map(transformPatient),
            pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/patients/:id
app.get('/api/patients/:id', (req, res) => {
    try {
        const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
        if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' });
        
        const metrics = db.prepare('SELECT * FROM patient_metrics WHERE patient_id = ? ORDER BY date DESC LIMIT 10').all(req.params.id);
        const conditions = db.prepare('SELECT * FROM patient_conditions WHERE patient_id = ?').all(req.params.id);
        const allergies = conditions.filter(c => c.type === 'allergy' || c.type === 'intolerance').map(c => c.name);

        res.json({
            success: true,
            data: {
                ...transformPatient(patient),
                metrics: metrics.map(transformMetric),
                conditions: conditions.map(transformCondition),
                allergies
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/patients
app.post('/api/patients', (req, res) => {
    try {
        const id = req.body.id || uuidv4();
        const now = new Date().toISOString();
        const d = req.body;

        db.prepare(`
            INSERT INTO patients (id, first_name, last_name, email, phone, date_of_birth, gender,
                street, city, zip_code, emergency_name, emergency_phone, emergency_relation,
                notes, photo, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
        `).run(
            id, d.firstName, d.lastName, d.email, d.phone, d.dateOfBirth, d.gender,
            d.address?.street || '', d.address?.city || '', d.address?.zipCode || '',
            d.emergencyContact?.name || '', d.emergencyContact?.phone || '', d.emergencyContact?.relation || '',
            d.notes || '', d.photo, now, now
        );

        const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
        res.json({ success: true, data: transformPatient(patient) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PUT /api/patients/:id
app.put('/api/patients/:id', (req, res) => {
    try {
        const now = new Date().toISOString();
        const d = req.body;

        db.prepare(`
            UPDATE patients SET
                first_name = COALESCE(?, first_name),
                last_name = COALESCE(?, last_name),
                email = COALESCE(?, email),
                phone = COALESCE(?, phone),
                date_of_birth = COALESCE(?, date_of_birth),
                gender = COALESCE(?, gender),
                street = COALESCE(?, street),
                city = COALESCE(?, city),
                zip_code = COALESCE(?, zip_code),
                emergency_name = COALESCE(?, emergency_name),
                emergency_phone = COALESCE(?, emergency_phone),
                emergency_relation = COALESCE(?, emergency_relation),
                notes = COALESCE(?, notes),
                photo = COALESCE(?, photo),
                updated_at = ?
            WHERE id = ?
        `).run(
            d.firstName, d.lastName, d.email, d.phone, d.dateOfBirth, d.gender,
            d.address?.street, d.address?.city, d.address?.zipCode,
            d.emergencyContact?.name, d.emergencyContact?.phone, d.emergencyContact?.relation,
            d.notes, d.photo, now, req.params.id
        );

        const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
        res.json({ success: true, data: transformPatient(patient) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/patients/:id
app.delete('/api/patients/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM patients WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// API ENDPOINTS - PATIENT METRICS
// ==========================================

app.post('/api/patients/:id/metrics', (req, res) => {
    try {
        const id = uuidv4();
        const d = req.body;

        db.prepare(`
            INSERT INTO patient_metrics (id, patient_id, date, weight, height, bmi, bmi_category,
                body_fat, muscle_mass, waist, chest, hips, activity_level, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            id, req.params.id, d.date || new Date().toISOString().split('T')[0],
            d.weight, d.height, d.bmi, d.bmiCategory,
            d.bodyFat, d.muscleMass, d.waist, d.chest, d.hips,
            d.activityLevel || 'moderate', d.notes || ''
        );

        const metric = db.prepare('SELECT * FROM patient_metrics WHERE id = ?').get(id);
        res.json({ success: true, data: transformMetric(metric) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/patients/:patientId/metrics/:metricId', (req, res) => {
    try {
        db.prepare('DELETE FROM patient_metrics WHERE id = ? AND patient_id = ?')
            .run(req.params.metricId, req.params.patientId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// API ENDPOINTS - PATIENT CONDITIONS
// ==========================================

app.post('/api/patients/:id/conditions', (req, res) => {
    try {
        const id = uuidv4();
        const d = req.body;

        db.prepare(`
            INSERT INTO patient_conditions (id, patient_id, type, name, severity, description, dietary_notes, medications)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, req.params.id, d.type || 'condition', d.name, d.severity || 'mild', d.description || '', d.dietaryNotes || '', d.medications || '');

        const condition = db.prepare('SELECT * FROM patient_conditions WHERE id = ?').get(id);
        res.json({ success: true, data: transformCondition(condition) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/api/patients/:patientId/conditions/:conditionId', (req, res) => {
    try {
        db.prepare('DELETE FROM patient_conditions WHERE id = ? AND patient_id = ?')
            .run(req.params.conditionId, req.params.patientId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// API ENDPOINTS - ALLERGIES (Special query)
// ==========================================

app.get('/api/patients/:id/allergies', (req, res) => {
    try {
        const allergies = db.prepare(`
            SELECT name FROM patient_conditions 
            WHERE patient_id = ? AND (type = 'allergy' OR type = 'intolerance')
        `).all(req.params.id);

        res.json({ success: true, data: allergies.map(a => a.name) });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/patients/:id/sync-to-billing - Sync patient to billing client (unified)
app.post('/api/patients/:id/sync-to-billing', (req, res) => {
    try {
        const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
        if (!patient) {
            return res.status(404).json({ success: false, error: 'Patient not found' });
        }

        // Check if already linked
        if (patient.billing_client_id) {
            const existingClient = db.prepare('SELECT * FROM billing_clients WHERE id = ?').get(patient.billing_client_id);
            if (existingClient) {
                return res.json({ success: true, data: existingClient, alreadyLinked: true });
            }
        }

        // Create new client in billing (unified database)
        const clientId = uuidv4();
        const now = new Date().toISOString();
        const company = db.prepare('SELECT id FROM billing_company LIMIT 1').get();

        db.prepare(`
            INSERT INTO billing_clients (id, company_id, name, email, phone, address, city, country, type, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'INDIVIDUAL', ?, ?, ?)
        `).run(
            clientId, company?.id,
            `${patient.first_name} ${patient.last_name}`,
            patient.email, patient.phone,
            patient.street, patient.city, 'USA',
            `Patient Notes: ${patient.notes || 'None'}`,
            now, now
        );

        const newClient = db.prepare('SELECT * FROM billing_clients WHERE id = ?').get(clientId);

        // Update patient with billing_client_id
        db.prepare('UPDATE patients SET billing_client_id = ?, updated_at = ? WHERE id = ?')
            .run(clientId, now, req.params.id);

        res.json({ success: true, data: newClient, alreadyLinked: false });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/patients/:id/billing - Get patient's billing info (unified)
app.get('/api/patients/:id/billing', (req, res) => {
    try {
        const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(req.params.id);
        if (!patient) {
            return res.status(404).json({ success: false, error: 'Patient not found' });
        }

        if (!patient.billing_client_id) {
            return res.json({ success: true, data: { linked: false, invoices: [], quotes: [] } });
        }

        // Get client info from unified database
        const client = db.prepare('SELECT * FROM billing_clients WHERE id = ?').get(patient.billing_client_id);
        const invoices = db.prepare('SELECT * FROM billing_invoices WHERE client_id = ? ORDER BY created_at DESC').all(patient.billing_client_id);
        const quotes = db.prepare('SELECT * FROM billing_quotes WHERE client_id = ? ORDER BY created_at DESC').all(patient.billing_client_id);

        res.json({ 
            success: true, 
            data: { 
                linked: !!client, 
                client,
                invoices,
                quotes 
            } 
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// API ENDPOINTS - FULL BACKUP/EXPORT
// ==========================================
// SYNC ENDPOINTS - For populating localStorage
// ==========================================

// GET /api/sync/init - Full sync (for initial load)
app.get('/api/sync/init', (req, res) => {
    try {
        const ingredients = db.prepare('SELECT * FROM v_ingredient_with_category').all().map(transformIngredient);
        
        const recipesRaw = db.prepare(`
            SELECT r.*, c.name as category, c.display_name as category_display
            FROM recipes r JOIN categories c ON r.category_id = c.id
        `).all();
        
        const recipes = recipesRaw.map(r => {
            const ingredients = db.prepare(`
                SELECT ri.*, i.name as ingredient_name, i.kcal_per_100g,
                       i.protein_per_100g, i.carbs_per_100g, i.fat_per_100g
                FROM recipe_ingredients ri 
                JOIN ingredients i ON ri.ingredient_id = i.id
                WHERE ri.recipe_id = ?
            `).all(r.id);
            
            return {
                ...transformRecipe(r),
                ingredients: ingredients.map(ri => ({
                    ingredientId: ri.ingredient_id,
                    grams: ri.grams
                }))
            };
        });
        
        const patients = db.prepare('SELECT * FROM patients').all().map(transformPatient);
        const patientMetrics = db.prepare('SELECT * FROM patient_metrics').all().map(transformMetric);
        const patientConditions = db.prepare('SELECT * FROM patient_conditions').all().map(transformCondition);
        
        res.json({
            success: true,
            data: {
                ingredients,
                recipes,
                patients,
                patientMetrics,
                patientConditions,
                weekPlan: {},
                currentTemplateId: null,
                dietProfile: { goal: 'maintenance', dailyTarget: 2000 },
                dietTemplates: [
                    { id: 'tpl-1', name: 'Weight Loss 1500', description: 'Caloric deficit', goal: 'deficit', dailyTarget: 1500, isDefault: false },
                    { id: 'tpl-2', name: 'Maintenance 2000', description: 'Maintain weight', goal: 'maintenance', dailyTarget: 2000, isDefault: true },
                    { id: 'tpl-3', name: 'Muscle Gain 3000', description: 'Caloric surplus', goal: 'bulking', dailyTarget: 3000, isDefault: false }
                ]
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/sync/push - Receive data from frontend (for backup/restore)
app.post('/api/sync/push', (req, res) => {
    try {
        // This endpoint receives data from frontend localStorage
        // For now, just acknowledge receipt (full bidirectional sync would be more complex)
        res.json({ success: true, message: 'Data received', timestamp: new Date().toISOString() });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/sync/pull - Pull data for frontend (same as init)
app.get('/api/sync/pull', (req, res) => {
    try {
        const ingredients = db.prepare('SELECT * FROM v_ingredient_with_category').all().map(transformIngredient);
        
        const recipesRaw = db.prepare(`
            SELECT r.*, c.name as category, c.display_name as category_display
            FROM recipes r JOIN categories c ON r.category_id = c.id
        `).all();
        
        const recipes = recipesRaw.map(r => {
            const ingredients = db.prepare(`
                SELECT ri.*, i.name as ingredient_name, i.kcal_per_100g,
                       i.protein_per_100g, i.carbs_per_100g, i.fat_per_100g
                FROM recipe_ingredients ri 
                JOIN ingredients i ON ri.ingredient_id = i.id
                WHERE ri.recipe_id = ?
            `).all(r.id);
            
            return {
                ...transformRecipe(r),
                ingredients: ingredients.map(ri => ({
                    ingredientId: ri.ingredient_id,
                    grams: ri.grams
                }))
            };
        });
        
        const patients = db.prepare('SELECT * FROM patients').all().map(transformPatient);
        
        res.json({
            ingredients,
            recipes,
            patients,
            weekPlan: {},
            currentTemplateId: null,
            dietProfile: { goal: 'maintenance', dailyTarget: 2000 }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================

app.get('/api/backup/export', (req, res) => {
    try {
        const backup = {
            version: '3.0-normalized',
            exportedAt: new Date().toISOString(),
            ingredients: db.prepare('SELECT * FROM v_ingredient_with_category').all().map(transformIngredient),
            recipes: db.prepare(`
                SELECT r.*, c.name as category, c.display_name as category_display
                FROM recipes r JOIN categories c ON r.category_id = c.id
            `).all().map(r => {
                const ingredients = db.prepare('SELECT * FROM recipe_ingredients WHERE recipe_id = ?').all(r.id);
                return { ...transformRecipe(r), ingredients };
            }),
            patients: db.prepare('SELECT * FROM patients').all().map(transformPatient),
            patientMetrics: db.prepare('SELECT * FROM patient_metrics').all().map(transformMetric),
            patientConditions: db.prepare('SELECT * FROM patient_conditions').all().map(transformCondition),
            patientPlans: db.prepare('SELECT * FROM patient_plans').all(),
            patientProgress: db.prepare('SELECT * FROM patient_progress').all()
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=meal-prep-backup.json');
        res.json(backup);
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/api/backup/import', (req, res) => {
    try {
        const { ingredients, recipes, patients } = req.body;
        const now = new Date().toISOString();

        const importTransaction = db.transaction(() => {
            if (ingredients?.length) {
                db.prepare('DELETE FROM recipe_ingredients');
                db.prepare('DELETE FROM ingredients').run();
                
                const insertIng = db.prepare(`
                    INSERT INTO ingredients (id, name, category_id, unit_id, created_at, updated_at, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `);
                for (const ing of ingredients) {
                    insertIng.run(ing.id, ing.name, ing.category || 'protein', 'gram', now, now, ing.kcalPer100g || 0, ing.proteinPer100g || 0, ing.carbsPer100g || 0, ing.fatPer100g || 0);
                }
            }

            if (recipes?.length) {
                db.prepare('DELETE FROM recipes').run();
                
                const insertRec = db.prepare(`INSERT INTO recipes (id, name, category_id, instructions, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`);
                const insertRecIng = db.prepare(`INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, grams) VALUES (?, ?, ?, ?)`);
                
                for (const rec of recipes) {
                    insertRec.run(rec.id, rec.name, rec.category || 'protein', rec.instructions || '', rec.notes || '', now, now);
                    for (const ing of (rec.ingredients || [])) {
                        insertRecIng.run(uuidv4(), rec.id, ing.ingredientId, ing.grams || 100);
                    }
                }
            }

            if (patients?.length) {
                db.prepare('DELETE FROM patient_progress');
                db.prepare('DELETE FROM patient_plan_meals');
                db.prepare('DELETE FROM patient_plans');
                db.prepare('DELETE FROM patient_conditions');
                db.prepare('DELETE FROM patient_metrics');
                db.prepare('DELETE FROM patients').run();
                
                // Simplified patient import
                const insertPat = db.prepare(`
                    INSERT INTO patients (id, first_name, last_name, email, phone, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                `);
                for (const pat of patients) {
                    insertPat.run(pat.id, pat.firstName, pat.lastName, pat.email || '', pat.phone || '', now, now);
                }
            }
        });

        importTransaction();
        res.json({ success: true, message: 'Import completed' });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// STATS
// ==========================================

app.get('/api/stats', (req, res) => {
    try {
        const stats = {
            ingredients: db.prepare('SELECT COUNT(*) as count FROM ingredients').get().count,
            recipes: db.prepare('SELECT COUNT(*) as count FROM recipes').get().count,
            patients: db.prepare('SELECT COUNT(*) as count FROM patients').get().count,
            categories: db.prepare('SELECT COUNT(*) as count FROM categories').get().count,
            // Billing stats
            billingClients: db.prepare('SELECT COUNT(*) as count FROM billing_clients').get().count,
            billingInvoices: db.prepare('SELECT COUNT(*) as count FROM billing_invoices').get().count,
            billingQuotes: db.prepare('SELECT COUNT(*) as count FROM billing_quotes').get().count
        };
        res.json({ success: true, stats });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// DATA TRANSFORMATIONS (snake_case → camelCase)
// ==========================================

function transformIngredient(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        category: row.category || row.category_id,
        categoryDisplay: row.category_display,
        unit: row.unit_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        kcalPer100g: row.kcal_per_100g,
        proteinPer100g: row.protein_per_100g,
        carbsPer100g: row.carbs_per_100g,
        fatPer100g: row.fat_per_100g,
        saturatedFatPer100g: row.saturated_fat_per_100g,
        polyunsaturatedFatPer100g: row.polyunsaturated_fat_per_100g,
        monounsaturatedFatPer100g: row.monounsaturated_fat_per_100g,
        sugarPer100g: row.sugar_per_100g,
        fiberPer100g: row.fiber_per_100g,
        cholesterolPer100g: row.cholesterol_per_100g,
        sodiumPer100g: row.sodium_per_100g,
        vitaminAPer100g: row.vitamin_a_per_100g,
        vitaminB1Per100g: row.vitamin_b1_per_100g,
        vitaminB2Per100g: row.vitamin_b2_per_100g,
        vitaminB3Per100g: row.vitamin_b3_per_100g,
        vitaminB5Per100g: row.vitamin_b5_per_100g,
        vitaminB6Per100g: row.vitamin_b6_per_100g,
        vitaminB9Per100g: row.vitamin_b9_per_100g,
        vitaminB12Per100g: row.vitamin_b12_per_100g,
        vitaminCPer100g: row.vitamin_c_per_100g,
        vitaminDPer100g: row.vitamin_d_per_100g,
        vitaminEPer100g: row.vitamin_e_per_100g,
        vitaminKPer100g: row.vitamin_k_per_100g,
        magnesiumPer100g: row.magnesium_per_100g,
        calciumPer100g: row.calcium_per_100g,
        phosphorusPer100g: row.phosphorus_per_100g,
        potassiumPer100g: row.potassium_per_100g,
        ironPer100g: row.iron_per_100g,
        seleniumPer100g: row.selenium_per_100g,
        zincPer100g: row.zinc_per_100g,
        manganesePer100g: row.manganese_per_100g,
        copperPer100g: row.copper_per_100g
    };
}

function transformRecipe(row) {
    if (!row) return null;
    return {
        id: row.id,
        name: row.name,
        category: row.category || row.category_id,
        categoryDisplay: row.category_display,
        instructions: row.instructions,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        nutrition: {
            calories: row.total_calories || 0,
            protein: row.total_protein || 0,
            carbs: row.total_carbs || 0,
            fat: row.total_fat || 0
        }
    };
}

function transformPatient(row) {
    if (!row) return null;
    return {
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        email: row.email,
        phone: row.phone,
        dateOfBirth: row.date_of_birth,
        gender: row.gender,
        address: {
            street: row.street,
            city: row.city,
            zipCode: row.zip_code
        },
        emergencyContact: {
            name: row.emergency_name,
            phone: row.emergency_phone,
            relation: row.emergency_relation
        },
        notes: row.notes,
        photo: row.photo,
        status: row.status,
        billingClientId: row.billing_client_id,  // Integration: billing link
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function transformMetric(row) {
    if (!row) return null;
    return {
        id: row.id,
        patientId: row.patient_id,
        date: row.date,
        weight: row.weight,
        height: row.height,
        bmi: row.bmi,
        bmiCategory: row.bmi_category,
        bodyFat: row.body_fat,
        muscleMass: row.muscle_mass,
        waist: row.waist,
        chest: row.chest,
        hips: row.hips,
        activityLevel: row.activity_level,
        notes: row.notes,
        createdAt: row.created_at
    };
}

function transformCondition(row) {
    if (!row) return null;
    return {
        id: row.id,
        patientId: row.patient_id,
        type: row.type,
        name: row.name,
        severity: row.severity,
        description: row.description,
        dietaryNotes: row.dietary_notes,
        medications: row.medications,
        createdAt: row.created_at
    };
}

// ==========================================
// BILLING API ENDPOINTS - DASHBOARD STATS
// ==========================================

app.get('/billing-api/dashboard/stats', (req, res) => {
    try {
        const totalClients = db.prepare('SELECT COUNT(*) as c FROM billing_clients').get().c;
        const totalInvoices = db.prepare('SELECT COUNT(*) as c FROM billing_invoices').get().c;
        const totalQuotes = db.prepare('SELECT COUNT(*) as c FROM billing_quotes').get().c;
        const paidInvoices = db.prepare("SELECT COUNT(*) as c FROM billing_invoices WHERE status = 'PAID'").get().c;
        const totalRevenue = db.prepare("SELECT COALESCE(SUM(total), 0) as s FROM billing_invoices WHERE status = 'PAID'").get().s;
        const pendingRevenue = db.prepare("SELECT COALESCE(SUM(total), 0) as s FROM billing_invoices WHERE status IN ('UNPAID', 'SENT')").get().s;
        
        res.json({
            data: {
                totalClients,
                totalInvoices,
                totalQuotes,
                totalRevenue,
                pendingRevenue,
                paidInvoices
            }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// BILLING API ENDPOINTS - COMPANY
// ==========================================

app.get('/billing-api/company', (req, res) => {
    try {
        const company = db.prepare('SELECT * FROM billing_company LIMIT 1').get();
        res.json({ success: true, data: company });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/billing-api/company', (req, res) => {
    try {
        const d = req.body;
        const now = new Date().toISOString();
        
        // Check if company exists
        const existing = db.prepare('SELECT id FROM billing_company LIMIT 1').get();
        
        if (existing) {
            db.prepare(`
                UPDATE billing_company SET 
                    name = ?, email = ?, phone = ?, address = ?, city = ?,
                    country = ?, currency = ?, vat_id = ?, website = ?, updated_at = ?
                WHERE id = ?
            `).run(d.name, d.email, d.phone, d.address, d.city, d.country, d.currency, d.vat_id, d.website, now, existing.id);
            const company = db.prepare('SELECT * FROM billing_company WHERE id = ?').get(existing.id);
            res.json({ success: true, data: company });
        } else {
            const id = d.id || uuidv4();
            db.prepare(`
                INSERT INTO billing_company (id, name, email, phone, address, city, country, currency, vat_id, website, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(id, d.name, d.email, d.phone, d.address, d.city, d.country || 'USA', d.currency || 'USD', d.vat_id, d.website, now, now);
            const company = db.prepare('SELECT * FROM billing_company WHERE id = ?').get(id);
            res.json({ success: true, data: company });
        }
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// PDF Config
app.get('/billing-api/pdf-config', (req, res) => {
    try {
        const config = db.prepare(`
            SELECT pc.* FROM billing_pdf_config pc
            JOIN billing_company c ON pc.company_id = c.id
            LIMIT 1
        `).get();
        res.json({ success: true, data: config || null });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/billing-api/pdf-config', (req, res) => {
    try {
        const d = req.body;
        const company = db.prepare('SELECT id FROM billing_company LIMIT 1').get();
        if (!company) return res.status(400).json({ success: false, error: 'Company not configured' });

        const existing = db.prepare('SELECT id FROM billing_pdf_config WHERE company_id = ?').get(company.id);
        
        if (existing) {
            db.prepare(`
                UPDATE billing_pdf_config SET 
                    font_family = ?, padding = ?, primary_color = ?, secondary_color = ?,
                    include_logo = ?, logo_b64 = ?
                WHERE id = ?
            `).run(d.fontFamily, d.padding, d.primaryColor, d.secondaryColor, d.includeLogo ? 1 : 0, d.logoB64, existing.id);
        } else {
            const id = uuidv4();
            db.prepare(`
                INSERT INTO billing_pdf_config (id, company_id, font_family, padding, primary_color, secondary_color, include_logo, logo_b64)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(id, company.id, d.fontFamily || 'Helvetica', d.padding || 40, d.primaryColor || '#22c55e', d.secondaryColor || '#64748b', d.includeLogo ? 1 : 0, d.logoB64);
        }
        
        const config = db.prepare('SELECT * FROM billing_pdf_config WHERE company_id = ?').get(company.id);
        res.json({ success: true, data: config });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// BILLING API ENDPOINTS - CLIENTS
// ==========================================

app.get('/billing-api/clients', (req, res) => {
    try {
        const { search = '', page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        let whereClause = '1=1';
        const params = [];
        
        if (search) {
            whereClause += ' AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR phone LIKE ?)';
            const s = `%${search}%`;
            params.push(s, s, s);
        }
        
        const { total } = db.prepare(`SELECT COUNT(*) as total FROM billing_clients WHERE ${whereClause}`).get(...params);
        const clients = db.prepare(`
            SELECT * FROM billing_clients WHERE ${whereClause}
            ORDER BY name LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);
        
        res.json({
            success: true,
            data: clients,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/billing-api/clients/:id', (req, res) => {
    try {
        const client = db.prepare('SELECT * FROM billing_clients WHERE id = ?').get(req.params.id);
        if (!client) return res.status(404).json({ success: false, error: 'Client not found' });
        res.json({ success: true, data: client });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/billing-api/clients', (req, res) => {
    try {
        const d = req.body;
        const id = d.id || uuidv4();
        const now = new Date().toISOString();
        const company = db.prepare('SELECT id FROM billing_company LIMIT 1').get();
        
        db.prepare(`
            INSERT INTO billing_clients (id, company_id, name, email, phone, address, city, country, type, vat_id, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, company?.id, d.name, d.email, d.phone, d.address, d.city, d.country || 'USA', d.type || 'INDIVIDUAL', d.vatId, d.notes || '', now, now);
        
        const client = db.prepare('SELECT * FROM billing_clients WHERE id = ?').get(id);
        res.json({ success: true, data: client });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/billing-api/clients/:id', (req, res) => {
    try {
        const d = req.body;
        const now = new Date().toISOString();
        
        db.prepare(`
            UPDATE billing_clients SET 
                name = ?, email = ?, phone = ?, address = ?, city = ?,
                country = ?, type = ?, vat_id = ?, notes = ?, updated_at = ?
            WHERE id = ?
        `).run(d.name, d.email, d.phone, d.address, d.city, d.country, d.type, d.vatId, d.notes || '', now, req.params.id);
        
        const client = db.prepare('SELECT * FROM billing_clients WHERE id = ?').get(req.params.id);
        res.json({ success: true, data: client });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/billing-api/clients/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM billing_clients WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Create client from patient
app.post('/billing-api/clients/from-patient', (req, res) => {
    try {
        const d = req.body;
        const id = uuidv4();
        const now = new Date().toISOString();
        const company = db.prepare('SELECT id FROM billing_company LIMIT 1').get();
        
        db.prepare(`
            INSERT INTO billing_clients (id, company_id, name, email, phone, address, city, country, type, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'INDIVIDUAL', ?, ?, ?)
        `).run(id, company?.id, d.name, d.email, d.phone, d.address, d.city, 'USA', d.notes || '', now, now);
        
        const client = db.prepare('SELECT * FROM billing_clients WHERE id = ?').get(id);
        res.json({ success: true, data: client });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// BILLING API ENDPOINTS - INVOICES
// ==========================================

app.get('/billing-api/invoices', (req, res) => {
    try {
        const { clientId, status, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        let whereClause = '1=1';
        const params = [];
        
        if (clientId) {
            whereClause += ' AND client_id = ?';
            params.push(clientId);
        }
        if (status) {
            whereClause += ' AND status = ?';
            params.push(status);
        }
        
        const { total } = db.prepare(`SELECT COUNT(*) as total FROM billing_invoices WHERE ${whereClause}`).get(...params);
        const invoices = db.prepare(`
            SELECT i.*, c.name as client_name 
            FROM billing_invoices i
            LEFT JOIN billing_clients c ON i.client_id = c.id
            WHERE ${whereClause}
            ORDER BY i.created_at DESC LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);
        
        res.json({
            success: true,
            data: invoices,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/billing-api/invoices/:id', (req, res) => {
    try {
        const invoice = db.prepare(`
            SELECT i.*, c.name as client_name, c.email as client_email, c.address as client_address
            FROM billing_invoices i
            LEFT JOIN billing_clients c ON i.client_id = c.id
            WHERE i.id = ?
        `).get(req.params.id);
        
        if (!invoice) return res.status(404).json({ success: false, error: 'Invoice not found' });
        
        const items = db.prepare('SELECT * FROM billing_invoice_items WHERE invoice_id = ?').all(req.params.id);
        const company = db.prepare('SELECT * FROM billing_company LIMIT 1').get();
        const pdfConfig = db.prepare('SELECT * FROM billing_pdf_config WHERE company_id = ?').get(company?.id);
        
        res.json({ success: true, data: { ...invoice, items, company, pdfConfig } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/billing-api/invoices', (req, res) => {
    try {
        const d = req.body;
        const id = d.id || uuidv4();
        const now = new Date().toISOString();
        const company = db.prepare('SELECT id FROM billing_company LIMIT 1').get();
        
        // Generate invoice number
        const lastInvoice = db.prepare('SELECT invoice_number FROM billing_invoices ORDER BY created_at DESC LIMIT 1').get();
        const lastNum = lastInvoice ? parseInt(lastInvoice.invoice_number?.replace('INV-', '') || 0) : 0;
        const invoiceNumber = `INV-${String(lastNum + 1).padStart(4, '0')}`;
        
        db.prepare(`
            INSERT INTO billing_invoices (id, company_id, client_id, invoice_number, status, date, due_date, subtotal, discount, total, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, company?.id, d.clientId, invoiceNumber, d.status || 'UNPAID', d.date, d.dueDate, d.subtotal || 0, d.discount || 0, d.total || 0, d.notes || '', now, now);
        
        // Insert items
        if (d.items?.length) {
            const insertItem = db.prepare(`INSERT INTO billing_invoice_items (id, invoice_id, description, quantity, unit_price, type) VALUES (?, ?, ?, ?, ?, ?)`);
            for (const item of d.items) {
                insertItem.run(uuidv4(), id, item.description, item.quantity || 1, item.unitPrice || 0, item.type || 'SERVICE');
            }
        }
        
        const invoice = db.prepare('SELECT * FROM billing_invoices WHERE id = ?').get(id);
        res.json({ success: true, data: invoice });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/billing-api/invoices/:id', (req, res) => {
    try {
        const d = req.body;
        const now = new Date().toISOString();
        
        db.prepare(`
            UPDATE billing_invoices SET 
                client_id = ?, status = ?, date = ?, due_date = ?,
                subtotal = ?, discount = ?, total = ?, paid_at = ?, notes = ?, updated_at = ?
            WHERE id = ?
        `).run(d.clientId, d.status, d.date, d.dueDate, d.subtotal || 0, d.discount || 0, d.total || 0, d.paidAt, d.notes || '', now, req.params.id);
        
        // Update items if provided
        if (d.items !== undefined) {
            db.prepare('DELETE FROM billing_invoice_items WHERE invoice_id = ?').run(req.params.id);
            if (d.items?.length) {
                const insertItem = db.prepare(`INSERT INTO billing_invoice_items (id, invoice_id, description, quantity, unit_price, type) VALUES (?, ?, ?, ?, ?, ?)`);
                for (const item of d.items) {
                    insertItem.run(uuidv4(), req.params.id, item.description, item.quantity || 1, item.unitPrice || 0, item.type || 'SERVICE');
                }
            }
        }
        
        const invoice = db.prepare('SELECT * FROM billing_invoices WHERE id = ?').get(req.params.id);
        res.json({ success: true, data: invoice });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/billing-api/invoices/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM billing_invoices WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// BILLING API ENDPOINTS - QUOTES
// ==========================================

app.get('/billing-api/quotes', (req, res) => {
    try {
        const { clientId, status, page = 1, limit = 50 } = req.query;
        const offset = (parseInt(page) - 1) * parseInt(limit);
        
        let whereClause = '1=1';
        const params = [];
        
        if (clientId) {
            whereClause += ' AND client_id = ?';
            params.push(clientId);
        }
        if (status) {
            whereClause += ' AND status = ?';
            params.push(status);
        }
        
        const { total } = db.prepare(`SELECT COUNT(*) as total FROM billing_quotes WHERE ${whereClause}`).get(...params);
        const quotes = db.prepare(`
            SELECT q.*, c.name as client_name 
            FROM billing_quotes q
            LEFT JOIN billing_clients c ON q.client_id = c.id
            WHERE ${whereClause}
            ORDER BY q.created_at DESC LIMIT ? OFFSET ?
        `).all(...params, parseInt(limit), offset);
        
        res.json({
            success: true,
            data: quotes,
            pagination: { page: parseInt(page), limit: parseInt(limit), total, totalPages: Math.ceil(total / parseInt(limit)) }
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/billing-api/quotes/:id', (req, res) => {
    try {
        const quote = db.prepare(`
            SELECT q.*, c.name as client_name, c.email as client_email, c.address as client_address
            FROM billing_quotes q
            LEFT JOIN billing_clients c ON q.client_id = c.id
            WHERE q.id = ?
        `).get(req.params.id);
        
        if (!quote) return res.status(404).json({ success: false, error: 'Quote not found' });
        
        const items = db.prepare('SELECT * FROM billing_quote_items WHERE quote_id = ?').all(req.params.id);
        const company = db.prepare('SELECT * FROM billing_company LIMIT 1').get();
        const pdfConfig = db.prepare('SELECT * FROM billing_pdf_config WHERE company_id = ?').get(company?.id);
        
        res.json({ success: true, data: { ...quote, items, company, pdfConfig } });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/billing-api/quotes', (req, res) => {
    try {
        const d = req.body;
        const id = d.id || uuidv4();
        const now = new Date().toISOString();
        const company = db.prepare('SELECT id FROM billing_company LIMIT 1').get();
        
        // Generate quote number
        const lastQuote = db.prepare('SELECT quote_number FROM billing_quotes ORDER BY created_at DESC LIMIT 1').get();
        const lastNum = lastQuote ? parseInt(lastQuote.quote_number?.replace('QT-', '') || 0) : 0;
        const quoteNumber = `QT-${String(lastNum + 1).padStart(4, '0')}`;
        
        db.prepare(`
            INSERT INTO billing_quotes (id, company_id, client_id, quote_number, status, date, valid_until, subtotal, discount, total, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, company?.id, d.clientId, quoteNumber, d.status || 'DRAFT', d.date, d.validUntil, d.subtotal || 0, d.discount || 0, d.total || 0, d.notes || '', now, now);
        
        // Insert items
        if (d.items?.length) {
            const insertItem = db.prepare(`INSERT INTO billing_quote_items (id, quote_id, description, quantity, unit_price, type) VALUES (?, ?, ?, ?, ?, ?)`);
            for (const item of d.items) {
                insertItem.run(uuidv4(), id, item.description, item.quantity || 1, item.unitPrice || 0, item.type || 'SERVICE');
            }
        }
        
        const quote = db.prepare('SELECT * FROM billing_quotes WHERE id = ?').get(id);
        res.json({ success: true, data: quote });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/billing-api/quotes/:id', (req, res) => {
    try {
        const d = req.body;
        const now = new Date().toISOString();
        
        db.prepare(`
            UPDATE billing_quotes SET 
                client_id = ?, status = ?, date = ?, valid_until = ?,
                subtotal = ?, discount = ?, total = ?, notes = ?, updated_at = ?
            WHERE id = ?
        `).run(d.clientId, d.status, d.date, d.validUntil, d.subtotal || 0, d.discount || 0, d.total || 0, d.notes || '', now, req.params.id);
        
        // Update items if provided
        if (d.items !== undefined) {
            db.prepare('DELETE FROM billing_quote_items WHERE quote_id = ?').run(req.params.id);
            if (d.items?.length) {
                const insertItem = db.prepare(`INSERT INTO billing_quote_items (id, quote_id, description, quantity, unit_price, type) VALUES (?, ?, ?, ?, ?, ?)`);
                for (const item of d.items) {
                    insertItem.run(uuidv4(), req.params.id, item.description, item.quantity || 1, item.unitPrice || 0, item.type || 'SERVICE');
                }
            }
        }
        
        const quote = db.prepare('SELECT * FROM billing_quotes WHERE id = ?').get(req.params.id);
        res.json({ success: true, data: quote });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/billing-api/quotes/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM billing_quotes WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// BILLING API ENDPOINTS - PAYMENT METHODS
// ==========================================

app.get('/billing-api/payment-methods', (req, res) => {
    try {
        const methods = db.prepare('SELECT * FROM billing_payment_methods ORDER BY is_default DESC, name').all();
        res.json({ success: true, data: methods });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/billing-api/payment-methods', (req, res) => {
    try {
        const d = req.body;
        const id = uuidv4();
        const company = db.prepare('SELECT id FROM billing_company LIMIT 1').get();
        
        db.prepare(`
            INSERT INTO billing_payment_methods (id, company_id, name, type, instructions, is_default)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(id, company?.id, d.name, d.type || 'BANK_TRANSFER', d.instructions || '', d.isDefault ? 1 : 0);
        
        const method = db.prepare('SELECT * FROM billing_payment_methods WHERE id = ?').get(id);
        res.json({ success: true, data: method });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.put('/billing-api/payment-methods/:id', (req, res) => {
    try {
        const d = req.body;
        
        db.prepare(`
            UPDATE billing_payment_methods SET name = ?, type = ?, instructions = ?, is_default = ?
            WHERE id = ?
        `).run(d.name, d.type, d.instructions, d.isDefault ? 1 : 0, req.params.id);
        
        const method = db.prepare('SELECT * FROM billing_payment_methods WHERE id = ?').get(req.params.id);
        res.json({ success: true, data: method });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.delete('/billing-api/payment-methods/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM billing_payment_methods WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// ==========================================
// BILLING HEALTH CHECK
// ==========================================

app.get('/billing-api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), database: 'unified' });
});

// ==========================================
// ERROR HANDLING
// ==========================================

app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found' });
});

app.use((err, req, res, next) => {
    console.error('[Server] Error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

// ==========================================
// START SERVER
// ==========================================

function startServer() {
    initializeDatabase();
    
    app.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════════════════════════════╗
║         Meal Prep Planner - Unified Backend                   ║
╠══════════════════════════════════════════════════════════════╣
║  Status:    Running                                           ║
║  Port:      ${PORT}                                               ║
║  Database:  SQLite (Unified - Meal Prep + Billing)            ║
║  URL:       http://localhost:${PORT}                            ║
╚══════════════════════════════════════════════════════════════╝

API Endpoints:
  MEAL PREP:
    GET    /api/ingredients          - List ingredients
    GET    /api/ingredients/:id      - Get ingredient
    POST   /api/ingredients          - Create ingredient
    PUT    /api/ingredients/:id      - Update ingredient
    DELETE /api/ingredients/:id      - Delete ingredient
    POST   /api/ingredients/bulk     - Bulk import

    GET    /api/recipes              - List recipes
    GET    /api/recipes/:id          - Get recipe with ingredients
    POST   /api/recipes              - Create recipe
    PUT    /api/recipes/:id          - Update recipe
    DELETE /api/recipes/:id          - Delete recipe

    GET    /api/patients             - List patients
    GET    /api/patients/:id         - Get patient details
    POST   /api/patients             - Create patient
    PUT    /api/patients/:id         - Update patient
    DELETE /api/patients/:id         - Delete patient

  BILLING (Integrated):
    GET    /billing-api/company          - Get company info
    PUT    /billing-api/company          - Update company
    GET    /billing-api/pdf-config       - Get PDF config
    PUT    /billing-api/pdf-config       - Update PDF config
    
    GET    /billing-api/clients          - List clients
    GET    /billing-api/clients/:id      - Get client
    POST   /billing-api/clients          - Create client
    PUT    /billing-api/clients/:id      - Update client
    DELETE /billing-api/clients/:id      - Delete client
    
    GET    /billing-api/invoices         - List invoices
    GET    /billing-api/invoices/:id     - Get invoice with items
    POST   /billing-api/invoices         - Create invoice
    PUT    /billing-api/invoices/:id     - Update invoice
    DELETE /billing-api/invoices/:id     - Delete invoice
    
    GET    /billing-api/quotes           - List quotes
    GET    /billing-api/quotes/:id       - Get quote with items
    POST   /billing-api/quotes           - Create quote
    PUT    /billing-api/quotes/:id       - Update quote
    DELETE /billing-api/quotes/:id       - Delete quote
    
    GET    /billing-api/payment-methods  - List payment methods
    POST   /billing-api/payment-methods  - Create payment method
    PUT    /billing-api/payment-methods/:id - Update
    DELETE /billing-api/payment-methods/:id - Delete

  UTILITY:
    GET    /api/backup/export             - Full export
    POST   /api/backup/import            - Full import
    GET    /api/stats                    - Database stats
    GET    /api/sync/init                - Initialize sync
        `);
    });
}

// Handle shutdown
process.on('SIGINT', () => {
    console.log('\n[Server] Shutting down...');
    db.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n[Server] Shutting down...');
    db.close();
    process.exit(0);
});

if (require.main === module) {
    startServer();
}

module.exports = { app, startServer };
