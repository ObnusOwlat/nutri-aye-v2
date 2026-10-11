// Which consultorio owns each backed-up row. Tables with org_id are owned
// directly; the rest through their parent row (fk -> parent table).
const { db } = require('../db/connection');

// Parents first (import order)
const TABLES = [
    { name: 'ingredients', org: true },
    { name: 'recipes', org: true },
    { name: 'recipe_ingredients', parent: ['recipe_id', 'recipes'] },
    { name: 'patients', org: true },
    { name: 'patient_metrics', parent: ['patient_id', 'patients'] },
    { name: 'patient_conditions', parent: ['patient_id', 'patients'] },
    { name: 'patient_plans', parent: ['patient_id', 'patients'] },
    { name: 'patient_plan_meals', parent: ['patient_plan_id', 'patient_plans'] },
    { name: 'patient_progress', parent: ['patient_id', 'patients'] },
    { name: 'week_planner', parent: ['patient_id', 'patients'] },
    { name: 'week_planner_meals', parent: ['planner_id', 'week_planner'] },
    { name: 'billing_company', org: true },
    { name: 'billing_pdf_config', parent: ['company_id', 'billing_company'] },
    { name: 'billing_clients', org: true },
    { name: 'billing_invoices', org: true },
    { name: 'billing_invoice_items', parent: ['invoice_id', 'billing_invoices'] },
    { name: 'billing_quotes', org: true },
    { name: 'billing_quote_items', parent: ['quote_id', 'billing_quotes'] },
    { name: 'billing_payment_methods', org: true },
    { name: 'billing_payments', org: true },
    { name: 'diet_templates', org: true }
];
const BY_NAME = Object.fromEntries(TABLES.map(t => [t.name, t]));

// Other columns that point to consultorio data: they must stay inside the consultorio
const REFERENCES = {
    recipe_ingredients: { ingredient_id: 'ingredients' },
    week_planner_meals: { recipe_id: 'recipes' },
    patient_plan_meals: { recipe_id: 'recipes' },
    patients: { billing_client_id: 'billing_clients' },
    billing_clients: { company_id: 'billing_company' },
    billing_invoices: { client_id: 'billing_clients', company_id: 'billing_company' },
    billing_quotes: { client_id: 'billing_clients', company_id: 'billing_company' },
    billing_payment_methods: { company_id: 'billing_company' },
    billing_payments: { invoice_id: 'billing_invoices', method_id: 'billing_payment_methods' }
};

// SQL condition selecting the consultorio's rows of a table (named param @orgId)
function ownedWhere(name) {
    const table = BY_NAME[name];
    if (table.org) return 'org_id = @orgId';
    const [fk, parent] = table.parent;
    return `${fk} IN (SELECT id FROM ${parent} WHERE ${ownedWhere(parent)})`;
}

// Export query; catalog foods are included only when the consultorio's recipes use them
function exportSql(name) {
    if (name === 'ingredients') {
        return `SELECT * FROM ingredients WHERE org_id = @orgId OR (org_id IS NULL AND id IN (
            SELECT ingredient_id FROM recipe_ingredients WHERE ${ownedWhere('recipe_ingredients')}))`;
    }
    return `SELECT * FROM ${name} WHERE ${ownedWhere(name)}`;
}

// undefined = row does not exist; null = catalog (no owner); otherwise the org id
function ownerOf(name, id) {
    const table = BY_NAME[name];
    if (table.org) {
        const row = db.prepare(`SELECT org_id FROM ${name} WHERE id = ?`).get(id);
        return row ? row.org_id : undefined;
    }
    const [fk, parent] = table.parent;
    const row = db.prepare(`SELECT ${fk} AS parent_id FROM ${name} WHERE id = ?`).get(id);
    return row ? ownerOf(parent, row.parent_id) : undefined;
}

module.exports = { TABLES, BY_NAME, REFERENCES, exportSql, ownerOf };
