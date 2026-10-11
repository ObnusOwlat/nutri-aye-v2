const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, db } = require('./helpers');
const { isAvailableInPy, fixName } = require('../src/lib/paraguay');
const { markParaguayFoods } = require('../src/db/schema/paraguay');

test('foods found in Paraguay and translation fixes', () => {
    assert.equal(isAvailableInPy({ name: 'Mandioca, cruda' }), true);
    assert.equal(isAvailableInPy({ name: 'Carne vacuna, bife', sourceCategory: 'Beef Products' }), true);
    assert.equal(isAvailableInPy({ name: 'Pollo, nuggets', nameEn: "McDONALD'S, Chicken McNUGGETS", sourceCategory: 'Fast Foods' }), false);
    assert.equal(isAvailableInPy({ name: 'Halibut del Atlántico' }), false);
    assert.equal(isAvailableInPy({ name: 'Cualquier cosa', orgId: 'org-1' }), true);   // own foods
    assert.equal(fixName('Pavo, molido, 93% de préstamos, 7 % de grasa, pan-broiled crumbles'), 'Pavo, molido, 93 % magro, 7 % de grasa, a la sartén, desmenuzado');
    assert.equal(fixName('Pollo, broiler o fryers, pechuga'), 'Pollo, parrillero, pechuga');
    assert.equal(fixName('Arvejas de paloma (gramos rojo), crudas'), 'Guandú (poroto paloma), crudas');
});

test('catalog search: ⭐ first, py filter and count; edited names are kept', async () => {
    const insert = db.prepare(`INSERT INTO ingredients (id, name, category_id, unit_id, source, name_edited, kcal_per_100g)
                               VALUES (?, ?, 'protein', 'gram', 'usda_sr_legacy', ?, 100)`);
    insert.run('py-1', 'Zorro de prueba PYT, crudo', 0);
    insert.run('py-2', 'Pollo PYT, broiler o fryers, crudo', 0);
    insert.run('py-3', 'Pollo PYT, broiler o fryers, editado', 1);
    markParaguayFoods(db);
    assert.equal(db.prepare("SELECT name FROM ingredients WHERE id = 'py-2'").get().name, 'Pollo PYT, parrillero, crudo');
    assert.equal(db.prepare("SELECT name FROM ingredients WHERE id = 'py-3'").get().name, 'Pollo PYT, broiler o fryers, editado');

    const list = await api().get('/api/ingredients?scope=catalog&search=PYT');
    assert.deepEqual(list.body.data.map(i => i.availablePy), [true, true, false]);   // ⭐ first
    const only = await api().get('/api/ingredients?scope=catalog&search=PYT&py=1');
    assert.equal(only.body.pagination.total, 2);
    const facets = await api().get('/api/ingredients/facets?scope=catalog&search=PYT');
    assert.equal(facets.body.data.py, 2);
    const own = (await api().post('/api/ingredients').send({ name: 'Mi alimento raro', category: 'mixed', kcalPer100g: 10 })).body.data;
    assert.equal(own.availablePy, true);
});
