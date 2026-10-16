const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, sessionFor, createIngredient, createPatient, createRecipe } = require('./helpers');
const { tagFood, allergensInText } = require('../src/lib/allergen-tags');

const tags = (name, nameEn = null) => tagFood({ name, nameEn }).map(t => t.allergen).sort();

test('food tags: Open Food Facts terms (longest wins) and local rules', () => {
    assert.deepEqual(tags('Queso, mozzarella', 'Cheese, mozzarella, whole milk'), ['milk']);
    assert.deepEqual(tags('Leche de coco', 'Coconut milk'), []);                 // "coconut milk" hides "milk"
    assert.deepEqual(tags('Manteca de maní'), ['peanuts']);
    assert.deepEqual(tags('Cereales, avena'), ['gluten']);                        // EU: oats count as gluten
    assert.deepEqual(tags('Harina de maíz, integral'), []);
    assert.deepEqual(tags('Salsa de soja'), ['gluten', 'soybeans']);
    assert.deepEqual(tags('Nuez moscada'), []);
    assert.deepEqual(tags('Camarones'), ['crustaceans']);
    assert.deepEqual(allergensInText('Intolerancia a la lactosa'), ['milk']);
    assert.deepEqual(allergensInText('Alergia a mariscos').sort(), ['crustaceans', 'molluscs']);
});

test('own foods are tagged; the consultorio can add or remove an allergen', async () => {
    const pesto = await createIngredient({ name: 'Pesto casero AL', category: 'mixed', kcalPer100g: 400 });
    assert.deepEqual(pesto.allergens, []);
    let res = await api().put(`/api/ingredients/${pesto.id}/allergens`).send({ allergen: 'nuts', present: true });
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.data.map(a => [a.allergen, a.source]), [['nuts', 'manual']]);
    const cheese = await createIngredient({ name: 'Queso de cabra AL', category: 'dairy', kcalPer100g: 300 });
    assert.deepEqual(cheese.allergens.map(a => a.allergen), ['milk']);
    await api().put(`/api/ingredients/${cheese.id}/allergens`).send({ allergen: 'milk', present: false });
    assert.deepEqual((await api().get(`/api/ingredients/${cheese.id}`)).body.data.allergens, []);
    // Other consultorios keep the automatic tags (and cannot see own foods)
    assert.equal((await api(sessionFor('admin')).put(`/api/ingredients/${cheese.id}/allergens`).send({ allergen: 'milk', present: true })).status, 404);
    assert.equal((await api().put(`/api/ingredients/${cheese.id}/allergens`).send({ allergen: 'chocolate', present: true })).status, 400);
    assert.equal((await api().get('/api/allergens')).body.data.length, 14);
});

test('patient allergies are structured; a severe allergy blocks the recipe', async () => {
    const shrimp = await createIngredient({ name: 'Camarones AL', category: 'protein', kcalPer100g: 99 });
    const rice = await createIngredient({ name: 'Arroz AL', category: 'carbs', kcalPer100g: 130 });
    const paella = await createRecipe(shrimp.id, { name: 'Arroz con camarones AL', ingredients: [{ ingredientId: rice.id, grams: 100 }, { ingredientId: shrimp.id, grams: 80 }] });
    const plain = await createRecipe(rice.id, { name: 'Arroz blanco AL', ingredients: [{ ingredientId: rice.id, grams: 150 }] });

    const patient = await createPatient({ firstName: 'Alérgica' });
    const chosen = await api().post(`/api/patients/${patient.id}/conditions`).send({ type: 'allergy', name: 'Alergia', severity: 'severe', allergens: ['crustaceans'] });
    assert.deepEqual(chosen.body.data.allergens, ['crustaceans']);
    const inferred = await api().post(`/api/patients/${patient.id}/conditions`).send({ type: 'intolerance', name: 'Intolerancia a la lactosa' });
    assert.deepEqual(inferred.body.data.allergens, ['milk']);

    const res = await api().get(`/api/patients/${patient.id}/recipe-suggestions`);
    const byId = Object.fromEntries(res.body.data.map(r => [r.recipeId, r]));
    assert.equal(byId[paella.id].blocked, true);
    assert.match(byId[paella.id].warnings[0], /^Contiene crustáceos: Camarones AL — alergia grave/);
    assert.equal(byId[plain.id].excluded, false);
    const targets = (await api().get(`/api/patients/${patient.id}/targets`)).body.data;
    assert.deepEqual(targets.avoid.map(a => [a.id, a.block]), [['crustaceans', true], ['milk', false]]);
});

test('plant milks are not dairy', () => {
    assert.deepEqual(tags('Leche de almendras sin azúcar'), ['nuts']);
    assert.deepEqual(tags('Leche de arroz sin azúcar'), []);
    assert.deepEqual(tags('Leche entera'), ['milk']);
});
