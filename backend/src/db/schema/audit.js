// Fase 3: audit log. Append-only: the database itself rejects UPDATE and DELETE.
function createAuditLog(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            org_id TEXT REFERENCES organizations(id),
            user_id TEXT REFERENCES users(id),
            action TEXT NOT NULL,
            entity TEXT NOT NULL,
            entity_id TEXT,
            patient_id TEXT,
            changes TEXT,
            ip TEXT,
            created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_audit_org_date ON audit_log(org_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_patient ON audit_log(patient_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity, entity_id);

        CREATE TRIGGER IF NOT EXISTS audit_log_no_update BEFORE UPDATE ON audit_log
        BEGIN SELECT RAISE(ABORT, 'El registro de cambios no se puede modificar'); END;

        CREATE TRIGGER IF NOT EXISTS audit_log_no_delete BEFORE DELETE ON audit_log
        BEGIN SELECT RAISE(ABORT, 'El registro de cambios no se puede borrar'); END;
    `);
}

module.exports = { createAuditLog };
