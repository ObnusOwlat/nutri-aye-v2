// Full backup: raw rows of every consultorio table, lossless round trip.
// Import is an upsert by id inside one transaction: nothing is deleted.
const { db } = require('../db/connection');
const { LIBRARY_WHERE } = require('../repos/ingredients');

const FORMAT = 'nutri-aye-backup';
const VERSION = 4;

// Parent tables first (foreign keys). The USDA catalog is not included,
// except the foods used by recipes.
const TABLES = {
    ingredients: `SELECT * FROM ingredients WHERE ${LIBRARY_WHERE}`,
    recipes: 'SELECT * FROM recipes',
    recipe_ingredients: 'SELECT * FROM recipe_ingredients',
    patients: 'SELECT * FROM patients',
    patient_metrics: 'SELECT * FROM patient_metrics',
    patient_conditions: 'SELECT * FROM patient_conditions',
    patient_plans: 'SELECT * FROM patient_plans',
    patient_plan_meals: 'SELECT * FROM patient_plan_meals',
    patient_progress: 'SELECT * FROM patient_progress',
    week_planner: 'SELECT * FROM week_planner',
    week_planner_meals: 'SELECT * FROM week_planner_meals',
    billing_company: 'SELECT * FROM billing_company',
    billing_pdf_config: 'SELECT * FROM billing_pdf_config',
    billing_clients: 'SELECT * FROM billing_clients',
    billing_invoices: 'SELECT * FROM billing_invoices',
    billing_invoice_items: 'SELECT * FROM billing_invoice_items',
    billing_quotes: 'SELECT * FROM billing_quotes',
    billing_quote_items: 'SELECT * FROM billing_quote_items',
    billing_payment_methods: 'SELECT * FROM billing_payment_methods'
};

function exportBackup() {
    const tables = {};
    for (const [name, sql] of Object.entries(TABLES)) tables[name] = db.prepare(sql).all();
    return { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), tables };
}

const columnsOf = (table) => new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name));

// Returns a list of problems; empty = the backup can be imported
function checkBackup(backup) {
    const problems = [];
    if (backup?.format !== FORMAT) return ['No es un archivo de respaldo de Nutri Aye'];
    if (backup.version !== VERSION) return [`Versión de respaldo no soportada: ${backup.version} (se espera ${VERSION})`];
    if (!backup.tables || typeof backup.tables !== 'object') return ['El respaldo no tiene tablas'];

    for (const [name, rows] of Object.entries(backup.tables)) {
        if (!(name in TABLES)) { problems.push(`Tabla desconocida: ${name}`); continue; }
        if (!Array.isArray(rows)) { problems.push(`${name}: debe ser una lista`); continue; }
        const columns = columnsOf(name);
        rows.forEach((row, i) => {
            if (!row || typeof row !== 'object' || Array.isArray(row)) return problems.push(`${name}[${i}]: fila inválida`);
            if (typeof row.id !== 'string' || !row.id) problems.push(`${name}[${i}]: falta el id`);
            const unknown = Object.keys(row).filter(c => !columns.has(c));
            if (unknown.length) problems.push(`${name}[${i}]: columnas desconocidas ${unknown.join(', ')}`);
            const nested = Object.entries(row).filter(([, v]) => v !== null && typeof v === 'object');
            if (nested.length) problems.push(`${name}[${i}]: valores inválidos en ${nested.map(([c]) => c).join(', ')}`);
        });
        if (problems.length > 20) break;
    }
    return problems.slice(0, 20);
}

// Upsert every row; throws (and rolls back everything) on a constraint error
const importBackup = db.transaction((backup) => {
    const counts = {};
    for (const name of Object.keys(TABLES)) {
        const rows = backup.tables[name] || [];
        for (const row of rows) {
            const cols = Object.keys(row);
            const updates = cols.filter(c => c !== 'id').map(c => `${c} = excluded.${c}`);
            db.prepare(`
                INSERT INTO ${name} (${cols.join(', ')}) VALUES (${cols.map(c => `@${c}`).join(', ')})
                ON CONFLICT(id) DO ${updates.length ? `UPDATE SET ${updates.join(', ')}` : 'NOTHING'}
            `).run(row);
        }
        counts[name] = rows.length;
    }
    return counts;
});

module.exports = { exportBackup, checkBackup, importBackup, TABLES };
