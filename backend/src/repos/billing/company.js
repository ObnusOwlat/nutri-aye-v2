// The consultorio's billing profile and PDF settings (one row each for now)
const { db } = require('../../db/connection');
const { camelizeRow } = require('../../transforms');
const { newId, nowIso } = require('../../lib/http');

const stmts = {
    get: db.prepare('SELECT * FROM billing_company LIMIT 1'),
    insert: db.prepare(`
        INSERT INTO billing_company (id, name, email, phone, address, city, country, currency, vat_id, website, created_at, updated_at)
        VALUES (@id, @name, @email, @phone, @address, @city, @country, @currency, @vatId, @website, @now, @now)
    `),
    update: db.prepare(`
        UPDATE billing_company SET name = @name, email = @email, phone = @phone, address = @address, city = @city,
            country = @country, currency = @currency, vat_id = @vatId, website = @website, updated_at = @now
        WHERE id = @id
    `),
    pdfConfig: db.prepare('SELECT * FROM billing_pdf_config WHERE company_id = ?'),
    insertPdf: db.prepare(`
        INSERT INTO billing_pdf_config (id, company_id, font_family, padding, primary_color, secondary_color, include_logo, logo_b64)
        VALUES (@id, @companyId, @fontFamily, @padding, @primaryColor, @secondaryColor, @includeLogo, @logoB64)
    `),
    updatePdf: db.prepare(`
        UPDATE billing_pdf_config SET font_family = @fontFamily, padding = @padding, primary_color = @primaryColor,
            secondary_color = @secondaryColor, include_logo = @includeLogo, logo_b64 = @logoB64
        WHERE company_id = @companyId
    `)
};

const getRow = () => stmts.get.get();
const get = () => camelizeRow(getRow()) || null;

function save(data) {
    const existing = getRow();
    const params = {
        name: data.name, email: data.email ?? null, phone: data.phone ?? null, address: data.address ?? null,
        city: data.city ?? null, country: data.country, currency: data.currency, vatId: data.vatId ?? null,
        website: data.website ?? null, now: nowIso()
    };
    if (existing) stmts.update.run({ ...params, id: existing.id });
    else stmts.insert.run({ ...params, id: newId() });
    return get();
}

function getPdfConfig() {
    const company = getRow();
    return company ? camelizeRow(stmts.pdfConfig.get(company.id)) || null : null;
}

// null when the company is not configured yet
function savePdfConfig(data) {
    const company = getRow();
    if (!company) return null;
    const params = { ...data, includeLogo: data.includeLogo ? 1 : 0, logoB64: data.logoB64 ?? null, companyId: company.id };
    if (stmts.pdfConfig.get(company.id)) stmts.updatePdf.run(params);
    else stmts.insertPdf.run({ ...params, id: newId() });
    return getPdfConfig();
}

function dashboard() {
    const count = (sql) => db.prepare(sql).get().n;
    return {
        totalClients: count('SELECT COUNT(*) AS n FROM billing_clients'),
        totalInvoices: count('SELECT COUNT(*) AS n FROM billing_invoices'),
        totalQuotes: count('SELECT COUNT(*) AS n FROM billing_quotes'),
        paidInvoices: count("SELECT COUNT(*) AS n FROM billing_invoices WHERE status = 'PAID'"),
        totalRevenue: count("SELECT COALESCE(SUM(total), 0) AS n FROM billing_invoices WHERE status = 'PAID'"),
        pendingRevenue: count("SELECT COALESCE(SUM(total), 0) AS n FROM billing_invoices WHERE status IN ('UNPAID', 'OVERDUE')")
    };
}

module.exports = { getRow, get, save, getPdfConfig, savePdfConfig, dashboard };
