// Meal day templates of a consultorio: a day of the planner (breakfast to
// dinner) saved to reuse on any day. Empty meals are dropped. "Delete" deactivates.
const { db } = require('../db/connection');
const { parseJson } = require('../transforms');
const { newId, nowIso } = require('../lib/http');

const stmts = {
    list: db.prepare('SELECT * FROM day_templates WHERE org_id = ? AND deactivated_at IS NULL ORDER BY name'),
    byId: db.prepare('SELECT * FROM day_templates WHERE id = @id AND org_id = @orgId AND deactivated_at IS NULL'),
    insert: db.prepare(`
        INSERT INTO day_templates (id, org_id, name, description, meals, created_at, updated_at)
        VALUES (@id, @orgId, @name, @description, @meals, @now, @now)
    `),
    update: db.prepare(`
        UPDATE day_templates SET name = COALESCE(@name, name), description = COALESCE(@description, description),
            meals = COALESCE(@meals, meals), updated_at = @now
        WHERE id = @id AND org_id = @orgId
    `),
    deactivate: db.prepare(`
        UPDATE day_templates SET deactivated_at = @now, deactivated_by = @userId
        WHERE id = @id AND org_id = @orgId AND deactivated_at IS NULL
    `)
};

const cleanMeals = (meals) => JSON.stringify(Object.fromEntries(Object.entries(meals || {}).filter(([, recipeId]) => recipeId)));

const toTemplate = (row) => row && ({
    id: row.id, name: row.name, description: row.description, meals: parseJson(row.meals, {}), updatedAt: row.updated_at
});

const list = (ctx) => stmts.list.all(ctx.orgId).map(toTemplate);
const getById = (ctx, id) => toTemplate(stmts.byId.get({ id, orgId: ctx.orgId }));

function create(ctx, data) {
    const id = newId();
    stmts.insert.run({ id, orgId: ctx.orgId, name: data.name, description: data.description ?? '', meals: cleanMeals(data.meals), now: nowIso() });
    return getById(ctx, id);
}

function update(ctx, id, data) {
    if (!getById(ctx, id)) return null;
    stmts.update.run({
        id, orgId: ctx.orgId, name: data.name ?? null, description: data.description ?? null,
        meals: data.meals ? cleanMeals(data.meals) : null, now: nowIso()
    });
    return getById(ctx, id);
}

const deactivate = (ctx, id) => stmts.deactivate.run({ id, orgId: ctx.orgId, userId: ctx.userId, now: nowIso() }).changes > 0;

module.exports = { list, getById, create, update, deactivate };
