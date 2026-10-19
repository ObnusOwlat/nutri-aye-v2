const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { api, sessionFor, createPatient } = require('./helpers');
const daily = require('../src/backup/daily');
const Database = require('better-sqlite3');

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'nutri-respaldo-'));

test('one automatic copy per day, readable, and only the last ones are kept', async () => {
    const dir = tempDir();
    await createPatient({ firstName: 'Copia diaria' });
    const day = new Date(2026, 9, 18, 9);
    assert.equal(await daily.runDaily({ dir, keep: 3, now: day }), 'nutri-aye-2026-10-18.sqlite');
    assert.equal(await daily.runDaily({ dir, keep: 3, now: new Date(2026, 9, 18, 23) }), null); // same day: no second copy

    const copy = new Database(path.join(dir, 'nutri-aye-2026-10-18.sqlite'), { readonly: true });
    assert.equal(copy.prepare("SELECT COUNT(*) n FROM patients WHERE first_name = 'Copia diaria'").get().n, 1);
    copy.close();

    for (const d of [19, 20, 21]) await daily.runDaily({ dir, keep: 3, now: new Date(2026, 9, d, 9) });
    fs.writeFileSync(path.join(dir, 'otra-cosa.txt'), 'no se toca');
    assert.deepEqual(daily.listCopies(dir).map(c => c.date), ['2026-10-21', '2026-10-20', '2026-10-19']);
    assert.ok(fs.existsSync(path.join(dir, 'otra-cosa.txt')));
    assert.ok(!fs.readdirSync(dir).some(f => f.endsWith('.parcial')));
});

test('the status of the automatic copies is for admins only', async () => {
    const status = await api().get('/api/backup/auto');
    assert.equal(status.status, 200);
    assert.equal(status.body.data.keep, 30);
    assert.equal((await api(sessionFor('nutricionista')).get('/api/backup/auto')).status, 403);
});
