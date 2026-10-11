// Fase 7: per-patient adjustments of the automatic nutritional targets.
// key = 'energy' or a USDA nutrient id; target NULL = back to the automatic
// value (rows are updated, never deleted).
function createTargetTables(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS patient_targets (
            patient_id TEXT NOT NULL REFERENCES patients(id),
            target_key TEXT NOT NULL,
            target REAL,
            updated_at TEXT NOT NULL,
            updated_by TEXT,
            PRIMARY KEY (patient_id, target_key)
        );
    `);
}

module.exports = { createTargetTables };
