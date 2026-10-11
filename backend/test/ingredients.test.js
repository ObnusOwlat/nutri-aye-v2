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
    assert.equal(res.body.count, 2);
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
