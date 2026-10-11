const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, sessionFor } = require('./helpers');

const item = (name, extra = {}) => ({ id: 'x', kind: 'activity', refId: 'trotar', name, activityId: 'trotar', minutes: 20, ...extra });

test('a consultorio starts with example routines', async () => {
    const list = (await api().get('/api/activity-templates')).body.data;
    assert.ok(list.length >= 4);
    const strength = list.find(r => r.name.startsWith('Fuerza 3 días'));
    assert.equal(strength.days, 3);
    assert.ok(strength.activityPlan.monday.every(i => i.id.startsWith('act-')));
    // listing again does not duplicate them
    assert.equal((await api().get('/api/activity-templates')).body.data.length, list.length);
});

test('create, edit and deactivate a routine; item ids are regenerated', async () => {
    const created = await api().post('/api/activity-templates').send({
        name: 'Trote 2 días', level: 'beginner', activityPlan: { monday: [item('Trotar')], thursday: [item('Trotar'), item('Otro')], sunday: [] }
    });
    assert.equal(created.status, 201);
    const r = created.body.data;
    assert.equal(r.days, 2);           // empty days are dropped
    assert.equal(r.items, 3);
    const ids = [...r.activityPlan.monday, ...r.activityPlan.thursday].map(i => i.id);
    assert.equal(new Set(ids).size, 3);

    const renamed = (await api().put(`/api/activity-templates/${r.id}`).send({ name: 'Trote suave' })).body.data;
    assert.equal(renamed.name, 'Trote suave');
    assert.equal(renamed.items, 3);    // the plan stays when not sent

    assert.equal((await api().post('/api/activity-templates').send({ name: 'Mala', activityPlan: { lunes: [] } })).status, 400);
    assert.equal((await api().delete(`/api/activity-templates/${r.id}`)).status, 200);
    assert.equal((await api().delete(`/api/activity-templates/${r.id}`)).status, 404);
    assert.ok(!(await api().get('/api/activity-templates')).body.data.some(x => x.id === r.id));
    const history = (await api().get('/api/activity?entity=routine')).body.data;
    assert.ok(history.some(e => e.action === 'deactivate'));
});

test('routines are per consultorio; reception cannot change them', async () => {
    const mine = (await api().post('/api/activity-templates').send({ name: 'Solo mía', activityPlan: { monday: [item('Trotar')] } })).body.data;
    const other = sessionFor('admin');
    assert.ok(!(await api(other).get('/api/activity-templates')).body.data.some(x => x.id === mine.id));
    assert.equal((await api(other).put(`/api/activity-templates/${mine.id}`).send({ name: 'x' })).status, 404);
    const reception = sessionFor('recepcion');
    assert.equal((await api(reception).get('/api/activity-templates')).status, 200);
    assert.equal((await api(reception).post('/api/activity-templates').send({ name: 'x', activityPlan: {} })).status, 403);
});
