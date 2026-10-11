// Nutrition analysis of planned recipes
const { z, requiredText } = require('./index');

const nutritionAnalyze = z.object({
    recipeIds: z.array(requiredText(64)).min(1).max(100)
});

module.exports = { nutritionAnalyze };
