// Numbered schema migrations, recorded in schema_version.
// Migration 1 is the original idempotent schema, so existing databases adopt it safely.
// New changes go at the end as { version, name, up(db) } and never edit old ones.
const { db } = require('./connection');
const { logger } = require('../lib/logger');
const { createCatalogTables } = require('./schema/catalog');
const { createPatientTables } = require('./schema/patients');
const { migrateCategories } = require('./schema/categories');
const { createNutrientTables } = require('./schema/nutrients');
const { createPlannerTables } = require('./schema/planner');
const { createBillingTables } = require('./schema/billing');
const { createViews } = require('./schema/views');

const MIGRATIONS = [
    {
        version: 1,
        name: 'esquema inicial',
        up(conn) {
            createCatalogTables(conn);
            createPatientTables(conn);
            migrateCategories(conn);
            createNutrientTables(conn);
            createPlannerTables(conn);
            createBillingTables(conn);
            createViews(conn);
        }
    },
    {
        version: 2,
        name: 'facturación en guaraníes por defecto',
        up(conn) {
            // SQLite cannot change column defaults: new rows get them from the
            // validation layer; existing empty company/clients move to Paraguay
            conn.exec(`
                UPDATE billing_company SET country = 'Paraguay', currency = 'PYG' WHERE country = 'USA' AND currency = 'USD';
                UPDATE billing_clients SET country = 'Paraguay' WHERE country = 'USA';
            `);
        }
    }
];

function migrate() {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    const current = db.prepare('SELECT COALESCE(MAX(version), 0) AS v FROM schema_version').get().v;
    for (const m of MIGRATIONS.filter(x => x.version > current)) {
        db.transaction(() => {
            m.up(db);
            db.prepare('INSERT INTO schema_version (version, name) VALUES (?, ?)').run(m.version, m.name);
        })();
        logger.info({ version: m.version }, `Migración aplicada: ${m.name}`);
    }
}

module.exports = { migrate, MIGRATIONS };
