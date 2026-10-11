// Fase 4: everything the browser kept on its own now lives in the server:
// physical activity, extra measurements, plan weeks and diet templates.

function addColumn(db, table, column, type) {
    const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    if (!columns.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

function createServerFirstTables(db) {
    addColumn(db, 'patients', 'physical_activity', 'TEXT'); // JSON: active, level, frequency...
    for (const column of ['cia_abdominal', 'cia_brazo', 'cia_pierna', 'cadera']) addColumn(db, 'patient_metrics', column, 'REAL');
    addColumn(db, 'patient_conditions', 'updated_at', 'TEXT');
    addColumn(db, 'patient_progress', 'updated_at', 'TEXT');

    // A consultorio's diet templates; week_plan is the planner draft of each one (JSON)
    db.exec(`
        CREATE TABLE IF NOT EXISTS diet_templates (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL REFERENCES organizations(id),
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            goal TEXT NOT NULL DEFAULT 'maintenance',
            daily_target INTEGER NOT NULL DEFAULT 2000,
            meal_distribution TEXT,
            week_plan TEXT,
            is_default INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deactivated_at TEXT,
            deactivated_by TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_diet_templates_org ON diet_templates(org_id);
    `);
}

module.exports = { createServerFirstTables };
