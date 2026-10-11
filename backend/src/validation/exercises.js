// Physical activity energy estimate
const { z, requiredText } = require('./index');

const activityKcalQuery = z.object({
    activityId: requiredText(64),
    minutes: z.coerce.number().min(1).max(600),
    patientId: z.string().max(64).optional(),
    weightKg: z.coerce.number().min(10).max(400).optional(),
    age: z.coerce.number().int().min(1).max(120).optional()
});

module.exports = { activityKcalQuery };
