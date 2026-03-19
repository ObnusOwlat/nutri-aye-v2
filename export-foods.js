/**
 * Export calories-in database to Nutri Aye format
 * Run with: node export-foods.js
 */

const fs = require('fs');
const path = require('path');

const CATEGORY_MAP = {
    100: 'protein',    // poultry
    101: 'protein',     // beef
    102: 'protein',     // pork
    103: 'protein',     // fish
    104: 'dairy',       // dairy
    105: 'carbs',       // grains
    106: 'vegetables',  // vegetables
    107: 'protein',     // legumes
    108: 'fruits',      // fruits
    109: 'fats',        // nuts
    110: 'fats',        // fats
    111: 'mixed',       // baked
    112: 'mixed',       // sauces
    113: 'mixed',       // spices
    114: 'mixed',       // snacks
    115: 'mixed',       // beverages
    500: 'dairy',       // dairy
    600: 'protein',     // meat
    700: 'mixed',       // prepared
    800: 'mixed',
    900: 'mixed',
    1000: 'mixed',
    1100: 'mixed',
    1200: 'mixed'
};

function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function convertFood(food) {
    const categoryId = food.categoryId || 500;
    const category = CATEGORY_MAP[categoryId] || 'mixed';
    
    return {
        id: generateId(),
        name: food.name,
        category: category,
        unit: 'g',
        kcalPer100g: food.energy || 0,
        proteinPer100g: food.protein || 0,
        carbsPer100g: food.carbs || 0,
        fatPer100g: food.fat || 0,
        saturatedFatPer100g: food.saturatedFat || 0,
        polyunsaturatedFatPer100g: food.polyunsaturatedFat || 0,
        monounsaturatedFatPer100g: food.monounsaturatedFat || 0,
        sugarPer100g: food.sugar || 0,
        fiberPer100g: food.fiber || 0,
        cholesterolPer100g: food.cholesterol || 0,
        sodiumPer100g: food.sodium || 0,
        vitaminAPer100g: food.vitaminA || 0,
        vitaminB1Per100g: food.vitaminB1 || 0,
        vitaminB2Per100g: food.vitaminB2 || 0,
        vitaminB3Per100g: food.vitaminB3 || 0,
        vitaminB5Per100g: food.vitaminB5 || 0,
        vitaminB6Per100g: food.vitaminB6 || 0,
        vitaminB9Per100g: food.vitaminB9 || 0,
        vitaminB12Per100g: food.vitaminB12 || 0,
        vitaminCPer100g: food.vitaminC || 0,
        vitaminDPer100g: food.vitaminD || 0,
        vitaminEPer100g: food.vitaminE || 0,
        vitaminKPer100g: food.vitaminK || 0,
        magnesiumPer100g: food.magnesium || 0,
        calciumPer100g: food.calcium || 0,
        phosphorusPer100g: food.phosphorus || 0,
        potassiumPer100g: food.potassium || 0,
        ironPer100g: food.iron || 0,
        seleniumPer100g: food.selenium || 0,
        zincPer100g: food.zinc || 0,
        manganesePer100g: food.manganese || 0,
        copperPer100g: food.copper || 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
}

// Read all JSON files
const builtInDir = path.join(__dirname, 'foods-data');

// Create output directory
if (!fs.existsSync(builtInDir)) {
    fs.mkdirSync(builtInDir, { recursive: true });
}

// List of food files to process
const foodFiles = [
    'poultry.json',
    'beef.json',
    'pork.json',
    'finfishAndShellFish.json',
    'dairyAndEggs.json',
    'grainsAndPasta.json',
    'vegetables.json',
    'legumesAndLegumeProducts.json',
    'fruitsAndJuices.json',
    'nutAndSeedProducts.json',
    'fatsAndOils.json',
    'bakedProducts.json',
    'saucesAndSoups.json',
    'spicesAndHerbs.json',
    'sweetsAndSnacks.json',
    'beverages.json'
];

// Source directory
const sourceDir = '/home/monitoreo/Documentos/app/calories-in/src/foods/builtIn';

let allIngredients = [];

console.log('Converting foods...\n');

foodFiles.forEach(file => {
    const sourcePath = path.join(sourceDir, file);
    if (fs.existsSync(sourcePath)) {
        const data = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
        const converted = data.map(food => convertFood(food));
        allIngredients = allIngredients.concat(converted);
        console.log(`${file}: ${converted.length} ingredients`);
    } else {
        console.log(`${file}: FILE NOT FOUND`);
    }
});

console.log(`\nTotal ingredients: ${allIngredients.length}`);

// Save as JSON
const outputPath = path.join(builtInDir, 'calories-in-ingredients.json');
fs.writeFileSync(outputPath, JSON.stringify(allIngredients, null, 2));
console.log(`\nSaved to: ${outputPath}`);

// Create import script for browser
const importScript = `
// Nutri Aye - Import Calories-in Database
// Run this in browser console on Nutri Aye app

const IMPORT_DATA = ${JSON.stringify(allIngredients, null, 2)};

function importCaloriesInIngredients() {
    // Get existing ingredients
    const existing = JSON.parse(localStorage.getItem('mp_ingredients_v1') || '[]');
    
    // Create map of existing names (case insensitive)
    const existingNames = new Map();
    existing.forEach(i => existingNames.set(i.name.toLowerCase(), true));
    
    // Filter out duplicates
    const newIngredients = IMPORT_DATA.filter(i => !existingNames.has(i.name.toLowerCase()));
    
    // Merge
    const merged = [...existing, ...newIngredients];
    
    // Save
    localStorage.setItem('mp_ingredients_v1', JSON.stringify(merged));
    
    // Return stats
    return {
        imported: newIngredients.length,
        total: merged.length,
        skipped: existing.length
    };
}

// Run import
const result = importCaloriesInIngredients();
console.log('Import complete:', result);
console.log('Refresh the page to see the new ingredients!');
`;

const importScriptPath = path.join(builtInDir, 'import-to-nutriaye.js');
fs.writeFileSync(importScriptPath, importScript);
console.log(`Import script saved to: ${importScriptPath}`);

console.log('\nTo import:');
console.log('1. Open Nutri Aye in browser');
console.log('2. Open Developer Console (F12)');
console.log('3. Copy and paste the contents of import-to-nutriaye.js');
console.log('4. Refresh the page');
