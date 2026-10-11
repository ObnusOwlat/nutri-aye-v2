// Patients with their metrics and conditions
const { db } = require('../db/connection');
const { transformPatient, transformMetric, transformCondition } = require('../transforms');
const { newId, nowIso } = require('../lib/http');

// API field -> column (nested address/emergency contact flattened)
const FIELDS = [
    ['firstName', 'first_name'], ['lastName', 'last_name'], ['email', 'email'], ['phone', 'phone'],
    ['dateOfBirth', 'date_of_birth'], ['gender', 'gender'], ['status', 'status'], ['notes', 'notes'], ['photo', 'photo'],
    ['address.street', 'street'], ['address.city', 'city'], ['address.zipCode', 'zip_code'],
    ['emergencyContact.name', 'emergency_name'], ['emergencyContact.phone', 'emergency_phone'],
    ['emergencyContact.relation', 'emergency_relation']
];
const COLUMNS = FIELDS.map(([, column]) => column);
const pick = (data, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), data);

const stmts = {
    byId: db.prepare('SELECT * FROM patients WHERE id = ?'),
    insert: db.prepare(`
        INSERT INTO patients (id, ${COLUMNS.join(', ')}, created_at, updated_at)
        VALUES (@id, ${COLUMNS.map(c => `@${c}`).join(', ')}, @now, @now)
    `),
    remove: db.prepare('DELETE FROM patients WHERE id = ?'),
    recentMetrics: db.prepare('SELECT * FROM patient_metrics WHERE patient_id = ? ORDER BY date DESC LIMIT 10'),
    conditions: db.prepare('SELECT * FROM patient_conditions WHERE patient_id = ? ORDER BY created_at'),
    insertMetric: db.prepare(`
        INSERT INTO patient_metrics (id, patient_id, date, weight, height, bmi, bmi_category,
            body_fat, muscle_mass, waist, chest, hips, activity_level, notes)
        VALUES (@id, @patientId, @date, @weight, @height, @bmi, @bmiCategory,
            @bodyFat, @muscleMass, @waist, @chest, @hips, @activityLevel, @notes)
    `),
    metricById: db.prepare('SELECT * FROM patient_metrics WHERE id = ?'),
    removeMetric: db.prepare('DELETE FROM patient_metrics WHERE id = ? AND patient_id = ?'),
    insertCondition: db.prepare(`
        INSERT INTO patient_conditions (id, patient_id, type, name, severity, description, dietary_notes, medications)
        VALUES (@id, @patientId, @type, @name, @severity, @description, @dietaryNotes, @medications)
    `),
    conditionById: db.prepare('SELECT * FROM patient_conditions WHERE id = ?'),
    removeCondition: db.prepare('DELETE FROM patient_conditions WHERE id = ? AND patient_id = ?')
};

function list({ search = '', limit, offset }) {
    let where = '1=1';
    const params = [];
    if (search) {
        where = '(unaccent(first_name) LIKE unaccent(?) OR unaccent(last_name) LIKE unaccent(?) OR LOWER(email) LIKE LOWER(?) OR phone LIKE ?)';
        const s = `%${search}%`;
        params.push(s, s, s, s);
    }
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM patients WHERE ${where}`).get(...params);
    const rows = db.prepare(`SELECT * FROM patients WHERE ${where} ORDER BY last_name, first_name LIMIT ? OFFSET ?`).all(...params, limit, offset);
    return { rows: rows.map(transformPatient), total };
}

const getById = (id) => transformPatient(stmts.byId.get(id));
const exists = (id) => !!stmts.byId.get(id);

function getDetail(id) {
    const patient = getById(id);
    if (!patient) return null;
    const conditions = stmts.conditions.all(id).map(transformCondition);
    return {
        ...patient,
        metrics: stmts.recentMetrics.all(id).map(transformMetric),
        conditions,
        allergies: allergiesOf(conditions)
    };
}

function create(data) {
    const id = newId();
    const params = Object.fromEntries(FIELDS.map(([path, column]) => [column, pick(data, path) ?? null]));
    stmts.insert.run({ ...params, status: params.status || 'active', id, now: nowIso() });
    return getById(id);
}

// Only the fields present in the request change
function update(id, data) {
    if (!exists(id)) return null;
    const changes = FIELDS.filter(([path]) => pick(data, path) !== undefined);
    if (changes.length) {
        const sets = changes.map(([, column]) => `${column} = @${column}`).join(', ');
        const params = Object.fromEntries(changes.map(([path, column]) => [column, pick(data, path)]));
        db.prepare(`UPDATE patients SET ${sets}, updated_at = @now WHERE id = @id`).run({ ...params, id, now: nowIso() });
    }
    return getById(id);
}

const remove = (id) => stmts.remove.run(id).changes > 0;

function addMetric(patientId, data) {
    const id = newId();
    const nullable = ['weight', 'height', 'bmi', 'bmiCategory', 'bodyFat', 'muscleMass', 'waist', 'chest', 'hips'];
    const params = Object.fromEntries(nullable.map(k => [k, data[k] ?? null]));
    stmts.insertMetric.run({
        ...params, id, patientId,
        date: data.date || nowIso().slice(0, 10),
        activityLevel: data.activityLevel, notes: data.notes ?? ''
    });
    return transformMetric(stmts.metricById.get(id));
}

const removeMetric = (patientId, metricId) => stmts.removeMetric.run(metricId, patientId).changes > 0;

function addCondition(patientId, data) {
    const id = newId();
    stmts.insertCondition.run({
        id, patientId, type: data.type, name: data.name, severity: data.severity,
        description: data.description ?? '', dietaryNotes: data.dietaryNotes ?? '', medications: data.medications ?? ''
    });
    return transformCondition(stmts.conditionById.get(id));
}

const removeCondition = (patientId, conditionId) => stmts.removeCondition.run(conditionId, patientId).changes > 0;

const allergiesOf = (conditions) => conditions.filter(c => c.type === 'allergy' || c.type === 'intolerance').map(c => c.name);
const allergies = (patientId) => allergiesOf(stmts.conditions.all(patientId).map(transformCondition));

const listAll = () => db.prepare('SELECT * FROM patients ORDER BY last_name, first_name').all().map(transformPatient);
const listAllMetrics = () => db.prepare('SELECT * FROM patient_metrics ORDER BY date').all().map(transformMetric);
const listAllConditions = () => db.prepare('SELECT * FROM patient_conditions ORDER BY created_at').all().map(transformCondition);

module.exports = {
    list, getById, exists, getDetail, create, update, remove,
    addMetric, removeMetric, addCondition, removeCondition, allergies,
    listAll, listAllMetrics, listAllConditions
};
