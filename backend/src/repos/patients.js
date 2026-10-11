// Patients of a consultorio with their metrics and conditions. ctx = { orgId, userId }.
// Nothing is deleted: "delete" deactivates the patient (or the metric/condition).
const { db } = require('../db/connection');
const { transformPatient, transformMetric, transformCondition } = require('../transforms');
const { newId, nowIso } = require('../lib/http');

// API field -> column (nested address/emergency contact flattened)
const FIELDS = [
    ['firstName', 'first_name'], ['lastName', 'last_name'], ['email', 'email'], ['phone', 'phone'],
    ['dateOfBirth', 'date_of_birth'], ['gender', 'gender'], ['status', 'status'], ['notes', 'notes'], ['photo', 'photo'],
    ['address.street', 'street'], ['address.city', 'city'], ['address.zipCode', 'zip_code'],
    ['emergencyContact.name', 'emergency_name'], ['emergencyContact.phone', 'emergency_phone'],
    ['emergencyContact.relation', 'emergency_relation'], ['physicalActivity', 'physical_activity']
];
// Objects stored as JSON text
const JSON_COLUMNS = new Set(['physical_activity']);
const toColumn = (column, value) => (JSON_COLUMNS.has(column) && value != null ? JSON.stringify(value) : value);
const COLUMNS = FIELDS.map(([, column]) => column);
const pick = (data, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), data);

const stmts = {
    byId: db.prepare('SELECT * FROM patients WHERE id = @id AND org_id = @orgId AND deactivated_at IS NULL'),
    insert: db.prepare(`
        INSERT INTO patients (id, org_id, ${COLUMNS.join(', ')}, created_at, updated_at)
        VALUES (@id, @orgId, ${COLUMNS.map(c => `@${c}`).join(', ')}, @now, @now)
    `),
    deactivate: db.prepare(`
        UPDATE patients SET deactivated_at = @now, deactivated_by = @userId
        WHERE id = @id AND org_id = @orgId AND deactivated_at IS NULL
    `),
    reactivate: db.prepare('UPDATE patients SET deactivated_at = NULL, deactivated_by = NULL WHERE id = @id AND org_id = @orgId'),
    recentMetrics: db.prepare('SELECT * FROM patient_metrics WHERE patient_id = ? AND deactivated_at IS NULL ORDER BY date DESC LIMIT 10'),
    conditions: db.prepare('SELECT * FROM patient_conditions WHERE patient_id = ? AND deactivated_at IS NULL ORDER BY created_at'),
    insertMetric: db.prepare(`
        INSERT INTO patient_metrics (id, patient_id, date, weight, height, bmi, bmi_category,
            body_fat, muscle_mass, waist, chest, hips, cia_abdominal, cia_brazo, cia_pierna, cadera, activity_level, notes)
        VALUES (@id, @patientId, @date, @weight, @height, @bmi, @bmiCategory,
            @bodyFat, @muscleMass, @waist, @chest, @hips, @ciaAbdominal, @ciaBrazo, @ciaPierna, @cadera, @activityLevel, @notes)
    `),
    metricById: db.prepare('SELECT * FROM patient_metrics WHERE id = ?'),
    deactivateMetric: db.prepare(`
        UPDATE patient_metrics SET deactivated_at = @now, deactivated_by = @userId
        WHERE id = @id AND patient_id = @patientId AND deactivated_at IS NULL
    `),
    insertCondition: db.prepare(`
        INSERT INTO patient_conditions (id, patient_id, type, name, severity, description, dietary_notes, medications)
        VALUES (@id, @patientId, @type, @name, @severity, @description, @dietaryNotes, @medications)
    `),
    conditionById: db.prepare('SELECT * FROM patient_conditions WHERE id = ?'),
    updateCondition: db.prepare(`
        UPDATE patient_conditions SET type = COALESCE(@type, type), name = COALESCE(@name, name),
            severity = COALESCE(@severity, severity), description = COALESCE(@description, description),
            dietary_notes = COALESCE(@dietaryNotes, dietary_notes), medications = COALESCE(@medications, medications),
            updated_at = @now
        WHERE id = @id AND patient_id = @patientId AND deactivated_at IS NULL
    `),
    deactivateCondition: db.prepare(`
        UPDATE patient_conditions SET deactivated_at = @now, deactivated_by = @userId
        WHERE id = @id AND patient_id = @patientId AND deactivated_at IS NULL
    `)
};

function list(ctx, { search = '', limit, offset }) {
    let where = 'org_id = ? AND deactivated_at IS NULL';
    const params = [ctx.orgId];
    if (search) {
        where += ' AND (unaccent(first_name) LIKE unaccent(?) OR unaccent(last_name) LIKE unaccent(?) OR LOWER(email) LIKE LOWER(?) OR phone LIKE ?)';
        const s = `%${search}%`;
        params.push(s, s, s, s);
    }
    const { total } = db.prepare(`SELECT COUNT(*) AS total FROM patients WHERE ${where}`).get(...params);
    const rows = db.prepare(`SELECT * FROM patients WHERE ${where} ORDER BY last_name, first_name LIMIT ? OFFSET ?`).all(...params, limit, offset);
    return { rows: rows.map(transformPatient), total };
}

