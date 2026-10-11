// Exercise routines of a consultorio: a reusable week of physical activity
// (same JSON as week_planner.activity_plan). Deactivated, never deleted.
function createActivityTemplates(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS activity_templates (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL REFERENCES organizations(id),
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            level TEXT DEFAULT 'beginner',
            activity_plan TEXT NOT NULL,
            is_example INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deactivated_at TEXT,
            deactivated_by TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_activity_templates_org ON activity_templates(org_id);
    `);
}

module.exports = { createActivityTemplates };
