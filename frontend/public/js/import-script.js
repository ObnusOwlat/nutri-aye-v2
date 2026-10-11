/**
 * Import script for calories-in database
 * Run this in browser console on Nutri Aye
 */

const CATEGORY_MAP = {
    100: 'poultry',
    101: 'beef',
    102: 'pork',
    103: 'protein',
    104: 'dairy',
    105: 'carbs',
    106: 'vegetables',
    107: 'vegetables',
    108: 'fruits',
    109: 'fats',
    110: 'baked',
    111: 'mixed',
    500: 'dairy',
    600: 'protein',
    700: 'mixed',
    800: 'mixed',
    900: 'mixed',
    1000: 'mixed',
    1100: 'mixed',
    1200: 'mixed'
};

// Built-in foods data
const builtInFoods = [
    // Poultry
    { file: 'poultry', category: 'poultry', categoryId: 100 },
    // Beef
    { file: 'beef', category: 'beef', categoryId: 101 },
    // Pork
    { file: 'pork', category: 'pork', categoryId: 102 },
    // Fish
    { file: 'finfishAndShellFish', category: 'protein', categoryId: 103 },
    // Dairy
    { file: 'dairyAndEggs', category: 'dairy', categoryId: 500 },
    // Grains
    { file: 'grainsAndPasta', category: 'carbs', categoryId: 105 },
    // Vegetables
    { file: 'vegetables', category: 'vegetables', categoryId: 106 },
    // Legumes
    { file: 'legumesAndLegumeProducts', category: 'protein', categoryId: 107 },
    // Fruits
    { file: 'fruitsAndJuices', category: 'fruits', categoryId: 108 },
    // Nuts
    { file: 'nutAndSeedProducts', category: 'fats', categoryId: 109 },
    // Fats
    { file: 'fatsAndOils', category: 'fats', categoryId: 110 },
    // Baked
    { file: 'bakedProducts', category: 'carbs', categoryId: 110 },
    // Sauces
    { file: 'saucesAndSoups', category: 'mixed', categoryId: 111 },
    // Spices
    { file: 'spicesAndHerbs', category: 'mixed', categoryId: 111 },
    // Snacks
    { file: 'sweetsAndSnacks', category: 'mixed', categoryId: 111 },
    // Beverages
    { file: 'beverages', category: 'mixed', categoryId: 111 }
];

// Function to convert calories-in format to Nutri Aye format
function convertFood(food, category) {
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

function generateId() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Export for browser use
window.importCaloriesInFoods = function(foodsData) {
    const ingredients = foodsData.map(food => convertFood(food, 'protein'));
    
    // Get existing ingredients
    const existing = JSON.parse(localStorage.getItem('mp_ingredients_v1') || '[]');
    
    // Merge (don't duplicate by name)
    const existingNames = new Set(existing.map(i => i.name.toLowerCase()));
    const newIngredients = ingredients.filter(i => !existingNames.has(i.name.toLowerCase()));
    
    const merged = [...existing, ...newIngredients];
    
    localStorage.setItem('mp_ingredients_v1', JSON.stringify(merged));
    
    return {
        imported: newIngredients.length,
        total: merged.length,
        skipped: existingNames.size
    };
};

console.log('Import script loaded. Use: window.importCaloriesInFoods([...foods])');
