// Payment methods; only one can be the default
const { db } = require('../../db/connection');
const { camelizeRow } = require('../../transforms');
const { newId } = require('../../lib/http');
const company = require('./company');

const stmts = {
    all: db.prepare('SELECT * FROM billing_payment_methods ORDER BY is_default DESC, name'),
    byId: db.prepare('SELECT * FROM billing_payment_methods WHERE id = ?'),
    insert: db.prepare(`
        INSERT INTO billing_payment_methods (id, company_id, name, type, instructions, is_default)
        VALUES (@id, @companyId, @name, @type, @instructions, @isDefault)
    `),
    update: db.prepare('UPDATE billing_payment_methods SET name = @name, type = @type, instructions = @instructions, is_default = @isDefault WHERE id = @id'),
    clearDefault: db.prepare('UPDATE billing_payment_methods SET is_default = 0 WHERE id != ?'),
    remove: db.prepare('DELETE FROM billing_payment_methods WHERE id = ?')
};

const list = () => stmts.all.all().map(camelizeRow);
const getById = (id) => camelizeRow(stmts.byId.get(id));
const toParams = (d) => ({ name: d.name, type: d.type, instructions: d.instructions ?? '', isDefault: d.isDefault ? 1 : 0 });

const create = db.transaction((data) => {
    const id = newId();
    stmts.insert.run({ ...toParams(data), id, companyId: company.getRow()?.id ?? null });
    if (data.isDefault) stmts.clearDefault.run(id);
    return getById(id);
});

const update = db.transaction((id, data) => {
    if (!stmts.byId.get(id)) return null;
    stmts.update.run({ ...toParams(data), id });
    if (data.isDefault) stmts.clearDefault.run(id);
    return getById(id);
});

const remove = (id) => stmts.remove.run(id).changes > 0;

module.exports = { list, getById, create, update, remove };
