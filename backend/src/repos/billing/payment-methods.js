// Payment methods of a consultorio; only one can be the default. "Delete" deactivates.
const { db } = require('../../db/connection');
const { camelizeRow } = require('../../transforms');
const { newId, nowIso } = require('../../lib/http');
const company = require('./company');

const stmts = {
    all: db.prepare('SELECT * FROM billing_payment_methods WHERE org_id = ? AND deactivated_at IS NULL ORDER BY is_default DESC, name'),
    byId: db.prepare('SELECT * FROM billing_payment_methods WHERE id = @id AND org_id = @orgId AND deactivated_at IS NULL'),
    insert: db.prepare(`
        INSERT INTO billing_payment_methods (id, org_id, company_id, name, type, instructions, is_default)
        VALUES (@id, @orgId, @companyId, @name, @type, @instructions, @isDefault)
    `),
    update: db.prepare('UPDATE billing_payment_methods SET name = @name, type = @type, instructions = @instructions, is_default = @isDefault WHERE id = @id'),
    clearDefault: db.prepare('UPDATE billing_payment_methods SET is_default = 0 WHERE id != @id AND org_id = @orgId'),
    deactivate: db.prepare('UPDATE billing_payment_methods SET deactivated_at = @now, deactivated_by = @userId, is_default = 0 WHERE id = @id AND org_id = @orgId AND deactivated_at IS NULL')
};

const list = (ctx) => stmts.all.all(ctx.orgId).map(camelizeRow);
const getById = (ctx, id) => camelizeRow(stmts.byId.get({ id, orgId: ctx.orgId }));
const toParams = (d) => ({ name: d.name, type: d.type, instructions: d.instructions ?? '', isDefault: d.isDefault ? 1 : 0 });

const create = db.transaction((ctx, data) => {
    const id = newId();
    stmts.insert.run({ ...toParams(data), id, orgId: ctx.orgId, companyId: company.getRow(ctx)?.id ?? null });
    if (data.isDefault) stmts.clearDefault.run({ id, orgId: ctx.orgId });
    return getById(ctx, id);
});

const update = db.transaction((ctx, id, data) => {
    if (!getById(ctx, id)) return null;
    stmts.update.run({ ...toParams(data), id });
    if (data.isDefault) stmts.clearDefault.run({ id, orgId: ctx.orgId });
    return getById(ctx, id);
});

const deactivate = (ctx, id) => stmts.deactivate.run({ id, orgId: ctx.orgId, userId: ctx.userId, now: nowIso() }).changes > 0;

module.exports = { list, getById, create, update, deactivate };
