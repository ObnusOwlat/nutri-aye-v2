// Weekly physical-activity plan (JSON) next to the meal week: in diet templates
// (routines "A / B / C") and in each patient's planner week
function addActivityPlans(db) {
    for (const table of ['diet_templates', 'week_planner']) {
        const columns = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
        if (!columns.includes('activity_plan')) db.exec(`ALTER TABLE ${table} ADD COLUMN activity_plan TEXT`);
    }
}

module.exports = { addActivityPlans };
