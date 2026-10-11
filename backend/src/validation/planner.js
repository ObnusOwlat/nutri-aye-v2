// Weekly planner
const { z, requiredText, optionalText } = require('./index');
const { MEAL_TYPES, DAYS } = require('../constants');
const { activityPlan } = require('./activity');

const plannerCreate = z.object({
    patientId: requiredText(64),
    templateId: optionalText(64)
});

const plannerUpdate = z.object({
    patientId: requiredText(64).optional(),
    templateId: optionalText(64),
    meals: z.array(z.object({
        day: z.enum(DAYS),
        mealType: z.enum(MEAL_TYPES),
        recipeId: optionalText(64)
    })).max(7 * MEAL_TYPES.length * 10).optional(),
    activityPlan: activityPlan.optional()
});

module.exports = { plannerCreate, plannerUpdate };
