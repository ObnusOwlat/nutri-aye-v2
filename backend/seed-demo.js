/**
 * Demo data: fictional patients (metrics, conditions) and recipes built
 * from USDA foods, in the first consultorio. Every row id starts with "demo-".
 *
 * Usage:
 *   node seed-demo.js           # create the demo data (or reactivate it)
 *   node seed-demo.js --remove  # deactivate it (nothing is deleted)
 *
 * Needs the USDA import (node import-usda.js) for the recipe ingredients.
 */

const { migrate } = require('./src/db/migrations');
migrate();
const { db } = require('./src/db/connection');
const auth = require('./src/repos/auth');

const PATIENTS = [
    {
        id: 'demo-p1', first_name: 'María', last_name: 'González', gender: 'female', date_of_birth: '1988-04-12',
        email: 'maria.gonzalez@ejemplo.com', phone: '0981 000 101', city: 'Asunción',
        notes: 'Busca bajar de peso. Trabaja de oficina, almuerza afuera.',
        metrics: [
            { date: '2026-07-10', weight: 82.4, height: 162, body_fat: 36.1, waist: 98, hips: 110, activity_level: 'sedentary' },
            { date: '2026-08-14', weight: 80.1, height: 162, body_fat: 34.8, waist: 95, hips: 108, activity_level: 'light' },
            { date: '2026-09-18', weight: 78.6, height: 162, body_fat: 33.5, waist: 92, hips: 106, activity_level: 'light' }
        ],
        conditions: [
            { type: 'condition', name: 'Hipertensión arterial', severity: 'moderate', dietary_notes: 'Limitar sodio a menos de 2 g/día; priorizar potasio.', medications: 'Losartán 50 mg' }
        ]
    },
    {
        id: 'demo-p2', first_name: 'Carlos', last_name: 'Benítez', gender: 'male', date_of_birth: '1979-09-03',
        email: 'carlos.benitez@ejemplo.com', phone: '0982 000 202', city: 'San Lorenzo',
        notes: 'Control glucémico. Le cuesta dejar el pan y la gaseosa.',
        metrics: [
            { date: '2026-08-01', weight: 96.0, height: 175, body_fat: 31.0, waist: 108, activity_level: 'sedentary' },
            { date: '2026-09-05', weight: 94.2, height: 175, body_fat: 30.2, waist: 105, activity_level: 'light' }
        ],
        conditions: [
            { type: 'condition', name: 'Diabetes tipo 2', severity: 'moderate', dietary_notes: 'Carbohidratos complejos, porciones controladas, fibra.', medications: 'Metformina 850 mg' },
            { type: 'intolerance', name: 'Intolerancia a la lactosa', severity: 'mild', dietary_notes: 'Lácteos deslactosados o yogur.' }
        ]
    },
    {
        id: 'demo-p3', first_name: 'Lucía', last_name: 'Martínez', gender: 'female', date_of_birth: '1995-01-20',
        email: 'lucia.martinez@ejemplo.com', phone: '0983 000 303', city: 'Luque',
        notes: 'Cansancio frecuente. Vegetariana flexible.',
        metrics: [
            { date: '2026-09-02', weight: 54.3, height: 165, body_fat: 24.0, activity_level: 'moderate' }
        ],
        conditions: [
            { type: 'condition', name: 'Anemia ferropénica', severity: 'mild', dietary_notes: 'Hierro + vitamina C en la misma comida; evitar té/café con las comidas.', medications: 'Sulfato ferroso' },
            { type: 'allergy', name: 'Enfermedad celíaca', severity: 'severe', dietary_notes: 'Sin TACC estricto (trigo, avena, cebada, centeno).' }
        ]
    },
    {
        id: 'demo-p4', first_name: 'Diego', last_name: 'Ramírez', gender: 'male', date_of_birth: '2001-06-15',
        email: 'diego.ramirez@ejemplo.com', phone: '0984 000 404', city: 'Lambaré',
        notes: 'Futbolista amateur. Objetivo: ganar masa muscular.',
        metrics: [
            { date: '2026-08-20', weight: 70.5, height: 180, body_fat: 14.0, muscle_mass: 34.5, activity_level: 'very_active' },
            { date: '2026-09-25', weight: 72.0, height: 180, body_fat: 13.6, muscle_mass: 35.6, activity_level: 'very_active' }
        ],
        conditions: []
    }
];

