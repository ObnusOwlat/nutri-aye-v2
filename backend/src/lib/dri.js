// Daily reference intakes (RDA/AI) of adults, by sex and age.
// Source: NASEM Dietary Reference Intakes, NIH Office of Dietary Supplements.
// Under 19 years the adult values are used (to be refined in Fase 7).
// Keys are USDA nutrient ids, as in lib/key-nutrients.js.
const NAMES = {
    1003: 'proteínas', 1079: 'fibra', 1089: 'hierro', 1087: 'calcio', 1190: 'folato',
    1114: 'vitamina D', 1092: 'potasio', 1162: 'vitamina C', 1090: 'magnesio', 1095: 'zinc', 1178: 'vitamina B12'
};

function driFor({ sex, age, pregnant = false }) {
    const female = sex === 'female';
    const older = age != null && age >= 51;
    const elderly = age != null && age >= 71;
    const dri = {
        1003: female ? 46 : 56,
        1079: female ? (older ? 21 : 25) : (older ? 30 : 38),
        1089: female && !older ? 18 : 8,
        1087: (female && older) || elderly ? 1200 : 1000,
        1190: 400,
        1114: elderly ? 20 : 15,
        1092: female ? 2600 : 3400,
        1162: female ? 75 : 90,
        1090: female ? (age != null && age >= 31 ? 320 : 310) : (age != null && age >= 31 ? 420 : 400),
        1095: female ? 8 : 11,
        1178: 2.4
    };
    if (pregnant) Object.assign(dri, { 1089: 27, 1190: 600, 1003: 71, 1095: 11 });
    return dri;
}

module.exports = { driFor, DRI_NAMES: NAMES };
