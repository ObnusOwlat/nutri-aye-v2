// Meal day templates (planner)
const { z, requiredText, text } = require('./index');
const { MEAL_TYPES } = require('../constants');

const meals = z.record(z.enum(MEAL_TYPES), z.string().max(64).nullable())
    .refine(m => Object.values(m).some(Boolean), 'La plantilla necesita al menos una comida');

const dayTemplateCreate = z.object({
    name: requiredText(120),
    description: text(500).nullish(),
    meals
});

const dayTemplateUpdate = dayTemplateCreate.partial();

module.exports = { dayTemplateCreate, dayTemplateUpdate };
