#!/usr/bin/env python3
"""
Export calories-in database to Nutri Aye format
"""

import json
import os
import random
import string

CATEGORY_MAP = {
    100: 'protein',    # poultry
    101: 'protein',     # beef
    102: 'protein',     # pork
    103: 'protein',     # fish
    104: 'dairy',       # dairy
    105: 'carbs',       # grains
    106: 'vegetables',  # vegetables
    107: 'protein',     # legumes
    108: 'fruits',      # fruits
    109: 'fats',        # nuts
    110: 'fats',        # fats
    111: 'mixed',       # baked
    112: 'mixed',       # sauces
    113: 'mixed',       # spices
    114: 'mixed',       # snacks
    115: 'mixed',       # beverages
    500: 'dairy',       # dairy
    600: 'protein',     # meat
    700: 'mixed',       # prepared
}

def generate_id():
    """Generate UUID-like ID"""
    return ''.join(random.choice(string.ascii_lowercase + string.digits) for _ in range(36)).replace(' ', '')

def convert_food(food):
    """Convert calories-in format to Nutri Aye format"""
    category_id = food.get('categoryId', 500)
    category = CATEGORY_MAP.get(category_id, 'mixed')
    
    return {
        'id': generate_id(),
        'name': food.get('name', ''),
        'category': category,
        'unit': 'g',
        'kcalPer100g': food.get('energy', 0),
        'proteinPer100g': food.get('protein', 0),
        'carbsPer100g': food.get('carbs', 0),
        'fatPer100g': food.get('fat', 0),
        'saturatedFatPer100g': food.get('saturatedFat', 0),
        'polyunsaturatedFatPer100g': food.get('polyunsaturatedFat', 0),
        'monounsaturatedFatPer100g': food.get('monounsaturatedFat', 0),
        'sugarPer100g': food.get('sugar', 0),
        'fiberPer100g': food.get('fiber', 0),
        'cholesterolPer100g': food.get('cholesterol', 0),
        'sodiumPer100g': food.get('sodium', 0),
        'vitaminAPer100g': food.get('vitaminA', 0),
        'vitaminB1Per100g': food.get('vitaminB1', 0),
        'vitaminB2Per100g': food.get('vitaminB2', 0),
        'vitaminB3Per100g': food.get('vitaminB3', 0),
        'vitaminB5Per100g': food.get('vitaminB5', 0),
        'vitaminB6Per100g': food.get('vitaminB6', 0),
        'vitaminB9Per100g': food.get('vitaminB9', 0),
        'vitaminB12Per100g': food.get('vitaminB12', 0),
        'vitaminCPer100g': food.get('vitaminC', 0),
        'vitaminDPer100g': food.get('vitaminD', 0),
        'vitaminEPer100g': food.get('vitaminE', 0),
        'vitaminKPer100g': food.get('vitaminK', 0),
        'magnesiumPer100g': food.get('magnesium', 0),
        'calciumPer100g': food.get('calcium', 0),
        'phosphorusPer100g': food.get('phosphorus', 0),
        'potassiumPer100g': food.get('potassium', 0),
        'ironPer100g': food.get('iron', 0),
        'seleniumPer100g': food.get('selenium', 0),
        'zincPer100g': food.get('zinc', 0),
        'manganesePer100g': food.get('manganese', 0),
        'copperPer100g': food.get('copper', 0),
    }

# Source directory
source_dir = '/home/monitoreo/Documentos/app/calories-in/src/foods/builtIn'

# Food files to process
food_files = [
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
]

all_ingredients = []

print('Converting foods...\n')

for file in food_files:
    source_path = os.path.join(source_dir, file)
    if os.path.exists(source_path):
        with open(source_path, 'r') as f:
            data = json.load(f)
        converted = [convert_food(food) for food in data]
        all_ingredients.extend(converted)
        print(f'{file}: {len(converted)} ingredients')
    else:
        print(f'{file}: FILE NOT FOUND')

print(f'\nTotal ingredients: {len(all_ingredients)}')

# Save as JSON
output_dir = '/home/monitoreo/opencode/OpenAgentsControl/meal-prep-planner/foods-data'
os.makedirs(output_dir, exist_ok=True)

output_path = os.path.join(output_dir, 'calories-in-ingredients.json')
with open(output_path, 'w') as f:
    json.dump(all_ingredients, f, indent=2)
print(f'\nSaved to: {output_path}')

# Create import script for browser
import_script = '''// Nutri Aye - Import Calories-in Database
// Run this in browser console on Nutri Aye

const IMPORT_DATA = %s;

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
''' % json.dumps(all_ingredients)

import_script_path = os.path.join(output_dir, 'import-to-nutriaye.js')
with open(import_script_path, 'w') as f:
    f.write(import_script)
print(f'Import script saved to: {import_script_path}')

print('\nTo import:')
print('1. Open Nutri Aye in browser')
print('2. Open Developer Console (F12)')
print('3. Copy and paste the contents of import-to-nutriaye.js')
print('4. Refresh the page')
