// Consultorio B must never see or change consultorio A's data
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api, db, admin: a, sessionFor, createIngredient, createPatient, createRecipe } = require('./helpers');

const b = sessionFor('admin');

test('patients, metrics and conditions of another consultorio answer 404', async () => {
    const patient = await createPatient({ firstName: 'Solo', lastName: 'DeA' });
    const metric = (await api(a).post(`/api/patients/${patient.id}/metrics`).send({ weight: 70 })).body.data;

    assert.equal((await api(b).get(`/api/patients/${patient.id}`)).status, 404);
    assert.ok(!(await api(b).get('/api/patients')).body.data.some(p => p.id === patient.id));
    assert.equal((await api(b).put(`/api/patients/${patient.id}`).send({ notes: 'x' })).status, 404);
    assert.equal((await api(b).delete(`/api/patients/${patient.id}`)).status, 404);
    assert.equal((await api(b).post(`/api/patients/${patient.id}/metrics`).send({ weight: 1 })).status, 404);
    assert.equal((await api(b).delete(`/api/patients/${patient.id}/metrics/${metric.id}`)).status, 404);
    assert.equal((await api(b).get(`/api/patients/${patient.id}/billing`)).status, 404);
    assert.equal((await api(b).post('/api/planner').send({ patientId: patient.id })).status, 400);
    assert.ok(!(await api(b).get('/api/bootstrap')).body.data.patients.some(p => p.id === patient.id));
    // A still has everything
    assert.equal((await api(a).get(`/api/patients/${patient.id}`)).body.data.metrics.length, 1);
});

test('own foods and recipes are private; the catalog is shared and read-only', async () => {
    const own = await createIngredient({ name: 'Chipa de la casa A' });
    const recipe = await createRecipe(own.id, { name: 'Receta de A' });
    db.prepare("INSERT INTO ingredients (id, name, category_id, source, kcal_per_100g) VALUES ('cat-1', 'Mandioca hervida', 'carbs', 'usda_sr_legacy', 112)").run();

    assert.equal((await api(b).get(`/api/ingredients/${own.id}`)).status, 404);
    assert.equal((await api(b).get('/api/ingredients?search=chipa')).body.data.length, 0);
    assert.equal((await api(b).get(`/api/recipes/${recipe.id}`)).status, 404);
    assert.equal((await api(b).put(`/api/recipes/${recipe.id}`).send({ name: 'Mía' })).status, 404);
    // B cannot build a recipe with A's food, but can with the catalog
    assert.equal((await api(b).post('/api/recipes').send({ name: 'X', category: 'lunch', ingredients: [{ ingredientId: own.id, grams: 10 }] })).status, 400);
    assert.equal((await api(b).post('/api/recipes').send({ name: 'Y', category: 'lunch', ingredients: [{ ingredientId: 'cat-1', grams: 100 }] })).status, 201);
    // Nobody edits or deactivates the catalog
    for (const session of [a, b]) {
        const edit = await api(session).put('/api/ingredients/cat-1').send({ kcalPer100g: 1 });
        assert.equal(edit.status, 403);
        assert.equal(edit.body.code, 'CATALOG_READONLY');
        assert.equal((await api(session).delete('/api/ingredients/cat-1')).status, 403);
    }
});

test('billing: own clients and documents; numbering per consultorio', async () => {
    const clientA = (await api(a).post('/billing-api/clients').send({ name: 'Cliente A' })).body.data;
    const clientB = (await api(b).post('/billing-api/clients').send({ name: 'Cliente B' })).body.data;
    const invA = (await api(a).post('/billing-api/invoices').send({ clientId: clientA.id })).body.data;
    const invB = (await api(b).post('/billing-api/invoices').send({ clientId: clientB.id })).body.data;
    assert.equal(invA.invoiceNumber, 'REC-0001');
    assert.equal(invB.invoiceNumber, 'REC-0001');

    assert.equal((await api(b).get(`/billing-api/invoices/${invA.id}`)).status, 404);
    assert.equal((await api(b).post('/billing-api/invoices').send({ clientId: clientA.id })).status, 400);
    assert.equal((await api(b).get(`/billing-api/clients/${clientA.id}`)).status, 404);
    assert.ok(!(await api(b).get('/billing-api/invoices')).body.data.some(i => i.id === invA.id));
});

test('a backup contains only its consultorio and cannot be imported into another', async () => {
    const patient = await createPatient({ firstName: 'Respaldo', lastName: 'DeA' });
    const backupA = (await api(a).get('/api/backup/export')).body;
    const backupB = (await api(b).get('/api/backup/export')).body;
    assert.ok(backupA.tables.patients.some(p => p.id === patient.id));
    assert.ok(!backupB.tables.patients.some(p => p.id === patient.id));

    const stolen = await api(b).post('/api/backup/import').send(backupA);
    assert.equal(stolen.status, 400);
    assert.match(stolen.body.error, /otro consultorio/);
    assert.equal(db.prepare('SELECT org_id FROM patients WHERE id = ?').get(patient.id).org_id, a.orgId);
});

test('deactivated patients disappear but stay in the database, and can be reactivated', async () => {
    const patient = await createPatient({ firstName: 'Inactivo', lastName: 'DeA' });
    assert.equal((await api(a).delete(`/api/patients/${patient.id}`)).status, 200);
    assert.equal((await api(a).get(`/api/patients/${patient.id}`)).status, 404);
    const row = db.prepare('SELECT deactivated_at, deactivated_by FROM patients WHERE id = ?').get(patient.id);
    assert.ok(row.deactivated_at);
    assert.equal(row.deactivated_by, a.userId);
    assert.equal((await api(b).post(`/api/patients/${patient.id}/reactivate`)).status, 404);
    assert.equal((await api(a).post(`/api/patients/${patient.id}/reactivate`)).status, 200);
    assert.equal((await api(a).get(`/api/patients/${patient.id}`)).status, 200);
});

test('no DELETE statement removes consultorio data anywhere in the code', () => {
    const fs = require('fs');
    const path = require('path');
    const files = [];
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full); else if (e.name.endsWith('.js')) files.push(full);
    });
    walk(path.join(__dirname, '..', 'src'));
    // Allowed: replacing the lines of a recipe, a week, a plan or an invoice while editing it
    const allowed = /DELETE FROM (recipe_ingredients|week_planner_meals|patient_plan_meals|\$\{k\.items\})/;
    const offenders = files.flatMap(f => fs.readFileSync(f, 'utf8').split('\n')
        .filter(l => /DELETE FROM/i.test(l) && !allowed.test(l)).map(l => `${path.basename(f)}: ${l.trim()}`));
    assert.deepEqual(offenders, []);
});
