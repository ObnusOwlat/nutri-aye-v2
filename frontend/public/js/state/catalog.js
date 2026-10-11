/**
 * state/catalog.js - Foods and recipes of the consultorio (saved in the server).
 * Catalog foods (USDA, calories-in) are read-only: the server answers 403.
 */

Object.assign(State, (function() {
    const S = State;

    // Full nutrition from the foods; the server's macros when a food is missing here
    const withNutrition = (recipe) => {
        const complete = recipe.ingredients?.every(ri => S._find('ingredients', ri.ingredientId));
        return { ...recipe, nutrition: complete ? S.calculateRecipeNutrition(recipe) : { ...S.getEmptyNutritionObject(), ...recipe.nutrition } };
    };
    S._onLoad(() => S._replaceAll('recipes', S._data.recipes.map(withNutrition)));

    const changed = (list, event) => S.emit(event, S._data[list]);

    // --- Foods
    const getIngredients = () => [...S._data.ingredients];
    const getIngredient = (id) => S._find('ingredients', id);

    async function addIngredient(data) {
        const ingredient = S._put('ingredients', await S._api('POST', '/api/ingredients', data));
        changed('ingredients', 'ingredients:updated');
        S.emit('ingredients:added', ingredient);
        return ingredient;
    }

    async function updateIngredient(id, data) {
        const ingredient = S._put('ingredients', await S._api('PUT', `/api/ingredients/${encodeURIComponent(id)}`, data));
        changed('ingredients', 'ingredients:updated');
        return ingredient;
    }

    // Deactivated in the server; recipes that use it keep their nutrition
    async function deleteIngredient(id) {
        await S._api('DELETE', `/api/ingredients/${encodeURIComponent(id)}`);
        S._drop('ingredients', id);
        changed('ingredients', 'ingredients:updated');
        return true;
    }

    // A catalog food (USDA) chosen in a recipe: kept in this copy so the recipe can sum it
    const cacheIngredient = (ingredient) => {
        if (!ingredient?.id || S._find('ingredients', ingredient.id)) return;
        S._put('ingredients', ingredient);
        changed('ingredients', 'ingredients:updated');
    };

    // CSV/JSON import: new foods of the consultorio (ids are always new)
    async function importIngredients(list) {
        const valid = list.filter(i => i.name && i.kcalPer100g !== undefined && i.kcalPer100g !== '');
        const errors = list.filter(i => !valid.includes(i)).map(i => ({ name: i.name || 'sin nombre', error: 'Faltan datos' }));
        if (!valid.length) return { imported: [], skipped: [], errors };
        await S._api('POST', '/api/ingredients/bulk', { ingredients: valid });
        S._replaceAll('ingredients', await S._api('GET', '/api/bootstrap').then(all => all.ingredients));
        changed('ingredients', 'ingredients:updated');
        return { imported: valid, skipped: [], errors };
    }

    // --- Recipes
    const getRecipes = () => [...S._data.recipes];
    const getRecipe = (id) => S._find('recipes', id);
    const getRecipesByCategory = (cat) => (cat === 'all' ? getRecipes() : S._data.recipes.filter(r => r.category === cat));

    const recipeBody = (data) => ({
        name: data.name?.trim(),
        category: data.category,
        instructions: data.instructions,
        notes: data.notes,
        ingredients: data.ingredients?.map(ri => ({ ingredientId: ri.ingredientId, grams: Number(ri.grams) || 100 }))
    });

    async function addRecipe(data) {
        const recipe = S._put('recipes', withNutrition(await S._api('POST', '/api/recipes', recipeBody(data))));
        changed('recipes', 'recipes:updated');
        S.emit('recipes:added', recipe);
        return recipe;
    }

    async function updateRecipe(id, data) {
        const recipe = S._put('recipes', withNutrition(await S._api('PUT', `/api/recipes/${encodeURIComponent(id)}`, recipeBody(data))));
        changed('recipes', 'recipes:updated');
        return recipe;
    }

    // Deactivated in the server; weeks and plans that use it keep it
    async function deleteRecipe(id) {
        await S._api('DELETE', `/api/recipes/${encodeURIComponent(id)}`);
        S._drop('recipes', id);
        changed('recipes', 'recipes:updated');
        return true;
    }

    return {
        getIngredients, getIngredient, addIngredient, updateIngredient, deleteIngredient, cacheIngredient,
        importIngredients, importIngredientsFull: importIngredients,
        getRecipes, getRecipe, getRecipesByCategory, addRecipe, updateRecipe, deleteRecipe
    };
})());
