// Diet rules per medical condition, used to rank recipes for a patient.
// A rule applies when one of its keywords appears in a condition's name or
// description (accents and case ignored). Amounts are per recipe (one meal),
// taken as roughly a quarter of the daily limit/goal of each guideline.
// Guidance only: the nutritionist decides.
const N = {
    sugars: 2000, fiber: 1079, sodium: 1093, potassium: 1092, phosphorus: 1091,
    saturatedFat: 1258, cholesterol: 1253, iron: 1089, vitaminC: 1162, folate: 1190
};

const DIET_RULES = [
    {
        id: 'diabetes',
        label: 'Diabetes / glucemia',
        keywords: ['diabet', 'prediabet', 'glucemia', 'insulin', 'hiperglucem'],
        source: 'ADA Standards of Care; OMS azúcares libres < 10 % de la energía',
        limit: [{ nutrient: N.sugars, max: 12, text: 'azúcares' }],
        favor: [{ nutrient: N.fiber, min: 6, text: 'fibra' }]
    },
    {
        id: 'hypertension',
        label: 'Hipertensión',
        keywords: ['hipertens', 'presion alta', 'tension alta'],
        source: 'OMS sodio < 2 g/día; dieta DASH (potasio 4,7 g/día)',
        limit: [{ nutrient: N.sodium, max: 500, text: 'sodio' }],
        favor: [{ nutrient: N.potassium, min: 900, text: 'potasio' }]
    },
    {
        id: 'kidney',
        label: 'Enfermedad renal',
        keywords: ['renal', 'rinon', 'nefr', 'dialisis'],
        source: 'KDIGO / KDOQI: potasio, fósforo y sodio restringidos',
        limit: [
            { nutrient: N.potassium, max: 600, text: 'potasio' },
            { nutrient: N.phosphorus, max: 250, text: 'fósforo' },
            { nutrient: N.sodium, max: 500, text: 'sodio' }
        ],
        favor: []
    },
    {
        id: 'cholesterol',
        label: 'Colesterol / dislipemia',
        keywords: ['colesterol', 'dislipem', 'hipercolest', 'triglicer', 'cardio', 'coronar'],
        source: 'OMS/AHA: grasas saturadas < 10 % de la energía, colesterol < 300 mg/día',
        limit: [
            { nutrient: N.saturatedFat, max: 5, text: 'grasas saturadas' },
            { nutrient: N.cholesterol, max: 75, text: 'colesterol' }
        ],
        favor: [{ nutrient: N.fiber, min: 6, text: 'fibra' }]
    },
    {
        id: 'anemia',
        label: 'Anemia',
        keywords: ['anemia', 'ferropen', 'hierro bajo'],
        source: 'OMS: hierro y vitamina C (mejora su absorción)',
        limit: [],
        favor: [
            { nutrient: N.iron, min: 4, text: 'hierro' },
            { nutrient: N.vitaminC, min: 25, text: 'vitamina C' }
        ]
    },
    {
        id: 'pregnancy',
        label: 'Embarazo / lactancia',
        keywords: ['embaraz', 'gestac', 'lactancia'],
        source: 'NASEM DRI embarazo: folato 600 µg, hierro 27 mg',
        limit: [],
        favor: [
            { nutrient: N.folate, min: 150, text: 'folato' },
            { nutrient: N.iron, min: 6, text: 'hierro' }
        ]
    }
];

// Accent- and case-insensitive text, for matching keywords
const plain = (text) => String(text || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

// Rules that apply to a list of conditions ({ name, description })
function rulesFor(conditions) {
    const text = conditions.map(c => plain(`${c.name} ${c.description || ''}`)).join(' | ');
    return DIET_RULES.filter(rule => rule.keywords.some(k => text.includes(k)));
}

module.exports = { DIET_RULES, rulesFor, plain };
