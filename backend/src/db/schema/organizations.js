// Fase 2: consultorios, users, memberships, sessions; org_id on consultorio
// data and soft delete (deactivated_at/by) everywhere. Nothing is ever deleted.

const DEFAULT_ORG_ID = 'org-principal';

// Tables owned directly by a consultorio (children are reached through them)
const ORG_TABLES = [
    'ingredients', 'recipes', 'patients', 'billing_company', 'billing_clients',
    'billing_invoices', 'billing_quotes', 'billing_payment_methods'
];

// Everything a user can "delete": it is deactivated instead
const SOFT_DELETE_TABLES = [
    'ingredients', 'recipes', 'patients', 'patient_metrics', 'patient_conditions',
    'patient_plans', 'patient_progress', 'week_planner', 'billing_clients',
    'billing_invoices', 'billing_quotes', 'billing_payment_methods'
];

function addColumn(db, table, column, type) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

function createOrganizationTables(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS organizations (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            deactivated_at TEXT,
            deactivated_by TEXT
        );

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL UNIQUE COLLATE NOCASE,
            name TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            must_change_password INTEGER NOT NULL DEFAULT 0,
            last_login_at TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            deactivated_at TEXT,
            deactivated_by TEXT
        );

        CREATE TABLE IF NOT EXISTS memberships (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL REFERENCES users(id),
            org_id TEXT NOT NULL REFERENCES organizations(id),
            role TEXT NOT NULL CHECK (role IN ('admin', 'nutricionista', 'recepcion')),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            deactivated_at TEXT,
            deactivated_by TEXT,
            UNIQUE (user_id, org_id)
        );

        -- token_hash = sha256 of the cookie value; logout revokes, never deletes
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            token_hash TEXT NOT NULL UNIQUE,
            user_id TEXT NOT NULL REFERENCES users(id),
            org_id TEXT NOT NULL REFERENCES organizations(id),
            ip TEXT,
            user_agent TEXT,
            created_at TEXT NOT NULL,
            last_seen_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            revoked_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);
        CREATE INDEX IF NOT EXISTS idx_memberships_org ON memberships(org_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    `);

    for (const table of ORG_TABLES) {
        addColumn(db, table, 'org_id', 'TEXT REFERENCES organizations(id)');
        db.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_org ON ${table}(org_id)`);
    }
    for (const table of SOFT_DELETE_TABLES) {
        addColumn(db, table, 'deactivated_at', 'TEXT');
        addColumn(db, table, 'deactivated_by', 'TEXT');
    }

    // Existing data belongs to a first consultorio. Catalog foods (USDA,
    // calories-in) stay global: org_id NULL, read-only for every consultorio.
    const hasData = db.prepare(`
        SELECT (SELECT COUNT(*) FROM patients) + (SELECT COUNT(*) FROM recipes)
             + (SELECT COUNT(*) FROM billing_company) + (SELECT COUNT(*) FROM billing_clients)
             + (SELECT COUNT(*) FROM ingredients WHERE source = 'user') AS n
    `).get().n > 0;
    if (hasData) {
        db.prepare('INSERT OR IGNORE INTO organizations (id, name) VALUES (?, ?)').run(DEFAULT_ORG_ID, 'Consultorio principal');
        for (const table of ORG_TABLES) {
            const onlyOwn = table === 'ingredients' ? " AND source = 'user'" : '';
            db.prepare(`UPDATE ${table} SET org_id = ? WHERE org_id IS NULL${onlyOwn}`).run(DEFAULT_ORG_ID);
        }
    }
}

module.exports = { createOrganizationTables, DEFAULT_ORG_ID, ORG_TABLES, SOFT_DELETE_TABLES };
