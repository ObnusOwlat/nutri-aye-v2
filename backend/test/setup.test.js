// First run: no users yet (this file does not use helpers, so the database is empty)
process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app } = require('../server');

test('the first admin is created once, then setup is closed', async () => {
    assert.equal((await request(app).get('/api/auth/status')).body.data.setupRequired, true);
    const bad = await request(app).post('/api/auth/setup').send({ name: 'Ana', email: 'ana@ejemplo.com', password: 'corta' });
    assert.equal(bad.status, 400);

    const res = await request(app).post('/api/auth/setup').send({ orgName: 'Nutri Aye Asunción', name: 'Ana', email: 'ana@ejemplo.com', password: 'clave-segura-1' });
    assert.equal(res.status, 201);
    const cookie = res.headers['set-cookie'][0].split(';')[0];
    const me = (await request(app).get('/api/auth/me').set('Cookie', cookie)).body.data;
    assert.equal(me.role, 'admin');
    assert.equal(me.organization.name, 'Nutri Aye Asunción');

    const again = await request(app).post('/api/auth/setup').send({ name: 'Eva', email: 'eva@ejemplo.com', password: 'clave-segura-1' });
    assert.equal(again.status, 409);
});
