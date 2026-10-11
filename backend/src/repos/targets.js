// Daily nutritional targets of a patient: suggested energy (lib/energy.js),
// reference intakes by sex and age (lib/dri.js), limits and emphasis from their
// conditions (lib/diet-rules.js: daily = 4 x the per-meal amounts) and the
// nutritionist's manual adjustments (patient_targets). Guidance only.
const { db } = require('../db/connection');
const patients = require('./patients');
const plans = require('./plans');
const { driDetails, isChild } = require('../lib/dri');
const { suggestedEnergy } = require('../lib/energy');
const { rulesFor } = require('../lib/diet-rules');
const { allergensFor } = require('../lib/allergens');
const { ageOf } = require('../lib/age');
const { nowIso } = require('../lib/http');

const MEALS_PER_DAY = 4; // diet-rules amounts are per meal
const SATURATED_FAT = 1258, PROTEIN = 1003, ENERGY = 1008;

const stmts = {
    overrides: db.prepare('SELECT target_key, target FROM patient_targets WHERE patient_id = ? AND target IS NOT NULL'),
    upsert: db.prepare(`
        INSERT INTO patient_targets (patient_id, target_key, target, updated_at, updated_by) VALUES (@patientId, @key, @target, @now, @userId)
        ON CONFLICT (patient_id, target_key) DO UPDATE SET target = excluded.target, updated_at = excluded.updated_at, updated_by = excluded.updated_by
    `)
};

// Everything the calculation needs about the patient
function profileOf(ctx, patientId) {
    const patient = patients.getById(ctx, patientId);
    if (!patient) return null;
    const metric = patients.getDetail(ctx, patientId).metrics.find(m => m.weight || m.height) || {};
    const conditions = patients.listAllConditions(ctx).filter(c => c.patientId === patientId);
    const activePlan = plans.listAllPlans(ctx).find(p => p.patientId === patientId && p.status === 'active');
    const text = conditions.map(c => `${c.name} ${c.description || ''}`).join(' ').toLowerCase();
    return {
        patient, conditions, activePlan,
        sex: patient.gender, age: ageOf(patient.dateOfBirth), weight: metric.weight, height: metric.height,
        activityLevel: patient.physicalActivity?.level || metric.activityLevel || 'moderate',
        goal: activePlan?.dietGoal || 'maintenance',
        pregnant: /embaraz|gestac/.test(text), lactating: /lactancia|amamant/.test(text)
    };
}

function targetsFor(ctx, patientId) {
    const profile = profileOf(ctx, patientId);
    if (!profile) return null;
    const overrides = Object.fromEntries(stmts.overrides.all(patientId).map(r => [r.target_key, r.target]));

    // Energy: manual > active plan > formula
    const auto = suggestedEnergy(profile);
    const planKcal = profile.activePlan?.dailyTarget || null;
    const energySource = overrides.energy ? 'manual' : planKcal ? 'plan' : auto.kcal ? 'calculated' : 'default';
    const kcal = overrides.energy || planKcal || auto.kcal || 2000;

    const nutrients = {};
    for (const [id, d] of Object.entries(driDetails(profile))) {
        nutrients[id] = d.kind === 'CDRR' || d.kind === 'UL'
            ? { max: d.target, ul: null, kind: 'limit', basis: d.kind === 'UL' ? 'Máximo tolerable (retinol preformado)' : 'Límite recomendado' }
            : { target: d.target, ul: d.ul, kind: 'goal', basis: d.kind === 'AI' ? 'Ingesta adecuada' : 'Ingesta recomendada' };
    }
    // Protein 0,8 g/kg when the weight is known; saturated fat < 10 % of the energy
    if (profile.weight && (profile.age == null || profile.age >= 19)) nutrients[PROTEIN].target = Math.round(0.8 * profile.weight);
    nutrients[SATURATED_FAT] = { max: Math.round((kcal * 0.1) / 9), ul: null, kind: 'limit', basis: 'Menos del 10 % de las calorías' };
    nutrients[ENERGY] = { target: kcal, ul: null, kind: 'energy', basis: 'Calorías del día' };

    // Conditions: daily limits and nutrients to favor
    const rules = rulesFor(profile.conditions);
    for (const rule of rules) {
        for (const { nutrient, max } of rule.limit) {
            const daily = max * MEALS_PER_DAY;
            const current = nutrients[nutrient];
            nutrients[nutrient] = { ...current, kind: 'limit', max: Math.min(current?.max ?? Infinity, daily), target: undefined, basis: rule.label };
        }
        for (const { nutrient, min } of rule.favor) {
            const current = nutrients[nutrient] || { kind: 'goal', ul: null };
            nutrients[nutrient] = { ...current, target: Math.max(current.target || 0, min * MEALS_PER_DAY), emphasis: rule.label };
        }
    }

    // Manual adjustments (goal or limit, whichever the nutrient has)
    for (const [key, value] of Object.entries(overrides)) {
        if (key === 'energy' || !nutrients[key]) continue;
        const n = nutrients[key];
        n.auto = n.kind === 'limit' ? n.max : n.target;
        if (n.kind === 'limit') n.max = value; else n.target = value;
        n.manual = true;
    }

    const notes = [];
    if (isChild(profile.age)) notes.push('Paciente menor de 14 años: se usan valores de adolescentes; requiere evaluación pediátrica.');
    if (auto.missing.length) notes.push(`Para calcular las calorías sugeridas faltan: ${auto.missing.join(', ')}.`);

    return {
        profile: { sex: profile.sex, age: profile.age, weight: profile.weight, height: profile.height, activityLevel: profile.activityLevel, goal: profile.goal },
        energy: { kcal, source: energySource, automatic: planKcal || auto.kcal || 2000, suggested: auto },
        nutrients,
        rules: rules.map(r => ({ id: r.id, label: r.label, source: r.source })),
        avoid: allergensFor(profile.conditions).map(g => ({ id: g.id, label: g.label })),
        notes
    };
}

// { energy?: number|null, nutrients?: { id: number|null } } — null = automatic again
const saveOverrides = db.transaction((ctx, patientId, { energy, nutrients = {} }) => {
    const now = nowIso();
    const write = (key, target) => stmts.upsert.run({ patientId, key, target, now, userId: ctx.userId });
    if (energy !== undefined) write('energy', energy);
    for (const [id, target] of Object.entries(nutrients)) write(String(id), target);
});

module.exports = { targetsFor, saveOverrides };
