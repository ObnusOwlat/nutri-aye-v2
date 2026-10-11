// What each client owes: active, non-cancelled receipts minus their payments.
const { db } = require('../../db/connection');
const { camelizeRow } = require('../../transforms');
const { PAID_SQL } = require('./payments');

const OWED = `
    SELECT d.client_id, COUNT(*) AS receipts, SUM(d.total) AS invoiced, SUM(${PAID_SQL}) AS paid
    FROM billing_invoices d
    WHERE d.org_id = @orgId AND d.deactivated_at IS NULL AND d.status != 'CANCELLED'
    GROUP BY d.client_id
`;

const stmts = {
    all: db.prepare(`
        SELECT c.id, c.name, c.phone, c.email, o.receipts, o.invoiced, o.paid, o.invoiced - o.paid AS balance,
               (SELECT p.id FROM patients p WHERE p.billing_client_id = c.id AND p.org_id = c.org_id AND p.deactivated_at IS NULL LIMIT 1) AS patient_id
        FROM billing_clients c JOIN (${OWED}) o ON o.client_id = c.id
        WHERE c.org_id = @orgId
        ORDER BY balance DESC, c.name
    `),
    one: db.prepare(`SELECT receipts, invoiced, paid FROM (${OWED}) WHERE client_id = @clientId`)
};

const round = (n) => Math.round((n || 0) * 100) / 100;

// [{ id, name, receipts, invoiced, paid, balance, patientId }]; onlyOwing = balance > 0
function list(ctx, { onlyOwing = false } = {}) {
    const rows = stmts.all.all({ orgId: ctx.orgId }).map(camelizeRow)
        .map(r => ({ ...r, invoiced: round(r.invoiced), paid: round(r.paid), balance: round(r.balance) }));
    return onlyOwing ? rows.filter(r => r.balance > 0) : rows;
}

function ofClient(ctx, clientId) {
    const row = stmts.one.get({ orgId: ctx.orgId, clientId }) || { receipts: 0, invoiced: 0, paid: 0 };
    return { receipts: row.receipts, invoiced: round(row.invoiced), paid: round(row.paid), balance: round(row.invoiced - row.paid) };
}

module.exports = { list, ofClient };
