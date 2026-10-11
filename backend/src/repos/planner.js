// Weekly planner per patient (meals replaced in one transaction)
const { db } = require('../db/connection');
const { camelizeRow } = require('../transforms');
const { newId, nowIso } = require('../lib/http');

const PLANNER_SELECT = `
    SELECT wp.*, p.first_name || ' ' || p.last_name AS patient_name
    FROM week_planner wp LEFT JOIN patients p ON wp.patient_id = p.id
`;

const stmts = {
    byId: db.prepare(`${PLANNER_SELECT} WHERE wp.id = ?`),
    insert: db.prepare('INSERT INTO week_planner (id, patient_id, template_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'),
    touch: db.prepare(`
        UPDATE week_planner SET patient_id = COALESCE(@patientId, patient_id),
            template_id = COALESCE(@templateId, template_id), updated_at = @now
        WHERE id = @id
    `),
    remove: db.prepare('DELETE FROM week_planner WHERE id = ?'),
    clearMeals: db.prepare('DELETE FROM week_planner_meals WHERE planner_id = ?'),
    insertMeal: db.prepare('INSERT INTO week_planner_meals (id, planner_id, day, meal_type, recipe_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'),
    recipeExists: db.prepare('SELECT 1 FROM recipes WHERE id = ?')
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

function list({ patientId } = {}) {
    const rows = patientId
        ? db.prepare(`${PLANNER_SELECT} WHERE wp.patient_id = ? ORDER BY wp.updated_at DESC`).all(patientId)
        : db.prepare(`${PLANNER_SELECT} ORDER BY wp.updated_at DESC`).all();
    return withMeals(rows);
}

function getById(id) {
    const row = stmts.byId.get(id);
    return row ? withMeals([row])[0] : null;
}

function create({ patientId, templateId }) {
    const id = newId();
    const now = nowIso();
    stmts.insert.run(id, patientId, templateId ?? null, now, now);
    return getById(id);
}

// Ids of recipes in meals that do not exist (400 before writing)
const missingRecipes = (meals = []) => meals.map(m => m.recipeId).filter(id => id && !stmts.recipeExists.get(id));

const update = db.transaction((id, { patientId, templateId, meals }) => {
    if (!stmts.byId.get(id)) return null;
    const now = nowIso();
    stmts.touch.run({ id, patientId: patientId ?? null, templateId: templateId ?? null, now });
    if (meals) {
        stmts.clearMeals.run(id);
        for (const meal of meals) stmts.insertMeal.run(newId(), id, meal.day, meal.mealType, meal.recipeId || null, now);
    }
    return getById(id);
});

const remove = (id) => stmts.remove.run(id).changes > 0; // meals cascade

module.exports = { list, getById, create, update, remove, missingRecipes };
