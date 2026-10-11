const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, createPatient } = require('./helpers');

const squat = { id: 'a1', kind: 'exercise', refId: '111', name: 'Sentadilla', activityId: 'pesas_general', sets: 4, reps: 12, weightKg: 40, restSec: 60 };
const walk = { id: 'a2', kind: 'activity', refId: 'caminar_rapido', name: 'Caminar rápido', activityId: 'caminar_rapido', minutes: 45, intensity: 'moderate' };

test('diet templates keep a weekly activity plan', async () => {
    const created = await api().post('/api/diet-templates').send({ name: 'Rutina A', activityPlan: { monday: [squat], tuesday: [walk] } });
    assert.equal(created.status, 201);
    assert.deepEqual(created.body.data.activityPlan.monday[0].sets, 4);
    const updated = await api().put(`/api/diet-templates/${created.body.data.id}`).send({ activityPlan: { monday: [] } });
    assert.deepEqual(updated.body.data.activityPlan, { monday: [] });
    assert.equal((await api().put(`/api/diet-templates/${created.body.data.id}`).send({ activityPlan: { monday: [{ ...squat, sets: 99 }] } })).status, 400);
});

test("a patient's planner week keeps meals and activity", async () => {
    const patient = await createPatient({ firstName: 'Activo' });
    const planner = (await api().post('/api/planner').send({ patientId: patient.id })).body.data;
    const res = await api().put(`/api/planner/${planner.id}`).send({ meals: [], activityPlan: { wednesday: [walk] } });
    assert.equal(res.status, 200);
    assert.equal(res.body.data.activityPlan.wednesday[0].minutes, 45);
    const again = await api().get(`/api/planner?patientId=${patient.id}`);
    assert.equal(again.body.data[0].activityPlan.wednesday[0].name, 'Caminar rápido');
    assert.equal((await api().put(`/api/planner/${planner.id}`).send({ activityPlan: { lunes: [walk] } })).status, 400);
});
