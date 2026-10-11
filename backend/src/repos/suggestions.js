// Recipe suggestions for a patient: the consultorio's recipes ranked by the
// patient's conditions (lib/diet-rules.js), allergies (lib/allergens.js) and
// daily needs by sex and age (lib/dri.js). Read only; guidance for the nutritionist.
const patients = require('./patients');
const recipes = require('./recipes');
const nutrition = require('./nutrition');
const { rulesFor } = require('../lib/diet-rules');
const { allergensFor, conflicts } = require('../lib/allergens');
const { driFor, DRI_NAMES } = require('../lib/dri');

// Planner meal slot -> recipe category
const CATEGORY_OF_MEAL = { morning_snack: 'snack' };
const ALLERGY_TYPES = ['allergy', 'intolerance'];

function ageOf(dateOfBirth) {
    if (!dateOfBirth) return null;
    const birth = new Date(dateOfBirth), now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now < new Date(now.getFullYear(), birth.getMonth(), birth.getDate())) age--;
    return Number.isFinite(age) ? age : null;
}

const fmt = (amount) => amount.toLocaleString('es-PY', { maximumFractionDigits: amount >= 100 ? 0 : 1 });

// How much of each daily need the planned week already covers -> weight 0.2..1
function needWeights(dri, perRecipe, weekRecipeIds, days) {
    const weights = Object.fromEntries(Object.keys(dri).map(id => [id, 1]));
    if (!weekRecipeIds.length) return weights;
    for (const id of Object.keys(dri)) {
        const total = weekRecipeIds.reduce((sum, r) => sum + (perRecipe[r]?.[id] || 0), 0);
        weights[id] = Math.min(1, Math.max(0.2, 1 - total / days / dri[id]));
    }
    return weights;
}

function scoreRecipe(recipe, amounts, units, ctx) {
    let score = 0;
    const reasons = [], warnings = [];
    const amountText = (id) => `${fmt(amounts[id])} ${units[id] || ''}`.trim();

    for (const rule of ctx.rules) {
        for (const { nutrient, max, text } of rule.limit) {
            if (amounts[nutrient] == null) continue;
            if (amounts[nutrient] <= max) {
                score += 2;
                reasons.push(`Bajo en ${text} (${amountText(nutrient)})`);
            } else if (amounts[nutrient] > 2 * max) {
                score -= 4;
                warnings.push(`Alto en ${text} (${amountText(nutrient)}) — ${rule.label}`);
            } else {
                score -= 1;
            }
        }
        for (const { nutrient, min, text } of rule.favor) {
            if ((amounts[nutrient] || 0) >= min) {
                score += 2;
                reasons.push(`Buena fuente de ${text} (${amountText(nutrient)})`);
            }
        }
    }

    // Daily needs: up to 40 % of each one counts, more where the week falls short
    const covered = [];
    for (const [id, need] of Object.entries(ctx.dri)) {
        const share = (amounts[id] || 0) / need;
        score += Math.min(share, 0.4) * 5 * ctx.weights[id];
        if (share >= 0.25) covered.push([id, share]);
    }
    covered.sort((a, b) => b[1] - a[1]).slice(0, 2)
        .forEach(([id, share]) => reasons.push(`Aporta ${Math.round(share * 100)} % de ${DRI_NAMES[id]} del día`));

    const found = conflicts(ctx.allergens, recipe.ingredients.map(i => i.ingredientName));
    for (const { group, ingredient } of found) warnings.unshift(`Contiene ${group.label}: ${ingredient}`);

    return {
        recipeId: recipe.id, name: recipe.name, category: recipe.category,
        calories: recipe.nutrition?.calories ?? null,
        score: Math.round(score * 10) / 10, excluded: found.length > 0, reasons, warnings
    };
}

/**
 * Ranked recipes for a patient, or null when the patient is not in the consultorio.
 * Recipes with an allergen of the patient go last, with excluded: true.
 */
function forPatient(ctx, patientId, { mealType = '', limit = 50, weekRecipeIds = [], days = 7 } = {}) {
    const patient = patients.getDetail(ctx, patientId);
    if (!patient) return null;

    const conditions = patient.conditions || [];
    const rules = rulesFor(conditions);
    const allergens = allergensFor(conditions.filter(c => ALLERGY_TYPES.includes(c.type)));
    const age = ageOf(patient.dateOfBirth);
    const dri = driFor({ sex: patient.gender, age, pregnant: rules.some(r => r.id === 'pregnancy') });

    const category = CATEGORY_OF_MEAL[mealType] || mealType;
    const list = recipes.listAll(ctx).filter(r => !category || r.category === category);
    const analysis = nutrition.forRecipes(ctx, [...list.map(r => r.id), ...weekRecipeIds]);
    const units = Object.fromEntries(analysis.nutrients.map(n => [n.id, n.unit]));
    const weights = needWeights(dri, analysis.recipes, weekRecipeIds.filter(id => analysis.recipes[id]), days);

    const ranked = list
        .map(r => scoreRecipe(r, analysis.recipes[r.id] || {}, units, { rules, allergens, dri, weights }))
        .sort((a, b) => (a.excluded - b.excluded) || (b.score - a.score));

    return {
        patient: {
            id: patient.id, sex: patient.gender || null, age,
            rules: rules.map(r => ({ id: r.id, label: r.label, source: r.source })),
            allergens: allergens.map(a => a.label)
        },
        data: ranked.slice(0, limit)
    };
}

module.exports = { forPatient };
