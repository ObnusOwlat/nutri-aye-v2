// Exercise routines of a consultorio (reusable weeks of physical activity).
// The first time a consultorio lists them it gets the example routines.
// "Delete" deactivates; ids of the items are regenerated so days never share one.
const { db } = require('../db/connection');
const { parseJson } = require('../transforms');
const { newId, nowIso } = require('../lib/http');
const { EXAMPLES } = require('../lib/example-routines');

const stmts = {
    count: db.prepare('SELECT COUNT(*) AS n FROM activity_templates WHERE org_id = ?'),
    list: db.prepare('SELECT * FROM activity_templates WHERE org_id = ? AND deactivated_at IS NULL ORDER BY is_example, name'),
    byId: db.prepare('SELECT * FROM activity_templates WHERE id = @id AND org_id = @orgId AND deactivated_at IS NULL'),
    insert: db.prepare(`
        INSERT INTO activity_templates (id, org_id, name, description, level, activity_plan, is_example, created_at, updated_at)
        VALUES (@id, @orgId, @name, @description, @level, @plan, @isExample, @now, @now)
    `),
    update: db.prepare(`
        UPDATE activity_templates SET name = COALESCE(@name, name), description = COALESCE(@description, description),
            level = COALESCE(@level, level), activity_plan = COALESCE(@plan, activity_plan), updated_at = @now
        WHERE id = @id AND org_id = @orgId
    `),
    deactivate: db.prepare(`
        UPDATE activity_templates SET deactivated_at = @now, deactivated_by = @userId
        WHERE id = @id AND org_id = @orgId AND deactivated_at IS NULL
    `)
};

// Fresh item ids, empty days dropped
function cleanPlan(plan) {
    const out = {};
    for (const [day, items] of Object.entries(plan || {})) {
        if (items?.length) out[day] = items.map(i => ({ ...i, id: `act-${newId().slice(0, 12)}` }));
    }
    return out;
}

const count = (plan) => Object.values(plan).reduce((n, items) => n + items.length, 0);

const toRoutine = (row) => {
    if (!row) return null;
    const plan = parseJson(row.activity_plan, {});
    return {
        id: row.id, name: row.name, description: row.description, level: row.level, activityPlan: plan,
        days: Object.keys(plan).length, items: count(plan), isExample: !!row.is_example, updatedAt: row.updated_at
    };
};

function insert(ctx, data, isExample = false) {
    const id = newId();
    stmts.insert.run({
        id, orgId: ctx.orgId, name: data.name, description: data.description ?? '', level: data.level || 'beginner',
        plan: JSON.stringify(cleanPlan(data.activityPlan ?? data.plan)), isExample: isExample ? 1 : 0, now: nowIso()
    });
    return id;
}

const ensureExamples = db.transaction((ctx) => {
    if (stmts.count.get(ctx.orgId).n) return;
    for (const example of EXAMPLES) insert(ctx, example, true);
});

function list(ctx) {
    ensureExamples(ctx);
    return stmts.list.all(ctx.orgId).map(toRoutine);
}

const getById = (ctx, id) => toRoutine(stmts.byId.get({ id, orgId: ctx.orgId }));
const create = (ctx, data) => getById(ctx, insert(ctx, data));

function update(ctx, id, data) {
    if (!getById(ctx, id)) return null;
    stmts.update.run({
        id, orgId: ctx.orgId, name: data.name ?? null, description: data.description ?? null, level: data.level ?? null,
        plan: data.activityPlan ? JSON.stringify(cleanPlan(data.activityPlan)) : null, now: nowIso()
    });
    return getById(ctx, id);
}

const deactivate = (ctx, id) => stmts.deactivate.run({ id, orgId: ctx.orgId, userId: ctx.userId, now: nowIso() }).changes > 0;

module.exports = { list, getById, create, update, deactivate };
