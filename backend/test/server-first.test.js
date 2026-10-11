// Fase 4: what the browser kept on its own now lives in the server
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, db, sessionFor, createIngredient, createPatient, createRecipe } = require('./helpers');

test('physical activity, extra measurements and condition edits are stored', async () => {
    const p = await createPatient({ physicalActivity: { active: true, level: 'active', frequency: 4, types: 'Natación' } });
    assert.deepEqual((await api().get(`/api/patients/${p.id}`)).body.data.physicalActivity.level, 'active');
    const metric = (await api().post(`/api/patients/${p.id}/metrics`).send({ weight: 70, ciaAbdominal: 85, cadera: 98 })).body.data;
    assert.equal(metric.ciaAbdominal, 85);
    assert.equal(metric.cadera, 98);
    const condition = (await api().post(`/api/patients/${p.id}/conditions`).send({ name: 'Hipertensión' })).body.data;
    const edited = await api().put(`/api/patients/${p.id}/conditions/${condition.id}`).send({ severity: 'severe', dietaryNotes: 'Sodio bajo' });
    assert.equal(edited.body.data.severity, 'severe');
    assert.equal(edited.body.data.name, 'Hipertensión');
    assert.equal((await api().put(`/api/patients/${p.id}/conditions/no-existe`).send({ name: 'x' })).status, 404);
});

test('patient plans keep their week; a new active plan completes the previous one', async () => {
    const p = await createPatient({ firstName: 'Plan' });
    const rice = await createIngredient({ name: 'Arroz plan' });
    const recipe = await createRecipe(rice.id, { name: 'Arroz del plan' });
    const first = (await api().post(`/api/patients/${p.id}/plans`).send({
        name: 'Semana 1', dailyTarget: 1800, weekPlan: { monday: { lunch: recipe.id, dinner: 'no-existe' } }
    })).body.data;
    assert.equal(first.weekPlan.monday.lunch, recipe.id);
    assert.equal(first.weekPlan.monday.dinner, null); // unknown recipes are dropped
    const second = (await api().post(`/api/patients/${p.id}/plans`).send({ name: 'Semana 2' })).body.data;
    const plans = (await api().get('/api/bootstrap')).body.data.patientPlans.filter(x => x.patientId === p.id);
    assert.equal(plans.find(x => x.id === first.id).status, 'completed');
    assert.equal(plans.find(x => x.id === second.id).status, 'active');

    const updated = await api().put(`/api/patients/${p.id}/plans/${first.id}`).send({ notes: 'Ajustado', weekPlan: { friday: { breakfast: recipe.id } } });
    assert.equal(updated.body.data.weekPlan.friday.breakfast, recipe.id);
    assert.equal(updated.body.data.weekPlan.monday.lunch, null);
    assert.equal((await api().delete(`/api/patients/${p.id}/plans/${first.id}`)).status, 200);
    assert.ok(db.prepare('SELECT deactivated_at FROM patient_plans WHERE id = ?').get(first.id).deactivated_at);
    const history = (await api().get(`/api/patients/${p.id}/history`)).body.data.map(e => `${e.entity}:${e.action}`);
    assert.ok(history.includes('plan:create') && history.includes('plan:deactivate'));
});

test('progress check-ins: create, edit, deactivate', async () => {
    const p = await createPatient({ firstName: 'Seguimiento' });
    const entry = (await api().post(`/api/patients/${p.id}/progress`).send({ weight: 72.5, adherence: 80, symptoms: ['cansancio'] })).body.data;
    assert.deepEqual(entry.symptoms, ['cansancio']);
    assert.equal(entry.mood, 5);
    const edited = (await api().put(`/api/patients/${p.id}/progress/${entry.id}`).send({ mood: 8 })).body.data;
    assert.equal(edited.mood, 8);
    assert.equal(edited.adherence, 80);
    assert.equal((await api().post(`/api/patients/${p.id}/progress`).send({ adherence: 150 })).status, 400);
    assert.equal((await api().delete(`/api/patients/${p.id}/progress/${entry.id}`)).status, 200);
    assert.ok(!(await api().get('/api/bootstrap')).body.data.patientProgress.some(x => x.id === entry.id));
});

