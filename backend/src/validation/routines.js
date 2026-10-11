// Exercise routines (activity templates)
const { z, requiredText, text } = require('./index');
const { activityPlan } = require('./activity');

const LEVELS = ['beginner', 'intermediate', 'advanced'];

const routineCreate = z.object({
    name: requiredText(120),
    description: text(500).nullish(),
    level: z.enum(LEVELS).default('beginner'),
    activityPlan
});

const routineUpdate = routineCreate.partial();

module.exports = { routineCreate, routineUpdate, LEVELS };
