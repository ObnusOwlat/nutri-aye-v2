// Allergen groups: which patient conditions trigger them and which ingredient
// names contain them (accents and case ignored). Ingredient words match whole
// words, plural included ("pan" -> "pan integral", not "panceta"); a trailing *
// matches any word start ("empanad*" -> "empanadas").
// Matching by name is a help, not a guarantee: the nutritionist checks labels.
const { plain } = require('./diet-rules');

const ALLERGEN_GROUPS = [
    {
        id: 'gluten', label: 'gluten',
        triggers: ['celiac', 'gluten', 'trigo'],
        ingredients: ['trigo', 'avena', 'cebada', 'centeno', 'pan', 'harina', 'fideo', 'pasta', 'galleta', 'galletita', 'cerveza', 'semola', 'cuscus', 'empanad*', 'tostada']
    },
    {
        id: 'dairy', label: 'lácteos',
        triggers: ['lactosa', 'lacteo', 'leche', 'caseina', 'proteina de la leche'],
        ingredients: ['leche', 'queso', 'yogur', 'manteca', 'mantequilla', 'crema', 'ricota', 'requeson', 'mozzarella', 'dulce de leche', 'suero']
    },
    { id: 'egg', label: 'huevo', triggers: ['huevo'], ingredients: ['huevo', 'mayonesa', 'merengue'] },
    { id: 'peanut', label: 'maní', triggers: ['mani', 'cacahuate'], ingredients: ['mani', 'cacahuate'] },
    {
        id: 'tree_nuts', label: 'frutos secos',
        triggers: ['frutos secos', 'nuez', 'nueces', 'almendra', 'avellana', 'castana', 'pistacho'],
        ingredients: ['nuez', 'nueces', 'almendra', 'avellana', 'castana', 'pistacho', 'anacardo', 'caju', 'pecan', 'macadamia']
    },
    {
        id: 'fish', label: 'pescado',
        triggers: ['pescado'],
        ingredients: ['pescado', 'salmon', 'atun', 'merluza', 'sardina', 'bacalao', 'trucha', 'tilapia', 'surubi', 'dorado', 'pacu', 'anchoa']
    },
    {
        id: 'shellfish', label: 'mariscos',
        triggers: ['marisco', 'crustace', 'camaron', 'langostino'],
        ingredients: ['camaron', 'langostino', 'marisco', 'mejillon', 'calamar', 'pulpo', 'cangrejo', 'langosta', 'almeja', 'ostra']
    },
    { id: 'soy', label: 'soja', triggers: ['soja', 'soya'], ingredients: ['soja', 'soya', 'tofu', 'miso'] }
];

const containsWord = (text, word) => (word.endsWith('*')
    ? new RegExp(`(^|[^a-z])${word.slice(0, -1)}`)
    : new RegExp(`(^|[^a-z])${word}(s|es)?([^a-z]|$)`)).test(text);

// Groups a patient must avoid, from conditions of any type
function allergensFor(conditions) {
    const text = conditions.map(c => plain(`${c.name} ${c.description || ''}`)).join(' | ');
    return ALLERGEN_GROUPS.filter(group => group.triggers.some(t => text.includes(t)));
}

// [{ group, ingredient }] for the ingredient names that contain an avoided group
function conflicts(groups, ingredientNames) {
    const found = [];
    for (const name of ingredientNames) {
        const text = plain(name);
        for (const group of groups) {
            if (group.ingredients.some(word => containsWord(text, word))) found.push({ group, ingredient: name });
        }
    }
    return found;
}

module.exports = { ALLERGEN_GROUPS, allergensFor, conflicts };
