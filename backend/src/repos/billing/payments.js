// Payments of internal receipts (no fiscal value). A receipt is PAID when its
// active payments cover the total; a cancelled receipt takes no payments.
// "Delete" a payment deactivates it and the receipt's status is recomputed.
const { db } = require('../../db/connection');
const { camelizeRow } = require('../../transforms');
const { newId, nowIso } = require('../../lib/http');

const PAID_SQL = '(SELECT COALESCE(SUM(p.amount), 0) FROM billing_payments p WHERE p.invoice_id = d.id AND p.deactivated_at IS NULL)';

const stmts = {
    invoice: db.prepare(`SELECT d.*, ${PAID_SQL} AS paid FROM billing_invoices d WHERE d.id = @id AND d.org_id = @orgId AND d.deactivated_at IS NULL`),
    ofInvoice: db.prepare(`
        SELECT p.*, m.name AS method_name, m.type AS method_type, u.name AS created_by_name
        FROM billing_payments p
        LEFT JOIN billing_payment_methods m ON m.id = p.method_id
        LEFT JOIN users u ON u.id = p.created_by
        WHERE p.invoice_id = ? AND p.deactivated_at IS NULL ORDER BY p.date, p.created_at
    `),
    byId: db.prepare('SELECT * FROM billing_payments WHERE id = @id AND org_id = @orgId AND deactivated_at IS NULL'),
    method: db.prepare('SELECT id FROM billing_payment_methods WHERE id = @id AND org_id = @orgId AND deactivated_at IS NULL'),
    insert: db.prepare(`
        INSERT INTO billing_payments (id, org_id, invoice_id, amount, date, method_id, notes, created_at, created_by)
        VALUES (@id, @orgId, @invoiceId, @amount, @date, @methodId, @notes, @now, @userId)
    `),
    deactivate: db.prepare('UPDATE billing_payments SET deactivated_at = @now, deactivated_by = @userId WHERE id = @id'),
    setStatus: db.prepare('UPDATE billing_invoices SET status = @status, paid_at = @paidAt, updated_at = @now WHERE id = @id'),
    void: db.prepare(`UPDATE billing_invoices SET status = 'CANCELLED', updated_at = @now WHERE id = @id`)
};

const today = () => nowIso().slice(0, 10);
const listFor = (invoiceId) => stmts.ofInvoice.all(invoiceId).map(camelizeRow);

// { paidAmount, balance } of a receipt row that has a `paid` column
const summary = (row) => ({
    paidAmount: row.paid,
    balance: row.status === 'CANCELLED' ? 0 : Math.max(0, row.total - row.paid)
});

// PAID when fully covered; otherwise UNPAID, or OVERDUE once the due date passed
function recompute(ctx, invoiceId) {
    const row = stmts.invoice.get({ id: invoiceId, orgId: ctx.orgId });
    if (!row || row.status === 'CANCELLED') return;
    const paid = row.total > 0 && row.paid >= row.total;
    const status = paid ? 'PAID' : row.due_date && row.due_date.slice(0, 10) < today() ? 'OVERDUE' : 'UNPAID';
    const last = paid ? listFor(invoiceId).at(-1)?.date ?? today() : null;
    stmts.setStatus.run({ id: invoiceId, status, paidAt: last, now: nowIso() });
}

/**
 * Registers a payment. Returns { payment } or { error } (receipt not found,
 * cancelled, unknown method, amount above the balance).
 */
const create = db.transaction((ctx, invoiceId, data) => {
    const row = stmts.invoice.get({ id: invoiceId, orgId: ctx.orgId });
    if (!row) return { error: 'notFound' };
    if (row.status === 'CANCELLED') return { error: 'cancelled' };
    if (data.methodId && !stmts.method.get({ id: data.methodId, orgId: ctx.orgId })) return { error: 'method' };
    if (data.amount > summary(row).balance + 0.5) return { error: 'overpaid', balance: summary(row).balance };
    const id = newId();
    stmts.insert.run({
        id, orgId: ctx.orgId, invoiceId, amount: data.amount, date: data.date || today(),
        methodId: data.methodId || null, notes: data.notes ?? '', now: nowIso(), userId: ctx.userId
    });
    recompute(ctx, invoiceId);
    return { payment: camelizeRow(stmts.byId.get({ id, orgId: ctx.orgId })) };
});

const deactivate = db.transaction((ctx, id) => {
    const payment = stmts.byId.get({ id, orgId: ctx.orgId });
    if (!payment) return false;
    stmts.deactivate.run({ id, now: nowIso(), userId: ctx.userId });
    recompute(ctx, payment.invoice_id);
    return true;
});

// Voids an issued receipt: it stays visible with its number, as CANCELLED.
// Its payments must be removed first. Returns 'notFound' | 'paid' | 'ok'
const voidInvoice = db.transaction((ctx, invoiceId) => {
    const row = stmts.invoice.get({ id: invoiceId, orgId: ctx.orgId });
    if (!row) return 'notFound';
    if (row.paid > 0) return 'paid';
    stmts.void.run({ id: invoiceId, now: nowIso() });
    return 'ok';
});

const invoiceIdOf = (ctx, paymentId) => stmts.byId.get({ id: paymentId, orgId: ctx.orgId })?.invoice_id ?? null;

module.exports = { PAID_SQL, listFor, summary, recompute, create, deactivate, voidInvoice, invoiceIdOf };
