/**
 * Import foods-data/calories-in-ingredients.json into the SQLite database.
 * Skips ingredients whose name already exists (case-insensitive).
 *
 * Usage: node import-foods.js [path/to/foods.json]
 * Run the server once first so the schema (and food-group categories) exist.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const jsonPath = process.argv[2] || path.join(__dirname, '..', 'foods-data', 'calories-in-ingredients.json');
const dbPath = path.join(__dirname, 'db', 'database.sqlite');

const foods = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

const UNIT_MAP = { g: 'gram', ml: 'milliliter', oz: 'ounce', cup: 'cup', tbsp: 'tablespoon', tsp: 'teaspoon' };
const validCategories = new Set(db.prepare('SELECT id FROM categories').all().map(c => c.id));

// camelCase JSON field -> snake_case column
const NUTRIENTS = [
    'kcal', 'protein', 'carbs', 'fat', 'saturatedFat', 'polyunsaturatedFat', 'monounsaturatedFat',
    'sugar', 'fiber', 'cholesterol', 'sodium',
    'vitaminA', 'vitaminB1', 'vitaminB2', 'vitaminB3', 'vitaminB5', 'vitaminB6', 'vitaminB9', 'vitaminB12',
    'vitaminC', 'vitaminD', 'vitaminE', 'vitaminK',
    'magnesium', 'calcium', 'phosphorus', 'potassium', 'iron', 'selenium', 'zinc', 'manganese', 'copper'
];
// vitaminB12 -> vitamin_b12_per_100g, saturatedFat -> saturated_fat_per_100g
const columns = NUTRIENTS.map(n => n.replace(/[A-Z]/g, c => '_' + c.toLowerCase()) + '_per_100g');

const insert = db.prepare(`
    INSERT INTO ingredients (id, name, category_id, unit_id, source, ${columns.join(', ')})
    VALUES (?, ?, ?, ?, 'calories_in', ${columns.map(() => '?').join(', ')})
`);

const existingNames = new Set(db.prepare('SELECT LOWER(name) AS n FROM ingredients').all().map(r => r.n));

let imported = 0, skipped = 0;
const run = db.transaction(() => {
    for (const f of foods) {
        const key = f.name.trim().toLowerCase();
        if (existingNames.has(key)) { skipped++; continue; }
        existingNames.add(key);
        insert.run(
            f.id,
            f.name.trim(),
            validCategories.has(f.category) ? f.category : 'mixed',
            UNIT_MAP[f.unit] || 'gram',
            ...NUTRIENTS.map(n => Number(f[`${n}Per100g`]) || 0)
        );
        imported++;
    }
});
run();

const total = db.prepare('SELECT COUNT(*) AS c FROM ingredients').get().c;
console.log(`Importados: ${imported}, omitidos (nombre repetido): ${skipped}, alimentos en total: ${total}`);
db.close();
