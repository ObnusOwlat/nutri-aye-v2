// Recipe suggestions query
const { z } = require('./index');
const { MEAL_TYPES } = require('../constants');

const idList = z.string().max(100 * 65).optional()
    .transform(s => (s ? s.split(',').map(x => x.trim()).filter(Boolean).slice(0, 100) : []));

const suggestionsQuery = z.object({
    mealType: z.enum(MEAL_TYPES).optional(),
    limit: z.coerce.number().int().min(1).max(200).default(50),
    week: idList,
    days: z.coerce.number().int().min(1).max(7).default(7)
});

module.exports = { suggestionsQuery };
