// Ingredients and recipes
const { z, requiredText, optionalText, nonNegative } = require('./index');
const { INGREDIENT_CATEGORIES, MEAL_CATEGORIES, UNITS } = require('../constants');
const { NUTRIENT_FIELDS } = require('../nutrient-fields');

const nutrientShape = Object.fromEntries(NUTRIENT_FIELDS.map(({ key }) => [key, nonNegative.optional()]));

const ingredientCreate = z.object({
    name: requiredText(200),
    category: z.enum(INGREDIENT_CATEGORIES).default('mixed'),
    unit: z.enum(UNITS).default('gram'),
    ...nutrientShape
});

const ingredientUpdate = z.object({
    name: requiredText(200).optional(),
    category: z.enum(INGREDIENT_CATEGORIES).optional(),
    unit: z.enum(UNITS).optional(),
    ...nutrientShape
});

// Bulk import is lenient on category (unknown -> mixed), strict on the rest
const ingredientBulk = z.object({
    ingredients: z.array(ingredientCreate.extend({
        category: z.string().optional().transform(c => (INGREDIENT_CATEGORIES.includes(c) ? c : 'mixed'))
    })).max(20000)
});

const recipeIngredient = z.object({
    ingredientId: requiredText(64),
    grams: z.coerce.number().positive().max(10000)
});

const recipeCreate = z.object({
    name: requiredText(200),
    category: z.enum(MEAL_CATEGORIES).default('lunch'),
    instructions: optionalText(10000),
    notes: optionalText(5000),
    ingredients: z.array(recipeIngredient).min(1).max(100)
});

const recipeUpdate = recipeCreate.partial().extend({
    category: z.enum(MEAL_CATEGORIES).optional()
});

module.exports = { ingredientCreate, ingredientUpdate, ingredientBulk, recipeCreate, recipeUpdate };
