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
const { createOrganizationTables } = require('./schema/organizations');
const { rebuildDocumentTables } = require('./schema/billing-numbering');
const { createAuditLog } = require('./schema/audit');
const { createServerFirstTables } = require('./schema/server-first');

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
    },
    {
        version: 3,
        name: 'consultorios, usuarios, sesiones y desactivación en lugar de borrado',
        up: createOrganizationTables
    },
    {
        version: 4,
        name: 'numeración de facturas y presupuestos por consultorio',
        foreignKeysOff: true,
        checkTables: ['billing_invoices', 'billing_quotes', 'billing_invoice_items', 'billing_quote_items'],
        up: rebuildDocumentTables
    },
    {
        version: 5,
        name: 'registro de cambios (solo agregar)',
        up: createAuditLog
    },
    {
        version: 6,
        name: 'todo en el servidor: actividad física, medidas, planes y plantillas',
        up: createServerFirstTables
    }
];

function migrate() {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    const current = db.prepare('SELECT COALESCE(MAX(version), 0) AS v FROM schema_version').get().v;
    for (const m of MIGRATIONS.filter(x => x.version > current)) {
        // Table rebuilds need foreign keys off (cannot change inside a transaction)
        if (m.foreignKeysOff) db.pragma('foreign_keys = OFF');
        try {
            db.transaction(() => {
                m.up(db);
                const broken = (m.checkTables || []).flatMap(t => db.pragma(`foreign_key_check(${t})`));
                if (broken.length) throw new Error(`La migración ${m.version} dejaría referencias rotas`);
                db.prepare('INSERT INTO schema_version (version, name) VALUES (?, ?)').run(m.version, m.name);
            })();
        } finally {
            if (m.foreignKeysOff) db.pragma('foreign_keys = ON');
        }
        logger.info({ version: m.version }, `Migración aplicada: ${m.name}`);
    }
}

module.exports = { migrate, MIGRATIONS };
