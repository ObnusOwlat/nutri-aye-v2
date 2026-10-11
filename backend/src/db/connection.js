// Single SQLite connection shared by the whole backend
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { DB_PATH } = require('../config');

if (DB_PATH !== ':memory:') {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Accent/case-insensitive search: unaccent('Limón') = 'limon'
const unaccent = (text) => (text == null ? null : String(text).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase());
db.function('unaccent', { deterministic: true }, unaccent);

module.exports = { db, unaccent };
