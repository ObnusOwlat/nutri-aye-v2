/**
 * Import USDA FoodData Central (Foundation Foods + SR Legacy) JSON downloads.
 *
 * Stores every nutrient in ingredient_nutrients, household portions in
 * ingredient_portions, and fills the fixed *_per_100g columns the frontend uses.
 * Names come in Spanish from foods-data/translations/ (original kept in name_en).
 * Re-running updates nutrient data and names, but keeps a name you edited
 * (name_edited = 1) and the category.
 *
 * Usage: node import-usda.js [file.json ...]
 *   Defaults to every FoodData_Central_*.json in foods-data/usda/.
 *   Download: https://fdc.nal.usda.gov/download-datasets (JSON, Foundation + SR Legacy)
 * Run the server once first so the schema exists.
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { classifyFoods } = require('./src/db/schema/food-groups');

const usdaDir = path.join(__dirname, '..', 'foods-data', 'usda');
const files = process.argv.length > 2
    ? process.argv.slice(2)
    : fs.readdirSync(usdaDir).filter(f => /^FoodData_Central_.*\.json$/.test(f)).map(f => path.join(usdaDir, f));

// Foundation Foods first: when both datasets have the same NDB number, the
// newer Foundation analysis wins and the SR Legacy entry is skipped
const datasetOrder = f => (/foundation/i.test(f) ? 0 : 1);
files.sort((a, b) => datasetOrder(a) - datasetOrder(b));

if (files.length === 0) {
    console.error(`No se encontraron archivos FoodData_Central_*.json en ${usdaDir}`);
    process.exit(1);
}

const db = new Database(path.join(__dirname, 'db', 'database.sqlite'));
db.pragma('foreign_keys = ON');

// Spanish names: foods from tools/translate-usda.py, nutrients hand-translated
const translationsDir = path.join(__dirname, '..', 'foods-data', 'translations');
const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {});
const foodNamesEs = readJson(path.join(translationsDir, 'usda-names-es.json'));
const nutrientNamesEs = readJson(path.join(translationsDir, 'nutrients-es.json'));

// Fatty acid codes: SFA 16:0 -> AGS 16:0, PUFA 22:6 n-3 (DHA) -> AGP 22:6 n-3 (DHA)
const FATTY_ACID_PREFIX = { SFA: 'AGS', MUFA: 'AGM', PUFA: 'AGP', TFA: 'AGT' };
function nutrientNameEs(n) {
    if (nutrientNamesEs[n.id]) return nutrientNamesEs[n.id];
    const m = /^(SFA|MUFA|PUFA|TFA) (.+)$/.exec(n.name);
    return m ? `${FATTY_ACID_PREFIX[m[1]]} ${m[2]}` : null;
}

// USDA food category -> Nutri Aye food group
const CATEGORY_MAP = {
    'Beef Products': 'protein',
    'Pork Products': 'protein',
    'Poultry Products': 'protein',
    'Lamb, Veal, and Game Products': 'protein',
    'Finfish and Shellfish Products': 'protein',
    'Sausages and Luncheon Meats': 'protein',
    'Legumes and Legume Products': 'protein',
    'Cereal Grains and Pasta': 'carbs',
    'Baked Products': 'carbs',
    'Breakfast Cereals': 'carbs',
    'Fats and Oils': 'fats',
    'Nut and Seed Products': 'fats',
    'Vegetables and Vegetable Products': 'vegetables',
    'Fruits and Fruit Juices': 'fruits',
    'Dairy and Egg Products': 'dairy'
};

// Fixed column -> USDA nutrient ids, first one present wins
// (Foundation Foods often report energy/sugar/fiber under newer ids)
const LEGACY_COLUMNS = {
    kcal_per_100g: [1008, 2048, 2047],
    protein_per_100g: [1003],
    carbs_per_100g: [1005, 1050],
    fat_per_100g: [1004, 1085],
    saturated_fat_per_100g: [1258],
    polyunsaturated_fat_per_100g: [1293],
    monounsaturated_fat_per_100g: [1292],
    sugar_per_100g: [2000, 1063],
    fiber_per_100g: [1079, 2033],
    cholesterol_per_100g: [1253],
    sodium_per_100g: [1093],
    vitamin_a_per_100g: [1106],     // µg RAE
    vitamin_b1_per_100g: [1165],
    vitamin_b2_per_100g: [1166],
    vitamin_b3_per_100g: [1167],
    vitamin_b5_per_100g: [1170],
    vitamin_b6_per_100g: [1175],
    vitamin_b9_per_100g: [1177, 1190],
    vitamin_b12_per_100g: [1178],
    vitamin_c_per_100g: [1162],
    vitamin_d_per_100g: [1114],     // µg
    vitamin_e_per_100g: [1109],
    vitamin_k_per_100g: [1185],
    magnesium_per_100g: [1090],
    calcium_per_100g: [1087],
    phosphorus_per_100g: [1091],
    potassium_per_100g: [1092],
    iron_per_100g: [1089],
    selenium_per_100g: [1103],
    zinc_per_100g: [1095],
    manganese_per_100g: [1101],
    copper_per_100g: [1098]
};
const legacyCols = Object.keys(LEGACY_COLUMNS);

const ENERGY_IDS = new Set([1008, 1062, 2047, 2048]);

// Group by USDA rank (their display order clusters nutrients by type)
function nutrientGroup(n) {
    if (ENERGY_IDS.has(n.id)) return 'energy';
    if (n.id === 1253) return 'sterols'; // cholesterol
    const r = n.rank ?? 999999;
    if (r === 999999) return 'vitamins'; // unranked folate forms
    if (r <= 1000) return 'proximates';
    if (r < 3000) return 'carbohydrates';
    if (r < 5000) return 'organic_acids';
    if (r < 6250) return 'minerals';
    if (r < 9100) return 'vitamins';
    if (r < 15700) return 'lipids';
    if (r < 16300) return 'sterols';
    if (r < 18200) return 'amino_acids';
    return 'other';
}

const upsertNutrient = db.prepare(`
    INSERT INTO nutrients (id, name, name_es, unit, number, rank, nutrient_group)
    VALUES (@id, @name, @nameEs, @unit, @number, @rank, @group)
    ON CONFLICT(id) DO UPDATE SET
        name = excluded.name, name_es = excluded.name_es, unit = excluded.unit, number = excluded.number,
        rank = excluded.rank, nutrient_group = excluded.nutrient_group
`);

const upsertIngredient = db.prepare(`
    INSERT INTO ingredients (id, name, name_en, category_id, unit_id, source, fdc_id, ndb_number, source_category,
                             ${legacyCols.join(', ')})
    VALUES (@id, @name, @nameEn, @category, 'gram', @source, @fdcId, @ndbNumber, @sourceCategory,
            ${legacyCols.map(c => '@' + c).join(', ')})
    ON CONFLICT(id) DO UPDATE SET
        name = CASE WHEN ingredients.name_edited = 1 THEN ingredients.name ELSE excluded.name END,
        name_en = excluded.name_en, source = excluded.source, fdc_id = excluded.fdc_id, ndb_number = excluded.ndb_number,
        source_category = excluded.source_category, updated_at = datetime('now'),
        ${legacyCols.map(c => `${c} = excluded.${c}`).join(', ')}
`);

const clearNutrients = db.prepare('DELETE FROM ingredient_nutrients WHERE ingredient_id = ?');
const clearPortions = db.prepare('DELETE FROM ingredient_portions WHERE ingredient_id = ?');
const insertNutrient = db.prepare('INSERT OR REPLACE INTO ingredient_nutrients (ingredient_id, nutrient_id, amount) VALUES (?, ?, ?)');
const insertPortion = db.prepare(`
    INSERT INTO ingredient_portions (ingredient_id, amount, unit, modifier, gram_weight, sequence)
    VALUES (?, ?, ?, ?, ?, ?)
`);

function portionUnit(p) {
    const name = p.measureUnit?.name;
    return name && name !== 'undetermined' ? name : null;
}

const deleteUnusedIngredient = db.prepare(`
    DELETE FROM ingredients
    WHERE id = ? AND id NOT IN (SELECT ingredient_id FROM recipe_ingredients)
`);

const seenNdb = new Set();
const seenNutrients = new Set();
const totals = { foods: 0, skippedDuplicate: 0, skippedNoEnergy: 0, nutrientValues: 0, portions: 0 };

const importFoods = db.transaction((foods, source) => {
    for (const food of foods) {
        if (!food || !food.fdcId) continue;

        // Some Foundation entries are partial analyses (no energy, no carbs);
        // skip them so the complete SR Legacy entry with that NDB number is used
        const hasEnergy = (food.foodNutrients || []).some(fn => ENERGY_IDS.has(fn.nutrient?.id) && typeof fn.amount === 'number');
        if (!hasEnergy) {
            deleteUnusedIngredient.run(`usda-${food.fdcId}`); // drop it if an earlier run imported it
            totals.skippedNoEnergy++;
            continue;
        }

        if (food.ndbNumber) {
            if (seenNdb.has(food.ndbNumber)) { totals.skippedDuplicate++; continue; }
            seenNdb.add(food.ndbNumber);
        }

        const amounts = new Map();
        for (const fn of food.foodNutrients || []) {
            const n = fn.nutrient;
            if (!n || typeof fn.amount !== 'number') continue;
            if (!seenNutrients.has(n.id)) {
                upsertNutrient.run({ id: n.id, name: n.name, nameEs: nutrientNameEs(n), unit: n.unitName, number: n.number || null, rank: n.rank ?? null, group: nutrientGroup(n) });
                seenNutrients.add(n.id);
            }
            amounts.set(n.id, fn.amount);
        }

        const sourceCategory = food.foodCategory?.description || null;
        const row = {
            id: `usda-${food.fdcId}`,
            name: foodNamesEs[food.fdcId] || food.description.trim(),
            nameEn: food.description.trim(),
            category: CATEGORY_MAP[sourceCategory] || 'mixed',
            source,
            fdcId: food.fdcId,
            ndbNumber: food.ndbNumber || null,
            sourceCategory
        };
        for (const [col, ids] of Object.entries(LEGACY_COLUMNS)) {
            const id = ids.find(i => amounts.has(i));
            row[col] = id !== undefined ? amounts.get(id) : 0;
        }
        upsertIngredient.run(row);

        clearNutrients.run(row.id);
        for (const [nutrientId, amount] of amounts) {
            insertNutrient.run(row.id, nutrientId, amount);
            totals.nutrientValues++;
        }

        clearPortions.run(row.id);
        for (const p of food.foodPortions || []) {
            if (!p.gramWeight) continue;
            insertPortion.run(row.id, p.amount ?? p.value ?? null, portionUnit(p), p.modifier || p.portionDescription || null, p.gramWeight, p.sequenceNumber ?? null);
            totals.portions++;
        }

        totals.foods++;
    }
});

for (const file of files) {
    console.log(`Leyendo ${path.basename(file)}...`);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    const [key] = Object.keys(data);
    const source = /foundation/i.test(key) ? 'usda_foundation' : 'usda_sr_legacy';
    const before = totals.foods;
    importFoods(data[key], source);
    console.log(`  ${source}: ${totals.foods - before} alimentos`);
}

// Nutrients only present in skipped foods were created by earlier runs: name them too
const setNutrientEs = db.prepare('UPDATE nutrients SET name_es = ? WHERE id = ?');
db.transaction(() => {
    for (const n of db.prepare('SELECT id, name FROM nutrients').all()) setNutrientEs.run(nutrientNameEs(n), n.id);
})();

// Subgroup (origen) and preparation form of every food
classifyFoods(db);

const count = (sql) => db.prepare(sql).get().c;
console.log(`
Importados/actualizados: ${totals.foods} alimentos
Omitidos:                ${totals.skippedDuplicate} con número NDB ya importado, ${totals.skippedNoEnergy} sin datos de energía (análisis parciales)
Valores de nutrientes:   ${totals.nutrientValues}
Porciones:               ${totals.portions}
Nutrientes en catálogo:  ${count('SELECT COUNT(*) AS c FROM nutrients')}
Alimentos en total:      ${count('SELECT COUNT(*) AS c FROM ingredients')}`);
db.close();
