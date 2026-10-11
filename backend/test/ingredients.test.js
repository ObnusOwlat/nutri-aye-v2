const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, db, seedNutrients, createIngredient } = require('./helpers');

test('create, read, update and delete an ingredient', async () => {
    const created = await createIngredient({ name: 'Limón', category: 'fruits', kcalPer100g: 29 });
    assert.equal(created.name, 'Limón');
    assert.equal(created.category, 'fruits');
    assert.equal(created.kcalPer100g, 29);

    const read = await api().get(`/api/ingredients/${created.id}`);
    assert.equal(read.status, 200);
    assert.deepEqual(read.body.data.nutrients, []);
    assert.deepEqual(read.body.data.portions, []);

    const updated = await api().put(`/api/ingredients/${created.id}`).send({ kcalPer100g: 30 });
    assert.equal(updated.body.data.kcalPer100g, 30);

    const del = await api().delete(`/api/ingredients/${created.id}`);
    assert.equal(del.status, 200);
    const gone = await api().get(`/api/ingredients/${created.id}`);
    assert.equal(gone.status, 404);
});

test('ingredient validation', async () => {
    assert.equal((await api().post('/api/ingredients').send({ name: '' })).status, 400);
    assert.equal((await api().post('/api/ingredients').send({ name: 'X', category: 'snack' })).status, 400);
    assert.equal((await api().post('/api/ingredients').send({ name: 'X', kcalPer100g: -1 })).status, 400);
    const ing = await createIngredient({ name: 'Y' });
    assert.equal((await api().put(`/api/ingredients/${ing.id}`).send({ category: 'lunch' })).status, 400);
});

test('search ignores accents and matches every word, in Spanish or English', async () => {
    const lemon = await createIngredient({ name: 'Limones, crudos', category: 'fruits' });
    db.prepare("UPDATE ingredients SET name_en = 'Lemons, raw', source = 'usda_sr_legacy' WHERE id = ?").run(lemon.id);
    await createIngredient({ name: 'Pollo, pechuga, asada', category: 'protein' });

    const byAccent = await api().get('/api/ingredients?search=limon');
    assert.deepEqual(byAccent.body.data.map(i => i.name), ['Limones, crudos']);
    const byEnglish = await api().get('/api/ingredients?search=lemons');
    assert.equal(byEnglish.body.data.length, 1);
    const anyOrder = await api().get('/api/ingredients?search=pechuga%20pollo');
    assert.equal(anyOrder.body.data.length, 1);
    const bySource = await api().get('/api/ingredients?source=usda');
    assert.ok(bySource.body.data.every(i => i.source.startsWith('usda')));
    assert.ok(bySource.body.pagination.total >= 1);
});

test('bulk import generates its own ids and validates categories', async () => {
    const res = await api().post('/api/ingredients/bulk').send({
        ingredients: [{ id: 'forced-id', name: 'Bulk A', category: 'protein', kcalPer100g: 100 }, { name: 'Bulk B', category: 'nope' }]
    });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.count, 2);
    assert.equal(db.prepare("SELECT COUNT(*) c FROM ingredients WHERE id = 'forced-id'").get().c, 0);
    assert.equal(db.prepare("SELECT category_id FROM ingredients WHERE name = 'Bulk B'").get().category_id, 'mixed');
});

test('nutrient catalog and richest-in-nutrient ranking', async () => {
    seedNutrients();
    const a = await createIngredient({ name: 'Espinaca', category: 'vegetables' });
    const b = await createIngredient({ name: 'Lechuga', category: 'vegetables' });
    db.prepare('INSERT INTO ingredient_nutrients (ingredient_id, nutrient_id, amount) VALUES (?, 1089, 2.7), (?, 1089, 0.9)').run(a.id, b.id);

    const catalog = await api().get('/api/nutrients?group=minerals');
    assert.equal(catalog.body.data[0].name, 'Hierro');
    assert.equal(catalog.body.data[0].nameEn, 'Iron, Fe');

    const top = await api().get('/api/nutrients/1089/ingredients?category=vegetables&limit=5');
    assert.deepEqual(top.body.data.map(i => i.name), ['Espinaca', 'Lechuga']);
    assert.equal(top.body.data[0].amountPer100g, 2.7);
    assert.equal((await api().get('/api/nutrients/999999/ingredients')).status, 404);

    const detail = await api().get(`/api/ingredients/${a.id}`);
    assert.equal(detail.body.data.nutrients[0].name, 'Hierro');
});

test('missing ingredients return 404; deactivating a food keeps the recipes that use it', async () => {
    assert.equal((await api().put('/api/ingredients/nope').send({ kcalPer100g: 1 })).status, 404);
    assert.equal((await api().delete('/api/ingredients/nope')).status, 404);
    const ing = await createIngredient({ name: 'En uso' });
    await api().post('/api/recipes').send({ name: 'R', category: 'lunch', ingredients: [{ ingredientId: ing.id, grams: 10 }] });
    const recipe = (await api().get('/api/recipes?search=R')).body.data.find(r => r.name === 'R');
    assert.equal((await api().delete(`/api/ingredients/${ing.id}`)).status, 200);
    assert.equal((await api().get(`/api/ingredients/${ing.id}`)).status, 404);
    assert.ok(!(await api().get('/api/ingredients?search=en%20uso')).body.data.length);
    // The recipe still sums it, and the row is still in the database
    assert.ok((await api().get(`/api/recipes/${recipe.id}`)).body.data.nutrition.calories > 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM ingredients WHERE id = ?').get(ing.id).n, 1);
    assert.equal((await api().post(`/api/ingredients/${ing.id}/reactivate`)).status, 200);
});

test('updating one vitamin keeps the rest (every nutrient column is writable)', async () => {
    const ing = await createIngredient({ name: 'Naranja', vitaminCPer100g: 53, ironPer100g: 0.1 });
    const updated = await api().put(`/api/ingredients/${ing.id}`).send({ vitaminCPer100g: 50 });
    assert.equal(updated.body.data.vitaminCPer100g, 50);
    assert.equal(updated.body.data.ironPer100g, 0.1);
    assert.equal(updated.body.data.kcalPer100g, 130);
});

test('validation errors are in Spanish and name the field', async () => {
    const res = await api().post('/api/ingredients').send({ name: 'X', kcalPer100g: 'mucho' });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'VALIDATION_ERROR');
    assert.equal(res.body.details[0].field, 'kcalPer100g');
});
