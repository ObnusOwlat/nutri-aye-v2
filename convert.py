#!/usr/bin/env python3
import json
import os
import glob
import uuid

INPUT_DIR = "/home/monitoreo/Documentos/app/calories-in/src/foods/builtIn"
OUTPUT_FILE = "/home/monitoreo/opencode/OpenAgentsControl/meal-prep-planner/frontend/assets/templates/ingredients-full.json"

CATEGORY_MAP = {
    "bakedProducts": "carbs",
    "beef": "protein",
    "beverages": "mixed",
    "dairyAndEggs": "protein",
    "fatsAndOils": "fats",
    "finfishAndShellFish": "protein",
    "fruitsAndJuices": "vegetables",
    "grainsAndPasta": "carbs",
    "legumesAndLegumeProducts": "protein",
    "nutAndSeedProducts": "fats",
    "pork": "protein",
    "poultry": "protein",
    "saucesAndSoups": "mixed",
    "spicesAndHerbs": "vegetables",
    "sweetsAndSnacks": "fats",
    "vegetables": "vegetables",
}

def r(val, default=0):
    return round(val, 2) if val is not None else default

ingredients = []

for json_file in sorted(glob.glob(os.path.join(INPUT_DIR, "*.json"))):
    basename = os.path.basename(json_file).replace(".json", "")
    category = CATEGORY_MAP.get(basename, "mixed")
    
    with open(json_file, "r", encoding="utf-8") as f:
        foods = json.load(f)
    
    for food in foods:
        name = food.get("name", "").strip()
        energy = food.get("energy", 0)
        
        if not name or energy is None:
            continue
        
        ingredients.append({
            "id": str(uuid.uuid4()),
            "name": name,
            "kcalPer100g": r(energy),
            "proteinPer100g": r(food.get("protein")),
            "carbsPer100g": r(food.get("carbs")),
            "fatPer100g": r(food.get("fat")),
            "saturatedFatPer100g": r(food.get("saturatedFat")),
            "polyunsaturatedFatPer100g": r(food.get("polyunsaturatedFat")),
            "monounsaturatedFatPer100g": r(food.get("monounsaturatedFat")),
            "cholesterolPer100g": r(food.get("cholesterol")),
            "sodiumPer100g": r(food.get("sodium")),
            "sugarPer100g": r(food.get("sugar")),
            "fiberPer100g": r(food.get("fiber")),
            "vitaminAPer100g": r(food.get("vitaminA")),
            "vitaminB1Per100g": r(food.get("vitaminB1")),
            "vitaminB2Per100g": r(food.get("vitaminB2")),
            "vitaminB3Per100g": r(food.get("vitaminB3")),
            "vitaminB5Per100g": r(food.get("vitaminB5")),
            "vitaminB6Per100g": r(food.get("vitaminB6")),
            "vitaminB9Per100g": r(food.get("vitaminB9")),
            "vitaminB12Per100g": r(food.get("vitaminB12")),
            "vitaminCPer100g": r(food.get("vitaminC")),
            "vitaminDPer100g": r(food.get("vitaminD")),
            "vitaminEPer100g": r(food.get("vitaminE")),
            "vitaminKPer100g": r(food.get("vitaminK")),
            "calciumPer100g": r(food.get("calcium")),
            "ironPer100g": r(food.get("iron")),
            "magnesiumPer100g": r(food.get("magnesium")),
            "phosphorusPer100g": r(food.get("phosphorus")),
            "potassiumPer100g": r(food.get("potassium")),
            "seleniumPer100g": r(food.get("selenium")),
            "zincPer100g": r(food.get("zinc")),
            "manganesePer100g": r(food.get("manganese")),
            "copperPer100g": r(food.get("copper")),
            "cholinePer100g": r(food.get("choline")),
            "category": category,
            "unit": "g",
        })

os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)

with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(ingredients, f, ensure_ascii=False, indent=2)

print(f"Created {OUTPUT_FILE} with {len(ingredients)} ingredients")

cats = {}
for i in ingredients:
    cats[i["category"]] = cats.get(i["category"], 0) + 1
for c, n in sorted(cats.items()):
    print(f"  {c}: {n}")
