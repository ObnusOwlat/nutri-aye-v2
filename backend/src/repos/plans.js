// Patient meal plans (week in patient_plan_meals) and progress check-ins.
// The route checks that the patient belongs to the consultorio. "Delete" deactivates.
const { db } = require('../db/connection');
const { parseJson } = require('../transforms');
const { newId, nowIso } = require('../lib/http');
const { DAYS, MEAL_TYPES } = require('../constants');

const stmts = {
    plan: db.prepare('SELECT * FROM patient_plans WHERE id = ? AND patient_id = ? AND deactivated_at IS NULL'),
    activeOf: db.prepare("SELECT id FROM patient_plans WHERE patient_id = ? AND status = 'active' AND deactivated_at IS NULL"),
    insertPlan: db.prepare(`
        INSERT INTO patient_plans (id, patient_id, name, diet_goal, daily_target, start_date, end_date, notes, status, created_at, updated_at)
        VALUES (@id, @patientId, @name, @dietGoal, @dailyTarget, @startDate, @endDate, @notes, @status, @now, @now)
    `),
    updatePlan: db.prepare(`
        UPDATE patient_plans SET name = COALESCE(@name, name), diet_goal = COALESCE(@dietGoal, diet_goal),
            daily_target = COALESCE(@dailyTarget, daily_target), start_date = COALESCE(@startDate, start_date),
            end_date = CASE WHEN @setEnd THEN @endDate ELSE end_date END, notes = COALESCE(@notes, notes),
            status = COALESCE(@status, status), updated_at = @now
        WHERE id = @id
    `),
    complete: db.prepare("UPDATE patient_plans SET status = 'completed', updated_at = ? WHERE id = ?"),
    deactivatePlan: db.prepare('UPDATE patient_plans SET deactivated_at = @now, deactivated_by = @userId WHERE id = @id AND patient_id = @patientId AND deactivated_at IS NULL'),
    meals: db.prepare('SELECT day_of_week, meal_type, recipe_id FROM patient_plan_meals WHERE patient_plan_id = ?'),
    clearMeals: db.prepare('DELETE FROM patient_plan_meals WHERE patient_plan_id = ?'),
    insertMeal: db.prepare('INSERT INTO patient_plan_meals (id, patient_plan_id, day_of_week, meal_type, recipe_id) VALUES (?, ?, ?, ?, ?)'),
    recipeUsable: db.prepare('SELECT 1 FROM recipes WHERE id = ? AND org_id = ?'),
    progress: db.prepare('SELECT * FROM patient_progress WHERE id = ? AND patient_id = ? AND deactivated_at IS NULL'),
    insertProgress: db.prepare(`
        INSERT INTO patient_progress (id, patient_id, date, weight, adherence, energy_level, sleep_quality, mood, symptoms, notes, created_at, updated_at)
        VALUES (@id, @patientId, @date, @weight, @adherence, @energyLevel, @sleepQuality, @mood, @symptoms, @notes, @now, @now)
    `),
    updateProgress: db.prepare(`
        UPDATE patient_progress SET date = COALESCE(@date, date), weight = CASE WHEN @setWeight THEN @weight ELSE weight END,
            adherence = COALESCE(@adherence, adherence), energy_level = COALESCE(@energyLevel, energy_level),
            sleep_quality = COALESCE(@sleepQuality, sleep_quality), mood = COALESCE(@mood, mood),
            symptoms = COALESCE(@symptoms, symptoms), notes = COALESCE(@notes, notes), updated_at = @now
        WHERE id = @id
    `),
    deactivateProgress: db.prepare('UPDATE patient_progress SET deactivated_at = @now, deactivated_by = @userId WHERE id = @id AND patient_id = @patientId AND deactivated_at IS NULL')
};

// { monday: { breakfast: recipeId|null, ... }, ... }
function weekOf(planId) {
    const week = Object.fromEntries(DAYS.map(d => [d, Object.fromEntries(MEAL_TYPES.map(m => [m, null]))]));
    for (const meal of stmts.meals.all(planId)) {
        if (week[meal.day_of_week] && meal.meal_type in week[meal.day_of_week]) week[meal.day_of_week][meal.meal_type] = meal.recipe_id;
    }
    return week;
}

const toPlan = (row) => row && ({
    id: row.id, patientId: row.patient_id, name: row.name, dietGoal: row.diet_goal, dailyTarget: row.daily_target,
    startDate: row.start_date, endDate: row.end_date, notes: row.notes, status: row.status,
    weekPlan: weekOf(row.id), createdAt: row.created_at, updatedAt: row.updated_at
});

