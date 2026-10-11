const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, db, createIngredient, createPatient, createRecipe } = require('./helpers');

test('weekly planner per patient with all six meal types', async () => {
    const p = await createPatient();
    const rice = await createIngredient({ name: 'Arroz P' });
    const recipe = await createRecipe(rice.id, { name: 'Arroz P' });

    assert.equal((await api().post('/api/planner').send({})).status, 400);
    assert.equal((await api().post('/api/planner').send({ patientId: 'nope' })).status, 400);

    const planner = (await api().post('/api/planner').send({ patientId: p.id })).body.data;
    const meals = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'snack', 'dinner']
        .map(mealType => ({ day: 'monday', mealType, recipeId: recipe.id }));
    assert.equal((await api().put(`/api/planner/${planner.id}`).send({ meals })).status, 200);

    const list = await api().get(`/api/planner?patientId=${p.id}`);
    assert.equal(list.body.data[0].meals.length, 6);
    assert.equal(list.body.data[0].meals[0].recipeName, 'Arroz P');
    assert.equal(list.body.data[0].meals[0].mealType, 'breakfast');
    assert.equal(list.body.data[0].patientId, p.id);

    // Invalid day: 400 and the saved week is untouched
    const badDay = await api().put(`/api/planner/${planner.id}`).send({ meals: [{ day: 'funday', mealType: 'lunch' }] });
    assert.equal(badDay.status, 400);
    assert.equal((await api().get(`/api/planner?patientId=${p.id}`)).body.data[0].meals.length, 6);

    // Unknown recipe (only in a browser): skipped and reported, the rest is saved
    const partial = await api().put(`/api/planner/${planner.id}`).send({
        meals: [{ day: 'monday', mealType: 'lunch', recipeId: 'solo-local' }, { day: 'tuesday', mealType: 'lunch', recipeId: recipe.id }]
    });
    assert.equal(partial.status, 200);
    assert.equal(partial.body.skippedMeals, 1);
    assert.equal(partial.body.data.meals.length, 1);
    assert.equal((await api().put('/api/planner/nope').send({ meals: [] })).status, 404);

    assert.equal((await api().delete(`/api/planner/${planner.id}`)).status, 200);
    assert.equal((await api().get(`/api/planner?patientId=${p.id}`)).body.data.length, 0);
});

test('sync pull: library ingredients plus USDA foods used in recipes, patients with metrics', async () => {
    const own = await createIngredient({ name: 'Propio' });
    const usdaUsed = await createIngredient({ name: 'USDA usado' });
    const usdaUnused = await createIngredient({ name: 'USDA sin usar' });
    db.prepare("UPDATE ingredients SET source = 'usda_sr_legacy' WHERE id IN (?, ?)").run(usdaUsed.id, usdaUnused.id);
    await createRecipe(usdaUsed.id, { name: 'Con USDA' });
    const p = await createPatient({ firstName: 'Sync' });
    await api().post(`/api/patients/${p.id}/metrics`).send({ weight: 60, height: 160 });

    const pull = (await api().get('/api/sync/pull')).body.data;
    const ids = pull.ingredients.map(i => i.id);
    assert.ok(ids.includes(own.id));
    assert.ok(ids.includes(usdaUsed.id));
    assert.ok(!ids.includes(usdaUnused.id));
    assert.ok(pull.patients.some(x => x.id === p.id));
    assert.ok(pull.patientMetrics.some(m => m.patientId === p.id));
    assert.equal(pull.weekPlan, undefined);
    const recipe = pull.recipes.find(r => r.name === 'Con USDA');
    assert.ok(recipe.nutrition.calories > 0);
});

test('stats', async () => {
    const stats = await api().get('/api/stats');
    assert.equal(stats.body.success, true);
    assert.equal(typeof stats.body.data.ingredients, 'number');
});
