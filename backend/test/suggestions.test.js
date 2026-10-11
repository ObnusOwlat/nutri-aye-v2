const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, db, sessionFor, createIngredient, createPatient, createRecipe } = require('./helpers');

const suggest = (patientId, query = '', session) => api(session).get(`/api/patients/${patientId}/recipe-suggestions${query}`);
const addCondition = (patientId, body) => api().post(`/api/patients/${patientId}/conditions`).send(body);

test('hypertension ranks the low-sodium recipe first', async () => {
    db.prepare(`INSERT OR IGNORE INTO nutrients (id, name, name_es, unit, rank, nutrient_group)
                VALUES (1093, 'Sodium, Na', 'Sodio', 'mg', 5800, 'minerals')`).run();
    const ham = await createIngredient({ name: 'Jamón cocido S', category: 'protein', kcalPer100g: 145, sodiumPer100g: 1200 });
    const chicken = await createIngredient({ name: 'Pechuga S', category: 'protein', kcalPer100g: 165, sodiumPer100g: 70 });
    const salty = await createRecipe(ham.id, { name: 'Sándwich de jamón', ingredients: [{ ingredientId: ham.id, grams: 100 }] });
    const plain = await createRecipe(chicken.id, { name: 'Pollo a la plancha', ingredients: [{ ingredientId: chicken.id, grams: 150 }] });

    const patient = await createPatient({ firstName: 'Marta', gender: 'female', dateOfBirth: '1980-05-01' });
    assert.equal((await addCondition(patient.id, { type: 'condition', name: 'Hipertensión arterial' })).status, 201);

    const res = await suggest(patient.id);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.patient.rules.map(r => r.id), ['hypertension']);
    const ids = res.body.data.map(r => r.recipeId);
    assert.ok(ids.indexOf(plain.id) < ids.indexOf(salty.id));
    assert.ok(res.body.data.find(r => r.recipeId === plain.id).reasons.some(t => t.startsWith('Bajo en sodio')));
    assert.ok(res.body.data.find(r => r.recipeId === salty.id).warnings.some(t => t.startsWith('Alto en sodio')));
});

test('dairy intolerance and celiac disease exclude recipes, last and flagged', async () => {
    const cheese = await createIngredient({ name: 'Queso fresco S', category: 'dairy', kcalPer100g: 260 });
    const bread = await createIngredient({ name: 'Pan de trigo S', category: 'carbs', kcalPer100g: 250 });
    const rice = await createIngredient({ name: 'Arroz S', category: 'carbs', kcalPer100g: 130 });
    const withCheese = await createRecipe(cheese.id, { name: 'Queso con miel', category: 'snack', ingredients: [{ ingredientId: cheese.id, grams: 50 }] });
    const withBread = await createRecipe(bread.id, { name: 'Tostada', category: 'snack', ingredients: [{ ingredientId: bread.id, grams: 50 }] });
    const safe = await createRecipe(rice.id, { name: 'Arroz con leche no', category: 'snack', ingredients: [{ ingredientId: rice.id, grams: 100 }] });

    const patient = await createPatient({ firstName: 'Lía' });
    await addCondition(patient.id, { type: 'intolerance', name: 'Intolerancia a la lactosa' });
    await addCondition(patient.id, { type: 'allergy', name: 'Enfermedad celíaca' });

    const res = await suggest(patient.id, '?mealType=snack');
    assert.equal(res.status, 200);
    assert.deepEqual(res.body.patient.allergens.sort(), ['gluten', 'lácteos']);
    const byId = Object.fromEntries(res.body.data.map(r => [r.recipeId, r]));
    assert.equal(byId[safe.id].excluded, false);
    assert.equal(byId[withCheese.id].excluded, true);
    assert.match(byId[withCheese.id].warnings[0], /^Contiene lácteos: Queso fresco S/);
    assert.match(byId[withBread.id].warnings[0], /^Contiene gluten: Pan de trigo S/);
    assert.equal(res.body.data.at(-1).excluded, true);
    assert.ok(res.body.data.every(r => r.category === 'snack'));
});

test('a condition note does not count as an allergy', async () => {
    const milk = await createIngredient({ name: 'Leche S', category: 'dairy', kcalPer100g: 60 });
    const recipe = await createRecipe(milk.id, { name: 'Licuado', ingredients: [{ ingredientId: milk.id, grams: 200 }] });
    const patient = await createPatient({ firstName: 'Nota' });
    await addCondition(patient.id, { type: 'condition', name: 'Osteopenia', description: 'tomar leche descremada' });
    const res = await suggest(patient.id);
    assert.equal(res.body.data.find(r => r.recipeId === recipe.id).excluded, false);
});

test('suggestions are per consultorio and validate the query', async () => {
    const patient = await createPatient({ firstName: 'Ajena' });
    assert.equal((await suggest(patient.id, '', sessionFor('admin'))).status, 404);
    assert.equal((await suggest('nope')).status, 404);
    assert.equal((await suggest(patient.id, '?mealType=brunch')).status, 400);
    assert.equal((await suggest(patient.id, '?limit=0')).status, 400);
});
