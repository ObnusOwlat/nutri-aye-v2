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
const { createDayTemplates } = require('./schema/day-templates');
const { createServerFirstTables } = require('./schema/server-first');
const { addFoodGroups } = require('./schema/food-groups');
const { addActivityPlans } = require('./schema/activity-plans');
const { markParaguayFoods } = require('./schema/paraguay');
const { createAllergenTables } = require('./schema/allergens');
const { translateCatalogNames, translateBasicFoods } = require('./schema/spanish-names');
const { createTargetTables, renameVitaminA } = require('./schema/targets');
const { createPaymentTables } = require('./schema/payments');
const { createActivityTemplates } = require('./schema/activity-templates');

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
    },
    {
        version: 7,
        name: 'nombres de categorías y unidades en español',
        up: translateCatalogNames
    },
    {
        version: 8,
        name: 'nombres del catálogo básico de alimentos en español',
        up: translateBasicFoods
    },
    {
        version: 9,
        name: 'ajustes de metas nutricionales por paciente',
        up: createTargetTables
    },
    {
        version: 10,
        name: 'nombre de la vitamina A sin la sigla EAR',
        up: renameVitaminA
    },
    {
        version: 11,
        name: 'pagos de los recibos internos',
        up: createPaymentTables
    },
    {
        version: 12,
        name: 'subgrupos (origen) y forma de preparación de los alimentos; categorías del catálogo básico',
        up: addFoodGroups
    },
    {
        version: 13,
        name: 'semana de actividad física en plantillas y en la semana del paciente',
        up: addActivityPlans
    },
    {
        version: 14,
        name: 'alimentos que se consiguen en Paraguay y correcciones de traducción',
        up: markParaguayFoods
    },
    {
        version: 15,
        name: 'alérgenos de los alimentos (Open Food Facts + reglas) y de las alergias de los pacientes',
        up: createAllergenTables
    },
    {
        version: 16,
        name: 'rutinas de ejercicio (plantillas de actividad)',
        up: createActivityTemplates
    },
    {
        version: 17,
        name: 'carne importada (Nueva Zelanda, Australia) deja de figurar como de Paraguay',
        up: markParaguayFoods
    },
    {
        version: 18,
        name: 'plantillas de día (comidas)',
        up: createDayTemplates
    }
];

function migrate() {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    // Every migration not applied yet, in order: a lower number merged later
    // (another branch) still runs instead of being skipped
    const applied = new Set(db.prepare('SELECT version FROM schema_version').all().map(r => r.version));
    for (const m of MIGRATIONS.filter(x => !applied.has(x.version))) {
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
