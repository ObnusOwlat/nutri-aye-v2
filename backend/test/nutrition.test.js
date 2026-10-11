const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, db, admin, sessionFor, seedNutrients, createIngredient, createRecipe } = require('./helpers');

const analyze = (body, session) => api(session).post('/api/nutrition/analyze').send(body);
const addNutrient = (ingredientId, nutrientId, amount) =>
    db.prepare('INSERT INTO ingredient_nutrients (ingredient_id, nutrient_id, amount) VALUES (?, ?, ?)').run(ingredientId, nutrientId, amount);

test('analyze sums key nutrients per recipe, with column and duplicate-id fallbacks', async () => {
    seedNutrients();
    db.prepare(`INSERT OR IGNORE INTO nutrients (id, name, name_es, unit, rank, nutrient_group)
                VALUES (2047, 'Energy (Atwater)', 'Energía (Atwater)', 'kcal', 280, 'energy'),
                       (1051, 'Water', 'Agua', 'g', 100, 'proximates')`).run();

    // Own food: no USDA rows, kcal comes from its column (130 per 100 g)
    const rice = await createIngredient({ name: 'Arroz N' });
    // USDA-like food: kcal only under the duplicate id, plus iron and water
    const spinach = await createIngredient({ name: 'Espinaca N', category: 'vegetables', kcalPer100g: 0 });
    addNutrient(spinach.id, 2047, 20);
    addNutrient(spinach.id, 1089, 2.7);
    addNutrient(spinach.id, 1051, 90);

    const recipe = await createRecipe(rice.id, {
        name: 'Arroz con espinaca',
        ingredients: [{ ingredientId: rice.id, grams: 200 }, { ingredientId: spinach.id, grams: 50 }]
    });

    const res = await analyze({ recipeIds: [recipe.id, recipe.id] });
    assert.equal(res.status, 200);
    const { nutrients, recipes } = res.body.data;
    assert.equal(recipes[recipe.id][1008], 270);   // 260 rice + 10 spinach
    assert.equal(recipes[recipe.id][1089], 1.35);
    assert.equal(recipes[recipe.id][1051], 45);

    assert.equal(nutrients.find(n => n.id === 1008).key, true);
    assert.equal(nutrients.find(n => n.id === 1051).key, false);
    assert.ok(!nutrients.some(n => n.id === 2047), 'duplicate id folded into Energía');
    assert.deepEqual(res.body.skipped, []);
});

test('analyze skips recipes of another consultorio and validates the body', async () => {
    const other = sessionFor('admin');
    const rice = await createIngredient({ name: 'Arroz O' });
    const mine = await createRecipe(rice.id, { name: 'Mía' });
    const theirRice = (await api(other).post('/api/ingredients').send({
        name: 'Arroz ajeno', category: 'carbs', kcalPer100g: 130
    })).body.data;
    const theirs = (await api(other).post('/api/recipes').send({
        name: 'Ajena', category: 'lunch', ingredients: [{ ingredientId: theirRice.id, grams: 100 }]
    })).body.data;

    const res = await analyze({ recipeIds: [mine.id, theirs.id, 'nope'] });
    assert.equal(res.status, 200);
    assert.deepEqual(Object.keys(res.body.data.recipes), [mine.id]);
    assert.deepEqual(res.body.skipped.sort(), [theirs.id, 'nope'].sort());

    assert.equal((await analyze({ recipeIds: [] })).status, 400);
    assert.equal((await analyze({})).status, 400);
    assert.equal((await analyze({ recipeIds: [123] })).status, 400);
});

test('reception of the same consultorio can read the analysis', async () => {
    const rice = await createIngredient({ name: 'Arroz R' });
    const recipe = await createRecipe(rice.id, { name: 'Para recepción' });
    const res = await analyze({ recipeIds: [recipe.id] }, sessionFor('recepcion', admin.orgId));
    assert.equal(res.status, 200);
    assert.equal(res.body.data.recipes[recipe.id][1008], 260);   // 200 g x 130 kcal/100 g
});
