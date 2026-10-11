// Billing clients and the patient -> client link
const { db } = require('../../db/connection');
const { camelizeRow } = require('../../transforms');
const { newId, nowIso } = require('../../lib/http');
const company = require('./company');

const stmts = {
    byId: db.prepare('SELECT * FROM billing_clients WHERE id = ?'),
    insert: db.prepare(`
        INSERT INTO billing_clients (id, company_id, name, email, phone, address, city, country, type, vat_id, notes, created_at, updated_at)
        VALUES (@id, @companyId, @name, @email, @phone, @address, @city, @country, @type, @vatId, @notes, @now, @now)
    `),
    update: db.prepare(`
        UPDATE billing_clients SET name = @name, email = @email, phone = @phone, address = @address, city = @city,
            country = @country, type = @type, vat_id = @vatId, notes = @notes, updated_at = @now
        WHERE id = @id
    `),
    remove: db.prepare('DELETE FROM billing_clients WHERE id = ?'),
    documents: db.prepare(`
        SELECT (SELECT COUNT(*) FROM billing_invoices WHERE client_id = @id) +
               (SELECT COUNT(*) FROM billing_quotes WHERE client_id = @id) AS n
    `),
    patient: db.prepare('SELECT * FROM patients WHERE id = ?'),
    linkPatient: db.prepare('UPDATE patients SET billing_client_id = ?, updated_at = ? WHERE id = ?'),
    invoicesOf: db.prepare('SELECT * FROM billing_invoices WHERE client_id = ? ORDER BY created_at DESC'),
    quotesOf: db.prepare('SELECT * FROM billing_quotes WHERE client_id = ? ORDER BY created_at DESC')
};

const nullable = (d) => ({
    email: d.email ?? null, phone: d.phone ?? null, address: d.address ?? null, city: d.city ?? null,
    vatId: d.vatId ?? null, notes: d.notes ?? ''
});

function list({ search = '', limit, offset }) {
    let where = '1=1';
    const params = [];
    if (search) {
        where = '(unaccent(name) LIKE unaccent(?) OR LOWER(email) LIKE LOWER(?) OR phone LIKE ?)';
        const s = `%${search}%`;
        params.push(s, s, s);
    }
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM billing_clients WHERE ${where}`).get(...params);
    const rows = db.prepare(`SELECT * FROM billing_clients WHERE ${where} ORDER BY name LIMIT ? OFFSET ?`).all(...params, limit, offset);
    return { rows: rows.map(camelizeRow), total };
}

const getById = (id) => camelizeRow(stmts.byId.get(id));
const exists = (id) => !!stmts.byId.get(id);

function create(data) {
    const id = newId();
    stmts.insert.run({
        ...data, ...nullable(data), id, companyId: company.getRow()?.id ?? null, now: nowIso()
    });
    return getById(id);
}

function update(id, data) {
    if (!exists(id)) return null;
    stmts.update.run({ ...data, ...nullable(data), id, now: nowIso() });
    return getById(id);
}

const documentCount = (id) => stmts.documents.get({ id }).n;
const remove = (id) => stmts.remove.run(id).changes > 0;

// Creates (once) the billing client of a patient. null = patient not found
const linkPatient = db.transaction((patientId) => {
    const patient = stmts.patient.get(patientId);
    if (!patient) return null;
    if (patient.billing_client_id && exists(patient.billing_client_id)) {
        return { client: getById(patient.billing_client_id), alreadyLinked: true };
    }
    const client = create({
        name: `${patient.first_name} ${patient.last_name}`, email: patient.email, phone: patient.phone,
        address: patient.street, city: patient.city, country: 'Paraguay', type: 'INDIVIDUAL', notes: ''
    });
    stmts.linkPatient.run(client.id, nowIso(), patientId);
    return { client, alreadyLinked: false };
});

// Billing summary of a patient. null = patient not found
function patientBilling(patientId) {
    const patient = stmts.patient.get(patientId);
    if (!patient) return null;
    const client = patient.billing_client_id ? getById(patient.billing_client_id) : null;
    if (!client) return { linked: false, client: null, invoices: [], quotes: [] };
    return {
        linked: true,
        client,
        invoices: stmts.invoicesOf.all(client.id).map(camelizeRow),
        quotes: stmts.quotesOf.all(client.id).map(camelizeRow)
    };
}

module.exports = { list, getById, exists, create, update, remove, documentCount, linkPatient, patientBilling };
