// Foods available in Paraguay (⭐ first in searches) and fixes of odd machine
// translations in catalog names. Both are rules on the Spanish name; they guide
// the search, they do not certify where a food can be bought.
const { plain } = require('./diet-rules');

// First words of foods found in Paraguayan markets, supermarkets and ferias
const PY_FOODS = [
    // Carnes, pescados de río y de mar, huevos
    'carne vacuna', 'carne molida', 'pollo', 'cerdo', 'cordero', 'chivo', 'pavo', 'higado', 'mondongo', 'huevo', 'huevos', 'clara', 'yema',
    'chorizo', 'salchicha', 'jamon', 'panceta', 'mortadela', 'surubi', 'pacu', 'dorado', 'boga', 'tilapia', 'merluza', 'atun', 'sardina',
    'salmon', 'pescado', 'camarones', 'calamar',
    // Lácteos
    'leche', 'queso', 'yogur', 'manteca', 'crema', 'ricota', 'dulce de leche',
    // Cereales, harinas, panificados
    'arroz', 'fideo', 'fideos', 'pasta', 'harina', 'almidon', 'avena', 'maiz', 'pan', 'galleta', 'galletitas', 'polenta', 'trigo', 'semola',
    'tortilla', 'cereales', 'copos de maiz',
    // Legumbres y semillas
    'poroto', 'porotos', 'lenteja', 'lentejas', 'garbanzo', 'garbanzos', 'arveja', 'arvejas', 'soja', 'mani', 'manies', 'sesamo', 'chia', 'lino',
    'girasol', 'nuez', 'nueces', 'almendra', 'almendras', 'castanas de caju', 'coco',
    // Verduras
    'mandioca', 'papa', 'papas', 'batata', 'zanahoria', 'zanahorias', 'zapallo', 'zapallito', 'calabaza', 'tomate', 'tomates', 'cebolla',
    'cebollas', 'cebollita', 'ajo', 'locote', 'locotes', 'pimiento', 'pimientos', 'lechuga', 'repollo', 'acelga', 'espinaca', 'remolacha',
    'pepino', 'berenjena', 'chaucha', 'chauchas', 'choclo', 'brocoli', 'coliflor', 'apio', 'perejil', 'cilantro', 'albahaca', 'menta',
    'hongos', 'rabano', 'rabanos', 'rucula', 'puerro', 'kale', 'palmito',
    // Frutas
    'banana', 'bananas', 'naranja', 'naranjas', 'mandarina', 'mandarinas', 'pomelo', 'limon', 'limones', 'lima', 'limas', 'anana', 'pina',
    'mango', 'mangos', 'mamon', 'papaya', 'sandia', 'melon', 'manzana', 'manzanas', 'pera', 'peras', 'uva', 'uvas', 'pasas', 'frutilla',
    'frutillas', 'durazno', 'duraznos', 'ciruela', 'ciruelas', 'kiwi', 'palta', 'paltas', 'guayaba', 'maracuya', 'mburucuya', 'acerola',
    'pitanga', 'aratiku', 'jugo de naranja', 'jugo de limon',
    // Aceites, azúcar, infusiones, condimentos
    'aceite', 'azucar', 'miel', 'mermelada', 'cafe', 'te', 'yerba', 'sal', 'vinagre', 'mayonesa', 'ketchup', 'mostaza', 'oregano',
    'pimienta', 'comino', 'canela', 'cacao', 'chocolate', 'gelatina'
];
// USDA groups of US-only products (restaurants, brands, baby foods, native foods)
const NOT_PY_GROUPS = ['Fast Foods', 'Restaurant Foods', 'Baby Foods', 'American Indian/Alaska Native Foods', 'Meals, Entrees, and Side Dishes'];

// Foods the USDA marks as brought from another country ("Carne vacuna, Nueva
// Zelanda, importada…", "Beef, Australian, imported…"): the first words say
// "carne vacuna", but that cut is not the one sold here
const IMPORTED_EN = /\b(imported|New Zealand|Australian)\b/i;
const IMPORTED_ES = /\b(importad[oa]s?|nueva zelanda|australian[oa]s?)\b/;

const firstPart = (name) => plain(String(name || '').split(',')[0]).trim();
const startsWithAny = (text) => PY_FOODS.some(k => text === k || text.startsWith(`${k} `));

function isAvailableInPy({ name, nameEn, sourceCategory, orgId }) {
    if (orgId) return true;                                      // own foods: the consultorio has them
    if (NOT_PY_GROUPS.includes(sourceCategory)) return false;
    if (IMPORTED_EN.test(nameEn || '') || IMPORTED_ES.test(plain(name))) return false;
    if (/\b[A-Z]{3,}[A-Z' ]*\b/.test(nameEn || '') && !/^(USDA|NFS)\b/.test(nameEn)) return false; // brand names (KRAFT…)
    return startsWithAny(firstPart(name));
}

// Odd translations: [pattern, replacement], applied in order to catalog names
const NAME_FIXES = [
    [/(\d+)\s?% de pr[eé]stamos?/gi, '$1 % magro'],
    [/de pr[eé]stamos?/gi, 'magro'],
    [/,?\s*pan-broiled crumbles/gi, ', a la sartén, desmenuzado'],
    [/pan-broiled/gi, 'a la sartén'],
    [/\bcrumbles\b/gi, 'desmenuzado'],
    [/broilers? (o|or) fryers/gi, 'parrillero'],
    [/,\s*grado A\b/g, ''],
    [/calidad choice\b/gi, 'Choice'],
    [/calidad select\b/gi, 'Select'],
    [/Amplios porotos \(\s*porotos de la fava\)/gi, 'Habas'],
    [/arvejas de paloma \(gramos rojo\)/gi, 'Guandú (poroto paloma)'],
    [/arvejas de paloma/gi, 'guandú'],
    [/Arcillas de arroz de cerdo, marrón y servir/gi, 'Salchichas de cerdo con arroz, precocidas'],
    [/\btripe uncooked\b/gi, 'mondongo, crudo'],
    [/\btripe\b/gi, 'mondongo'],
    [/desayunar rayas/gi, 'tiras para el desayuno'],
    [/\bdiseminad([oa])\b/gi, 'para untar'],
    [/\bscalloped\b/gi, 'gratinadas'],
    // English words left in common (not brand) names; brands keep their names
    [/\b(cheese)\b(?![A-Z])/g, 'queso'], [/\bjuice\b/g, 'jugo'], [/\bwith\b/g, 'con'], [/\bflakes\b/g, 'copos'],
    [/\bpowder\b/g, 'en polvo'], [/\bcanned\b/g, 'enlatado'], [/\bfried\b/g, 'frito'], [/\bbaked\b/g, 'horneado'],
    [/\s{2,}/g, ' '], [/\(\s+/g, '(']
];

function fixName(name) {
    let fixed = String(name || '');
    for (const [pattern, replacement] of NAME_FIXES) fixed = fixed.replace(pattern, replacement);
    fixed = fixed.trim();
    return fixed.charAt(0).toUpperCase() + fixed.slice(1);
}

module.exports = { isAvailableInPy, fixName, PY_FOODS };
