// Nutrients always shown in summaries. Per ingredient the amount comes from the
// USDA id, else the duplicate USDA id (fallback), else the ingredient's own column
// (own and calories-in foods have no USDA rows).
const KEY_NUTRIENTS = [
    { id: 1008, fallback: 2047, column: 'kcal_per_100g' },
    { id: 1003, column: 'protein_per_100g' },
    { id: 1005, column: 'carbs_per_100g' },
    { id: 1004, column: 'fat_per_100g' },
    { id: 1258, column: 'saturated_fat_per_100g' },
    { id: 1079, column: 'fiber_per_100g' },
    { id: 2000, fallback: 1063, column: 'sugar_per_100g' },
    { id: 1093, column: 'sodium_per_100g' },
    { id: 1253, column: 'cholesterol_per_100g' },
    // Vitamins
    { id: 1106, column: 'vitamin_a_per_100g' },
    { id: 1162, column: 'vitamin_c_per_100g' },
    { id: 1114, column: 'vitamin_d_per_100g' },
    { id: 1109, column: 'vitamin_e_per_100g' },
    { id: 1185, column: 'vitamin_k_per_100g' },
    { id: 1165, column: 'vitamin_b1_per_100g' },
    { id: 1166, column: 'vitamin_b2_per_100g' },
    { id: 1167, column: 'vitamin_b3_per_100g' },
    { id: 1175, column: 'vitamin_b6_per_100g' },
    { id: 1178, column: 'vitamin_b12_per_100g' },
    { id: 1190, column: 'vitamin_b9_per_100g' },
    // Minerals
    { id: 1087, column: 'calcium_per_100g' },
    { id: 1089, column: 'iron_per_100g' },
    { id: 1090, column: 'magnesium_per_100g' },
    { id: 1091, column: 'phosphorus_per_100g' },
    { id: 1092, column: 'potassium_per_100g' },
    { id: 1095, column: 'zinc_per_100g' }
];

// Ids folded into a key nutrient: not listed again among "the rest"
const FOLDED_IDS = new Set(KEY_NUTRIENTS.flatMap(k => (k.fallback ? [k.id, k.fallback] : [k.id])));

module.exports = { KEY_NUTRIENTS, FOLDED_IDS };
