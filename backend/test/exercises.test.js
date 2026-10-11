const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, sessionFor, createPatient } = require('./helpers');

test('exercise catalog filters by search and muscle, with license', async () => {
    const res = await api().get('/api/exercises?muscle=B%C3%ADceps&limit=100');
    assert.equal(res.status, 200);
    assert.ok(res.body.pagination.total > 10);
    assert.ok(res.body.data.every(e => e.muscles.includes('Bíceps') || e.musclesSecondary.includes('Bíceps')));
    assert.ok(res.body.data.every(e => e.license));

    const search = await api().get('/api/exercises?search=sentadilla');
    assert.ok(search.body.data.length > 0);
    assert.ok(search.body.data.every(e => /sentadilla/i.test(e.name.normalize('NFD').replace(/\p{Diacritic}/gu, '')) || /sentadilla/i.test(e.nameEn || '')));

    const filters = await api().get('/api/exercises/filters');
    assert.ok(filters.body.data.categories.includes('Piernas'));
    assert.match(filters.body.sources.exercises.license, /CC-BY-SA/);
});

test('activity kcal: adult and 60+ tables, weight from the patient', async () => {
    const adult = await api().get('/api/activities/kcal?activityId=caminar_rapido&minutes=30&weightKg=70&age=40');
    assert.equal(adult.status, 200);
    assert.equal(adult.body.data.kcal, 176);   // 4,8 MET x 3,5 x 70 kg x 30 min / 200
    const older = await api().get('/api/activities/kcal?activityId=caminar_rapido&minutes=30&weightKg=70&age=65');
    assert.equal(older.body.data.kcal, 170);   // 6,0 MET60 x 2,7 x 70 x 30 / 200
    assert.equal(older.body.data.table, 'Compendio 60+ (2024)');

    const patient = await createPatient({ firstName: 'Activa', dateOfBirth: '1990-01-01' });
    await api().post(`/api/patients/${patient.id}/metrics`).send({ date: '2026-10-01', weight: 80, height: 170 });
    const fromPatient = await api().get(`/api/activities/kcal?activityId=correr_10&minutes=60&patientId=${patient.id}`);
    assert.equal(fromPatient.status, 200);
    assert.equal(fromPatient.body.data.weightKg, 80);
    assert.equal(fromPatient.body.data.kcal, Math.round(9.3 * 3.5 * 80 * 60 / 200));
});

test('activity kcal errors', async () => {
    assert.equal((await api().get('/api/activities/kcal?activityId=nope&minutes=30&weightKg=70')).status, 404);
    assert.equal((await api().get('/api/activities/kcal?activityId=yoga&minutes=0&weightKg=70')).status, 400);
    const noWeight = await createPatient({ firstName: 'Sin peso' });
    assert.equal((await api().get(`/api/activities/kcal?activityId=yoga&minutes=30&patientId=${noWeight.id}`)).status, 400);
    assert.equal((await api(sessionFor('admin')).get(`/api/activities/kcal?activityId=yoga&minutes=30&patientId=${noWeight.id}`)).status, 404);
    const list = await api().get('/api/activities');
    assert.ok(list.body.data.length >= 50 && list.body.data.every(a => a.adult.met > 0));
});
