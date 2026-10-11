// Backup of one consultorio: raw rows, lossless round trip. Import is an
// upsert by id inside one transaction: nothing is deleted, and rows of other
// consultorios can be neither changed nor referenced.
const { db } = require('../db/connection');
const { TABLES, BY_NAME, REFERENCES, exportSql, ownerOf } = require('./tables');
const { badRequest } = require('../lib/http');

const FORMAT = 'nutri-aye-backup';
const VERSION = 5;
const READABLE_VERSIONS = [4, 5]; // 4: before consultorios (rows get the importing one)

function exportBackup(ctx) {
    const tables = {};
    for (const { name } of TABLES) tables[name] = db.prepare(exportSql(name)).all({ orgId: ctx.orgId });
    return { format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), tables };
}

const columnsOf = (table) => new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name));

// Structure only (before touching the database); empty = OK
function checkBackup(backup) {
    const problems = [];
    if (backup?.format !== FORMAT) return ['No es un archivo de respaldo de Nutri Aye'];
    if (!READABLE_VERSIONS.includes(backup.version)) return [`Versión de respaldo no soportada: ${backup.version}`];
    if (!backup.tables || typeof backup.tables !== 'object') return ['El respaldo no tiene tablas'];

    for (const [name, rows] of Object.entries(backup.tables)) {
        if (!BY_NAME[name]) { problems.push(`Tabla desconocida: ${name}`); continue; }
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

function upsert(name, row) {
    const cols = Object.keys(row);
    const updates = cols.filter(c => c !== 'id').map(c => `${c} = excluded.${c}`);
    db.prepare(`
        INSERT INTO ${name} (${cols.join(', ')}) VALUES (${cols.map(c => `@${c}`).join(', ')})
        ON CONFLICT(id) DO ${updates.length ? `UPDATE SET ${updates.join(', ')}` : 'NOTHING'}
    `).run(row);
}

// Throws (rolling everything back) when a row would touch another consultorio
const importBackup = db.transaction((ctx, backup) => {
    const counts = {};
    const foreign = (where) => { throw badRequest(`El respaldo tiene datos de otro consultorio (${where}); no se importó nada`); };

    for (const { name, org, parent } of TABLES) {
        let imported = 0;
        for (const original of backup.tables[name] || []) {
            const row = org ? { ...original, org_id: ctx.orgId } : original;
            const owner = ownerOf(name, row.id);
            // Catalog foods are shared and read-only
            if (name === 'ingredients' && owner === null) continue;
            if (owner !== undefined && owner !== ctx.orgId) foreign(`${name} ${row.id}`);
            if (parent && ownerOf(parent[1], row[parent[0]]) !== ctx.orgId) foreign(`${name} ${row.id} → ${parent[1]}`);
            for (const [column, target] of Object.entries(REFERENCES[name] || {})) {
                if (row[column] == null) continue;
                const refOwner = ownerOf(target, row[column]);
                const catalogFood = target === 'ingredients' && refOwner === null;
                if (refOwner !== ctx.orgId && !catalogFood) foreign(`${name}.${column}`);
            }
            upsert(name, row);
            imported++;
        }
        counts[name] = imported;
    }
    return counts;
});

module.exports = { exportBackup, checkBackup, importBackup };
