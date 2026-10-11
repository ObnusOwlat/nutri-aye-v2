// How each audited entity is read for its before/after snapshot.
// patientId links an entry to a patient's history.
const { db } = require('../db/connection');

const lines = (sql) => (id) => db.prepare(sql).all(id);

const ENTITIES = {
    patient: { table: 'patients', patientId: (row, id) => id },
    metric: { table: 'patient_metrics', patientId: (row) => row.patient_id },
    condition: { table: 'patient_conditions', patientId: (row) => row.patient_id },
    planner: {
        table: 'week_planner',
        patientId: (row) => row.patient_id,
        extra: { meals: lines('SELECT day, meal_type, recipe_id FROM week_planner_meals WHERE planner_id = ? ORDER BY day, meal_type') }
    },
    plan: {
        table: 'patient_plans',
        patientId: (row) => row.patient_id,
        extra: { meals: lines('SELECT day_of_week, meal_type, recipe_id FROM patient_plan_meals WHERE patient_plan_id = ? ORDER BY day_of_week, meal_type') }
    },
    progress: { table: 'patient_progress', patientId: (row) => row.patient_id },
    template: { table: 'diet_templates' },
    recipe: {
        table: 'recipes',
        extra: { ingredients: lines('SELECT ingredient_id, grams FROM recipe_ingredients WHERE recipe_id = ? ORDER BY ingredient_id') }
    },
    ingredient: { table: 'ingredients' },
    billing_client: { table: 'billing_clients' },
    invoice: {
        table: 'billing_invoices',
        extra: { items: lines('SELECT description, quantity, unit_price, type FROM billing_invoice_items WHERE invoice_id = ? ORDER BY rowid') }
    },
    quote: {
        table: 'billing_quotes',
        extra: { items: lines('SELECT description, quantity, unit_price, type FROM billing_quote_items WHERE quote_id = ? ORDER BY rowid') }
    },
    payment_method: { table: 'billing_payment_methods' },
    company: { table: 'billing_company' },
    pdf_config: { table: 'billing_pdf_config' },
    // A user as seen by one consultorio: name, email and their role there
    user: {
        read: (id, ctx) => db.prepare(`
            SELECT u.id, u.name, u.email, m.role, m.deactivated_at, m.deactivated_by
            FROM users u JOIN memberships m ON m.user_id = u.id AND m.org_id = ?
            WHERE u.id = ?
        `).get(ctx.orgId, id)
    }
};

// Columns that are noise in a diff, or must never be copied into the log
const IGNORED = new Set(['created_at', 'updated_at', 'org_id', 'company_id', 'id']);
const HIDDEN = new Set(['password_hash', 'photo', 'logo_b64']);

// Plain object with the entity's current values, or null if it does not exist
function snapshot(entity, id, ctx) {
    const def = ENTITIES[entity];
    if (!def) throw new Error(`Entidad sin auditoría: ${entity}`);
    const row = def.read ? def.read(id, ctx) : db.prepare(`SELECT * FROM ${def.table} WHERE id = ?`).get(id);
    if (!row) return null;
    const values = {};
    for (const [key, value] of Object.entries(row)) {
        if (IGNORED.has(key)) continue;
        values[key] = HIDDEN.has(key) ? (value ? '(oculto)' : null) : value;
    }
    for (const [key, read] of Object.entries(def.extra || {})) values[key] = read(id);
    return values;
}

const patientIdOf = (entity, values, id) => (values && ENTITIES[entity].patientId ? ENTITIES[entity].patientId(values, id) : null);

module.exports = { ENTITIES, snapshot, patientIdOf };
