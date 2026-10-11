// Fase 6: food catalog — details with key nutrients and Spanish portions, scopes, duplicate
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, db, seedNutrients, createIngredient, sessionFor } = require('./helpers');

function catalogFood() {
    seedNutrients();
    db.prepare(`INSERT OR IGNORE INTO nutrients (id, name, name_es, unit, rank, nutrient_group) VALUES
        (1003, 'Protein', 'Proteínas', 'g', 600, 'proximates'), (1162, 'Vitamin C, total ascorbic acid', 'Vitamina C', 'mg', 6300, 'vitamins'),
        (1258, 'Fatty acids, total saturated', 'Ácidos grasos saturados totales', 'g', 9700, 'lipids')`).run();
    db.prepare("INSERT INTO ingredients (id, name, name_en, category_id, source, kcal_per_100g, protein_per_100g) VALUES ('usda-orange', 'Naranja, cruda', 'Oranges, raw', 'fruits', 'usda_sr_legacy', 47, 0.9)").run();
    db.prepare("INSERT INTO ingredient_nutrients (ingredient_id, nutrient_id, amount) VALUES ('usda-orange', 1008, 47), ('usda-orange', 1003, 0.94), ('usda-orange', 1162, 53.2), ('usda-orange', 1089, 0.1)").run();
    db.prepare("INSERT INTO ingredient_portions (ingredient_id, sequence, amount, unit, modifier, gram_weight) VALUES ('usda-orange', 1, 1, NULL, 'cup, sections', 180), ('usda-orange', 2, 1, NULL, 'large (3-1/16\" dia)', 184)").run();
}

test('food details: key nutrients first, every nutrient, portions in Spanish', async () => {
    catalogFood();
    const food = (await api().get('/api/ingredients/usda-orange')).body.data;
    assert.deepEqual(food.keyNutrients.map(n => n.name).slice(0, 2), ['Energía', 'Proteínas']);
    assert.ok(food.keyNutrients.some(n => n.name === 'Vitamina C' && n.amount === 53.2));
    assert.equal(food.nutrients.length, 4);
    assert.equal(food.editable, false);
    assert.equal(food.portions[0].gramWeight, 180);
    assert.doesNotMatch(food.portions[0].label, /cup|sections/);
    assert.match(food.portions[0].label, /^1 taza/);
});

test('own foods without USDA rows get key nutrients from their columns', async () => {
    const own = await createIngredient({ name: 'Chipa casera', kcalPer100g: 330, proteinPer100g: 9 });
    const food = (await api().get(`/api/ingredients/${own.id}`)).body.data;
    assert.equal(food.editable, true);
    assert.equal(food.keyNutrients.find(n => n.id === 1008).amount, 330);
});

test('search scope: own foods or the shared catalog', async () => {
    await createIngredient({ name: 'Sopa paraguaya' });
    const own = (await api().get('/api/ingredients?scope=own&limit=100')).body.data;
    const catalog = (await api().get('/api/ingredients?scope=catalog&limit=100')).body.data;
    assert.ok(own.every(i => i.source === 'user'));
    assert.ok(own.some(i => i.name === 'Sopa paraguaya'));
    assert.ok(!catalog.some(i => i.name === 'Sopa paraguaya'));
});

test('duplicate and edit: an own copy with every nutrient and portion; catalog untouched', async () => {
    const copy = (await api().post('/api/ingredients/usda-orange/duplicate').send({ name: 'Naranja del Chaco' })).body.data;
    assert.equal(copy.name, 'Naranja del Chaco');
    assert.equal(copy.source, 'user');
    const details = (await api().get(`/api/ingredients/${copy.id}`)).body.data;
    assert.equal(details.editable, true);
    assert.equal(details.nutrients.length, 4);
    assert.equal(details.portions.length, 2);
    await api().put(`/api/ingredients/${copy.id}`).send({ kcalPer100g: 50 });
    assert.equal(db.prepare("SELECT kcal_per_100g FROM ingredients WHERE id = 'usda-orange'").get().kcal_per_100g, 47);
    // Another consultorio does not see the copy
    const other = sessionFor('admin');
    assert.equal((await api(other).get(`/api/ingredients/${copy.id}`)).status, 404);
    assert.equal((await api().post('/api/ingredients/no-existe/duplicate').send({})).status, 404);
    const history = (await api().get('/api/activity?entity=ingredient&action=create')).body.data;
    assert.ok(history.some(e => e.entityId === copy.id));
});
