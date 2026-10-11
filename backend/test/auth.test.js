const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { api, app, admin, sessionFor } = require('./helpers');

const login = (email, password) => request(app).post('/api/auth/login').send({ email, password });
const cookieOf = (res) => res.headers['set-cookie']?.[0]?.split(';')[0];

test('without a session the API answers 401; health and status are public', async () => {
    assert.equal((await request(app).get('/api/patients')).status, 401);
    assert.equal((await request(app).get('/api/patients')).body.code, 'UNAUTHENTICATED');
    assert.equal((await request(app).get('/api/health')).status, 200);
    const status = await request(app).get('/api/auth/status');
    assert.deepEqual(status.body.data, { setupRequired: false, authenticated: false });
    // The app itself (HTML, JS) loads without a session to show the login screen
    assert.equal((await request(app).get('/')).status, 200);
});

test('login: same message for wrong password and unknown email; secure cookie', async () => {
    const wrong = await login(admin.email, 'otra-clave');
    const unknown = await login('nadie@ejemplo.com', 'otra-clave');
    assert.equal(wrong.status, 401);
    assert.equal(wrong.body.error, unknown.body.error);

    const ok = await login(admin.email, 'clave-segura-1');
    assert.equal(ok.status, 200);
    const setCookie = ok.headers['set-cookie'][0];
    assert.match(setCookie, /HttpOnly/);
    assert.match(setCookie, /SameSite=Lax/);
    const me = await request(app).get('/api/auth/me').set('Cookie', cookieOf(ok));
    assert.equal(me.body.data.role, 'admin');
    assert.equal(me.body.data.organization.id, admin.orgId);

    // Logout revokes the session on the server
    await request(app).post('/api/auth/logout').set('Cookie', cookieOf(ok));
    assert.equal((await request(app).get('/api/auth/me').set('Cookie', cookieOf(ok))).status, 401);
});

test('writes from another website are rejected', async () => {
    const res = await api().post('/api/patients').set('Origin', 'https://otro-sitio.example').send({ firstName: 'A', lastName: 'B' });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'FORBIDDEN_ORIGIN');
    const same = await api().post('/api/patients').set('Origin', 'http://127.0.0.1').set('Host', '127.0.0.1').send({ firstName: 'A', lastName: 'B' });
    assert.equal(same.status, 201);
});

test('changing the password closes the other sessions', async () => {
    const user = sessionFor('nutricionista');
    assert.equal((await api(user).post('/api/auth/password').send({ currentPassword: 'mal', newPassword: 'nueva-clave-1' })).status, 400);
    const changed = await api(user).post('/api/auth/password').send({ currentPassword: 'clave-segura-1', newPassword: 'nueva-clave-1' });
    assert.equal(changed.status, 200);
    assert.equal((await api(user).get('/api/auth/me')).status, 401);
    assert.equal((await request(app).get('/api/auth/me').set('Cookie', cookieOf(changed))).status, 200);
    assert.equal((await login(user.email, 'nueva-clave-1')).status, 200);
});

test('admin creates a user with a temporary password that must be changed', async () => {
    const created = await api().post('/api/users').send({ name: 'Recepción', email: 'recepcion@ejemplo.com', role: 'recepcion' });
    assert.equal(created.status, 201);
    const temp = created.body.data.temporaryPassword;
    assert.ok(temp.length >= 12);

    const res = await login('recepcion@ejemplo.com', temp);
    const cookie = cookieOf(res);
    const blocked = await request(app).get('/api/patients').set('Cookie', cookie);
    assert.equal(blocked.body.code, 'PASSWORD_CHANGE_REQUIRED');
    const changed = await request(app).post('/api/auth/password').set('Cookie', cookie).send({ currentPassword: temp, newPassword: 'mi-clave-propia' });
    assert.equal((await request(app).get('/api/patients').set('Cookie', cookieOf(changed))).status, 200);
});

test('roles: reception handles patients and billing, not clinical data; only admin manages users and backups', async () => {
    const reception = sessionFor('recepcion', admin.orgId);
    const nutritionist = sessionFor('nutricionista', admin.orgId);

    const patient = (await api(reception).post('/api/patients').send({ firstName: 'Rosa', lastName: 'Duarte' })).body.data;
    assert.ok(patient.id);
    assert.equal((await api(reception).post(`/api/patients/${patient.id}/metrics`).send({ weight: 60 })).status, 403);
    assert.equal((await api(reception).post('/api/recipes').send({ name: 'X', ingredients: [] })).status, 403);
    assert.equal((await api(reception).get('/api/recipes')).status, 200);
    assert.equal((await api(reception).post('/billing-api/clients').send({ name: 'Rosa' })).status, 201);

    assert.equal((await api(nutritionist).post(`/api/patients/${patient.id}/metrics`).send({ weight: 60 })).status, 201);
    for (const session of [reception, nutritionist]) {
        assert.equal((await api(session).get('/api/users')).status, 403);
        assert.equal((await api(session).get('/api/backup/export')).status, 403);
        assert.equal((await api(session).put('/billing-api/company').send({ name: 'X' })).status, 403);
    }
});

test('users are deactivated, never deleted; the last admin stays', async () => {
    const team = sessionFor('admin');
    const other = sessionFor('nutricionista', team.orgId);
    assert.equal((await api(team).put(`/api/users/${team.userId}`).send({ role: 'recepcion' })).status, 409);
    assert.equal((await api(team).post(`/api/users/${team.userId}/deactivate`)).status, 400);

    const off = await api(team).post(`/api/users/${other.userId}/deactivate`);
    assert.equal(off.body.data.active, false);
    assert.equal((await api(other).get('/api/patients')).status, 401);
    assert.equal((await login(other.email, 'clave-segura-1')).status, 401);
    const list = (await api(team).get('/api/users')).body.data;
    assert.ok(list.some(u => u.id === other.userId && !u.active));

    await api(team).post(`/api/users/${other.userId}/reactivate`);
    const reset = await api(team).post(`/api/users/${other.userId}/reset-password`);
    assert.equal((await login(other.email, reset.body.data.temporaryPassword)).status, 200);
});

test('switching consultorio requires a membership there', async () => {
    const user = sessionFor('admin');
    const second = sessionFor('admin');
    assert.equal((await api(user).post('/api/auth/switch-org').send({ orgId: second.orgId })).status, 403);
    await api(second).post('/api/users').send({ name: 'X', email: user.email, role: 'nutricionista' });
    assert.equal((await api(user).post('/api/auth/switch-org').send({ orgId: second.orgId })).status, 200);
    const me = (await api(user).get('/api/auth/me')).body.data;
    assert.equal(me.organization.id, second.orgId);
    assert.equal(me.role, 'nutricionista');
    assert.equal(me.memberships.length, 2);
});
