// Weekly planner per patient (meals replaced in one transaction). The consultorio
// is the patient's: every query joins patients.org_id. "Delete" deactivates.
const { db } = require('../db/connection');
const { camelizeRow } = require('../transforms');
const { newId, nowIso } = require('../lib/http');

const PLANNER_SELECT = `
    SELECT wp.id, wp.patient_id, wp.template_id, wp.created_at, wp.updated_at,
           p.first_name || ' ' || p.last_name AS patient_name
    FROM week_planner wp JOIN patients p ON wp.patient_id = p.id
    WHERE p.org_id = @orgId AND wp.deactivated_at IS NULL
`;

const stmts = {
    byId: db.prepare(`${PLANNER_SELECT} AND wp.id = @id`),
    insert: db.prepare('INSERT INTO week_planner (id, patient_id, template_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'),
    touch: db.prepare(`
        UPDATE week_planner SET patient_id = COALESCE(@patientId, patient_id),
            template_id = COALESCE(@templateId, template_id), updated_at = @now
        WHERE id = @id
    `),
    deactivate: db.prepare('UPDATE week_planner SET deactivated_at = @now, deactivated_by = @userId WHERE id = @id AND deactivated_at IS NULL'),
    clearMeals: db.prepare('DELETE FROM week_planner_meals WHERE planner_id = ?'),
    insertMeal: db.prepare('INSERT INTO week_planner_meals (id, planner_id, day, meal_type, recipe_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
    recipeUsable: db.prepare('SELECT 1 FROM recipes WHERE id = @id AND org_id = @orgId AND deactivated_at IS NULL')
};

function withMeals(planners) {
    if (!planners.length) return [];
    const ids = planners.map(p => p.id);
    const meals = db.prepare(`
        SELECT wpm.planner_id, wpm.id, wpm.day, wpm.meal_type, wpm.recipe_id, r.name AS recipe_name
        FROM week_planner_meals wpm LEFT JOIN recipes r ON wpm.recipe_id = r.id
        WHERE wpm.planner_id IN (${ids.map(() => '?').join(',')})
        ORDER BY wpm.rowid
    `).all(...ids);
    return planners.map(p => ({
        ...camelizeRow(p),
        meals: meals.filter(m => m.planner_id === p.id)
            .map(m => ({ id: m.id, day: m.day, mealType: m.meal_type, recipeId: m.recipe_id, recipeName: m.recipe_name }))
    }));
}

function list(ctx, { patientId } = {}) {
    const rows = patientId
        ? db.prepare(`${PLANNER_SELECT} AND wp.patient_id = @patientId ORDER BY wp.updated_at DESC`).all({ orgId: ctx.orgId, patientId })
        : db.prepare(`${PLANNER_SELECT} ORDER BY wp.updated_at DESC`).all({ orgId: ctx.orgId });
    return withMeals(rows);
}

function getById(ctx, id) {
    const row = stmts.byId.get({ id, orgId: ctx.orgId });
    return row ? withMeals([row])[0] : null;
}

// The route checks that the patient belongs to the consultorio
function create(ctx, { patientId, templateId }) {
    const id = newId();
    const now = nowIso();
    stmts.insert.run(id, patientId, templateId ?? null, now, now);
    return getById(ctx, id);
}

// Ids of recipes in meals the consultorio cannot use (skipped and reported)
const missingRecipes = (ctx, meals = []) => meals.map(m => m.recipeId)
    .filter(id => id && !stmts.recipeUsable.get({ id, orgId: ctx.orgId }));

const update = db.transaction((ctx, id, { patientId, templateId, meals }) => {
    if (!getById(ctx, id)) return null;
    const now = nowIso();
    stmts.touch.run({ id, patientId: patientId ?? null, templateId: templateId ?? null, now });
    if (meals) {
        stmts.clearMeals.run(id);
        for (const meal of meals) stmts.insertMeal.run(newId(), id, meal.day, meal.mealType, meal.recipeId || null, now);
    }
    return getById(ctx, id);
});

const deactivate = (ctx, id) => !!getById(ctx, id) && stmts.deactivate.run({ id, userId: ctx.userId, now: nowIso() }).changes > 0;

module.exports = { list, getById, create, update, deactivate, missingRecipes };
