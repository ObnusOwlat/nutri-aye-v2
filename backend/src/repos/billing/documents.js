// Invoices and quotes share one implementation: numbered header + line items.
// Totals are always computed here from the items, never trusted from the client.
// Numbering is per consultorio. "Delete" deactivates (numbers are never reused).
const { db } = require('../../db/connection');
const { camelizeRow } = require('../../transforms');
const { newId, nowIso } = require('../../lib/http');
const company = require('./company');
const payments = require('./payments');

const KINDS = {
    invoice: { table: 'billing_invoices', items: 'billing_invoice_items', fk: 'invoice_id', number: 'invoice_number', prefix: 'REC-', dateField: ['dueDate', 'due_date'], extra: [['paidAt', 'paid_at']], withPayments: true },
    quote: { table: 'billing_quotes', items: 'billing_quote_items', fk: 'quote_id', number: 'quote_number', prefix: 'PRE-', dateField: ['validUntil', 'valid_until'], extra: [] }
};

function documentsRepo(kind) {
    const k = KINDS[kind];
    const fields = [['clientId', 'client_id'], ['status', 'status'], ['date', 'date'], k.dateField, ...k.extra,
        ['subtotal', 'subtotal'], ['discount', 'discount'], ['total', 'total'], ['notes', 'notes']];
    const columns = fields.map(([, c]) => c);
    const paidColumn = k.withPayments ? `, ${payments.PAID_SQL} AS paid` : '';
    // Receipts carry what was paid and what is still owed
    const withBalance = (row) => {
        if (!k.withPayments) return camelizeRow(row);
        const { paid, ...rest } = row;
        return { ...camelizeRow(rest), ...payments.summary(row) };
    };

    const stmts = {
        byId: db.prepare(`
            SELECT d.*, c.name AS client_name, c.email AS client_email, c.address AS client_address, c.vat_id AS client_vat_id${paidColumn}
            FROM ${k.table} d LEFT JOIN billing_clients c ON d.client_id = c.id
            WHERE d.id = @id AND d.org_id = @orgId AND d.deactivated_at IS NULL
        `),
        items: db.prepare(`SELECT id, description, quantity, unit_price, type FROM ${k.items} WHERE ${k.fk} = ? ORDER BY rowid`),
        // Includes deactivated documents: a number is never given twice
        lastNumber: db.prepare(`SELECT MAX(CAST(SUBSTR(${k.number}, ${k.prefix.length + 1}) AS INTEGER)) AS n FROM ${k.table} WHERE org_id = ? AND ${k.number} LIKE '${k.prefix}%'`),
        insert: db.prepare(`
            INSERT INTO ${k.table} (id, org_id, company_id, ${k.number}, ${columns.join(', ')}, created_at, updated_at)
            VALUES (@id, @orgId, @companyId, @number, ${columns.map(c => `@${c}`).join(', ')}, @now, @now)
        `),
        update: db.prepare(`UPDATE ${k.table} SET ${columns.map(c => `${c} = @${c}`).join(', ')}, updated_at = @now WHERE id = @id`),
        clearItems: db.prepare(`DELETE FROM ${k.items} WHERE ${k.fk} = ?`),
        insertItem: db.prepare(`INSERT INTO ${k.items} (id, ${k.fk}, description, quantity, unit_price, type) VALUES (?, ?, ?, ?, ?, ?)`),
        deactivate: db.prepare(`UPDATE ${k.table} SET deactivated_at = @now, deactivated_by = @userId WHERE id = @id AND org_id = @orgId AND deactivated_at IS NULL`)
    };

    function list(ctx, { clientId, status, limit, offset }) {
        const where = ['d.org_id = ?', 'd.deactivated_at IS NULL'];
        const params = [ctx.orgId];
        if (clientId) { where.push('d.client_id = ?'); params.push(clientId); }
        if (status) { where.push('d.status = ?'); params.push(status); }
        const whereSql = where.join(' AND ');
        const { total } = db.prepare(`SELECT COUNT(*) AS total FROM ${k.table} d WHERE ${whereSql}`).get(...params);
        const rows = db.prepare(`
            SELECT d.*, c.name AS client_name${paidColumn} FROM ${k.table} d LEFT JOIN billing_clients c ON d.client_id = c.id
            WHERE ${whereSql} ORDER BY d.created_at DESC LIMIT ? OFFSET ?
        `).all(...params, limit, offset);
        return { rows: rows.map(withBalance), total };
    }

    function getById(ctx, id, { withCompany = false } = {}) {
        const row = stmts.byId.get({ id, orgId: ctx.orgId });
        if (!row) return null;
        const doc = { ...withBalance(row), items: stmts.items.all(id).map(camelizeRow) };
        if (k.withPayments) doc.payments = payments.listFor(id);
        return withCompany ? { ...doc, company: company.get(ctx), pdfConfig: company.getPdfConfig(ctx) } : doc;
    }

    const totals = (items, discount) => {
        const subtotal = items.reduce((sum, i) => sum + i.quantity * i.unitPrice, 0);
        return { subtotal, total: Math.max(0, subtotal - discount) };
    };

    function writeItems(id, items) {
        stmts.clearItems.run(id);
        for (const i of items) stmts.insertItem.run(newId(), id, i.description, i.quantity, i.unitPrice, i.type);
    }

    // A receipt's status and payment date come from its payments, never from the request
    const toParams = (data, items, existing = null) => {
        if (k.withPayments) data = { ...data, status: existing?.status || 'UNPAID', paidAt: existing?.paidAt ?? null };
        const params = Object.fromEntries(fields.map(([key, column]) => [column, data[key] ?? null]));
        return { ...params, ...totals(items, data.discount), notes: data.notes ?? '' };
    };

    const create = db.transaction((ctx, data) => {
        const id = newId();
        const items = data.items || [];
        const number = `${k.prefix}${String((stmts.lastNumber.get(ctx.orgId).n || 0) + 1).padStart(4, '0')}`;
        stmts.insert.run({ ...toParams(data, items), id, orgId: ctx.orgId, number, companyId: company.getRow(ctx)?.id ?? null, now: nowIso() });
        writeItems(id, items);
        return getById(ctx, id);
    });

    // Without items in the request, the stored items stay and totals are recomputed from them
    const update = db.transaction((ctx, id, data) => {
        const existing = getById(ctx, id);
        if (!existing) return null;
        const items = data.items || existing.items;
        stmts.update.run({ ...toParams(data, items, existing), id, now: nowIso() });
        if (data.items) writeItems(id, items);
        if (k.withPayments) payments.recompute(ctx, id);
        return getById(ctx, id);
    });

    const deactivate = (ctx, id) => stmts.deactivate.run({ id, orgId: ctx.orgId, userId: ctx.userId, now: nowIso() }).changes > 0;

    return { list, getById, create, update, deactivate };
}

module.exports = { invoices: documentsRepo('invoice'), quotes: documentsRepo('quote') };
