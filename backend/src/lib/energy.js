// Suggested daily energy and macronutrients. Guidance: the nutritionist confirms it.
//   1. Resting energy: Mifflin-St Jeor (Mifflin MD, St Jeor ST et al. Am J Clin Nutr 1990;51:241-7)
//   2. Total energy: x activity factor
//   3. Goal: % of the total (deficit -15 to -25 %, gain +10 to +20 %)
//   4. Macros: protein g/kg (1,6-2,2 to keep or gain muscle), fat 20-35 % of
//      the energy, carbohydrates the rest (4 / 9 / 4 kcal per gram)

const ACTIVITY_FACTORS = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, very_active: 1.9 };
const GOAL_PERCENT = { maintenance: 0, deficit: -20, bulking: 15, performance: 10 };
const PROTEIN_PER_KG = { maintenance: 1.6, deficit: 2.0, bulking: 1.8, performance: 1.8 };
const FAT_PERCENT = 25;
// Kidney disease: protein is limited (KDIGO 2020: 0,8 g/kg without dialysis)
const KIDNEY_PROTEIN_PER_KG = 0.8;
const MIN_CARBS_G = 130; // RDA of carbohydrates (NASEM)

// With a BMI of 30 or more, g/kg go on the adjusted weight:
// ideal (BMI 25) + 0,4 x (actual - ideal)
function proteinWeight(weight, height) {
    if (!weight || !height) return { kg: weight, adjusted: false };
    const ideal = 25 * (height / 100) ** 2;
    return weight / (height / 100) ** 2 >= 30
        ? { kg: Math.round((ideal + 0.4 * (weight - ideal)) * 10) / 10, adjusted: true }
        : { kg: weight, adjusted: false };
}

/**
 * { kcal, ree, tdee, factor, goalPercent, missing } — kcal is null when weight,
 * height, age or sex is missing (listed in missing)
 */
function suggestedEnergy({ sex, age, weight, height, activityLevel, goal, goalPercent }) {
    const missing = [];
    if (!weight) missing.push('peso');
    if (!height) missing.push('talla');
    if (age == null) missing.push('fecha de nacimiento');
    if (sex !== 'male' && sex !== 'female') missing.push('sexo');
    const factor = ACTIVITY_FACTORS[activityLevel] || ACTIVITY_FACTORS.moderate;
    const percent = goalPercent ?? GOAL_PERCENT[goal] ?? 0;
    if (missing.length) return { kcal: null, ree: null, tdee: null, factor, goalPercent: percent, missing };

    const ree = 10 * weight + 6.25 * height - 5 * age + (sex === 'male' ? 5 : -161);
    const tdee = ree * factor;
    const kcal = Math.max(1200, Math.round(tdee * (1 + percent / 100) / 10) * 10);
    return { kcal, ree: Math.round(ree), tdee: Math.round(tdee), factor, goalPercent: percent, missing };
}

/**
 * Daily grams of protein, fat and carbohydrates for an energy target.
 * { proteinPerKg, fatPercent, protein: { g, kcal, percent }, fat, carbs, notes }
 */
function macroTargets({ kcal, weight, height = null, goal, proteinPerKg, fatPercent, kidney = false }) {
    const notes = [];
    const perKg = proteinPerKg ?? (kidney ? KIDNEY_PROTEIN_PER_KG : PROTEIN_PER_KG[goal] ?? PROTEIN_PER_KG.maintenance);
    if (kidney && proteinPerKg == null) notes.push('Enfermedad renal: proteína limitada a 0,8 g/kg (KDIGO).');
    const fatPct = fatPercent ?? FAT_PERCENT;

    // Without weight, protein as 15 % of the energy
    const basis = proteinWeight(weight, height);
    if (basis.adjusted) notes.push(`IMC de 30 o más: proteína sobre el peso ajustado (${String(basis.kg).replace('.', ',')} kg).`);
    const proteinG = weight ? Math.round(perKg * basis.kg) : Math.round(kcal * 0.15 / 4);
    if (!weight) notes.push('Sin peso registrado: proteína estimada como 15 % de las calorías.');
    const fatG = Math.round(kcal * fatPct / 100 / 9);
    let carbsG = Math.round((kcal - proteinG * 4 - fatG * 9) / 4);
    if (carbsG < 0) {
        notes.push('La proteína y la grasa superan las calorías: revisá los g/kg o el % de grasa.');
        carbsG = 0;
    } else if (carbsG < MIN_CARBS_G) {
        notes.push(`Carbohidratos por debajo de ${MIN_CARBS_G} g/día (mínimo recomendado).`);
    }
    const part = (g, perGram) => ({ g, kcal: g * perGram, percent: kcal ? Math.round(g * perGram * 100 / kcal) : 0 });
    return {
        proteinPerKg: perKg, fatPercent: fatPct, proteinWeightKg: weight ? basis.kg : null,
        protein: part(proteinG, 4), fat: part(fatG, 9), carbs: part(carbsG, 4), notes
    };
}

module.exports = { suggestedEnergy, macroTargets, ACTIVITY_FACTORS, GOAL_PERCENT, PROTEIN_PER_KG, FAT_PERCENT };
