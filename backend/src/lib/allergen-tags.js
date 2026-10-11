// Allergens: the 14 of EU Regulation 1169/2011 (Open Food Facts ids), how a
// patient's handwritten condition maps to them, and which allergens each food
// carries. Food tags come from the Open Food Facts ingredient taxonomy
// (foods-data/allergens/off-allergen-terms.json, ODbL) matched on the English
// USDA name and the Spanish name, plus local Spanish rules. A help for the
// nutritionist: raw catalog foods have no "may contain traces" data.
const fs = require('fs');
const path = require('path');
const { plain } = require('./diet-rules');

const ALLERGENS = {
    gluten: { label: 'Gluten (trigo, avena, cebada, centeno)', short: 'gluten', aliases: ['celiac', 'gluten', 'trigo', 'tacc', 'cebada', 'centeno'] },
    milk: { label: 'Leche y lácteos', short: 'lácteos', aliases: ['lactosa', 'lacteo', 'leche', 'caseina', 'proteina de la leche', 'aplv', 'suero de leche'] },
    eggs: { label: 'Huevo', short: 'huevo', aliases: ['huevo', 'ovoalbumina'] },
    peanuts: { label: 'Maní', short: 'maní', aliases: ['mani', 'cacahuate', 'cacahuete'] },
    nuts: { label: 'Frutos secos', short: 'frutos secos', aliases: ['frutos secos', 'nuez', 'nueces', 'almendra', 'avellana', 'castana', 'pistacho', 'caju', 'pecan', 'macadamia'] },
    soybeans: { label: 'Soja', short: 'soja', aliases: ['soja', 'soya'] },
    fish: { label: 'Pescado', short: 'pescado', aliases: ['pescado'] },
    crustaceans: { label: 'Crustáceos', short: 'crustáceos', aliases: ['crustace', 'camaron', 'langostino', 'langosta', 'cangrejo', 'marisco'] },
    molluscs: { label: 'Moluscos', short: 'moluscos', aliases: ['molusco', 'calamar', 'pulpo', 'mejillon', 'almeja', 'ostra', 'marisco'] },
    'sesame-seeds': { label: 'Sésamo', short: 'sésamo', aliases: ['sesamo', 'ajonjoli'] },
    celery: { label: 'Apio', short: 'apio', aliases: ['apio'] },
    mustard: { label: 'Mostaza', short: 'mostaza', aliases: ['mostaza'] },
    'sulphur-dioxide-and-sulphites': { label: 'Sulfitos', short: 'sulfitos', aliases: ['sulfito', 'dioxido de azufre'] },
    lupin: { label: 'Altramuces (lupino)', short: 'altramuces', aliases: ['altramuz', 'lupino', 'lupin'] }
};

