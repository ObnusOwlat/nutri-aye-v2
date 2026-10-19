// Automatic daily copy of the whole database file (every consultorio), kept in
// BACKUP_DIR as nutri-aye-YYYY-MM-DD.sqlite. One copy per day: checked at start
// and every hour, so a computer turned on late still gets its copy. Only the
// last BACKUP_KEEP copies stay. SQLite's online backup: safe while in use.
const fs = require('fs');
const path = require('path');
const { db } = require('../db/connection');
const { BACKUP_DIR, BACKUP_KEEP, DB_PATH } = require('../config');
const { logger } = require('../lib/logger');

const PATTERN = /^nutri-aye-(\d{4}-\d{2}-\d{2})\.sqlite$/;
const HOUR = 60 * 60 * 1000;

const localDate = (d = new Date()) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// Newest first: [{ file, date, size }]
function listCopies(dir = BACKUP_DIR) {
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir)
        .filter(f => PATTERN.test(f))
        .map(f => ({ file: f, date: f.match(PATTERN)[1], size: fs.statSync(path.join(dir, f)).size }))
        .sort((a, b) => b.date.localeCompare(a.date));
}

// Today's copy if missing, then the old ones beyond `keep` are removed. Returns the file made or null.
async function runDaily({ dir = BACKUP_DIR, keep = BACKUP_KEEP, now = new Date() } = {}) {
    const file = `nutri-aye-${localDate(now)}.sqlite`;
    const target = path.join(dir, file);
    if (fs.existsSync(target)) return null;
    fs.mkdirSync(dir, { recursive: true });
    const partial = `${target}.parcial`; // a copy cut halfway never looks finished
    await db.backup(partial);
    fs.renameSync(partial, target);
    for (const old of listCopies(dir).slice(keep)) fs.unlinkSync(path.join(dir, old.file));
    logger.info(`Respaldo automático: ${target}`);
    return file;
}

function startDailyBackups() {
    if (DB_PATH === ':memory:') return null;
    const run = () => runDaily().catch(error => logger.error(`Respaldo automático falló: ${error.message}`));
    run();
    const timer = setInterval(run, HOUR);
    timer.unref();
    return timer;
}

function status() {
    const copies = listCopies();
    return { dir: BACKUP_DIR, keep: BACKUP_KEEP, count: copies.length, last: copies[0] || null };
}

module.exports = { runDaily, startDailyBackups, listCopies, status, localDate };
