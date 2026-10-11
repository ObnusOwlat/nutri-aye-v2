/**
 * Optional: typical Paraguayan dishes as recipes of a consultorio, built with
 * catalog foods (USDA + basic). Amounts are per portion and approximate: they
 * are a starting point for the nutritionist to adjust. Nothing runs by itself.
 *
 * Usage: node seed-recetas-paraguay.js [orgId]      (default: the first consultorio)
 * Re-running skips dishes whose name already exists in the consultorio.
 */

const { db } = require('./src/db/connection');
const { migrate } = require('./src/db/migrations');
const recipes = require('./src/repos/recipes');

// [name, category, [[candidate food names (first found wins)], grams]...]
const DISHES = [
    ['Chipa', 'snack', [
        [['Tapioca, perla, seca'], 50], [['Queso, fresco, queso fresco', 'Queso blanco'], 35],
        [['Huevos enteros'], 15], [['Leche, entera, 3,25 % de grasa láctea, con vitamina D agregada'], 15], [['Manteca, sin sal', 'Manteca'], 8]
    ]],
    ['Sopa paraguaya', 'lunch', [
        [['Harina de maíz, integral, amarilla', 'Harina de maíz, integral, blanca'], 45], [['Queso, fresco, queso fresco', 'Queso blanco'], 35],
        [['Cebollas, crudas', 'Cebollas'], 35], [['Leche, entera, 3,25 % de grasa láctea, con vitamina D agregada'], 50],
        [['Huevos enteros'], 25], [['Aceite, soja, para ensalada o cocina'], 8]
    ]],
    ["Mbeju", 'breakfast', [
        [['Tapioca, perla, seca'], 50], [['Queso, fresco, queso fresco', 'Queso blanco'], 25],
        [['Leche, entera, 3,25 % de grasa láctea, con vitamina D agregada'], 15], [['Manteca, sin sal', 'Manteca'], 8]
    ]],
    ['Vori vori de pollo', 'dinner', [
        [['Pollo, pechuga, sin hueso, sin piel, crudo'], 120], [['Harina de maíz, integral, amarilla', 'Harina de maíz, integral, blanca'], 30],
        [['Queso, fresco, queso fresco', 'Queso blanco'], 20], [['Cebollas, crudas', 'Cebollas'], 30],
        [['Pimientos rojos', 'Locotes'], 20], [['Zanahorias'], 20], [['Aceite, soja, para ensalada o cocina'], 5]
    ]],
    ['Bife koygua', 'lunch', [
        [['Carne vacuna, nalga, nalga de adentro, sin hueso, Choice, cruda', 'Carne molida 90% magra'], 150],
        [['Cebollas, crudas', 'Cebollas'], 60], [['Tomates, rojos, maduros, crudos, promedio del año', 'Tomates'], 60],
        [['Pimientos rojos', 'Locotes'], 30], [['Huevos enteros'], 50], [['Aceite, soja, para ensalada o cocina'], 10]
    ]],
    ['Guiso de fideo', 'lunch', [
        [['Pasta, seca, enriquecida', 'Pasta'], 70], [['Carne molida 90% magra', 'Carne vacuna, nalga, nalga de adentro, sin hueso, Choice, cruda'], 100],
        [['Cebollas, crudas', 'Cebollas'], 40], [['Tomates, rojos, maduros, crudos, promedio del año', 'Tomates'], 60],
        [['Pimientos rojos', 'Locotes'], 20], [['Zanahorias'], 20], [['Aceite, soja, para ensalada o cocina'], 8]
    ]],
    ['Mandioca hervida', 'lunch', [[['Mandioca, cruda'], 200]]]
];

migrate();
const orgId = process.argv[2] || db.prepare('SELECT id FROM organizations ORDER BY created_at LIMIT 1').get()?.id;
if (!orgId) {
    console.error('No hay consultorios: creá el primero desde la pantalla de inicio.');
    process.exit(1);
}
const ctx = { orgId, userId: null };
const findFood = db.prepare('SELECT id FROM ingredients WHERE name = ? AND org_id IS NULL AND deactivated_at IS NULL LIMIT 1');
const exists = db.prepare('SELECT 1 FROM recipes WHERE org_id = ? AND name = ? AND deactivated_at IS NULL');

for (const [name, category, lines] of DISHES) {
    if (exists.get(orgId, name)) { console.log(`= ${name}: ya existe`); continue; }
    const ingredients = [], missing = [];
    for (const [candidates, grams] of lines) {
        const food = candidates.map(c => findFood.get(c)).find(Boolean);
        if (food) ingredients.push({ ingredientId: food.id, grams }); else missing.push(candidates[0]);
    }
    if (missing.length) { console.log(`! ${name}: faltan en el catálogo: ${missing.join('; ')}`); continue; }
    recipes.create(ctx, { name, category, ingredients, notes: 'Plato típico paraguayo: cantidades aproximadas por porción, ajustalas a tu receta.' });
    console.log(`+ ${name}`);
}
