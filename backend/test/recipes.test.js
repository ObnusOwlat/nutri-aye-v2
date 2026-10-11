const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, db, seedNutrients, createIngredient, createRecipe } = require('./helpers');

test('recipe CRUD with nutrition totals', async () => {
    const rice = await createIngredient();
    const recipe = await createRecipe(rice.id);
    assert.equal(recipe.name, 'Arroz');

    const list = await api().get('/api/recipes');
    const fromList = list.body.data.find(r => r.id === recipe.id);
    assert.equal(Math.round(fromList.nutrition.calories), 260);

    const detail = await api().get(`/api/recipes/${recipe.id}`);
    assert.equal(Math.round(detail.body.data.nutrition.calories), 260);
    assert.deepEqual(detail.body.data.ingredients.map(i => i.grams), [200]);

    const updated = await api().put(`/api/recipes/${recipe.id}`).send({
        name: 'Arroz doble', category: 'dinner', ingredients: [{ ingredientId: rice.id, grams: 400 }]
    });
    assert.equal(updated.status, 200);
    const again = await api().get(`/api/recipes/${recipe.id}`);
    assert.equal(Math.round(again.body.data.nutrition.calories), 520);
    assert.equal(again.body.data.category, 'dinner');

    assert.equal((await api().delete(`/api/recipes/${recipe.id}`)).status, 200);
    assert.equal((await api().get(`/api/recipes/${recipe.id}`)).status, 404);
});

test('recipe validation', async () => {
    const rice = await createIngredient({ name: 'Arroz 2' });
    const noIngredients = await api().post('/api/recipes').send({ name: 'Vacía', category: 'lunch', ingredients: [] });
    assert.equal(noIngredients.status, 400);
    const badIngredient = await api().post('/api/recipes').send({ name: 'Mala', category: 'lunch', ingredients: [{ ingredientId: 'nope', grams: 10 }] });
    assert.equal(badIngredient.status, 400);
    const badCategory = await api().post('/api/recipes').send({ name: 'X', category: 'protein', ingredients: [{ ingredientId: rice.id, grams: 10 }] });
    assert.equal(badCategory.status, 400);
});

test('recipe detail sums every nutrient', async () => {
    seedNutrients();
    const spinach = await createIngredient({ name: 'Espinaca R', category: 'vegetables', kcalPer100g: 23 });
    db.prepare('INSERT INTO ingredient_nutrients (ingredient_id, nutrient_id, amount) VALUES (?, 1089, 2.7)').run(spinach.id);
    const recipe = await createRecipe(spinach.id, { name: 'Ensalada', ingredients: [{ ingredientId: spinach.id, grams: 50 }] });
    const detail = await api().get(`/api/recipes/${recipe.id}`);
    const iron = detail.body.data.nutrients.find(n => n.id === 1089);
    assert.equal(iron.amount, 1.35);
});

test('recipe 404s, partial update and repeated ingredients', async () => {
    assert.equal((await api().put('/api/recipes/nope').send({ name: 'X' })).status, 404);
    assert.equal((await api().delete('/api/recipes/nope')).status, 404);
    const rice = await createIngredient({ name: 'Arroz 3' });
    const recipe = await createRecipe(rice.id, { name: 'Parcial', ingredients: [{ ingredientId: rice.id, grams: 100 }, { ingredientId: rice.id, grams: 50 }] });
    assert.deepEqual(recipe.ingredients.map(i => i.grams), [150]);

    // Only notes change: name, category and ingredients stay
    const updated = (await api().put(`/api/recipes/${recipe.id}`).send({ notes: 'Sin sal' })).body.data;
    assert.equal(updated.name, 'Parcial');
    assert.equal(updated.notes, 'Sin sal');
    assert.equal(updated.ingredients.length, 1);

    // A bad ingredient rejects the whole update
    const bad = await api().put(`/api/recipes/${recipe.id}`).send({ name: 'Rota', ingredients: [{ ingredientId: 'nope', grams: 10 }] });
    assert.equal(bad.status, 400);
    assert.equal((await api().get(`/api/recipes/${recipe.id}`)).body.data.name, 'Parcial');
});
