// Per-100 g nutrient columns of the ingredients table: the single source for
// INSERT/UPDATE statements, API keys and validation
const BASES = [
    'kcal', 'protein', 'carbs', 'fat', 'saturated_fat', 'polyunsaturated_fat', 'monounsaturated_fat',
    'sugar', 'fiber', 'cholesterol', 'sodium',
    'vitamin_a', 'vitamin_b1', 'vitamin_b2', 'vitamin_b3', 'vitamin_b5', 'vitamin_b6', 'vitamin_b9',
    'vitamin_b12', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k',
    'magnesium', 'calcium', 'phosphorus', 'potassium', 'iron', 'selenium', 'zinc', 'manganese', 'copper'
];

const camel = (s) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

// [{ column: 'vitamin_b12_per_100g', key: 'vitaminB12Per100g' }, ...]
const NUTRIENT_FIELDS = BASES.map(base => ({ column: `${base}_per_100g`, key: `${camel(base)}Per100g` }));

module.exports = { NUTRIENT_FIELDS };
