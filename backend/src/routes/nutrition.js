// Nutrient totals of planned recipes (planner side panel). Read only: no audit.
const express = require('express');
const nutrition = require('../repos/nutrition');
const { validate } = require('../validation');
const { nutritionAnalyze } = require('../validation/nutrition');

const router = express.Router();

// POST /api/nutrition/analyze { recipeIds } -> nutrient list + amounts per recipe.
// The client sums per day/week, so changing the selected day needs no request.
router.post('/api/nutrition/analyze', validate(nutritionAnalyze), (req, res) => {
    const { nutrients, recipes, skipped } = nutrition.forRecipes(req.ctx, req.body.recipeIds);
    res.json({ success: true, data: { nutrients, recipes }, skipped });
});

module.exports = router;
