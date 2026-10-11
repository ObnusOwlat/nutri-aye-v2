// Creates and migrates the whole schema; order matters (views go last)
const { db } = require('../connection');
const { createCatalogTables } = require('./catalog');
const { createPatientTables } = require('./patients');
const { migrateCategories } = require('./categories');
const { createNutrientTables } = require('./nutrients');
const { createPlannerTables } = require('./planner');
const { createBillingTables } = require('./billing');
const { createViews } = require('./views');

function initializeDatabase() {
    createCatalogTables(db);
    createPatientTables(db);
    migrateCategories(db);
    createNutrientTables(db);
    createPlannerTables(db);
    createBillingTables(db);
    createViews(db);
}

module.exports = { initializeDatabase };
