// Meal day templates of a consultorio: one reusable day of the planner
// ({ mealType: recipeId }). Deactivated, never deleted.
function createDayTemplates(db) {
    db.exec(`
        CREATE TABLE IF NOT EXISTS day_templates (
            id TEXT PRIMARY KEY,
            org_id TEXT NOT NULL REFERENCES organizations(id),
            name TEXT NOT NULL,
            description TEXT DEFAULT '',
            meals TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            deactivated_at TEXT,
            deactivated_by TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_day_templates_org ON day_templates(org_id);
    `);
}

module.exports = { createDayTemplates };
