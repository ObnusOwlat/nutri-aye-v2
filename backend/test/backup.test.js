const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, db, createIngredient, createPatient, createRecipe } = require('./helpers');

test('backup round trip brings back deactivated data without touching the rest', async () => {
    const rice = await createIngredient({ name: 'Arroz respaldo' });
    const recipe = await createRecipe(rice.id, { name: 'Receta respaldo' });
    const patient = await createPatient({ firstName: 'Respaldo' });
    await api().post(`/api/patients/${patient.id}/metrics`).send({ weight: 80, height: 180 });
    await api().post(`/api/patients/${patient.id}/conditions`).send({ type: 'allergy', name: 'Gluten' });
    const planner = (await api().post('/api/planner').send({ patientId: patient.id })).body.data;
    await api().put(`/api/planner/${planner.id}`).send({ meals: [{ day: 'monday', mealType: 'lunch', recipeId: recipe.id }] });

    const backup = (await api().get('/api/backup/export')).body;
    assert.equal(backup.format, 'nutri-aye-backup');
    assert.equal(backup.version, 5);

    // Deactivate the patient and the recipe: they disappear from the app but stay in the database
    await api().delete(`/api/patients/${patient.id}`);
    assert.equal((await api().get(`/api/patients/${patient.id}`)).status, 404);
    assert.ok(db.prepare('SELECT deactivated_at FROM patients WHERE id = ?').get(patient.id).deactivated_at);
    await api().delete(`/api/recipes/${recipe.id}`);
    const other = await createPatient({ firstName: 'Nuevo después del respaldo' });

    const imported = await api().post('/api/backup/import').send(backup);
    assert.equal(imported.status, 200);
    assert.ok(imported.body.data.imported.patients >= 1);

    const restored = (await api().get(`/api/patients/${patient.id}`)).body.data;
    assert.equal(restored.firstName, 'Respaldo');
    assert.equal(restored.metrics[0].weight, 80);
    assert.deepEqual(restored.allergies, ['Gluten']);
    const week = (await api().get(`/api/planner?patientId=${patient.id}`)).body.data[0];
    assert.equal(week.meals[0].recipeName, 'Receta respaldo');
    assert.equal(Math.round((await api().get(`/api/recipes/${recipe.id}`)).body.data.nutrition.calories), 260);
    // Import never deletes
    assert.equal((await api().get(`/api/patients/${other.id}`)).status, 200);
});

test('a backup with broken references imports nothing', async () => {
    const before = db.prepare('SELECT COUNT(*) AS n FROM patients').get().n;
    const res = await api().post('/api/backup/import').send({
        format: 'nutri-aye-backup', version: 5,
        tables: {
            patients: [{ id: 'p-huerfano', first_name: 'A', last_name: 'B', created_at: '2026-01-01', updated_at: '2026-01-01' }],
            patient_metrics: [{ id: 'm1', patient_id: 'no-existe', date: '2026-01-01' }]
        }
    });
    assert.equal(res.status, 400);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM patients').get().n, before);
});

test('migrations are recorded', () => {
    const versions = db.prepare('SELECT version FROM schema_version ORDER BY version').all().map(r => r.version);
    assert.deepEqual(versions, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});