// [recipe, meal type, [[USDA ingredient id, grams], ...]]
const RECIPES = [
    ['Avena con banana y leche', 'breakfast', [['usda-173904', 50], ['usda-1105314', 120], ['usda-746782', 200]], 'Cocinar la avena en la leche 5 minutos y agregar la banana en rodajas.'],
    ['Omelette de espinaca y queso', 'breakfast', [['usda-748967', 120], ['usda-1999633', 60], ['usda-170845', 30], ['usda-171413', 5]], 'Batir los huevos, saltear la espinaca y cocinar con el queso.'],
    ['Pollo con arroz y brócoli', 'lunch', [['usda-171477', 150], ['usda-168878', 150], ['usda-169967', 100], ['usda-171413', 10]], 'Pechuga a la plancha con arroz blanco y brócoli al vapor.'],
    ['Guiso de lentejas', 'lunch', [['usda-172421', 200], ['usda-170000', 50], ['usda-2258586', 60], ['usda-170457', 80], ['usda-171413', 10]], 'Rehogar cebolla, zanahoria y tomate; agregar las lentejas cocidas.'],
    ['Salmón con batata', 'dinner', [['usda-175168', 150], ['usda-168483', 200], ['usda-171413', 5]], 'Salmón al horno con batata asada.'],
    ['Ensalada de palta y huevo', 'dinner', [['usda-746769', 80], ['usda-171706', 70], ['usda-748967', 100], ['usda-170457', 100], ['usda-171413', 10]], 'Lechuga, tomate, palta y huevo duro con aceite de oliva.'],
    ['Yogur griego con frutillas y miel', 'afternoon_snack', [['usda-330137', 170], ['usda-2346409', 100], ['usda-169640', 10]], 'Mezclar todo en un bowl.'],
    ['Mandioca con carne molida', 'lunch', [['usda-169985', 200], ['usda-171793', 120], ['usda-170000', 40]], 'Mandioca hervida con carne molida salteada con cebolla.'],
    ['Tostadas integrales con queso', 'snack', [['usda-172688', 60], ['usda-170845', 40]], 'Tostar el pan y gratinar el queso.']
];

// Weekly plan per patient (recipe numbers from RECIPES, 1-based), respecting
// conditions: Lucía is celiac (no oats/bread), Carlos lactose intolerant (no oats with milk)
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const WEEKS = {
    'demo-p1': { breakfast: [1, 2], lunch: [3, 4, 8], afternoon_snack: [7], dinner: [6, 5] },
    'demo-p2': { breakfast: [2], lunch: [4, 3, 8], snack: [9], dinner: [5, 6] },
    'demo-p3': { breakfast: [2], lunch: [4, 3, 8], afternoon_snack: [7], dinner: [5, 6] },
    'demo-p4': { breakfast: [1, 2], morning_snack: [9], lunch: [3, 8, 4], afternoon_snack: [7], dinner: [5, 6] }
};

// Demo rows are deactivated, never deleted (same rule as the app)
const DEMO_TABLES = ['patients', 'recipes', 'week_planner'];
const remove = db.transaction(() => {
    const now = new Date().toISOString();
    for (const table of DEMO_TABLES) {
        db.prepare(`UPDATE ${table} SET deactivated_at = ? WHERE id LIKE 'demo-%' AND deactivated_at IS NULL`).run(now);
    }
});

function bmiCategory(bmi) {
    if (bmi < 18.5) return 'underweight';
    if (bmi < 25) return 'normal';
    if (bmi < 30) return 'overweight';
    return 'obese';
}

