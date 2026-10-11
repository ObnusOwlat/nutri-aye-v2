/**
 * state/nutrition.js - Nutrition totals of recipes, days and weeks, from the
 * per-100 g values of each food
 */

Object.assign(State, (function() {
    // Empty nutrition object template
    const getEmptyNutritionObject = () => ({
        calories: 0, protein: 0, carbs: 0, fat: 0,
        saturatedFat: 0, polyunsaturatedFat: 0, monounsaturatedFat: 0,
        fiber: 0, sugar: 0, cholesterol: 0, sodium: 0,
        vitaminA: 0, vitaminB1: 0, vitaminB2: 0, vitaminB3: 0,
        vitaminB5: 0, vitaminB6: 0, vitaminB9: 0, vitaminB12: 0,
        vitaminC: 0, vitaminD: 0, vitaminE: 0, vitaminK: 0,
        calcium: 0, iron: 0, magnesium: 0, phosphorus: 0,
        potassium: 0, zinc: 0, selenium: 0, manganese: 0, copper: 0, choline: 0
    });

    // Calculate full nutrition for a recipe
    const calculateRecipeNutrition = (recipe) => {
        if (!recipe?.ingredients?.length) {
            return getEmptyNutritionObject();
        }
        return recipe.ingredients.reduce((totals, ri) => {
            const ing = State._find('ingredients', ri.ingredientId);
            if (!ing) return totals;
            const factor = ri.grams / 100;
            return {
                calories: totals.calories + (ing.kcalPer100g * factor),
                protein: totals.protein + ((ing.proteinPer100g || 0) * factor),
                carbs: totals.carbs + ((ing.carbsPer100g || 0) * factor),
                fat: totals.fat + ((ing.fatPer100g || 0) * factor),
                saturatedFat: totals.saturatedFat + ((ing.saturatedFatPer100g || 0) * factor),
                polyunsaturatedFat: totals.polyunsaturatedFat + ((ing.polyunsaturatedFatPer100g || 0) * factor),
                monounsaturatedFat: totals.monounsaturatedFat + ((ing.monounsaturatedFatPer100g || 0) * factor),
                fiber: totals.fiber + ((ing.fiberPer100g || 0) * factor),
                sugar: totals.sugar + ((ing.sugarPer100g || 0) * factor),
                cholesterol: totals.cholesterol + ((ing.cholesterolPer100g || 0) * factor),
                sodium: totals.sodium + ((ing.sodiumPer100g || 0) * factor),
                vitaminA: totals.vitaminA + ((ing.vitaminAPer100g || 0) * factor),
                vitaminB1: totals.vitaminB1 + ((ing.vitaminB1Per100g || 0) * factor),
                vitaminB2: totals.vitaminB2 + ((ing.vitaminB2Per100g || 0) * factor),
                vitaminB3: totals.vitaminB3 + ((ing.vitaminB3Per100g || 0) * factor),
                vitaminB5: totals.vitaminB5 + ((ing.vitaminB5Per100g || 0) * factor),
                vitaminB6: totals.vitaminB6 + ((ing.vitaminB6Per100g || 0) * factor),
                vitaminB9: totals.vitaminB9 + ((ing.vitaminB9Per100g || 0) * factor),
                vitaminB12: totals.vitaminB12 + ((ing.vitaminB12Per100g || 0) * factor),
                vitaminC: totals.vitaminC + ((ing.vitaminCPer100g || 0) * factor),
                vitaminD: totals.vitaminD + ((ing.vitaminDPer100g || 0) * factor),
                vitaminE: totals.vitaminE + ((ing.vitaminEPer100g || 0) * factor),
                vitaminK: totals.vitaminK + ((ing.vitaminKPer100g || 0) * factor),
                calcium: totals.calcium + ((ing.calciumPer100g || 0) * factor),
                iron: totals.iron + ((ing.ironPer100g || 0) * factor),
                magnesium: totals.magnesium + ((ing.magnesiumPer100g || 0) * factor),
                phosphorus: totals.phosphorus + ((ing.phosphorusPer100g || 0) * factor),
                potassium: totals.potassium + ((ing.potassiumPer100g || 0) * factor),
                zinc: totals.zinc + ((ing.zincPer100g || 0) * factor),
                selenium: totals.selenium + ((ing.seleniumPer100g || 0) * factor),
                manganese: totals.manganese + ((ing.manganesePer100g || 0) * factor),
                copper: totals.copper + ((ing.copperPer100g || 0) * factor),
                choline: totals.choline + ((ing.cholinePer100g || 0) * factor)
            };
        }, getEmptyNutritionObject());
    };

    // Calculate nutrition for a single meal (recipe ID)
    const calculateMealNutrition = (recipeId) => {
        if (!recipeId) return getEmptyNutritionObject();
        const recipe = State._find('recipes', recipeId);
        return recipe ? calculateRecipeNutrition(recipe) : getEmptyNutritionObject();
    };

    // Calculate daily nutrition from a day object { breakfast, lunch, snack, dinner }
    const calculateDayNutrition = (dayMeals) => {
        const totals = getEmptyNutritionObject();
        if (!dayMeals) return totals;
        
        for (const mealType of State.VALID_MEAL_TYPES) {
            const recipeId = dayMeals[mealType];
            if (recipeId) {
                const mealNutrition = calculateMealNutrition(recipeId);
                for (const key of Object.keys(totals)) {
                    totals[key] += mealNutrition[key];
                }
            }
        }
        return totals;
    };

    // Calculate weekly nutrition from a weekPlan object
    const calculateWeekNutrition = (weekPlan) => {
        const totals = getEmptyNutritionObject();
        if (!weekPlan) return totals;
        
        for (const day of State.DAYS) {
            if (weekPlan[day]) {
                const dayNutrition = calculateDayNutrition(weekPlan[day]);
                for (const key of Object.keys(totals)) {
                    totals[key] += dayNutrition[key];
                }
            }
        }
        return totals;
    };

    return { getEmptyNutritionObject, calculateRecipeNutrition, calculateMealNutrition, calculateDayNutrition, calculateWeekNutrition };
})());
