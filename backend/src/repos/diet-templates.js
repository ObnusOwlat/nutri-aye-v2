// Diet templates of a consultorio. Each keeps its planner draft week (JSON).
// The first time a consultorio is used it gets the default templates.
// Default templates cannot be deactivated; the rest are deactivated, never deleted.
const { db } = require('../db/connection');
const { parseJson } = require('../transforms');
const { newId, nowIso } = require('../lib/http');

const DEFAULTS = [
    { name: 'Mantenimiento', description: 'Calorías de mantenimiento', goal: 'maintenance', dailyTarget: 2000 },
    { name: 'Déficit 500', description: 'Déficit de 500 kcal para bajar de peso', goal: 'deficit', dailyTarget: 1500 },
    { name: 'Déficit 800', description: 'Déficit de 800 kcal', goal: 'deficit', dailyTarget: 1200 },
    { name: 'Aumento de masa', description: 'Superávit calórico para ganar masa muscular', goal: 'bulking', dailyTarget: 3000 },
    { name: 'Rendimiento', description: 'Para rendimiento deportivo', goal: 'performance', dailyTarget: 2800 }
];

const stmts = {
    count: db.prepare('SELECT COUNT(*) AS n FROM diet_templates WHERE org_id = ?'),
    list: db.prepare('SELECT * FROM diet_templates WHERE org_id = ? AND deactivated_at IS NULL ORDER BY is_default DESC, created_at'),
    byId: db.prepare('SELECT * FROM diet_templates WHERE id = @id AND org_id = @orgId AND deactivated_at IS NULL'),
    insert: db.prepare(`
        INSERT INTO diet_templates (id, org_id, name, description, goal, daily_target, meal_distribution, week_plan, activity_plan, is_default, created_at, updated_at)
        VALUES (@id, @orgId, @name, @description, @goal, @dailyTarget, @mealDistribution, @weekPlan, @activityPlan, @isDefault, @now, @now)
    `),
    update: db.prepare(`
        UPDATE diet_templates SET name = COALESCE(@name, name), description = COALESCE(@description, description),
            goal = COALESCE(@goal, goal), daily_target = COALESCE(@dailyTarget, daily_target),
            meal_distribution = COALESCE(@mealDistribution, meal_distribution), week_plan = COALESCE(@weekPlan, week_plan),
            activity_plan = COALESCE(@activityPlan, activity_plan),
            updated_at = @now
        WHERE id = @id AND org_id = @orgId
    `),
    deactivate: db.prepare(`
        UPDATE diet_templates SET deactivated_at = @now, deactivated_by = @userId
        WHERE id = @id AND org_id = @orgId AND is_default = 0 AND deactivated_at IS NULL
    `)
};

const toTemplate = (row) => row && ({
    id: row.id, name: row.name, description: row.description, goal: row.goal, dailyTarget: row.daily_target,
    mealDistribution: parseJson(row.meal_distribution, null), weekPlan: parseJson(row.week_plan, null), activityPlan: parseJson(row.activity_plan, null),
    isDefault: !!row.is_default, createdAt: row.created_at, updatedAt: row.updated_at
});

const json = (value) => (value === undefined || value === null ? null : JSON.stringify(value));

function insert(ctx, data, isDefault = false) {
    const id = newId();
    stmts.insert.run({
        id, orgId: ctx.orgId, name: data.name, description: data.description ?? '', goal: data.goal, dailyTarget: data.dailyTarget,
        mealDistribution: json(data.mealDistribution), weekPlan: json(data.weekPlan), activityPlan: json(data.activityPlan), isDefault: isDefault ? 1 : 0, now: nowIso()
    });
    return id;
}

const ensureDefaults = db.transaction((ctx) => {
    if (stmts.count.get(ctx.orgId).n) return;
    for (const template of DEFAULTS) insert(ctx, template, true);
});

function list(ctx) {
    ensureDefaults(ctx);
    return stmts.list.all(ctx.orgId).map(toTemplate);
}

const getById = (ctx, id) => toTemplate(stmts.byId.get({ id, orgId: ctx.orgId }));
const create = (ctx, data) => getById(ctx, insert(ctx, data));

function update(ctx, id, data) {
    if (!getById(ctx, id)) return null;
    stmts.update.run({
        id, orgId: ctx.orgId, name: data.name ?? null, description: data.description ?? null, goal: data.goal ?? null,
        dailyTarget: data.dailyTarget ?? null, mealDistribution: json(data.mealDistribution), weekPlan: json(data.weekPlan),
        activityPlan: json(data.activityPlan), now: nowIso()
    });
    return getById(ctx, id);
}

// false: not found, or a default template
const deactivate = (ctx, id) => stmts.deactivate.run({ id, orgId: ctx.orgId, userId: ctx.userId, now: nowIso() }).changes > 0;

module.exports = { list, getById, create, update, deactivate, ensureDefaults };
