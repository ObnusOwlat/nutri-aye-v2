/**
 * state/constants.js - Allowed values and labels shared by the whole app
 * (values are stored in English; labels are translated in Fase 5)
 */

const StateConstants = (function() {
    const VALID_CATEGORIES = ['breakfast', 'lunch', 'dinner', 'afternoon_snack', 'snack']; // recipes (meal type)
    const INGREDIENT_CATEGORIES = ['protein', 'carbs', 'fats', 'vegetables', 'fruits', 'dairy', 'mixed']; // ingredients (food group)
    const VALID_MEAL_TYPES = ['breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'snack', 'dinner'];
    const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const GENDERS = ['male', 'female', 'other'];
    const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
    const CONDITION_TYPES = ['condition', 'allergy', 'intolerance', 'medication'];
    const CONDITION_SEVERITIES = ['mild', 'moderate', 'severe'];
    const PLAN_STATUSES = ['active', 'completed', 'cancelled'];
    const DIET_GOALS = ['maintenance', 'deficit', 'bulking', 'performance'];

    // Currencies
    const CURRENCIES = {
        PYG: { symbol: '₲', name: 'Guaraní Paraguayo', code: 'PYG' },
        USD: { symbol: '$', name: 'Dólar Estadounidense', code: 'USD' },
        BRL: { symbol: 'R$', name: 'Real Brasileño', code: 'BRL' }
    };

    // Meal Labels (for UI display) - Sincronizado con VALID_MEAL_TYPES
    const MEAL_LABELS = {
        breakfast: 'Breakfast',
        morning_snack: 'Morning Snack',
        lunch: 'Lunch',
        afternoon_snack: 'Afternoon Snack',
        snack: 'Snack',
        dinner: 'Dinner'
    };

    // Day Labels (English - consistent language)
    const DAY_LABELS = {
        monday: 'Monday',
        tuesday: 'Tuesday',
        wednesday: 'Wednesday',
        thursday: 'Thursday',
        friday: 'Friday',
        saturday: 'Saturday',
        sunday: 'Sunday'
    };

    // Suggested Activities (Physical Exercises)
    const DEFAULT_SUGGESTED_ACTIVITIES = [
        { id: 'act_1', name: 'Caminar', category: 'cardio', intensity: 'baja', caloriesPerHour: 200, description: 'Actividad de bajo impacto, ideal para principiantes' },
        { id: 'act_2', name: 'Correr', category: 'cardio', intensity: 'alta', caloriesPerHour: 400, description: 'Ejercicio aeróbico intenso' },
        { id: 'act_3', name: 'Natación', category: 'cardio', intensity: 'media', caloriesPerHour: 300, description: 'Ejercicio completo de bajo impacto' },
        { id: 'act_4', name: 'Yoga', category: 'flexibilidad', intensity: 'baja', caloriesPerHour: 150, description: 'Mejora flexibilidad y reduce estrés' },
        { id: 'act_5', name: 'Pesas', category: 'fuerza', intensity: 'media', caloriesPerHour: 250, description: 'Entrenamiento de fuerza' },
        { id: 'act_6', name: 'Spinning', category: 'cardio', intensity: 'alta', caloriesPerHour: 450, description: 'Ejercicio cardiovascular intenso en bicicleta' },
        { id: 'act_7', name: 'Crossfit', category: 'fuerza', intensity: 'muy alta', caloriesPerHour: 500, description: 'Entrenamiento funcional de alta intensidad' },
        { id: 'act_8', name: 'HIIT', category: 'cardio', intensity: 'muy alta', caloriesPerHour: 400, description: 'Entrenamiento intervalado de alta intensidad' },
        { id: 'act_9', name: 'Bicicleta', category: 'cardio', intensity: 'media', caloriesPerHour: 350, description: 'Ejercicio cardiovascular' },
        { id: 'act_10', name: 'Baile', category: 'cardio', intensity: 'media', caloriesPerHour: 300, description: 'Ejercicio divertido y efectivo' },
        { id: 'act_11', name: 'Pilates', category: 'fuerza', intensity: 'media', caloriesPerHour: 200, description: 'Fortalece core y mejora postura' },
        { id: 'act_12', name: 'Tai Chi', category: 'flexibilidad', intensity: 'baja', caloriesPerHour: 120, description: 'Arte marcial suave' },
        { id: 'act_13', name: 'Boxeo', category: 'cardio', intensity: 'muy alta', caloriesPerHour: 500, description: 'Entrenamiento completo de combate' },
        { id: 'act_14', name: 'Saltar cuerda', category: 'cardio', intensity: 'alta', caloriesPerHour: 450, description: 'Ejercicio cardiovascular intenso' },
        { id: 'act_15', name: 'Stretching', category: 'flexibilidad', intensity: 'baja', caloriesPerHour: 80, description: 'Estiramientos para mejorar movilidad' }
    ];

    return {
        VALID_CATEGORIES, INGREDIENT_CATEGORIES, VALID_MEAL_TYPES, DAYS, GENDERS, ACTIVITY_LEVELS,
        CONDITION_TYPES, CONDITION_SEVERITIES, PLAN_STATUSES, DIET_GOALS, CURRENCIES, MEAL_LABELS, DAY_LABELS,
        DEFAULT_SUGGESTED_ACTIVITIES
    };
})();
