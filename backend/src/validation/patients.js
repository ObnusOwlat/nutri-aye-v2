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
    photo: optionalText(500000)
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

module.exports = { patientCreate, patientUpdate, metricCreate, conditionCreate };
