// Fase 7: daily nutritional targets per patient
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, db, admin, sessionFor, createPatient } = require('./helpers');
const { suggestedEnergy } = require('../src/lib/energy');
const { driDetails } = require('../src/lib/dri');

const yearsAgo = (n) => `${new Date().getFullYear() - n}-01-01`;
const targets = async (p) => (await api().get(`/api/patients/${p.id}/targets`)).body.data;

test('energy: Mifflin-St Jeor x activity, adjusted by goal', () => {
    // man, 40 y, 80 kg, 180 cm: REE = 800 + 1125 - 200 + 5 = 1730; x1,55 = 2681,5
    assert.equal(suggestedEnergy({ sex: 'male', age: 40, weight: 80, height: 180, activityLevel: 'moderate', goal: 'maintenance' }).kcal, 2680);
    assert.equal(suggestedEnergy({ sex: 'male', age: 40, weight: 80, height: 180, activityLevel: 'moderate', goal: 'deficit' }).kcal, 2180);
    const missing = suggestedEnergy({ sex: 'female', age: null, weight: 60 });
    assert.equal(missing.kcal, null);
    assert.deepEqual(missing.missing, ['talla', 'fecha de nacimiento']);
});

test('reference intakes change with sex, age and pregnancy', () => {
    assert.equal(driDetails({ sex: 'female', age: 30 })[1089].target, 18);
    assert.equal(driDetails({ sex: 'female', age: 60 })[1089].target, 8);
    assert.equal(driDetails({ sex: 'female', age: 30, pregnant: true })[1089].target, 27);
    assert.equal(driDetails({ sex: 'male', age: 16 })[1087].target, 1300);
    assert.equal(driDetails({ sex: 'male', age: 40 })[1093].kind, 'CDRR');
});

test('targets of a patient: calculated energy, protein by weight, limits', async () => {
    const p = await createPatient({ firstName: 'Metas', gender: 'male', dateOfBirth: yearsAgo(40), physicalActivity: { active: true, level: 'moderate' } });
    await api().post(`/api/patients/${p.id}/metrics`).send({ weight: 80, height: 180 });
    const t = await targets(p);
    assert.equal(t.energy.source, 'calculated');
    assert.equal(t.energy.kcal, 2680);
    assert.equal(t.nutrients[1003].target, 64);                 // 0,8 g/kg
    assert.equal(t.nutrients[1093].kind, 'limit');
    assert.equal(t.nutrients[1093].max, 2300);
    assert.equal(t.nutrients[1258].max, Math.round(2680 * 0.1 / 9));
    assert.equal(t.nutrients[1089].ul, 45);
});

test('conditions add limits and emphasis; allergies list what to avoid; plan energy wins', async () => {
    const p = await createPatient({ firstName: 'Condiciones', gender: 'female', dateOfBirth: yearsAgo(50) });
    await api().post(`/api/patients/${p.id}/conditions`).send({ type: 'condition', name: 'Hipertensión arterial' });
    await api().post(`/api/patients/${p.id}/conditions`).send({ type: 'condition', name: 'Anemia ferropénica' });
    await api().post(`/api/patients/${p.id}/conditions`).send({ type: 'intolerance', name: 'Celiaquía (gluten)' });
    await api().post(`/api/patients/${p.id}/plans`).send({ name: 'Plan', dailyTarget: 1700, dietGoal: 'deficit' });
    const t = await targets(p);
    assert.equal(t.nutrients[1093].max, 2000);                 // 4 x 500 mg
    assert.equal(t.nutrients[1089].emphasis, 'Anemia');
    assert.deepEqual(t.rules.map(r => r.id).sort(), ['anemia', 'hypertension']);
    assert.ok(t.avoid.some(a => a.id === 'gluten'));
    assert.equal(t.energy.source, 'plan');
    assert.equal(t.energy.kcal, 1700);
    assert.match(t.notes.join(' '), /faltan: peso, talla/);
});

test('manual adjustments replace the automatic value; null goes back; recorded and never deleted', async () => {
    const p = await createPatient({ firstName: 'Ajustes', gender: 'female', dateOfBirth: yearsAgo(35) });
    let t = (await api().put(`/api/patients/${p.id}/targets`).send({ energy: 1600, nutrients: { 1089: 25, 1093: 1500 } })).body.data;
    assert.equal(t.energy.source, 'manual');
    assert.equal(t.energy.kcal, 1600);
    assert.equal(t.nutrients[1089].target, 25);
    assert.equal(t.nutrients[1089].manual, true);
    assert.equal(t.nutrients[1093].max, 1500);
    t = (await api().put(`/api/patients/${p.id}/targets`).send({ nutrients: { 1089: null } })).body.data;
    assert.equal(t.nutrients[1089].target, 18);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM patient_targets WHERE patient_id = ? AND target_key = '1089'").get(p.id).n, 1);
    const history = (await api().get(`/api/patients/${p.id}/history`)).body.data;
    assert.ok(history.some(e => e.entity === 'targets'));
    assert.equal((await api().put(`/api/patients/${p.id}/targets`).send({ energy: 50 })).status, 400);
});

test('targets are private to the consultorio; reception reads but does not adjust', async () => {
    const p = await createPatient({ firstName: 'Privado' });
    const other = sessionFor('admin');
    assert.equal((await api(other).get(`/api/patients/${p.id}/targets`)).status, 404);
    const reception = sessionFor('recepcion', admin.orgId);
    assert.equal((await api(reception).get(`/api/patients/${p.id}/targets`)).status, 200);
    assert.equal((await api(reception).put(`/api/patients/${p.id}/targets`).send({ energy: 1800 })).status, 403);
});
