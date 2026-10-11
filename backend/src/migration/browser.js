// One-time import of the data a browser kept before Fase 4 (State export,
// camelCase) into backup rows. Only new records are added; references to
// things that exist neither in the payload nor in the consultorio are dropped.
const { db } = require('../db/connection');
const { NUTRIENT_FIELDS } = require('../nutrient-fields');
const templates = require('../repos/diet-templates');
const { newId, nowIso } = require('../lib/http');
const C = require('../constants');

const list = (value) => (Array.isArray(value) ? value.filter(v => v && typeof v === 'object' && typeof v.id === 'string') : []);
const num = (v) => (v === '' || v == null || Number.isNaN(Number(v)) ? null : Number(v));
const str = (v, max = 5000) => (v == null ? null : String(v).slice(0, max));
const oneOf = (v, options, fallback) => (options.includes(v) ? v : fallback);

const visibleIngredient = db.prepare('SELECT 1 FROM ingredients WHERE id = ? AND (org_id IS NULL OR org_id = ?)');
const orgRecipe = db.prepare('SELECT 1 FROM recipes WHERE id = ? AND org_id = ?');
const orgPatient = db.prepare('SELECT 1 FROM patients WHERE id = ? AND org_id = ?');
// Lines of a recipe or plan that is already in the server are not imported again
const recipeExists = db.prepare('SELECT 1 FROM recipes WHERE id = ?');
const planExists = db.prepare('SELECT 1 FROM patient_plans WHERE id = ?');