// Recipes of other consultorios (or unknown) are dropped from the week
function writeWeek(ctx, planId, weekPlan) {
    stmts.clearMeals.run(planId);
    for (const [day, meals] of Object.entries(weekPlan || {})) {
        for (const [mealType, recipeId] of Object.entries(meals || {})) {
            if (!recipeId || !DAYS.includes(day) || !MEAL_TYPES.includes(mealType)) continue;
            if (!stmts.recipeUsable.get(recipeId, ctx.orgId)) continue;
            stmts.insertMeal.run(newId(), planId, day, mealType, recipeId);
        }
    }
}

const getPlan = (patientId, id) => toPlan(stmts.plan.get(id, patientId));

// A new active plan completes the previous active one
const createPlan = db.transaction((ctx, patientId, data) => {
    const id = newId();
    const now = nowIso();
    if (data.status === 'active') for (const { id: old } of stmts.activeOf.all(patientId)) stmts.complete.run(now, old);
    stmts.insertPlan.run({
        id, patientId, name: data.name, dietGoal: data.dietGoal, dailyTarget: data.dailyTarget,
        startDate: data.startDate || now.slice(0, 10), endDate: data.endDate ?? null, notes: data.notes ?? '', status: data.status, now
    });
    writeWeek(ctx, id, data.weekPlan);
    return getPlan(patientId, id);
});

const updatePlan = db.transaction((ctx, patientId, id, data) => {
    if (!stmts.plan.get(id, patientId)) return null;
    const now = nowIso();
    if (data.status === 'active') for (const { id: old } of stmts.activeOf.all(patientId)) if (old !== id) stmts.complete.run(now, old);
    stmts.updatePlan.run({
        id, name: data.name ?? null, dietGoal: data.dietGoal ?? null, dailyTarget: data.dailyTarget ?? null,
        startDate: data.startDate ?? null, setEnd: data.endDate !== undefined ? 1 : 0, endDate: data.endDate ?? null,
        notes: data.notes ?? null, status: data.status ?? null, now
    });
    if (data.weekPlan) writeWeek(ctx, id, data.weekPlan);
    return getPlan(patientId, id);
});

const deactivatePlan = (ctx, patientId, id) => stmts.deactivatePlan.run({ id, patientId, userId: ctx.userId, now: nowIso() }).changes > 0;

const toProgress = (row) => row && ({
    id: row.id, patientId: row.patient_id, date: row.date, weight: row.weight, adherence: row.adherence,
    energyLevel: row.energy_level, sleepQuality: row.sleep_quality, mood: row.mood,
    symptoms: parseJson(row.symptoms, []), notes: row.notes, createdAt: row.created_at
});

const getProgress = (patientId, id) => toProgress(stmts.progress.get(id, patientId));

function createProgress(patientId, data) {
    const id = newId();
    stmts.insertProgress.run({
        id, patientId, date: data.date || nowIso().slice(0, 10), weight: data.weight ?? null, adherence: data.adherence,
        energyLevel: data.energyLevel, sleepQuality: data.sleepQuality, mood: data.mood,
        symptoms: JSON.stringify(data.symptoms || []), notes: data.notes ?? '', now: nowIso()
    });
    return getProgress(patientId, id);
}

function updateProgress(patientId, id, data) {
    if (!stmts.progress.get(id, patientId)) return null;
    stmts.updateProgress.run({
        id, date: data.date ?? null, setWeight: data.weight !== undefined ? 1 : 0, weight: data.weight ?? null,
        adherence: data.adherence ?? null, energyLevel: data.energyLevel ?? null, sleepQuality: data.sleepQuality ?? null,
        mood: data.mood ?? null, symptoms: data.symptoms ? JSON.stringify(data.symptoms) : null, notes: data.notes ?? null, now: nowIso()
    });
    return getProgress(patientId, id);
}

const deactivateProgress = (ctx, patientId, id) => stmts.deactivateProgress.run({ id, patientId, userId: ctx.userId, now: nowIso() }).changes > 0;

// Everything active of the consultorio's active patients (bootstrap)
const ACTIVE_PATIENTS = 'SELECT id FROM patients WHERE org_id = ? AND deactivated_at IS NULL';
const listAllPlans = (ctx) => db.prepare(`SELECT * FROM patient_plans WHERE deactivated_at IS NULL AND patient_id IN (${ACTIVE_PATIENTS}) ORDER BY created_at`)
    .all(ctx.orgId).map(toPlan);
const listAllProgress = (ctx) => db.prepare(`SELECT * FROM patient_progress WHERE deactivated_at IS NULL AND patient_id IN (${ACTIVE_PATIENTS}) ORDER BY date`)
    .all(ctx.orgId).map(toProgress);

module.exports = {
    getPlan, createPlan, updatePlan, deactivatePlan, listAllPlans,
    getProgress, createProgress, updateProgress, deactivateProgress, listAllProgress
};
