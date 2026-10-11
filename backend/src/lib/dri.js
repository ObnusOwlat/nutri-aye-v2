// Daily reference intakes by sex and life stage.
// Source: NASEM Dietary Reference Intakes (RDA/AI, UL; sodium CDRR 2019) as
// summarized by the NIH Office of Dietary Supplements; limits for saturated fat
// and cholesterol from WHO / Dietary Guidelines. Keys are USDA nutrient ids.
// Ages: 14-18 (adolescents), 19-30, 31-50, 51-70, 71+. Under 14 the 14-18 values
// are used and flagged, since children need a pediatric assessment.
//
// driDetails(): { id: { target, ul, kind } }  kind: RDA | AI | CDRR (limit)
// driFor():     { id: target } for the 11 nutrients the recipe suggestions use

const NAMES = {
    1003: 'proteínas', 1079: 'fibra', 1089: 'hierro', 1087: 'calcio', 1190: 'folato',
    1114: 'vitamina D', 1092: 'potasio', 1162: 'vitamina C', 1090: 'magnesio', 1095: 'zinc', 1178: 'vitamina B12'
};
const SUGGESTION_IDS = Object.keys(NAMES).map(Number);

// [id, kind, [male 14-18, 19-30, 31-50, 51-70, 71+], [female ...], UL adult, UL 14-18]
const TABLE = [
    [1003, 'RDA', [52, 56, 56, 56, 56], [46, 46, 46, 46, 46]],                      // protein g
    [1079, 'AI', [38, 38, 38, 30, 30], [26, 25, 25, 21, 21]],                       // fiber g
    [1087, 'RDA', [1300, 1000, 1000, 1000, 1200], [1300, 1000, 1000, 1200, 1200], 2500, 3000], // calcium mg
    [1089, 'RDA', [11, 8, 8, 8, 8], [15, 18, 18, 8, 8], 45, 45],                     // iron mg
    [1090, 'RDA', [410, 400, 420, 420, 420], [360, 310, 320, 320, 320]],             // magnesium mg (UL only supplements)
    [1091, 'RDA', [1250, 700, 700, 700, 700], [1250, 700, 700, 700, 700], 4000, 4000], // phosphorus mg
    [1092, 'AI', [3000, 3400, 3400, 3400, 3400], [2300, 2600, 2600, 2600, 2600]],   // potassium mg
    [1093, 'CDRR', [2300, 2300, 2300, 2300, 2300], [2300, 2300, 2300, 2300, 2300]], // sodium mg: reduce above
    [1095, 'RDA', [11, 11, 11, 11, 11], [9, 8, 8, 8, 8], 40, 34],                   // zinc mg
    [1098, 'RDA', [0.89, 0.9, 0.9, 0.9, 0.9], [0.89, 0.9, 0.9, 0.9, 0.9], 10, 8],   // copper mg
    [1103, 'RDA', [55, 55, 55, 55, 55], [55, 55, 55, 55, 55], 400, 400],            // selenium µg
    [1106, 'RDA', [900, 900, 900, 900, 900], [700, 700, 700, 700, 700], 3000, 2800], // vitamin A µg RAE
    [1162, 'RDA', [75, 90, 90, 90, 90], [65, 75, 75, 75, 75], 2000, 1800],          // vitamin C mg
    [1114, 'RDA', [15, 15, 15, 15, 20], [15, 15, 15, 15, 20], 100, 100],            // vitamin D µg
    [1109, 'RDA', [15, 15, 15, 15, 15], [15, 15, 15, 15, 15]],                      // vitamin E mg (UL only supplements)
    [1185, 'AI', [75, 120, 120, 120, 120], [75, 90, 90, 90, 90]],                   // vitamin K µg
    [1165, 'RDA', [1.2, 1.2, 1.2, 1.2, 1.2], [1.0, 1.1, 1.1, 1.1, 1.1]],            // thiamin mg
    [1166, 'RDA', [1.3, 1.3, 1.3, 1.3, 1.3], [1.0, 1.1, 1.1, 1.1, 1.1]],            // riboflavin mg
    [1167, 'RDA', [16, 16, 16, 16, 16], [14, 14, 14, 14, 14]],                      // niacin mg
    [1175, 'RDA', [1.3, 1.3, 1.3, 1.7, 1.7], [1.2, 1.3, 1.3, 1.5, 1.5], 100, 80],   // vitamin B6 mg
    [1178, 'RDA', [2.4, 2.4, 2.4, 2.4, 2.4], [2.4, 2.4, 2.4, 2.4, 2.4]],            // vitamin B12 µg
    [1190, 'RDA', [400, 400, 400, 400, 400], [400, 400, 400, 400, 400]],            // folate µg DFE
    [1253, 'CDRR', [300, 300, 300, 300, 300], [300, 300, 300, 300, 300]]            // cholesterol mg: limit
];

// Pregnancy / lactation (adults; replaces the female value)
const PREGNANT = { 1003: 71, 1089: 27, 1190: 600, 1095: 11, 1162: 85, 1106: 770, 1178: 2.6, 1175: 1.9, 1185: 90, 1092: 2900 };
const LACTATING = { 1003: 71, 1089: 9, 1190: 500, 1095: 12, 1162: 120, 1106: 1300, 1178: 2.8, 1175: 2.0, 1092: 2800 };

function stage(age) {
    if (age == null || age >= 19) return age == null || age < 31 ? 1 : age < 51 ? 2 : age < 71 ? 3 : 4;
    return 0;
}

function driDetails({ sex, age, pregnant = false, lactating = false }) {
    const female = sex === 'female';
    const index = stage(age);
    const details = {};
    for (const [id, kind, male, fem, ul, ulTeen] of TABLE) {
        details[id] = { target: (female ? fem : male)[index], ul: (index === 0 ? ulTeen : ul) ?? null, kind };
    }
    const extra = female && (pregnant ? PREGNANT : lactating ? LACTATING : null);
    if (extra) for (const [id, value] of Object.entries(extra)) details[id].target = value;
    return details;
}

function driFor(person) {
    const details = driDetails(person);
    return Object.fromEntries(SUGGESTION_IDS.map(id => [id, details[id].target]));
}

// Children get adolescent values: the interface warns about it
const isChild = (age) => age != null && age < 14;

module.exports = { driFor, driDetails, isChild, DRI_NAMES: NAMES };
