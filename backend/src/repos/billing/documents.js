// Invoices and quotes share one implementation: numbered header + line items.
// Totals are always computed here from the items, never trusted from the client.
const { db } = require('../../db/connection');
const { camelizeRow } = require('../../transforms');
const { newId, nowIso } = require('../../lib/http');
const company = require('./company');

const KINDS = {
    invoice: { table: 'billing_invoices', items: 'billing_invoice_items', fk: 'invoice_id', number: 'invoice_number', prefix: 'INV-', dateField: ['dueDate', 'due_date'], extra: [['paidAt', 'paid_at']] },
    quote: { table: 'billing_quotes', items: 'billing_quote_items', fk: 'quote_id', number: 'quote_number', prefix: 'QT-', dateField: ['validUntil', 'valid_until'], extra: [] }
};

function documentsRepo(kind) {
    const k = KINDS[kind];
    const fields = [['clientId', 'client_id'], ['status', 'status'], ['date', 'date'], k.dateField, ...k.extra,
        ['subtotal', 'subtotal'], ['discount', 'discount'], ['total', 'total'], ['notes', 'notes']];
    const columns = fields.map(([, c]) => c);

    const stmts = {
        byId: db.prepare(`
            SELECT d.*, c.name AS client_name, c.email AS client_email, c.address AS client_address
            FROM ${k.table} d LEFT JOIN billing_clients c ON d.client_id = c.id WHERE d.id = ?
        `),
        items: db.prepare(`SELECT id, description, quantity, unit_price, type FROM ${k.items} WHERE ${k.fk} = ? ORDER BY rowid`),
        lastNumber: db.prepare(`SELECT MAX(CAST(SUBSTR(${k.number}, ${k.prefix.length + 1}) AS INTEGER)) AS n FROM ${k.table}`),
        insert: db.prepare(`
            INSERT INTO ${k.table} (id, company_id, ${k.number}, ${columns.join(', ')}, created_at, updated_at)
            VALUES (@id, @companyId, @number, ${columns.map(c => `@${c}`).join(', ')}, @now, @now)
        `),
        update: db.prepare(`UPDATE ${k.table} SET ${columns.map(c => `${c} = @${c}`).join(', ')}, updated_at = @now WHERE id = @id`),
        clearItems: db.prepare(`DELETE FROM ${k.items} WHERE ${k.fk} = ?`),
        insertItem: db.prepare(`INSERT INTO ${k.items} (id, ${k.fk}, description, quantity, unit_price, type) VALUES (?, ?, ?, ?, ?, ?)`),
        remove: db.prepare(`DELETE FROM ${k.table} WHERE id = ?`)
    };

    function list({ clientId, status, limit, offset }) {
        const where = ['1=1'];
        const params = [];
        if (clientId) { where.push('d.client_id = ?'); params.push(clientId); }
        if (status) { where.push('d.status = ?'); params.push(status); }
        const whereSql = where.join(' AND ');
        const { total } = db.prepare(`SELECT COUNT(*) AS total FROM ${k.table} d WHERE ${whereSql}`).get(...params);
        const rows = db.prepare(`
            SELECT d.*, c.name AS client_name FROM ${k.table} d LEFT JOIN billing_clients c ON d.client_id = c.id
            WHERE ${whereSql} ORDER BY d.created_at DESC LIMIT ? OFFSET ?
        `).all(...params, limit, offset);
        return { rows: rows.map(camelizeRow), total };
    }

    function getById(id, { withCompany = false } = {}) {
        const row = stmts.byId.get(id);
        if (!row) return null;
        const doc = { ...camelizeRow(row), items: stmts.items.all(id).map(camelizeRow) };
        return withCompany ? { ...doc, company: company.get(), pdfConfig: company.getPdfConfig() } : doc;
    }

    const totals = (items, discount) => {
        const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
        return { subtotal, total: Math.max(0, subtotal - discount) };
    };

    function writeItems(id, items) {
        stmts.clearItems.run(id);
        for (const i of items) stmts.insertItem.run(newId(), id, i.description, i.quantity, i.unitPrice, i.type);
    }

    const toParams = (data, items) => {
        const params = Object.fromEntries(fields.map(([key, column]) => [column, data[key] ?? null]));
        return { ...params, ...totals(items, data.discount), notes: data.notes ?? '' };
    };

    const create = db.transaction((data) => {
        const id = newId();
        const items = data.items || [];
        const number = `${k.prefix}${String((stmts.lastNumber.get().n || 0) + 1).padStart(4, '0')}`;
        stmts.insert.run({ ...toParams(data, items), id, number, companyId: company.getRow()?.id ?? null, now: nowIso() });
        writeItems(id, items);
        return getById(id);
    });

    // Without items in the request, the stored items stay and totals are recomputed from them
    const update = db.transaction((id, data) => {
        const existing = getById(id);
        if (!existing) return null;
        const items = data.items || existing.items;
        stmts.update.run({ ...toParams(data, items), id, now: nowIso() });
        if (data.items) writeItems(id, items);
        return getById(id);
    });

    const remove = (id) => stmts.remove.run(id).changes > 0; // items cascade

    return { list, getById, create, update, remove };
}

module.exports = { invoices: documentsRepo('invoice'), quotes: documentsRepo('quote') };
