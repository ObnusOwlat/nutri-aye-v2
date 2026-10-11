// Weekly planner per patient

function createPlannerTables(db) {
    // ==========================================
    // WEEK_PLANNER (2NF - Depends on patient PK)
    // ==========================================

    db.exec(`
        CREATE TABLE IF NOT EXISTS week_planner (
            id TEXT PRIMARY KEY,
            patient_id TEXT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
            template_id TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS week_planner_meals (
            id TEXT PRIMARY KEY,
            planner_id TEXT NOT NULL REFERENCES week_planner(id) ON DELETE CASCADE,
            day TEXT NOT NULL,
            meal_type TEXT NOT NULL,
            recipe_id TEXT REFERENCES recipes(id) ON DELETE SET NULL,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_week_planner_patient ON week_planner(patient_id);
        CREATE INDEX IF NOT EXISTS idx_week_planner_meals_planner ON week_planner_meals(planner_id);
    `);
}

module.exports = { createPlannerTables };
