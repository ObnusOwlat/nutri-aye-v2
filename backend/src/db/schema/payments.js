// Fase 8: payments of internal receipts (no fiscal value). Deactivated, never deleted.
function createPaymentTables(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS billing_payments (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL REFERENCES organizations(id),
            invoice_id TEXT NOT NULL REFERENCES billing_invoices(id),
            amount REAL NOT NULL,
            date TEXT NOT NULL,
            method_id TEXT REFERENCES billing_payment_methods(id),
            notes TEXT DEFAULT '',
            created_at TEXT NOT NULL,
            created_by TEXT,
            deactivated_at TEXT,
            deactivated_by TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_billing_payments_invoice ON billing_payments(invoice_id);
        CREATE INDEX IF NOT EXISTS idx_billing_payments_org ON billing_payments(org_id, date);
    `);
}

module.exports = { createPaymentTables };
