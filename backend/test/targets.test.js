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
    // deficit: -20 % of the total (2681,5 x 0,8 = 2145 -> 2150)
    assert.equal(suggestedEnergy({ sex: 'male', age: 40, weight: 80, height: 180, activityLevel: 'moderate', goal: 'deficit' }).kcal, 2150);
    assert.equal(suggestedEnergy({ sex: 'male', age: 40, weight: 80, height: 180, activityLevel: 'moderate', goal: 'deficit', goalPercent: -15 }).kcal, 2280);
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
    assert.equal(t.nutrients[1003].target, 128);                // 1,6 g/kg (maintenance)
    // fat 25 % of 2680 = 74 g; carbohydrates the rest: (2680 - 512 - 666) / 4 = 376 g
    assert.equal(t.macros.fat.g, 74);
    assert.equal(t.macros.carbs.g, 376);
    assert.equal(t.nutrients[1005].target, 376);
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

test('vitamin A: no upper level on the RAE total (carotenoids); the limit is on preformed retinol', () => {
    const d = driDetails({ sex: 'male', age: 40 });
    assert.equal(d[1106].ul, null);
    assert.equal(d[1105].kind, 'UL');
    assert.equal(d[1105].target, 3000);
    assert.equal(driDetails({ sex: 'female', age: 16 })[1105].target, 2800);
});

test('macros: settings per patient, kidney disease limits protein', async () => {
    const { macroTargets } = require('../src/lib/energy');
    assert.equal(macroTargets({ kcal: 2000, weight: 70, goal: 'deficit' }).protein.g, 140);         // 2,0 g/kg
    assert.equal(macroTargets({ kcal: 2000, weight: 70, goal: 'maintenance', kidney: true }).protein.g, 56);
    assert.ok(macroTargets({ kcal: 1200, weight: 120, goal: 'deficit' }).notes.some(n => /superan/.test(n)));
    // BMI 36,7 (120 kg, 1,81 m): ideal 81,9 kg, adjusted 81,9 + 0,4 x 38,1 = 97,1 kg -> 2,0 g/kg = 194 g
    const obese = macroTargets({ kcal: 2400, weight: 120, height: 181, goal: 'deficit' });
    assert.equal(obese.proteinWeightKg, 97.1);
    assert.equal(obese.protein.g, 194);

    const p = await createPatient({ firstName: 'Macros', gender: 'female', dateOfBirth: yearsAgo(30) });
    await api().post(`/api/patients/${p.id}/metrics`).send({ weight: 60, height: 165 });
    let t = (await api().put(`/api/patients/${p.id}/targets`).send({ macros: { goalPercent: -15, proteinPerKg: 2.2, fatPercent: 30 } })).body.data;
    assert.equal(t.energy.suggested.goalPercent, -15);
    assert.equal(t.macros.protein.g, 132);
    assert.equal(t.macros.fatPercent, 30);
    assert.deepEqual(t.macros.manual, { goalPercent: -15, proteinPerKg: 2.2, fatPercent: 30 });
    t = (await api().put(`/api/patients/${p.id}/targets`).send({ macros: { proteinPerKg: null } })).body.data;
    assert.equal(t.macros.proteinPerKg, 1.6);
    assert.equal((await api().put(`/api/patients/${p.id}/targets`).send({ macros: { fatPercent: 80 } })).status, 400);

    await api().post(`/api/patients/${p.id}/conditions`).send({ type: 'condition', name: 'Enfermedad renal crónica' });
    t = (await api().get(`/api/patients/${p.id}/targets`)).body.data;
    assert.equal(t.macros.protein.g, 48);   // 0,8 g/kg
    assert.ok(t.notes.some(n => /KDIGO/.test(n)));
});
