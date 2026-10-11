const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api } = require('./helpers');
const { errorHandler } = require('../src/lib/errors');

test('no CORS headers: other origins cannot read the API', async () => {
    const res = await api().get('/api/health').set('Origin', 'https://evil.example');
    assert.equal(res.status, 200);
    assert.equal(res.headers['access-control-allow-origin'], undefined);
});

test('security headers and CSP are set', async () => {
    const res = await api().get('/');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-security-policy'], /script-src 'self'/);
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-powered-by'], undefined);
});

test('only frontend/public is served', async () => {
    for (const path of ['/node_modules/uuid/package.json', '/package.json', '/src/state.ts', '/vite.config.ts']) {
        const res = await api().get(path);
        assert.equal(res.status, 404, path);
    }
    const js = await api().get('/js/app.js');
    assert.equal(js.status, 200);
});

test('invalid JSON returns 400, unknown route returns JSON 404', async () => {
    const bad = await api().post('/api/patients').set('Content-Type', 'application/json').send('{bad json');
    assert.equal(bad.status, 400);
    assert.equal(bad.body.code, 'INVALID_JSON');
    const missing = await api().get('/api/does-not-exist');
    assert.equal(missing.status, 404);
    assert.equal(missing.body.success, false);
});

test('bodies over 1 MB are rejected', async () => {
    const res = await api().post('/api/patients').send({ firstName: 'x'.repeat(1.2 * 1024 * 1024), lastName: 'y' });
    assert.equal(res.status, 413);
});

test('internal errors do not leak database messages', () => {
    let status, body;
    const res = { status(code) { status = code; return this; }, json(b) { body = b; } };
    const err = Object.assign(new Error('SQLITE_CONSTRAINT: NOT NULL constraint failed: patients.last_name'), { code: 'SQLITE_CONSTRAINT' });
    errorHandler(err, { log: { error() {} } }, res, () => {});
    assert.equal(status, 500);
    assert.equal(body.code, 'INTERNAL_ERROR');
    assert.doesNotMatch(JSON.stringify(body), /SQLITE|constraint/i);
});

test('every response carries a request id', async () => {
    const res = await api().get('/api/health');
    assert.match(res.headers['x-request-id'], /^[0-9a-f-]{36}$/);
});

test('ids sent by the client are ignored', async () => {
    const res = await api().post('/api/patients').send({ id: 'my-own-id', firstName: 'A', lastName: 'B' });
    assert.equal(res.status, 201);
    assert.notEqual(res.body.data.id, 'my-own-id');
});

test('backup import rejects files that are not a valid backup', async () => {
    assert.equal((await api().post('/api/backup/import').send({ ingredients: [] })).status, 400);
    const injection = await api().post('/api/backup/import').send({
        format: 'nutri-aye-backup', version: 4, tables: { patients: [{ id: 'x', 'first_name) VALUES (1); DROP TABLE patients; --': 1 }] }
    });
    assert.equal(injection.status, 400);
    assert.match(injection.body.error, /columnas desconocidas/);
    const unknownTable = await api().post('/api/backup/import').send({ format: 'nutri-aye-backup', version: 4, tables: { sqlite_master: [] } });
    assert.equal(unknownTable.status, 400);
});
