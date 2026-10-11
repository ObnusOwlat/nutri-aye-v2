const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { api, app, db, admin, sessionFor, createIngredient, createPatient, createRecipe } = require('./helpers');

const activity = async (query = '', session = admin) => (await api(session).get(`/api/activity${query}`)).body.data;

test('patient create, update and deactivate are recorded with who, what and the changed fields', async () => {
    const p = await createPatient({ firstName: 'Auditada', lastName: 'Gómez', phone: '0981 111111' });
    await api().put(`/api/patients/${p.id}`).send({ phone: '0981 222222' });
    await api().put(`/api/patients/${p.id}`).send({ phone: '0981 222222' }); // no change: nothing recorded
    await api().delete(`/api/patients/${p.id}`);

    const entries = await activity(`?entity=patient`);
    const mine = entries.filter(e => e.entityId === p.id).reverse();
    assert.deepEqual(mine.map(e => e.action), ['create', 'update', 'deactivate']);
    assert.equal(mine[0].userId, admin.userId);
    assert.ok(mine[0].userName);
    assert.equal(mine[0].changes.first_name[1], 'Auditada');
    assert.deepEqual(mine[1].changes, { phone: ['0981 111111', '0981 222222'] });
    assert.equal(mine[2].changes.deactivated_by[1], admin.userId);
    assert.ok(mine.every(e => e.ip));
});

test('a failed change records nothing', async () => {
    const before = db.prepare('SELECT COUNT(*) AS n FROM audit_log').get().n;
    assert.equal((await api().post('/api/patients').send({ firstName: 'Sin apellido' })).status, 400);
    assert.equal((await api().put('/api/patients/no-existe').send({ notes: 'x' })).status, 404);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM audit_log').get().n, before);
});

test('recipe ingredient changes are part of the recorded diff', async () => {
    const rice = await createIngredient({ name: 'Arroz auditado' });
    const recipe = await createRecipe(rice.id, { name: 'Arroz con registro' });
    await api().put(`/api/recipes/${recipe.id}`).send({ ingredients: [{ ingredientId: rice.id, grams: 300 }] });
    const [update] = (await activity('?entity=recipe&action=update')).filter(e => e.entityId === recipe.id);
    assert.deepEqual(update.changes.ingredients, [[{ ingredient_id: rice.id, grams: 200 }], [{ ingredient_id: rice.id, grams: 300 }]]);
});

test('patient history gathers the patient, metrics, conditions and planner', async () => {
    const p = await createPatient({ firstName: 'Historia' });
    const metric = (await api().post(`/api/patients/${p.id}/metrics`).send({ weight: 80 })).body.data;
    await api().post(`/api/patients/${p.id}/conditions`).send({ type: 'allergy', name: 'Maní' });
    await api().delete(`/api/patients/${p.id}/metrics/${metric.id}`);
    await api().post('/api/planner').send({ patientId: p.id });

    const history = (await api().get(`/api/patients/${p.id}/history`)).body.data;
    assert.deepEqual(history.map(e => `${e.entity}:${e.action}`).reverse(),
        ['patient:create', 'metric:create', 'condition:create', 'metric:deactivate', 'planner:create']);
    assert.ok(history.every(e => e.patientName === 'Historia Pérez'));
});

test('sessions, users, passwords and backups are recorded', async () => {
    const team = sessionFor('admin');
    await request(app).post('/api/auth/login').send({ email: team.email, password: 'mala' });
    await request(app).post('/api/auth/login').send({ email: 'nadie@ejemplo.com', password: 'mala' });
    const login = await request(app).post('/api/auth/login').send({ email: team.email, password: 'clave-segura-1' });
    const created = (await api(team).post('/api/users').send({ name: 'Nueva', email: 'nueva@ejemplo.com', role: 'recepcion' })).body.data;
    await api(team).put(`/api/users/${created.id}`).send({ role: 'nutricionista' });
    await api(team).post(`/api/users/${created.id}/reset-password`);
    await api(team).get('/api/backup/export');
    await request(app).post('/api/auth/logout').set('Cookie', login.headers['set-cookie'][0].split(';')[0]);

    const actions = (await activity('', team)).map(e => `${e.entity}:${e.action}`).reverse();
    assert.deepEqual(actions, ['session:login_failed', 'session:login', 'user:create', 'user:update', 'user:password_reset', 'backup:export', 'session:logout']);
    const roleChange = (await activity('?entity=user&action=update', team))[0];
    assert.deepEqual(roleChange.changes.role, ['recepcion', 'nutricionista']);
    // A failed attempt on an unknown email is not shown to any consultorio, and the email is not stored
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE org_id IS NULL AND action = 'login_failed'").get().n, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM audit_log WHERE changes LIKE '%nadie@%'").get().n, 0);
});

test('the log cannot be edited or deleted, not even directly in the database', () => {
    assert.throws(() => db.prepare('UPDATE audit_log SET action = ?').run('x'), /no se puede modificar/);
    assert.throws(() => db.prepare('DELETE FROM audit_log').run(), /no se puede borrar/);
});

test('activity is only for admins and only shows their consultorio', async () => {
    const nutritionist = sessionFor('nutricionista', admin.orgId);
    assert.equal((await api(nutritionist).get('/api/activity')).status, 403);
    const other = sessionFor('admin');
    await api(other).post('/api/patients').send({ firstName: 'Otro', lastName: 'Consultorio' });
    assert.ok(!(await activity('?entity=patient')).some(e => e.patientName === 'Otro Consultorio'));
    assert.ok((await activity('?entity=patient', other)).some(e => e.patientName === 'Otro Consultorio'));
    // Filters: date range and user
    const today = new Date().toISOString().slice(0, 10);
    assert.ok((await activity(`?from=${today}&to=${today}`)).length > 0);
    assert.equal((await activity('?from=2000-01-01&to=2000-01-02')).length, 0);
    assert.ok((await activity(`?userId=${admin.userId}`)).every(e => e.userId === admin.userId));
});
