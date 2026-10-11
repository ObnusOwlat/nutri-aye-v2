const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, createPatient } = require('./helpers');

test('patient CRUD', async () => {
    const p = await createPatient({ email: 'ana@ejemplo.com', address: { city: 'Asunción' } });
    assert.equal(p.firstName, 'Ana');
    assert.equal(p.address.city, 'Asunción');
    assert.equal(p.status, 'active');

    const list = await api().get('/api/patients');
    assert.ok(list.body.data.some(x => x.id === p.id));

    const updated = await api().put(`/api/patients/${p.id}`).send({ firstName: 'Ana María', lastName: 'Pérez' });
    assert.equal(updated.body.data.firstName, 'Ana María');

    const detail = await api().get(`/api/patients/${p.id}`);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.firstName, 'Ana María');

    assert.equal((await api().delete(`/api/patients/${p.id}`)).status, 200);
    assert.equal((await api().get(`/api/patients/${p.id}`)).status, 404);
});

test('metrics, conditions and allergies', async () => {
    const p = await createPatient({ firstName: 'Luis' });
    const metric = await api().post(`/api/patients/${p.id}/metrics`).send({ date: '2026-10-01', weight: 70, height: 175 });
    assert.equal(metric.body.data.weight, 70);

    const allergy = await api().post(`/api/patients/${p.id}/conditions`).send({ type: 'allergy', name: 'Maní', severity: 'severe' });
    assert.equal(allergy.body.data.name, 'Maní');
    await api().post(`/api/patients/${p.id}/conditions`).send({ type: 'condition', name: 'Hipertensión' });

    const allergies = await api().get(`/api/patients/${p.id}/allergies`);
    assert.deepEqual(allergies.body.data, ['Maní']);

    assert.equal((await api().delete(`/api/patients/${p.id}/metrics/${metric.body.data.id}`)).status, 200);
    assert.equal((await api().delete(`/api/patients/${p.id}/conditions/${allergy.body.data.id}`)).status, 200);
});

test('patient to billing client link', async () => {
    await api().put('/billing-api/company').send({ name: 'Consultorio', currency: 'PYG' });
    const p = await createPatient({ firstName: 'Carla' });
    const linked = await api().post(`/api/patients/${p.id}/sync-to-billing`);
    assert.equal(linked.body.alreadyLinked, false);
    const again = await api().post(`/api/patients/${p.id}/sync-to-billing`);
    assert.equal(again.body.alreadyLinked, true);
    const billing = await api().get(`/api/patients/${p.id}/billing`);
    assert.equal(billing.body.data.linked, true);
});