const seed = db.transaction((orgId) => {
    const now = new Date().toISOString();
    // Already loaded once: reactivate it and stop
    if (db.prepare("SELECT COUNT(*) AS n FROM patients WHERE id LIKE 'demo-%'").get().n) {
        for (const table of DEMO_TABLES) db.prepare(`UPDATE ${table} SET deactivated_at = NULL, deactivated_by = NULL WHERE id LIKE 'demo-%'`).run();
        db.prepare("UPDATE patients SET org_id = ? WHERE id LIKE 'demo-%'").run(orgId);
        db.prepare("UPDATE recipes SET org_id = ? WHERE id LIKE 'demo-%'").run(orgId);
        return;
    }

    const insPatient = db.prepare(`
        INSERT INTO patients (id, org_id, first_name, last_name, email, phone, date_of_birth, gender, city, notes, status, created_at, updated_at)
        VALUES (@id, @orgId, @first_name, @last_name, @email, @phone, @date_of_birth, @gender, @city, @notes, 'active', @now, @now)
    `);
    const insMetric = db.prepare(`
        INSERT INTO patient_metrics (id, patient_id, date, weight, height, bmi, bmi_category, body_fat, muscle_mass, waist, hips, activity_level, created_at)
        VALUES (@id, @patient_id, @date, @weight, @height, @bmi, @bmi_category, @body_fat, @muscle_mass, @waist, @hips, @activity_level, @now)
    `);
    const insCondition = db.prepare(`
        INSERT INTO patient_conditions (id, patient_id, type, name, severity, dietary_notes, medications, created_at)
        VALUES (@id, @patient_id, @type, @name, @severity, @dietary_notes, @medications, @now)
    `);

    for (const p of PATIENTS) {
        insPatient.run({ ...p, orgId, now });
        p.metrics.forEach((m, i) => {
            const bmi = Math.round((m.weight / (m.height / 100) ** 2) * 10) / 10;
            insMetric.run({
                id: `${p.id}-m${i + 1}`, patient_id: p.id, body_fat: null, muscle_mass: null, waist: null, hips: null,
                ...m, bmi, bmi_category: bmiCategory(bmi), now
            });
        });
        p.conditions.forEach((c, i) => {
            insCondition.run({ id: `${p.id}-c${i + 1}`, patient_id: p.id, medications: '', ...c, now });
        });
    }

    const exists = db.prepare('SELECT 1 FROM ingredients WHERE id = ?');
    const insRecipe = db.prepare(`
        INSERT INTO recipes (id, org_id, name, category_id, instructions, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const insRecipeIng = db.prepare('INSERT INTO recipe_ingredients (id, recipe_id, ingredient_id, grams) VALUES (?, ?, ?, ?)');

    RECIPES.forEach(([name, category, items, instructions], i) => {
        const missing = items.filter(([id]) => !exists.get(id)).map(([id]) => id);
        if (missing.length) throw new Error(`"${name}": faltan alimentos ${missing.join(', ')} (corré antes node import-usda.js)`);
        const id = `demo-r${i + 1}`;
        insRecipe.run(id, orgId, name, category, instructions, now, now);
        items.forEach(([ingId, grams], j) => insRecipeIng.run(`${id}-i${j + 1}`, id, ingId, grams));
    });

    const insPlanner = db.prepare('INSERT INTO week_planner (id, patient_id, created_at, updated_at) VALUES (?, ?, ?, ?)');
    const insMeal = db.prepare('INSERT INTO week_planner_meals (id, planner_id, day, meal_type, recipe_id, created_at) VALUES (?, ?, ?, ?, ?, ?)');
    for (const [patientId, week] of Object.entries(WEEKS)) {
        const plannerId = `demo-wp-${patientId}`;
        insPlanner.run(plannerId, patientId, now, now);
        DAYS.forEach((day, d) => {
            for (const [mealType, recipes] of Object.entries(week)) {
                insMeal.run(`${plannerId}-${day}-${mealType}`, plannerId, day, mealType, `demo-r${recipes[d % recipes.length]}`, now);
            }
        });
    }
});

if (process.argv.includes('--remove')) {
    remove();
    console.log('Datos de prueba desactivados (siguen en la base; se reactivan corriendo node seed-demo.js).');
} else {
    const org = auth.firstOrganization() || auth.createOrganization('Consultorio principal');
    seed(org.id);
    const count = (sql) => db.prepare(sql).get().c;
    const active = "id LIKE 'demo-%' AND deactivated_at IS NULL";
    console.log(`Datos de prueba en "${org.name}": ${count(`SELECT COUNT(*) c FROM patients WHERE ${active}`)} pacientes, `
        + `${count("SELECT COUNT(*) c FROM patient_metrics WHERE id LIKE 'demo-%'")} mediciones, `
        + `${count("SELECT COUNT(*) c FROM patient_conditions WHERE id LIKE 'demo-%'")} condiciones, `
        + `${count(`SELECT COUNT(*) c FROM recipes WHERE ${active}`)} recetas, `
        + `${count(`SELECT COUNT(*) c FROM week_planner WHERE ${active}`)} semanas del planificador.`);
}
db.close();
