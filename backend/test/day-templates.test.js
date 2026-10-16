const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, sessionFor } = require('./helpers');

test('create, edit and deactivate a day template; empty meals are dropped', async () => {
    const created = await api().post('/api/day-templates').send({
        name: 'Día liviano', meals: { breakfast: 'r1', lunch: 'r2', dinner: null }
    });
    assert.equal(created.status, 201);
    const t = created.body.data;
    assert.deepEqual(t.meals, { breakfast: 'r1', lunch: 'r2' });

    const renamed = (await api().put(`/api/day-templates/${t.id}`).send({ name: 'Día suave' })).body.data;
    assert.equal(renamed.name, 'Día suave');
    assert.deepEqual(renamed.meals, { breakfast: 'r1', lunch: 'r2' });   // meals stay when not sent

    assert.equal((await api().delete(`/api/day-templates/${t.id}`)).status, 200);
    assert.ok(!(await api().get('/api/day-templates')).body.data.some(x => x.id === t.id));
    assert.equal((await api().delete(`/api/day-templates/${t.id}`)).status, 404);
});

test('a day template needs a name, valid meals and at least one recipe', async () => {
    assert.equal((await api().post('/api/day-templates').send({ name: 'Vacía', meals: { lunch: null } })).status, 400);
    assert.equal((await api().post('/api/day-templates').send({ name: 'Mala', meals: { brunch: 'r1' } })).status, 400);
    assert.equal((await api().post('/api/day-templates').send({ meals: { lunch: 'r1' } })).status, 400);
});

test('day templates are per consultorio; reception cannot change them', async () => {
    const mine = (await api().post('/api/day-templates').send({ name: 'Solo mía', meals: { lunch: 'r1' } })).body.data;
    const other = sessionFor('admin');
    assert.ok(!(await api(other).get('/api/day-templates')).body.data.some(x => x.id === mine.id));
    assert.equal((await api(other).put(`/api/day-templates/${mine.id}`).send({ name: 'x' })).status, 404);
    const reception = sessionFor('recepcion');
    assert.equal((await api(reception).get('/api/day-templates')).status, 200);
    assert.equal((await api(reception).post('/api/day-templates').send({ name: 'x', meals: { lunch: 'r1' } })).status, 403);
});
