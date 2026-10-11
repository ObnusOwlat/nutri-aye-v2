// Recipes with ingredients and nutrition
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../db/connection');
const { serverError } = require('../lib/errors');
const { MEAL_CATEGORIES } = require('../constants');
const { transformRecipe } = require('../transforms');

const router = express.Router();

// GET /api/recipes - List with search, filter, pagination
router.get('/api/recipes', (req, res) => {
    try {
        const { 
            search = '', 
            category = '',
            page = 1, 
            limit = 50 
        } = req.query;

        const pageNum = Math.max(1, parseInt(page));
        const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
        const offset = (pageNum - 1) * limitNum;

        let whereClause = '1=1';
        const params = [];

        if (search) {
            whereClause += ' AND LOWER(r.name) LIKE ?';
            params.push(`%${search.toLowerCase()}%`);
        }

        if (category) {
            whereClause += ' AND r.category_id = ?';
            params.push(category);
        }

        const countStmt = db.prepare(`
            SELECT COUNT(*) as total FROM recipes r WHERE ${whereClause}
        `);
        const { total } = countStmt.get(...params);

        const query = `
            SELECT 
                r.*,
                c.name as category,
                c.display_name as category_display,
                COALESCE(vn.total_calories, 0) as total_calories,
                COALESCE(vn.total_protein, 0) as total_protein,
                COALESCE(vn.total_carbs, 0) as total_carbs,
                COALESCE(vn.total_fat, 0) as total_fat
            FROM recipes r
            JOIN categories c ON r.category_id = c.id
            LEFT JOIN v_recipe_nutrition vn ON r.id = vn.recipe_id
            WHERE ${whereClause}
            ORDER BY r.name ASC
            LIMIT ? OFFSET ?
        `;

        const recipes = db.prepare(query).all(...params, limitNum, offset);

        // Get ingredients for each recipe
        const recipesWithIngredients = recipes.map(recipe => {
            const ingredients = db.prepare(`
                SELECT ri.*, i.name as ingredient_name, i.kcal_per_100g
                FROM recipe_ingredients ri
                JOIN ingredients i ON ri.ingredient_id = i.id
                WHERE ri.recipe_id = ?
            `).all(recipe.id);

            return {
                ...transformRecipe(recipe),
                ingredients: ingredients.map(ri => ({
                    ingredientId: ri.ingredient_id,
                    ingredientName: ri.ingredient_name,
                    grams: ri.grams
                }))
            };
        });

        res.json({
            success: true,
            data: recipesWithIngredients,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error('[Recipes] List error:', error);
        serverError(res, error);
    }
});

// GET /api/recipes/:id
router.get('/api/recipes/:id', (req, res) => {
    try {
        const recipe = db.prepare(`
            SELECT r.*, c.name as category, c.display_name as category_display,
                   n.total_calories, n.total_protein, n.total_carbs, n.total_fat
            FROM recipes r
            JOIN categories c ON r.category_id = c.id
            LEFT JOIN v_recipe_nutrition n ON n.recipe_id = r.id
            WHERE r.id = ?
        `).get(req.params.id);

        if (!recipe) {
            return res.status(404).json({ success: false, error: 'Recipe not found' });
        }

        const ingredients = db.prepare(`
            SELECT ri.*, i.name as ingredient_name, i.kcal_per_100g,
                   i.protein_per_100g, i.carbs_per_100g, i.fat_per_100g
            FROM recipe_ingredients ri
            JOIN ingredients i ON ri.ingredient_id = i.id
            WHERE ri.recipe_id = ?
        `).all(req.params.id);

        // Full nutrient totals from ingredients with a detailed profile
        const nutrients = db.prepare(`
            SELECT n.id, COALESCE(n.name_es, n.name) AS name, n.name AS nameEn, n.unit, n.nutrient_group AS "group",
                   SUM(inut.amount * ri.grams / 100) AS amount
            FROM recipe_ingredients ri
            JOIN ingredient_nutrients inut ON inut.ingredient_id = ri.ingredient_id
            JOIN nutrients n ON n.id = inut.nutrient_id
            WHERE ri.recipe_id = ?
            GROUP BY n.id
            ORDER BY n.rank, n.id
        `).all(req.params.id);

        res.json({
            success: true,
            data: {
                ...transformRecipe(recipe),
                ingredients: ingredients.map(ri => ({
                    ingredientId: ri.ingredient_id,
                    ingredientName: ri.ingredient_name,
                    grams: ri.grams
                })),
                nutrients
            }
        });
    } catch (error) {
        serverError(res, error);
    }
});

// POST /api/recipes
router.post('/api/recipes', (req, res) => {
    try {
        const { name, category, instructions, notes, ingredients = [] } = req.body;
        const id = uuidv4(); // ids are always generated by the server
        const now = new Date().toISOString();

        // Validation: Recipe must have a name
        if (!name || !name.trim()) {
            return res.status(400).json({ success: false, error: 'Recipe name is required' });
        }

        // Validation: Recipe must have at least one ingredient
        if (!ingredients || ingredients.length === 0) {
            return res.status(400).json({ success: false, error: 'Recipe must have at least one ingredient' });
        }

        // Validation: All ingredient IDs must exist in database
        if (category && !MEAL_CATEGORIES.includes(category)) {
            return res.status(400).json({ success: false, error: `Invalid category. Must be one of: ${MEAL_CATEGORIES.join(', ')}` });
        }

        // Validate each ingredient exists
        for (const ing of ingredients) {
            if (!ing.ingredientId) {
                return res.status(400).json({ success: false, error: 'ingredientId is required for each ingredient' });
            }
            const exists = db.prepare('SELECT id FROM ingredients WHERE id = ?').get(ing.ingredientId);
            if (!exists) {
                return res.status(400).json({ success: false, error: `Ingredient not found: ${ing.ingredientId}` });
            }
            if (!ing.grams || ing.grams <= 0) {
                return res.status(400).json({ success: false, error: 'grams must be greater than 0' });
            }
        }

        db.prepare(`
            INSERT INTO recipes (id, name, category_id, instructions, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(id, name, category || 'lunch', instructions || '', notes || '', now, now);

        // Insert recipe ingredients
        const insertIng = db.prepare(`
            INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, grams)
            VALUES (?, ?, ?, ?)
        `);

        for (const ing of ingredients) {
            insertIng.run(uuidv4(), id, ing.ingredientId, ing.grams || 100);
        }

        const recipe = db.prepare(`
            SELECT r.*, c.name as category, c.display_name as category_display,
                   n.total_calories, n.total_protein, n.total_carbs, n.total_fat
            FROM recipes r
            JOIN categories c ON r.category_id = c.id
            LEFT JOIN v_recipe_nutrition n ON n.recipe_id = r.id
            WHERE r.id = ?
        `).get(id);

        res.json({ success: true, data: transformRecipe(recipe) });
    } catch (error) {
        console.error('[Recipes] Create error:', error);
        serverError(res, error);
    }
});

// PUT /api/recipes/:id
router.put('/api/recipes/:id', (req, res) => {
    try {
        const { name, category, instructions, notes, ingredients } = req.body;
        const now = new Date().toISOString();

        // Check recipe exists
        const existing = db.prepare('SELECT id FROM recipes WHERE id = ?').get(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, error: 'Recipe not found' });
        }

        // Validation: Recipe must have a name
        if (name && !name.trim()) {
            return res.status(400).json({ success: false, error: 'Recipe name cannot be empty' });
        }

        // Validation: If ingredients provided, must have at least one
        if (ingredients && ingredients.length === 0) {
            return res.status(400).json({ success: false, error: 'Recipe must have at least one ingredient' });
        }

        // Validate each ingredient exists
        if (ingredients && ingredients.length > 0) {
            for (const ing of ingredients) {
                if (!ing.ingredientId) {
                    return res.status(400).json({ success: false, error: 'ingredientId is required for each ingredient' });
                }
                const exists = db.prepare('SELECT id FROM ingredients WHERE id = ?').get(ing.ingredientId);
                if (!exists) {
                    return res.status(400).json({ success: false, error: `Ingredient not found: ${ing.ingredientId}` });
                }
                if (!ing.grams || ing.grams <= 0) {
                    return res.status(400).json({ success: false, error: 'grams must be greater than 0' });
                }
            }
        }

        db.prepare(`
            UPDATE recipes SET
                name = ?,
                category_id = ?,
                instructions = ?,
                notes = ?,
                updated_at = ?
            WHERE id = ?
        `).run(name, category || 'lunch', instructions || '', notes || '', now, req.params.id);

        // Update ingredients if provided
        if (ingredients) {
            db.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').run(req.params.id);
            
            const insertIng = db.prepare(`
                INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, grams)
                VALUES (?, ?, ?, ?)
            `);

            for (const ing of ingredients) {
                insertIng.run(uuidv4(), req.params.id, ing.ingredientId, ing.grams || 100);
            }
        }

        const recipe = db.prepare(`
            SELECT r.*, c.name as category, c.display_name as category_display,
                   n.total_calories, n.total_protein, n.total_carbs, n.total_fat
            FROM recipes r
            JOIN categories c ON r.category_id = c.id
            LEFT JOIN v_recipe_nutrition n ON n.recipe_id = r.id
            WHERE r.id = ?
        `).get(req.params.id);

        res.json({ success: true, data: transformRecipe(recipe) });
    } catch (error) {
        serverError(res, error);
    }
});

// DELETE /api/recipes/:id
router.delete('/api/recipes/:id', (req, res) => {
    try {
        db.prepare('DELETE FROM recipes WHERE id = ?').run(req.params.id);
        res.json({ success: true });
    } catch (error) {
        serverError(res, error);
    }
});

module.exports = router;
