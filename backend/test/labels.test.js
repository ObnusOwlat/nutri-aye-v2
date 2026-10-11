// Fase 5 (backend): Spanish labels and messages
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { api, app, createIngredient, createRecipe } = require('./helpers');
const C = require('../src/constants');
const { ROLES } = require('../src/lib/permissions');
const { NUTRIENT_FIELDS } = require('../src/nutrient-fields');
const { LABELS, fieldLabel } = require('../src/labels');

test('every allowed value has a Spanish label', () => {
    const groups = {
        mealCategory: C.MEAL_CATEGORIES, mealType: C.MEAL_TYPES, day: C.DAYS, ingredientCategory: C.INGREDIENT_CATEGORIES,
        unit: C.UNITS, gender: C.GENDERS, patientStatus: C.PATIENT_STATUSES, activityLevel: C.ACTIVITY_LEVELS,
        conditionType: C.CONDITION_TYPES, severity: C.CONDITION_SEVERITIES, invoiceStatus: C.INVOICE_STATUSES,
        quoteStatus: C.QUOTE_STATUSES, itemType: C.ITEM_TYPES, paymentType: C.PAYMENT_TYPES, clientType: C.CLIENT_TYPES,
        role: ROLES, nutrient: NUTRIENT_FIELDS.map(f => f.key.replace(/Per100g$/, ''))
    };
    for (const [group, values] of Object.entries(groups)) {
        for (const value of values) assert.ok(LABELS[group]?.[value], `${group}.${value} sin etiqueta`);
    }
});

test('labels are served to logged-in users', async () => {
    assert.equal((await request(app).get('/api/labels')).status, 401);
    const res = await api().get('/api/labels');
    assert.equal(res.body.data.mealType.morning_snack, 'Media mañana');
    assert.equal(res.body.data.day.wednesday, 'Miércoles');
});

test('validation messages name the fields in Spanish', async () => {
    const res = await api().post('/api/ingredients').send({ name: '', kcalPer100g: 'mucho' });
    assert.equal(res.status, 400);
    assert.match(res.body.error, /^Revisá los datos: /);
    assert.match(res.body.error, /nombre: no puede estar vacío/);
    assert.match(res.body.error, /calorías por 100 g/);
    assert.equal(fieldLabel('items.1.unitPrice'), 'ítems (fila 2): precio unitario');
    assert.equal(fieldLabel('vitaminB12Per100g'), 'vitamina B12 por 100 g');
});

test('"not found" agrees with the noun; categories are shown in Spanish', async () => {
    assert.equal((await api().get('/api/recipes/no-existe')).body.error, 'Receta no encontrada');
    assert.equal((await api().get('/api/patients/no-existe')).body.error, 'Paciente no encontrado');
    const rice = await createIngredient({ name: 'Arroz etiquetas' });
    assert.equal(rice.categoryDisplay, 'Carbohidratos');
    const recipe = await createRecipe(rice.id, { name: 'Arroz etiquetas' });
    assert.equal(recipe.categoryDisplay, 'Almuerzo');
});

test('no English messages are left in the backend', () => {
    const files = [];
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach(e => {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) walk(full); else if (e.name.endsWith('.js')) files.push(full);
    });
    walk(path.join(__dirname, '..', 'src'));
    const ENGLISH = /(error|message): ['"`][^'"`]*\b(not found|required|invalid|must be|failed|cannot|already exists)\b/i;
    const offenders = files.flatMap(f => fs.readFileSync(f, 'utf8').split('\n').filter(l => ENGLISH.test(l)).map(l => `${path.basename(f)}: ${l.trim()}`));
    assert.deepEqual(offenders, []);
});
