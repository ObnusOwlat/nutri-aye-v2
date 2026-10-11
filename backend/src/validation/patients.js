// Patients, metrics and conditions
const { z, text, requiredText, optionalText, isoDate } = require('./index');
const { GENDERS, PATIENT_STATUSES, ACTIVITY_LEVELS, CONDITION_TYPES, CONDITION_SEVERITIES } = require('../constants');

const emptyToNull = (schema) => z.preprocess(v => (v === '' ? null : v), schema.nullish());
const measure = (max) => emptyToNull(z.coerce.number().min(0).max(max));

const patientShape = {
    firstName: requiredText(100),
    lastName: requiredText(100),
    email: emptyToNull(z.string().trim().email().max(200)),
    phone: emptyToNull(text(50)),
    dateOfBirth: emptyToNull(isoDate),
    gender: emptyToNull(z.enum(GENDERS)),
    status: z.enum(PATIENT_STATUSES).optional(),
    address: z.object({ street: text(200).nullish(), city: text(100).nullish(), zipCode: text(20).nullish() }).partial().optional(),
    emergencyContact: z.object({ name: text(100).nullish(), phone: text(50).nullish(), relation: text(50).nullish() }).partial().optional(),
    notes: optionalText(5000),
    photo: optionalText(500000),
    physicalActivity: z.object({
        active: z.boolean().default(false),
        level: emptyToNull(z.enum(ACTIVITY_LEVELS)),
        frequency: measure(7),
        duration: measure(600),
        caloriesBurned: measure(50000),
        types: optionalText(300),
        goals: optionalText(300)
    }).nullish()
};

const patientCreate = z.object(patientShape);
const patientUpdate = z.object(patientShape).partial();

const metricCreate = z.object({
    date: isoDate.optional(),
    weight: measure(500),
    height: measure(300),
    bmi: measure(200),
    bmiCategory: optionalText(50),
    bodyFat: measure(100),
    muscleMass: measure(500),
    waist: measure(400),
    chest: measure(400),
    hips: measure(400),
    ciaAbdominal: measure(400),
    ciaBrazo: measure(200),
    ciaPierna: measure(200),
    cadera: measure(400),
    activityLevel: z.enum(ACTIVITY_LEVELS).default('moderate'),
    notes: optionalText(2000)
});

const conditionCreate = z.object({
    type: z.enum(CONDITION_TYPES).default('condition'),
    name: requiredText(200),
    severity: z.enum(CONDITION_SEVERITIES).default('mild'),
    description: optionalText(2000),
    dietaryNotes: optionalText(2000),
    medications: optionalText(2000)
});

const conditionUpdate = conditionCreate.partial().extend({
    type: z.enum(CONDITION_TYPES).optional(),
    severity: z.enum(CONDITION_SEVERITIES).optional()
});

module.exports = { patientCreate, patientUpdate, metricCreate, conditionCreate, conditionUpdate };

// Patient plans, progress and diet templates (Fase 4)
const { DAYS, MEAL_TYPES } = require('../constants');
const DIET_GOALS = ['maintenance', 'deficit', 'bulking', 'performance'];
const PLAN_STATUSES = ['active', 'completed', 'cancelled'];
const weekPlan = z.record(z.enum(DAYS), z.record(z.enum(MEAL_TYPES), z.string().max(64).nullable()));
const score = (min, max, fallback) => z.coerce.number().int().min(min).max(max).default(fallback);

const planCreate = z.object({
    name: requiredText(200),
    dietGoal: z.enum(DIET_GOALS).default('maintenance'),
    dailyTarget: z.coerce.number().int().min(500).max(10000).default(2000),
    startDate: isoDate.optional(),
    endDate: emptyToNull(isoDate),
    notes: optionalText(5000),
    status: z.enum(PLAN_STATUSES).default('active'),
    weekPlan: weekPlan.optional()
});
const planUpdate = planCreate.partial().extend({
    dietGoal: z.enum(DIET_GOALS).optional(),
    dailyTarget: z.coerce.number().int().min(500).max(10000).optional(),
    status: z.enum(PLAN_STATUSES).optional()
});

const progressCreate = z.object({
    date: isoDate.optional(),
    weight: measure(500),
    adherence: score(0, 100, 0),
    energyLevel: score(1, 10, 5),
    sleepQuality: score(1, 10, 5),
    mood: score(1, 10, 5),
    symptoms: z.array(text(100)).max(30).default([]),
    notes: optionalText(5000)
});
const progressUpdate = z.object({
    date: isoDate.optional(),
    weight: measure(500),
    adherence: z.coerce.number().int().min(0).max(100).optional(),
    energyLevel: z.coerce.number().int().min(1).max(10).optional(),
    sleepQuality: z.coerce.number().int().min(1).max(10).optional(),
    mood: z.coerce.number().int().min(1).max(10).optional(),
    symptoms: z.array(text(100)).max(30).optional(),
    notes: optionalText(5000)
});

const templateCreate = z.object({
    name: requiredText(200),
    description: optionalText(1000),
    goal: z.enum(DIET_GOALS).default('maintenance'),
    dailyTarget: z.coerce.number().int().min(800).max(10000).default(2000),
    mealDistribution: z.record(z.string().max(30), z.coerce.number().min(0).max(100)).nullish(),
    weekPlan: weekPlan.nullish()
});
const templateUpdate = templateCreate.partial().extend({
    goal: z.enum(DIET_GOALS).optional(),
    dailyTarget: z.coerce.number().int().min(800).max(10000).optional()
});

Object.assign(module.exports, { planCreate, planUpdate, progressCreate, progressUpdate, templateCreate, templateUpdate });
