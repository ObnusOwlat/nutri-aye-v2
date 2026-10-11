// Invoice/quote numbers unique per consultorio (they were unique in the whole
// database). SQLite cannot drop a UNIQUE constraint, so both tables are rebuilt
// following the official procedure; foreign keys are off during this migration
// so the items are kept.

const DOCUMENTS = [
    {
        table: 'billing_invoices', number: 'invoice_number', status: "'UNPAID'",
        dates: 'due_date TEXT, paid_at TEXT,'
    },
    {
        table: 'billing_quotes', number: 'quote_number', status: "'DRAFT'",
        dates: 'valid_until TEXT,'
    }
];

function rebuildDocumentTables(db) {
    for (const { table, number, status, dates } of DOCUMENTS) {
        const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
        db.exec(`
            CREATE TABLE ${table}_new (
                id TEXT PRIMARY KEY,
                org_id TEXT REFERENCES organizations(id),
                company_id TEXT REFERENCES billing_company(id),
                client_id TEXT REFERENCES billing_clients(id),
                ${number} TEXT NOT NULL,
                status TEXT DEFAULT ${status},
                date TEXT,
                ${dates}
                subtotal REAL DEFAULT 0,
                discount REAL DEFAULT 0,
                total REAL DEFAULT 0,
                notes TEXT DEFAULT '',
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                deactivated_at TEXT,
                deactivated_by TEXT,
                UNIQUE (org_id, ${number})
            );
            INSERT INTO ${table}_new (${columns.join(', ')}) SELECT ${columns.join(', ')} FROM ${table};
            DROP TABLE ${table};
            ALTER TABLE ${table}_new RENAME TO ${table};
            CREATE INDEX IF NOT EXISTS idx_${table}_client ON ${table}(client_id);
            CREATE INDEX IF NOT EXISTS idx_${table}_org ON ${table}(org_id);
        `);
    }
}

module.exports = { rebuildDocumentTables };