test('diet templates: defaults per consultorio, custom ones with their week, defaults cannot be deactivated', async () => {
    const list = (await api().get('/api/diet-templates')).body.data;
    assert.equal(list.filter(t => t.isDefault).length, 5);
    const custom = (await api().post('/api/diet-templates').send({ name: 'Vegetariana 1800', goal: 'maintenance', dailyTarget: 1800 })).body.data;
    const saved = (await api().put(`/api/diet-templates/${custom.id}`).send({ weekPlan: { monday: { lunch: null } } })).body.data;
    assert.deepEqual(saved.weekPlan, { monday: { lunch: null } });
    assert.equal((await api().delete(`/api/diet-templates/${list[0].id}`)).status, 409);
    assert.equal((await api().delete(`/api/diet-templates/${custom.id}`)).status, 200);
    // Another consultorio has its own templates
    const other = sessionFor('admin');
    const theirs = (await api(other).get('/api/diet-templates')).body.data;
    assert.ok(!theirs.some(t => t.id === custom.id || t.id === list[0].id));
    assert.equal((await api(other).put(`/api/diet-templates/${list[0].id}`).send({ name: 'x' })).status, 404);
});

test('reception cannot write plans, progress or templates', async () => {
    const { admin } = require('./helpers');
    const reception = sessionFor('recepcion', admin.orgId);
    const p = await createPatient({ firstName: 'Recepción' });
    assert.equal((await api(reception).post(`/api/patients/${p.id}/plans`).send({ name: 'X' })).status, 403);
    assert.equal((await api(reception).post(`/api/patients/${p.id}/progress`).send({})).status, 403);
    assert.equal((await api(reception).post('/api/diet-templates').send({ name: 'X' })).status, 403);
    assert.equal((await api(reception).get('/api/bootstrap')).status, 200);
});

test('browser data import adds only new records and drops broken references', async () => {
    const serverPatient = await createPatient({ firstName: 'Ya en server' });
    const browser = {
        ingredients: [{ id: 'b-ing-1', name: 'Chipa casera', category: 'carbs', kcalPer100g: 300 }, { id: 'usda-x', name: 'Catálogo', source: 'usda_sr_legacy' }],
        recipes: [{ id: 'b-rec-1', name: 'Chipa', category: 'snack', ingredients: [{ ingredientId: 'b-ing-1', grams: 50 }, { ingredientId: 'no-existe', grams: 10 }] }],
        patients: [
            { id: 'b-pat-1', firstName: 'Del', lastName: 'Navegador', physicalActivity: { active: true } },
            { ...serverPatient, firstName: 'Versión vieja' }
        ],
        patientMetrics: [{ id: 'b-met-1', patientId: serverPatient.id, weight: 66 }, { id: 'b-met-2', patientId: 'paciente-borrado', weight: 1 }],
        patientConditions: [{ id: 'b-con-1', patientId: 'b-pat-1', type: 'allergy', name: 'Maní' }],
        patientPlans: [{ id: 'b-plan-1', patientId: 'b-pat-1', name: 'Plan viejo', weekPlan: { monday: { lunch: 'b-rec-1', dinner: 'perdida' } } }],
        patientProgress: [{ id: 'b-prog-1', patientId: 'b-pat-1', adherence: 90 }],
        dietTemplates: [{ id: 'tpl_maintenance', isDefault: true }, { id: 'b-tpl-1', name: 'Mi plantilla', goal: 'deficit', dailyTarget: 1600 }],
        weekPlans: { 'b-tpl-1': { tuesday: { lunch: 'b-rec-1' } } }
    };
    const res = await api().post('/api/migration/browser-data').send(browser);
    assert.equal(res.status, 200);
    const boot = (await api().get('/api/bootstrap')).body.data;
    assert.equal(boot.patients.find(p => p.id === serverPatient.id).firstName, 'Ya en server'); // never overwritten
    assert.ok(boot.patientMetrics.some(m => m.id === 'b-met-1'));
    assert.ok(!boot.patientMetrics.some(m => m.id === 'b-met-2'));
    assert.deepEqual(boot.recipes.find(r => r.id === 'b-rec-1').ingredients.map(i => i.ingredientId), ['b-ing-1']);
    const plan = boot.patientPlans.find(p => p.id === 'b-plan-1');
    assert.equal(plan.weekPlan.monday.lunch, 'b-rec-1');
    assert.equal(plan.weekPlan.monday.dinner, null);
    assert.equal(boot.dietTemplates.find(t => t.id === 'b-tpl-1').weekPlan.tuesday.lunch, 'b-rec-1');
    assert.equal(boot.patients.find(p => p.id === 'b-pat-1').physicalActivity.active, true);
    // Running it again changes nothing
    const again = await api().post('/api/migration/browser-data').send(browser);
    assert.equal(Object.values(again.body.data.imported).reduce((a, b) => a + b, 0), 0);
});
