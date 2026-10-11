// Billing clients of a consultorio and the patient -> client link. "Delete" deactivates.
const { db } = require('../../db/connection');
const { camelizeRow } = require('../../transforms');
const { newId, nowIso } = require('../../lib/http');
const company = require('./company');
const payments = require('./payments');

const stmts = {
    byId: db.prepare('SELECT * FROM billing_clients WHERE id = @id AND org_id = @orgId AND deactivated_at IS NULL'),
    insert: db.prepare(`
        INSERT INTO billing_clients (id, org_id, company_id, name, email, phone, address, city, country, type, vat_id, notes, created_at, updated_at)
        VALUES (@id, @orgId, @companyId, @name, @email, @phone, @address, @city, @country, @type, @vatId, @notes, @now, @now)
    `),
    update: db.prepare(`
        UPDATE billing_clients SET name = @name, email = @email, phone = @phone, address = @address, city = @city,
            country = @country, type = @type, vat_id = @vatId, notes = @notes, updated_at = @now
        WHERE id = @id
    `),
    deactivate: db.prepare(`
        UPDATE billing_clients SET deactivated_at = @now, deactivated_by = @userId
        WHERE id = @id AND org_id = @orgId AND deactivated_at IS NULL
    `),
    patient: db.prepare('SELECT * FROM patients WHERE id = @id AND org_id = @orgId AND deactivated_at IS NULL'),
    linkPatient: db.prepare('UPDATE patients SET billing_client_id = ?, updated_at = ? WHERE id = ?'),
    invoicesOf: db.prepare(`SELECT d.*, ${payments.PAID_SQL} AS paid FROM billing_invoices d WHERE d.client_id = ? AND d.deactivated_at IS NULL ORDER BY d.created_at DESC`),
    quotesOf: db.prepare('SELECT * FROM billing_quotes WHERE client_id = ? AND deactivated_at IS NULL ORDER BY created_at DESC')
};

const nullable = (d) => ({
    email: d.email ?? null, phone: d.phone ?? null, address: d.address ?? null, city: d.city ?? null,
    vatId: d.vatId ?? null, notes: d.notes ?? ''
});

function list(ctx, { search = '', limit, offset }) {
    let where = 'org_id = ? AND deactivated_at IS NULL';
    const params = [ctx.orgId];
    if (search) {
        where += ' AND (unaccent(name) LIKE unaccent(?) OR LOWER(email) LIKE LOWER(?) OR phone LIKE ?)';
        const s = `%${search}%`;
        params.push(s, s, s);
    }
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM billing_clients WHERE ${where}`).get(...params);
    const rows = db.prepare(`SELECT * FROM billing_clients WHERE ${where} ORDER BY name LIMIT ? OFFSET ?`).all(...params, limit, offset);
    return { rows: rows.map(camelizeRow), total };
}

const getById = (ctx, id) => camelizeRow(stmts.byId.get({ id, orgId: ctx.orgId }));
const exists = (ctx, id) => !!stmts.byId.get({ id, orgId: ctx.orgId });

function create(ctx, data) {
    const id = newId();
    stmts.insert.run({
        ...data, ...nullable(data), id, orgId: ctx.orgId, companyId: company.getRow(ctx)?.id ?? null, now: nowIso()
    });
    return getById(ctx, id);
}

function update(ctx, id, data) {
    if (!exists(ctx, id)) return null;
    stmts.update.run({ ...data, ...nullable(data), id, now: nowIso() });
    return getById(ctx, id);
}

// Invoices and quotes keep pointing to a deactivated client
const deactivate = (ctx, id) => stmts.deactivate.run({ id, orgId: ctx.orgId, userId: ctx.userId, now: nowIso() }).changes > 0;

// Creates (once) the billing client of a patient. null = patient not found
const linkPatient = db.transaction((ctx, patientId) => {
    const patient = stmts.patient.get({ id: patientId, orgId: ctx.orgId });
    if (!patient) return null;
    if (patient.billing_client_id && exists(ctx, patient.billing_client_id)) {
        return { client: getById(ctx, patient.billing_client_id), alreadyLinked: true };
    }
    const client = create(ctx, {
        name: `${patient.first_name} ${patient.last_name}`, email: patient.email, phone: patient.phone,
        address: patient.street, city: patient.city, country: 'Paraguay', type: 'INDIVIDUAL', notes: ''
    });
    stmts.linkPatient.run(client.id, nowIso(), patientId);
    return { client, alreadyLinked: false };
});

// Billing summary of a patient. null = patient not found
function patientBilling(ctx, patientId) {
    const patient = stmts.patient.get({ id: patientId, orgId: ctx.orgId });
    if (!patient) return null;
    const client = patient.billing_client_id ? getById(ctx, patient.billing_client_id) : null;
    if (!client) return { linked: false, client: null, invoices: [], quotes: [], balance: 0 };
    return withBalance({
        linked: true,
        client,
        invoices: stmts.invoicesOf.all(client.id).map(({ paid, ...row }) => ({ ...camelizeRow(row), ...payments.summary({ ...row, paid }) })),
        quotes: stmts.quotesOf.all(client.id).map(camelizeRow)
    });
}

// Adds the total still owed (cancelled receipts do not count)
function withBalance(billing) {
    return { ...billing, balance: billing.invoices.reduce((sum, i) => sum + i.balance, 0) };
}

module.exports = { list, getById, exists, create, update, deactivate, linkPatient, patientBilling };
