// Every test file gets a fresh in-memory database
process.env.DB_PATH = ':memory:';
process.env.NODE_ENV = 'test';

const request = require('supertest');
const { app, db } = require('../server');
const auth = require('../src/repos/auth');

// A consultorio with a user of the given role, logged in. Returns its cookie.
let userCount = 0;
function sessionFor(role = 'admin', orgId = null) {
    const org = orgId ? { id: orgId } : auth.createOrganization(`Consultorio ${++userCount}`);
    const user = auth.createUser({ email: `u${++userCount}@ejemplo.com`, name: `Usuario ${userCount}`, password: 'clave-segura-1' });
    auth.addMembership(user.id, org.id, role);
    const token = auth.createSession({ userId: user.id, orgId: org.id });
    return { cookie: `nutri_sid=${token}`, orgId: org.id, userId: user.id, email: user.email };
}

// Default: admin of a fresh consultorio (every test file has its own database)
const admin = sessionFor('admin');

// Requests with a session cookie: api() as the default admin, api(other) as someone else
function api(session = admin) {
    const agent = request(app);
    const withCookie = (method) => (path) => agent[method](path).set('Cookie', session?.cookie || '');
    return { get: withCookie('get'), post: withCookie('post'), put: withCookie('put'), delete: withCookie('delete') };
}

// Minimal nutrient catalog + one USDA-like ingredient, written straight to the DB
function seedNutrients() {
    db.prepare(`INSERT OR IGNORE INTO nutrients (id, name, name_es, unit, rank, nutrient_group)
                VALUES (1008, 'Energy', 'Energía', 'kcal', 300, 'energy'),
                       (1089, 'Iron, Fe', 'Hierro', 'mg', 5400, 'minerals')`).run();
}

async function createIngredient(overrides = {}, session = admin) {
    const res = await api(session).post('/api/ingredients').send({
        name: 'Arroz blanco', category: 'carbs', kcalPer100g: 130,
        proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3, ...overrides
    });
    return res.body.data;
}

async function createPatient(overrides = {}, session = admin) {
    const res = await api(session).post('/api/patients').send({ firstName: 'Ana', lastName: 'Pérez', ...overrides });
    return res.body.data;
}

async function createRecipe(ingredientId, overrides = {}, session = admin) {
    const res = await api(session).post('/api/recipes').send({
        name: 'Arroz', category: 'lunch', ingredients: [{ ingredientId, grams: 200 }], ...overrides
    });
    return res.body.data;
}

module.exports = { api, app, db, admin, sessionFor, seedNutrients, createIngredient, createPatient, createRecipe };