const getById = (ctx, id) => transformPatient(stmts.byId.get({ id, orgId: ctx.orgId }));
const exists = (ctx, id) => !!stmts.byId.get({ id, orgId: ctx.orgId });

function getDetail(ctx, id) {
    const patient = getById(ctx, id);
    if (!patient) return null;
    const conditions = stmts.conditions.all(id).map(transformCondition);
    return {
        ...patient,
        metrics: stmts.recentMetrics.all(id).map(transformMetric),
        conditions,
        allergies: allergiesOf(conditions)
    };
}

function create(ctx, data) {
    const id = newId();
    const params = Object.fromEntries(FIELDS.map(([path, column]) => [column, toColumn(column, pick(data, path) ?? null)]));
    stmts.insert.run({ ...params, status: params.status || 'active', id, orgId: ctx.orgId, now: nowIso() });
    return getById(ctx, id);
}

// Only the fields present in the request change
function update(ctx, id, data) {
    if (!exists(ctx, id)) return null;
    const changes = FIELDS.filter(([path]) => pick(data, path) !== undefined);
    if (changes.length) {
        const sets = changes.map(([, column]) => `${column} = @${column}`).join(', ');
        const params = Object.fromEntries(changes.map(([path, column]) => [column, toColumn(column, pick(data, path))]));
        db.prepare(`UPDATE patients SET ${sets}, updated_at = @now WHERE id = @id`).run({ ...params, id, now: nowIso() });
    }
    return getById(ctx, id);
}

const deactivate = (ctx, id) => stmts.deactivate.run({ id, orgId: ctx.orgId, userId: ctx.userId, now: nowIso() }).changes > 0;
const reactivate = (ctx, id) => stmts.reactivate.run({ id, orgId: ctx.orgId }).changes > 0;

function addMetric(patientId, data) {
    const id = newId();
    const nullable = ['weight', 'height', 'bmi', 'bmiCategory', 'bodyFat', 'muscleMass', 'waist', 'chest', 'hips',
        'ciaAbdominal', 'ciaBrazo', 'ciaPierna', 'cadera'];
    const params = Object.fromEntries(nullable.map(k => [k, data[k] ?? null]));
    stmts.insertMetric.run({
        ...params, id, patientId,
        date: data.date || nowIso().slice(0, 10),
        activityLevel: data.activityLevel, notes: data.notes ?? ''
    });
    return transformMetric(stmts.metricById.get(id));
}

const deactivateMetric = (ctx, patientId, id) =>
    stmts.deactivateMetric.run({ id, patientId, userId: ctx.userId, now: nowIso() }).changes > 0;

function addCondition(patientId, data) {
    const id = newId();
    stmts.insertCondition.run({
        id, patientId, type: data.type, name: data.name, severity: data.severity,
        description: data.description ?? '', dietaryNotes: data.dietaryNotes ?? '', medications: data.medications ?? ''
    });
    return transformCondition(stmts.conditionById.get(id));
}

// Only the fields sent change; null = not found
function updateCondition(patientId, id, data) {
    const fields = ['type', 'name', 'severity', 'description', 'dietaryNotes', 'medications'];
    const params = Object.fromEntries(fields.map(f => [f, data[f] ?? null]));
    const changed = stmts.updateCondition.run({ ...params, id, patientId, now: nowIso() }).changes;
    return changed ? transformCondition(stmts.conditionById.get(id)) : null;
}

const deactivateCondition = (ctx, patientId, id) =>
    stmts.deactivateCondition.run({ id, patientId, userId: ctx.userId, now: nowIso() }).changes > 0;

const allergiesOf = (conditions) => conditions.filter(c => c.type === 'allergy' || c.type === 'intolerance').map(c => c.name);
const allergies = (patientId) => allergiesOf(stmts.conditions.all(patientId).map(transformCondition));

// Everything active of the consultorio (browser sync)
const ACTIVE_PATIENTS = 'SELECT id FROM patients WHERE org_id = ? AND deactivated_at IS NULL';
const listAll = (ctx) => db.prepare('SELECT * FROM patients WHERE org_id = ? AND deactivated_at IS NULL ORDER BY last_name, first_name')
    .all(ctx.orgId).map(transformPatient);
const listAllMetrics = (ctx) => db.prepare(`SELECT * FROM patient_metrics WHERE deactivated_at IS NULL AND patient_id IN (${ACTIVE_PATIENTS}) ORDER BY date`)
    .all(ctx.orgId).map(transformMetric);
const listAllConditions = (ctx) => db.prepare(`SELECT * FROM patient_conditions WHERE deactivated_at IS NULL AND patient_id IN (${ACTIVE_PATIENTS}) ORDER BY created_at`)
    .all(ctx.orgId).map(transformCondition);

module.exports = {
    list, getById, exists, getDetail, create, update, deactivate, reactivate,
    addMetric, deactivateMetric, addCondition, updateCondition, deactivateCondition, allergies,
    listAll, listAllMetrics, listAllConditions
};
