const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, sessionFor, createIngredient } = require('./helpers');
const { subgroupOf, formOf, basicCategoryOf } = require('../src/lib/food-classify');

test('subgroups by USDA group and names, whole words for short keywords', () => {
    const sub = (category, name, nameEn = null, sourceCategory = null) => subgroupOf({ category, name, nameEn, sourceCategory });
    assert.equal(sub('protein', 'Carne vacuna, bife', 'Beef, loin, raw', 'Beef Products'), 'beef');
    assert.equal(sub('protein', 'Cerdo, curado, panceta', 'Pork, cured, bacon, raw', 'Pork Products'), 'processed');
    assert.equal(sub('protein', 'Pavo, molido', 'Turkey, ground', 'Poultry Products'), 'poultry');
    assert.equal(sub('protein', 'Crustáceos, camarones', 'Crustaceans, shrimp, raw', 'Finfish and Shellfish Products'), 'shellfish');
    assert.equal(sub('protein', 'Pescado, salmón', 'Fish, salmon, raw', 'Finfish and Shellfish Products'), 'fish');
    assert.equal(sub('protein', 'Lentejas cocidas'), 'legumes');
    assert.equal(sub('vegetables', 'Repollitos de Bruselas'), 'cruciferous');
    assert.equal(sub('vegetables', 'Mandioca, cruda'), 'roots_tubers');
    assert.equal(sub('fruits', 'Pomelo', 'Grapefruit, raw'), 'citrus');
    assert.equal(sub('carbs', 'Pan, de trigo integral'), 'bread_bakery');
    assert.equal(sub('carbs', 'Panceta'), 'other');                      // "pan" is a whole word
    assert.equal(sub('mixed', 'Salsa de soja'), 'spices_condiments');
    assert.equal(sub('mixed', 'Salmón con algo', null, 'Fast Foods'), 'prepared');
    assert.equal(sub('dairy', 'Queso cheddar'), 'cheese');
});

test('preparation form and basic-catalog categories', () => {
    assert.equal(formOf({ name: 'Espárragos', nameEn: 'Asparagus, frozen, cooked, boiled' }), 'cooked');
    assert.equal(formOf({ name: 'Arvejas congeladas' }), 'frozen');
    assert.equal(formOf({ name: 'Atún enlatado (en agua)' }), 'canned');
    assert.equal(formOf({ name: 'Miel' }), null);
    assert.equal(basicCategoryOf('Arroz blanco'), 'carbs');
    assert.equal(basicCategoryOf('Aceite de salmón'), 'fats');
    assert.equal(basicCategoryOf('Caldo de pollo'), 'mixed');
    assert.equal(basicCategoryOf('Carne de coco'), 'fruits');
    assert.equal(basicCategoryOf('Pan de hamburguesa grande con semillas'), 'carbs');
    assert.equal(basicCategoryOf('Proteína de suero en polvo'), 'protein');
});

test('own foods get subgroup and form; list filters and facet counts', async () => {
    const beef = await createIngredient({ name: 'Bife de chorizo crudo FG', category: 'protein' });
    const pork = await createIngredient({ name: 'Bondiola de cerdo cocida FG', category: 'protein' });
    await createIngredient({ name: 'Pechuga de pollo FG', category: 'protein' });
    assert.equal(beef.subgroup, 'beef');
    assert.equal(beef.form, 'raw');
    assert.equal(pork.subgroup, 'pork');

    const list = await api().get('/api/ingredients?scope=own&search=FG&subgroup=protein.beef,protein.pork');
    assert.deepEqual(list.body.data.map(i => i.name).sort(), ['Bife de chorizo crudo FG', 'Bondiola de cerdo cocida FG']);
    const mixed = await api().get('/api/ingredients?scope=own&search=FG&category=vegetables&subgroup=protein.beef');
    assert.deepEqual(mixed.body.data.map(i => i.id), [beef.id]);   // categories OR subgroups
    const raw = await api().get('/api/ingredients?scope=own&search=FG&form=raw');
    assert.deepEqual(raw.body.data.map(i => i.id), [beef.id]);

    // Counts ignore their own filter: choosing "Vaca" still shows how many pork foods there are
    const facets = await api().get('/api/ingredients/facets?scope=own&search=FG&subgroup=protein.beef&form=raw');
    assert.equal(facets.status, 200);
    assert.deepEqual(facets.body.data.categories.protein.subgroups, { beef: 1 });
    assert.equal(facets.body.data.forms.raw, 1);
    const all = await api().get('/api/ingredients/facets?scope=own&search=FG');
    assert.deepEqual(all.body.data.categories.protein.subgroups, { beef: 1, pork: 1, poultry: 1 });

    // Renaming reclassifies; other consultorios do not see the counts
    const renamed = await api().put(`/api/ingredients/${pork.id}`).send({ name: 'Pescado blanco FG' });
    assert.equal(renamed.body.data.subgroup, 'fish');
    const other = await api(sessionFor('admin')).get('/api/ingredients/facets?scope=own&search=FG');
    assert.deepEqual(other.body.data.categories, {});
});
