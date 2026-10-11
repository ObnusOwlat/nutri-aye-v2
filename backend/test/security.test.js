const { test } = require('node:test');
const assert = require('node:assert/strict');
const { api } = require('./helpers');

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

test('internal errors do not leak database messages', async () => {
    // last_name is NOT NULL in the schema
    const res = await api().post('/api/patients').send({ firstName: 'Solo' });
    assert.equal(res.status, 500);
    assert.equal(res.body.code, 'INTERNAL_ERROR');
    assert.doesNotMatch(JSON.stringify(res.body), /SQLITE|constraint/i);
});

test('ids sent by the client are ignored', async () => {
    const res = await api().post('/api/patients').send({ id: 'my-own-id', firstName: 'A', lastName: 'B' });
    assert.equal(res.status, 200);
    assert.notEqual(res.body.data.id, 'my-own-id');
});

test('backup import is disabled', async () => {
    const res = await api().post('/api/backup/import').send({ ingredients: [] });
    assert.equal(res.status, 503);
});