function convert(ctx, data) {
    const now = nowIso();
    const t = Object.fromEntries(['ingredients', 'recipes', 'recipe_ingredients', 'patients', 'patient_metrics', 'patient_conditions',
        'patient_plans', 'patient_plan_meals', 'patient_progress', 'diet_templates'].map(n => [n, []]));

    // Own foods only: catalog foods (USDA, calories-in) already exist in the server
    const ingredientIds = new Set();
    for (const ing of list(data.ingredients)) {
        if (ing.source && ing.source !== 'user') continue;
        const row = { id: ing.id, name: str(ing.name, 200) || 'Sin nombre', category_id: oneOf(ing.category, C.INGREDIENT_CATEGORIES, 'mixed'),
            unit_id: 'gram', source: 'user', created_at: ing.createdAt || now, updated_at: ing.updatedAt || now };
        for (const { column, key } of NUTRIENT_FIELDS) row[column] = num(ing[key]) ?? 0;
        t.ingredients.push(row);
        ingredientIds.add(ing.id);
    }
    const ingredientOk = (id) => ingredientIds.has(id) || !!visibleIngredient.get(id, ctx.orgId);

    const recipeIds = new Set();
    for (const r of list(data.recipes)) {
        t.recipes.push({ id: r.id, name: str(r.name, 200) || 'Sin nombre', category_id: oneOf(r.category, C.MEAL_CATEGORIES, 'lunch'),
            instructions: str(r.instructions) || '', notes: str(r.notes) || '', created_at: r.createdAt || now, updated_at: r.updatedAt || now });
        recipeIds.add(r.id);
        if (recipeExists.get(r.id)) continue;
        const grams = new Map();
        for (const ri of r.ingredients || []) {
            if (ri && ingredientOk(ri.ingredientId) && num(ri.grams) > 0) grams.set(ri.ingredientId, (grams.get(ri.ingredientId) || 0) + num(ri.grams));
        }
        for (const [ingredientId, g] of grams) t.recipe_ingredients.push({ id: newId(), recipe_id: r.id, ingredient_id: ingredientId, grams: g });
    }
    const recipeOk = (id) => recipeIds.has(id) || !!orgRecipe.get(id, ctx.orgId);

    const patientIds = new Set();
    for (const p of list(data.patients)) {
        if (!p.firstName || !p.lastName) continue;
        t.patients.push({ id: p.id, first_name: str(p.firstName, 100), last_name: str(p.lastName, 100), email: str(p.email, 200),
            phone: str(p.phone, 50), date_of_birth: str(p.dateOfBirth, 10), gender: oneOf(p.gender, C.GENDERS, null),
            street: str(p.address?.street, 200) || '', city: str(p.address?.city, 100) || '', zip_code: str(p.address?.zipCode, 20) || '',
            emergency_name: str(p.emergencyContact?.name, 100) || '', emergency_phone: str(p.emergencyContact?.phone, 50) || '',
            emergency_relation: str(p.emergencyContact?.relation, 50) || '', notes: str(p.notes) || '',
            status: oneOf(p.status, C.PATIENT_STATUSES, 'active'), physical_activity: p.physicalActivity ? JSON.stringify(p.physicalActivity) : null,
            created_at: p.createdAt || now, updated_at: p.updatedAt || now });
        patientIds.add(p.id);
    }
    const patientOk = (id) => patientIds.has(id) || !!orgPatient.get(id, ctx.orgId);

    for (const m of list(data.patientMetrics)) {
        if (!patientOk(m.patientId)) continue;
        t.patient_metrics.push({ id: m.id, patient_id: m.patientId, date: str(m.date, 10) || now.slice(0, 10), weight: num(m.weight), height: num(m.height),
            bmi: num(m.bmi), bmi_category: str(m.bmiCategory, 30), body_fat: num(m.bodyFat), muscle_mass: num(m.muscleMass), waist: num(m.waist),
            chest: num(m.chest), hips: num(m.hips), cia_abdominal: num(m.ciaAbdominal), cia_brazo: num(m.ciaBrazo), cia_pierna: num(m.ciaPierna),
            cadera: num(m.cadera), activity_level: oneOf(m.activityLevel, C.ACTIVITY_LEVELS, 'moderate'), notes: str(m.notes) || '', created_at: m.createdAt || now });
    }
    for (const c of list(data.patientConditions)) {
        if (!patientOk(c.patientId) || !c.name) continue;
        t.patient_conditions.push({ id: c.id, patient_id: c.patientId, type: oneOf(c.type, C.CONDITION_TYPES, 'condition'), name: str(c.name, 200),
            severity: oneOf(c.severity, C.CONDITION_SEVERITIES, 'mild'), description: str(c.description) || '',
            dietary_notes: str(c.dietaryNotes) || '', medications: str(c.medications) || '', created_at: c.createdAt || now });
    }
    for (const p of list(data.patientPlans)) {
        if (!patientOk(p.patientId)) continue;
        t.patient_plans.push({ id: p.id, patient_id: p.patientId, name: str(p.name, 200) || 'Plan', diet_goal: str(p.dietGoal, 30) || 'maintenance',
            daily_target: num(p.dailyTarget) || 2000, start_date: str(p.startDate, 10) || now.slice(0, 10), end_date: str(p.endDate, 10),
            notes: str(p.notes) || '', status: oneOf(p.status, ['active', 'completed', 'cancelled'], 'active'),
            created_at: p.createdAt || now, updated_at: p.updatedAt || now });
        if (planExists.get(p.id)) continue;
        for (const [day, meals] of Object.entries(p.weekPlan || {})) {
            for (const [mealType, recipeId] of Object.entries(meals || {})) {
                if (recipeId && C.DAYS.includes(day) && C.MEAL_TYPES.includes(mealType) && recipeOk(recipeId)) {
                    t.patient_plan_meals.push({ id: newId(), patient_plan_id: p.id, day_of_week: day, meal_type: mealType, recipe_id: recipeId });
                }
            }
        }
    }
    for (const g of list(data.patientProgress)) {
        if (!patientOk(g.patientId)) continue;
        t.patient_progress.push({ id: g.id, patient_id: g.patientId, date: str(g.date, 10) || now.slice(0, 10), weight: num(g.weight),
            adherence: num(g.adherence) ?? 0, energy_level: num(g.energyLevel) ?? 5, sleep_quality: num(g.sleepQuality) ?? 5, mood: num(g.mood) ?? 5,
            symptoms: JSON.stringify(Array.isArray(g.symptoms) ? g.symptoms : []), notes: str(g.notes) || '', created_at: g.createdAt || now });
    }

    // Custom templates come over with their week; the browser's default
    // templates only lend their week to the server's template of the same goal
    templates.ensureDefaults(ctx);
    const weeks = data.weekPlans && typeof data.weekPlans === 'object' ? data.weekPlans : {};
    for (const tpl of list(data.dietTemplates)) {
        if (tpl.isDefault) continue;
        t.diet_templates.push({ id: tpl.id, name: str(tpl.name, 200) || 'Plantilla', description: str(tpl.description, 1000) || '',
            goal: str(tpl.goal, 30) || 'maintenance', daily_target: num(tpl.dailyTarget) || 2000,
            week_plan: weeks[tpl.id] ? JSON.stringify(weeks[tpl.id]) : null, is_default: 0, created_at: tpl.createdAt || now, updated_at: now });
    }
    return { format: 'nutri-aye-backup', version: 5, tables: t };
}

module.exports = { convert };
