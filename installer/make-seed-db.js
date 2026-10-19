// Starting database for a new installation, made from an existing one:
// keeps the food catalog, recipes, templates and routines of its consultorio;
// removes users, sessions, patients, billing and the change log. The first
// admin created on the new computer takes that consultorio (routes/auth.js).
//   node installer/make-seed-db.js <source.sqlite> <out.sqlite>
const fs = require('fs');
const Database = require('../backend/node_modules/better-sqlite3');

// Children first (foreign keys)
const CLEAR = [
    'sessions', 'memberships', 'audit_log',
    'week_planner_meals', 'week_planner', 'patient_plan_meals', 'patient_plans', 'patient_progress',
    'patient_targets', 'patient_metrics', 'patient_conditions',
    'billing_payments', 'billing_invoice_items', 'billing_invoices', 'billing_quote_items', 'billing_quotes',
    'billing_clients', 'billing_payment_methods', 'billing_pdf_config', 'billing_company', 'patients', 'users'
];
// Deactivated templates (tests and discarded ones) do not travel
const ACTIVE_ONLY = ['diet_templates', 'day_templates', 'activity_templates'];

async function main([source, out]) {
    if (!source || !out) throw new Error('Uso: node make-seed-db.js <origen.sqlite> <salida.sqlite>');
    if (fs.existsSync(out)) fs.unlinkSync(out);
    const from = new Database(source, { readonly: true });
    await from.backup(out);
    from.close();

    const db = new Database(out);
    db.pragma('foreign_keys = ON');
    const tables = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map(t => t.name));
    const orgs = db.prepare('SELECT COUNT(*) n FROM organizations').get().n;
    if (orgs !== 1) throw new Error(`La base de origen tiene ${orgs} consultorios; se espera uno solo`);
    // The change log refuses deletes (triggers): lifted only in this copy, then put back as they were
    const guards = db.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'audit_log'").all();
    db.transaction(() => {
        for (const g of guards) db.exec(`DROP TRIGGER ${g.name}`);
        for (const t of CLEAR) if (tables.has(t)) db.prepare(`DELETE FROM ${t}`).run();
        for (const t of ACTIVE_ONLY) if (tables.has(t)) db.prepare(`DELETE FROM ${t} WHERE deactivated_at IS NOT NULL`).run();
        db.prepare("UPDATE organizations SET name = 'Consultorio principal'").run();
        for (const g of guards) db.exec(g.sql);
    })();
    db.exec('VACUUM');
    const count = (t) => (tables.has(t) ? db.prepare(`SELECT COUNT(*) n FROM ${t}`).get().n : 0);
    console.log(`Base inicial: ${count('ingredients')} alimentos, ${count('recipes')} recetas, ` +
        `${count('diet_templates')} plantillas de semana, ${count('day_templates')} de día, ${count('activity_templates')} rutinas; ` +
        `${count('patients')} pacientes, ${count('users')} usuarios`);
    db.close();
}

main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exit(1); });