// Local Spanish names the taxonomy misses (Río de la Plata / Paraguay).
// [allergen, keywords, exceptions]: whole words, plural included
const LOCAL_RULES = [
    ['gluten', ['trigo', 'avena', 'cebada', 'centeno', 'pan', 'harina', 'fideo', 'pasta', 'galleta', 'galletita', 'semola', 'cuscus', 'burgol', 'empanada', 'oats', 'barley', 'rye', 'wheat', 'salsa de soja'],
        ['harina de maiz', 'harina de mandioca', 'harina de arroz', 'pan de yuca', 'almidon', 'sin gluten', 'harina de garbanzo', 'pasta de mani']],
    ['milk', ['leche', 'queso', 'yogur', 'manteca', 'crema', 'ricota', 'requeson', 'mozzarella', 'dulce de leche', 'suero', 'kefir'],
        ['leche de coco', 'leche de almendra', 'leche de arroz', 'leche de soja', 'manteca de mani', 'manteca de cacao', 'manteca de almendra', 'manteca de girasol', 'manteca de cerdo', 'crema de mani', 'crema de coco', 'crema de arroz']],
    ['eggs', ['huevo', 'clara', 'yema', 'mayonesa', 'merengue'], []],
    ['peanuts', ['mani', 'manies', 'cacahuate'], []],
    ['nuts', ['nuez', 'nueces', 'almendra', 'avellana', 'castana', 'pistacho', 'caju', 'pecan', 'macadamia'], ['nuez moscada']],
    ['soybeans', ['soja', 'soya', 'tofu', 'miso', 'salsa de soja'], []],
    ['fish', ['pescado', 'salmon', 'atun', 'merluza', 'sardina', 'bacalao', 'trucha', 'tilapia', 'surubi', 'dorado', 'pacu', 'anchoa', 'eglefino', 'halibut', 'salsa de pescado'], []],
    ['crustaceans', ['camaron', 'langostino', 'langosta', 'cangrejo'], []],
    ['molluscs', ['calamar', 'pulpo', 'mejillon', 'almeja', 'ostra', 'vieira'], []],
    ['sesame-seeds', ['sesamo', 'tahini', 'ajonjoli'], []],
    ['celery', ['apio'], []],
    ['mustard', ['mostaza'], []],
    ['sulphur-dioxide-and-sulphites', ['vino', 'vinagre de vino'], []]
];

const escape = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const wordRe = (w) => new RegExp(`(^|[^a-z0-9])${escape(w)}(s|es)?(?![a-z])`);

// --- Open Food Facts terms, indexed by their first word
let terms = null;
function loadTerms() {
    if (terms) return terms;
    const file = path.join(__dirname, '..', '..', '..', 'foods-data', 'allergens', 'off-allergen-terms.json');
    const data = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')).terms : {};
    const byFirst = new Map();
    for (const [term, allergens] of Object.entries(data)) {
        const first = term.split(' ')[0];
        if (!byFirst.has(first)) byFirst.set(first, []);
        byFirst.get(first).push({ term, allergens, re: wordRe(term) });
    }
    terms = byFirst;
    return terms;
}

// Matches of the taxonomy in a text: longest terms win ("coconut milk" hides "milk")
function offMatches(text) {
    if (!text) return [];
    const words = new Set(text.split(/[^a-z0-9]+/).filter(Boolean));
    const found = [];
    for (const word of words) {
        for (const candidate of loadTerms().get(word) || []) {
            const m = candidate.re.exec(text);
            if (m) found.push({ ...candidate, start: m.index + m[1].length, end: m.index + m[0].length });
        }
    }
    return found.filter(a => !found.some(b => b !== a && b.term.length > a.term.length && b.start <= a.start && b.end >= a.end));
}

/**
 * Allergens of a food: [{ allergen, source: 'off' | 'rules', term }]
 */
function tagFood({ name, nameEn }) {
    const tags = new Map();
    const add = (allergen, source, term) => { if (ALLERGENS[allergen] && !tags.has(allergen)) tags.set(allergen, { allergen, source, term }); };
    for (const text of [plain(nameEn), plain(name)]) {
        for (const m of offMatches(text)) for (const a of m.allergens) add(a, 'off', m.term);
    }
    const es = plain(name);
    for (const [allergen, keywords, exceptions] of LOCAL_RULES) {
        if (exceptions.some(e => es.includes(e))) continue;
        const hit = keywords.find(k => wordRe(k).test(es));
        if (hit) add(allergen, 'rules', hit);
    }
    return [...tags.values()];
}

// Allergens named in a handwritten condition ("Intolerancia a la lactosa" -> milk)
function allergensInText(text) {
    const t = plain(text);
    return Object.entries(ALLERGENS).filter(([, a]) => a.aliases.some(alias => t.includes(alias))).map(([id]) => id);
}

const labelOf = (id) => ALLERGENS[id]?.label || id;
const shortOf = (id) => ALLERGENS[id]?.short || id;

module.exports = { ALLERGENS, tagFood, allergensInText, labelOf, shortOf };
