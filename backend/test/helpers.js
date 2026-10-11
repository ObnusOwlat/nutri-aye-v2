// Every test file gets a fresh in-memory database
process.env.DB_PATH = ':memory:';

const request = require('supertest');
const { app, db } = require('../server');

const api = () => request(app);

// Minimal nutrient catalog + one USDA-like ingredient, written straight to the DB
function seedNutrients() {
    db.prepare(`INSERT OR IGNORE INTO nutrients (id, name, name_es, unit, rank, nutrient_group)
                VALUES (1008, 'Energy', 'Energía', 'kcal', 300, 'energy'),
                       (1089, 'Iron, Fe', 'Hierro', 'mg', 5400, 'minerals')`).run();
}

async function createIngredient(overrides = {}) {
    const res = await api().post('/api/ingredients').send({
        name: 'Arroz blanco', category: 'carbs', kcalPer100g: 130,
        proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3, ...overrides
    });
    return res.body.data;
}

async function createPatient(overrides = {}) {
    const res = await api().post('/api/patients').send({ firstName: 'Ana', lastName: 'Pérez', ...overrides });
    return res.body.data;
}

async function createRecipe(ingredientId, overrides = {}) {
    const res = await api().post('/api/recipes').send({
        name: 'Arroz', category: 'lunch', ingredients: [{ ingredientId, grams: 200 }], ...overrides
    });
    return res.body.data;
}

module.exports = { api, db, seedNutrients, createIngredient, createPatient, createRecipe };
