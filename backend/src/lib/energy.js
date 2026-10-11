// Suggested daily energy: Mifflin-St Jeor resting energy x activity factor,
// adjusted by the plan's goal. Guidance: the nutritionist confirms it.
// Mifflin MD, St Jeor ST et al. Am J Clin Nutr 1990;51:241-7.

const ACTIVITY_FACTORS = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
const GOAL_ADJUSTMENT = { maintenance: 0, deficit: -500, bulking: 300, performance: 200 };

/**
 * { kcal, ree, factor, adjustment, missing } — kcal is null when weight,
 * height, age or sex is missing (listed in missing)
 */
function suggestedEnergy({ sex, age, weight, height, activityLevel, goal }) {
    const missing = [];
    if (!weight) missing.push('peso');
    if (!height) missing.push('talla');
    if (age == null) missing.push('fecha de nacimiento');
    if (sex !== 'male' && sex !== 'female') missing.push('sexo');
    const factor = ACTIVITY_FACTORS[activityLevel] || ACTIVITY_FACTORS.moderate;
    const adjustment = GOAL_ADJUSTMENT[goal] || 0;
    if (missing.length) return { kcal: null, ree: null, factor, adjustment, missing };

    const ree = 10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161);
    const kcal = Math.max(1200, Math.round((ree * factor + adjustment) / 10) * 10);
    return { kcal, ree: Math.round(ree), factor, adjustment, missing };
}

module.exports = { suggestedEnergy, ACTIVITY_FACTORS, GOAL_ADJUSTMENT };
