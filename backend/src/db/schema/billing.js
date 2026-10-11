// Billing: company, clients, invoices, quotes, payment methods

function createBillingTables(db) {
    // ==========================================
    // BILLING (Unified - same database)
    // ==========================================

    db.exec(`
        CREATE TABLE IF NOT EXISTS billing_company (
            id TEXT PRIMARY KEY,
            name TEXT,
            email TEXT,
            phone TEXT,
            address TEXT,
            city TEXT,
            country TEXT DEFAULT 'USA',
            currency TEXT DEFAULT 'USD',
            vat_id TEXT,
            website TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS billing_pdf_config (
            id TEXT PRIMARY KEY,
            company_id TEXT NOT NULL REFERENCES billing_company(id) ON DELETE CASCADE,
            font_family TEXT DEFAULT 'Helvetica',
            padding INTEGER DEFAULT 40,
            primary_color TEXT DEFAULT '#22c55e',
            secondary_color TEXT DEFAULT '#64748b',
            include_logo INTEGER DEFAULT 0,
            logo_b64 TEXT
        );

        CREATE TABLE IF NOT EXISTS billing_clients (
            id TEXT PRIMARY KEY,
            company_id TEXT REFERENCES billing_company(id),
            name TEXT NOT NULL,
            email TEXT,
            phone TEXT,
            address TEXT,
            city TEXT,
            country TEXT DEFAULT 'USA',
            type TEXT DEFAULT 'INDIVIDUAL',
            vat_id TEXT,
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS billing_invoices (
            id TEXT PRIMARY KEY,
            company_id TEXT REFERENCES billing_company(id),
            client_id TEXT REFERENCES billing_clients(id),
            invoice_number TEXT NOT NULL UNIQUE,
            status TEXT DEFAULT 'UNPAID',
            date TEXT,
            due_date TEXT,
            subtotal REAL DEFAULT 0,
            discount REAL DEFAULT 0,
            total REAL DEFAULT 0,
            paid_at TEXT,
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS billing_invoice_items (
            id TEXT PRIMARY KEY,
            invoice_id TEXT NOT NULL REFERENCES billing_invoices(id) ON DELETE CASCADE,
            description TEXT,
            quantity REAL DEFAULT 1,
            unit_price REAL DEFAULT 0,
            type TEXT DEFAULT 'SERVICE'
        );

        CREATE TABLE IF NOT EXISTS billing_quotes (
            id TEXT PRIMARY KEY,
            company_id TEXT REFERENCES billing_company(id),
            client_id TEXT REFERENCES billing_clients(id),
            quote_number TEXT NOT NULL UNIQUE,
            status TEXT DEFAULT 'DRAFT',
            date TEXT,
            valid_until TEXT,
            subtotal REAL DEFAULT 0,
            discount REAL DEFAULT 0,
            total REAL DEFAULT 0,
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS billing_quote_items (
            id TEXT PRIMARY KEY,
            quote_id TEXT NOT NULL REFERENCES billing_quotes(id) ON DELETE CASCADE,
            description TEXT,
            quantity REAL DEFAULT 1,
            unit_price REAL DEFAULT 0,
            type TEXT DEFAULT 'SERVICE'
        );

        CREATE TABLE IF NOT EXISTS billing_payment_methods (
            id TEXT PRIMARY KEY,
            company_id TEXT REFERENCES billing_company(id),
            name TEXT NOT NULL,
            type TEXT DEFAULT 'BANK_TRANSFER',
            instructions TEXT DEFAULT '',
            is_default INTEGER DEFAULT 0
        );

        CREATE INDEX IF NOT EXISTS idx_billing_clients_name ON billing_clients(name COLLATE NOCASE);
        CREATE INDEX IF NOT EXISTS idx_billing_invoices_client ON billing_invoices(client_id);
        CREATE INDEX IF NOT EXISTS idx_billing_invoice_items_invoice ON billing_invoice_items(invoice_id);
        CREATE INDEX IF NOT EXISTS idx_billing_quotes_client ON billing_quotes(client_id);
        CREATE INDEX IF NOT EXISTS idx_billing_quote_items_quote ON billing_quote_items(quote_id);
    `);

    // patients.billing_client_id (added after the patients table existed)
    const patientCols = db.prepare('PRAGMA table_info(patients)').all().map(c => c.name);
    if (!patientCols.includes('billing_client_id')) {
        db.exec('ALTER TABLE patients ADD COLUMN billing_client_id TEXT');
    }
}

module.exports = { createBillingTables };
