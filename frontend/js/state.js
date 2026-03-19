/**
 * state.js - Centralized State Management
 * 
 * Manages all application state with localStorage persistence
 * and an event emitter pattern for reactive updates.
 * 
 * Optimized with:
 * - Map-based lookups for O(1) access
 * - Debounced saves
 * - Helper functions to reduce duplication
 */

const State = (function() {
    // Storage keys
    const STORAGE_KEYS = {
        INGREDIENTS: 'mp_ingredients_v1',
        RECIPES: 'mp_dishes_v3',
        WEEK_PLANS: 'mp_week_plans_v1',
        DIET_PROFILE: 'mp_diet_v3',
        DIET_TEMPLATES: 'mp_diet_templates_v1',
        PATIENTS: 'mp_patients_v1',
        PATIENT_METRICS: 'mp_patient_metrics_v1',
        PATIENT_CONDITIONS: 'mp_patient_conditions_v1',
        PATIENT_PLANS: 'mp_patient_plans_v1',
        PATIENT_PROGRESS: 'mp_patient_progress_v1'
    };

    // Enums
    const VALID_CATEGORIES = ['protein', 'carbs', 'fats', 'vegetables', 'mixed'];
    const VALID_MEAL_TYPES = ['breakfast', 'lunch', 'snack', 'dinner'];
    const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    const GENDERS = ['male', 'female', 'other'];
    const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'];
    const CONDITION_TYPES = ['condition', 'allergy', 'intolerance', 'medication'];
    const CONDITION_SEVERITIES = ['mild', 'moderate', 'severe'];
    const PLAN_STATUSES = ['active', 'completed', 'cancelled'];
    const DIET_GOALS = ['maintenance', 'deficit', 'bulking', 'performance'];

    // State
    let state = {
        ingredients: [], recipes: [],
        weekPlans: {}, // { templateId: weekPlan }
        currentTemplateId: null,
        dietProfile: { goal: 'maintenance', dailyTarget: 2000 },
        dietTemplates: [],
        patients: [], patientMetrics: [], patientConditions: [],
        patientPlans: [], patientProgress: []
    };

    // Lookups
    let ingredientMap = new Map(), recipeMap = new Map(), patientMap = new Map();
    let metricMap = new Map(), conditionMap = new Map(), planMap = new Map(), progressMap = new Map();

    // Event & Storage
    const listeners = {};
    let saveTimer = null;
    const SAVE_DEBOUNCE_MS = 100;

    // ==========================================
    // UTILITIES
    // ==========================================

    const generateId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : r & 0x3 | 0x8).toString(16);
    });

    const getTimestamp = () => new Date().toISOString();

    const calculateAge = (dob) => {
        if (!dob) return null;
        const today = new Date(), birth = new Date(dob);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    };

    const calculateBMI = (w, h) => {
        if (!w || !h) return null;
        return w / Math.pow(h / 100, 2);
    };

    const getBMICategory = (bmi) => {
        if (bmi < 18.5) return 'underweight';
        if (bmi < 25) return 'normal';
        if (bmi < 30) return 'overweight';
        return 'obese';
    };

    const clamp = (val, min, max) => Math.max(min, Math.min(max, val));

    const pick = (obj, keys) => {
        const result = {};
        for (const key of keys) {
            if (obj[key] !== undefined) result[key] = obj[key];
        }
        return result;
    };

    // ==========================================
    // EVENTS
    // ==========================================

    const subscribe = (event, callback) => {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(callback);
        return () => { listeners[event] = listeners[event].filter(cb => cb !== callback); };
    };

    const emit = (event, data) => {
        if (listeners[event]) listeners[event].forEach(cb => cb(data));
        if (listeners['*']) listeners['*'].forEach(cb => cb({ event, data }));
    };

    // ==========================================
    // STORAGE
    // ==========================================

    const rebuildMaps = () => {
        ingredientMap.clear(); recipeMap.clear(); patientMap.clear();
        metricMap.clear(); conditionMap.clear(); planMap.clear(); progressMap.clear();
        
        state.ingredients.forEach(i => ingredientMap.set(i.id, i));
        state.recipes.forEach(r => recipeMap.set(r.id, r));
        state.patients.forEach(p => patientMap.set(p.id, p));
        
        state.patientMetrics.forEach(m => {
            if (!metricMap.has(m.patientId)) metricMap.set(m.patientId, []);
            metricMap.get(m.patientId).push(m);
        });
        
        state.patientConditions.forEach(c => {
            if (!conditionMap.has(c.patientId)) conditionMap.set(c.patientId, []);
            conditionMap.get(c.patientId).push(c);
        });
        
        state.patientPlans.forEach(p => {
            if (!planMap.has(p.patientId)) planMap.set(p.patientId, []);
            planMap.get(p.patientId).push(p);
        });
        
        state.patientProgress.forEach(p => {
            if (!progressMap.has(p.patientId)) progressMap.set(p.patientId, []);
            progressMap.get(p.patientId).push(p);
        });
    };

    const loadFromStorage = () => {
        try {
            const load = (key) => {
                const data = localStorage.getItem(STORAGE_KEYS[key]);
                return data ? JSON.parse(data) : null;
            };

            state.ingredients = load('INGREDIENTS') || [];
            state.recipes = load('RECIPES') || [];
            state.weekPlans = load('WEEK_PLANS') || {};
            state.dietProfile = load('DIET_PROFILE') || { goal: 'maintenance', dailyTarget: 2000 };
            state.dietTemplates = load('DIET_TEMPLATES') || getDefaultDietTemplates();
            state.patients = load('PATIENTS') || [];
            state.patientMetrics = load('PATIENT_METRICS') || [];
            state.patientConditions = load('PATIENT_CONDITIONS') || [];
            state.patientPlans = load('PATIENT_PLANS') || [];
            state.patientProgress = load('PATIENT_PROGRESS') || [];

            // Set current template to first default template
            if (state.dietTemplates.length > 0 && !state.currentTemplateId) {
                state.currentTemplateId = state.dietTemplates[0].id;
            }

            rebuildMaps();
        } catch (error) {
            console.error('[State] Load error:', error);
            state = getDefaultState();
            rebuildMaps();
        }
    };

    const getDefaultState = () => ({
        ingredients: [], recipes: [],
        weekPlans: {},
        currentTemplateId: null,
        dietProfile: { goal: 'maintenance', dailyTarget: 2000 },
        dietTemplates: getDefaultDietTemplates(),
        patients: [], patientMetrics: [], patientConditions: [],
        patientPlans: [], patientProgress: []
    });

    const saveToStorage = () => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            try {
                const save = (key, data) => localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(data));
                save('INGREDIENTS', state.ingredients);
                save('RECIPES', state.recipes);
                save('WEEK_PLANS', state.weekPlans);
                save('DIET_PROFILE', state.dietProfile);
                save('DIET_TEMPLATES', state.dietTemplates);
                save('PATIENTS', state.patients);
                save('PATIENT_METRICS', state.patientMetrics);
                save('PATIENT_CONDITIONS', state.patientConditions);
                save('PATIENT_PLANS', state.patientPlans);
                save('PATIENT_PROGRESS', state.patientProgress);
            } catch (error) {
                console.error('[State] Save error:', error);
                if (error.name === 'QuotaExceededError') {
                    emit('state:error', { type: 'quota_exceeded', message: 'Storage limit reached' });
                }
            }
        }, SAVE_DEBOUNCE_MS);
    };

    const saveImmediately = () => {
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
        saveToStorage();
    };

    // ==========================================
    // INGREDIENTS
    // ==========================================

    const getIngredients = () => [...state.ingredients];
    const getIngredient = (id) => ingredientMap.get(id) || null;

    const findIngredientByName = (name) => {
        const n = name.trim().toLowerCase();
        return state.ingredients.find(i => i.name.toLowerCase() === n);
    };

    const addIngredient = (data) => {
        const name = data.name.trim();
        if (!name) throw new Error('Ingredient name is required');
        if (findIngredientByName(name)) throw new Error(`"${name}" already exists`);

        const ingredient = {
            id: generateId(), name,
            // Basic macros (per 100g)
            kcalPer100g: clamp(parseFloat(data.kcalPer100g) || 0, 0, Infinity),
            proteinPer100g: clamp(parseFloat(data.proteinPer100g) || 0, 0, 100),
            carbsPer100g: clamp(parseFloat(data.carbsPer100g) || 0, 0, 100),
            fatPer100g: clamp(parseFloat(data.fatPer100g) || 0, 0, 100),
            saturatedFatPer100g: clamp(parseFloat(data.saturatedFatPer100g) || 0, 0, 100),
            polyunsaturatedFatPer100g: clamp(parseFloat(data.polyunsaturatedFatPer100g) || 0, 0, 100),
            monounsaturatedFatPer100g: clamp(parseFloat(data.monounsaturatedFatPer100g) || 0, 0, 100),
            sugarPer100g: clamp(parseFloat(data.sugarPer100g) || 0, 0, 100),
            fiberPer100g: clamp(parseFloat(data.fiberPer100g) || 0, 0, 100),
            cholesterolPer100g: clamp(parseFloat(data.cholesterolPer100g) || 0, 0, 1000),
            sodiumPer100g: clamp(parseFloat(data.sodiumPer100g) || 0, 0, 10000),
            // Vitamins (mg or mcg per 100g)
            vitaminAPer100g: clamp(parseFloat(data.vitaminAPer100g) || 0, 0, 10000),
            vitaminB1Per100g: clamp(parseFloat(data.vitaminB1Per100g) || 0, 0, 100),
            vitaminB2Per100g: clamp(parseFloat(data.vitaminB2Per100g) || 0, 0, 100),
            vitaminB3Per100g: clamp(parseFloat(data.vitaminB3Per100g) || 0, 0, 100),
            vitaminB5Per100g: clamp(parseFloat(data.vitaminB5Per100g) || 0, 0, 100),
            vitaminB6Per100g: clamp(parseFloat(data.vitaminB6Per100g) || 0, 0, 100),
            vitaminB9Per100g: clamp(parseFloat(data.vitaminB9Per100g) || 0, 0, 10000),
            vitaminB12Per100g: clamp(parseFloat(data.vitaminB12Per100g) || 0, 0, 1000),
            vitaminCPer100g: clamp(parseFloat(data.vitaminCPer100g) || 0, 0, 1000),
            vitaminDPer100g: clamp(parseFloat(data.vitaminDPer100g) || 0, 0, 1000),
            vitaminEPer100g: clamp(parseFloat(data.vitaminEPer100g) || 0, 0, 100),
            vitaminKPer100g: clamp(parseFloat(data.vitaminKPer100g) || 0, 0, 10000),
            // Minerals (mg per 100g)
            magnesiumPer100g: clamp(parseFloat(data.magnesiumPer100g) || 0, 0, 10000),
            calciumPer100g: clamp(parseFloat(data.calciumPer100g) || 0, 0, 100000),
            phosphorusPer100g: clamp(parseFloat(data.phosphorusPer100g) || 0, 0, 10000),
            potassiumPer100g: clamp(parseFloat(data.potassiumPer100g) || 0, 0, 10000),
            ironPer100g: clamp(parseFloat(data.ironPer100g) || 0, 0, 100),
            seleniumPer100g: clamp(parseFloat(data.seleniumPer100g) || 0, 0, 1000),
            zincPer100g: clamp(parseFloat(data.zincPer100g) || 0, 0, 100),
            manganesePer100g: clamp(parseFloat(data.manganesePer100g) || 0, 0, 100),
            copperPer100g: clamp(parseFloat(data.copperPer100g) || 0, 0, 100),
            category: VALID_CATEGORIES.includes(data.category) ? data.category : 'mixed',
            unit: data.unit === 'oz' ? 'oz' : 'g',
            createdAt: getTimestamp(), updatedAt: getTimestamp()
        };

        state.ingredients.push(ingredient);
        ingredientMap.set(ingredient.id, ingredient);
        saveToStorage();
        emit('ingredients:updated', state.ingredients);
        emit('ingredients:added', ingredient);
        return ingredient;
    };

    const updateIngredient = (id, data) => {
        const idx = state.ingredients.findIndex(i => i.id === id);
        if (idx === -1) return null;

        const orig = state.ingredients[idx];
        if (data.name?.trim()) {
            const existing = findIngredientByName(data.name.trim());
            if (existing && existing.id !== id) throw new Error(`"${data.name}" already exists`);
        }

        const updated = {
            ...orig,
            name: data.name?.trim() || orig.name,
            // Basic macros
            kcalPer100g: data.kcalPer100g !== undefined ? clamp(parseFloat(data.kcalPer100g), 0, Infinity) : orig.kcalPer100g,
            proteinPer100g: data.proteinPer100g !== undefined ? clamp(parseFloat(data.proteinPer100g), 0, 100) : orig.proteinPer100g,
            carbsPer100g: data.carbsPer100g !== undefined ? clamp(parseFloat(data.carbsPer100g), 0, 100) : orig.carbsPer100g,
            fatPer100g: data.fatPer100g !== undefined ? clamp(parseFloat(data.fatPer100g), 0, 100) : orig.fatPer100g,
            saturatedFatPer100g: data.saturatedFatPer100g !== undefined ? clamp(parseFloat(data.saturatedFatPer100g), 0, 100) : orig.saturatedFatPer100g,
            polyunsaturatedFatPer100g: data.polyunsaturatedFatPer100g !== undefined ? clamp(parseFloat(data.polyunsaturatedFatPer100g), 0, 100) : orig.polyunsaturatedFatPer100g,
            monounsaturatedFatPer100g: data.monounsaturatedFatPer100g !== undefined ? clamp(parseFloat(data.monounsaturatedFatPer100g), 0, 100) : orig.monounsaturatedFatPer100g,
            sugarPer100g: data.sugarPer100g !== undefined ? clamp(parseFloat(data.sugarPer100g), 0, 100) : orig.sugarPer100g,
            fiberPer100g: data.fiberPer100g !== undefined ? clamp(parseFloat(data.fiberPer100g), 0, 100) : orig.fiberPer100g,
            cholesterolPer100g: data.cholesterolPer100g !== undefined ? clamp(parseFloat(data.cholesterolPer100g), 0, 1000) : orig.cholesterolPer100g,
            sodiumPer100g: data.sodiumPer100g !== undefined ? clamp(parseFloat(data.sodiumPer100g), 0, 10000) : orig.sodiumPer100g,
            // Vitamins
            vitaminAPer100g: data.vitaminAPer100g !== undefined ? clamp(parseFloat(data.vitaminAPer100g), 0, 10000) : orig.vitaminAPer100g,
            vitaminB1Per100g: data.vitaminB1Per100g !== undefined ? clamp(parseFloat(data.vitaminB1Per100g), 0, 100) : orig.vitaminB1Per100g,
            vitaminB2Per100g: data.vitaminB2Per100g !== undefined ? clamp(parseFloat(data.vitaminB2Per100g), 0, 100) : orig.vitaminB2Per100g,
            vitaminB3Per100g: data.vitaminB3Per100g !== undefined ? clamp(parseFloat(data.vitaminB3Per100g), 0, 100) : orig.vitaminB3Per100g,
            vitaminB5Per100g: data.vitaminB5Per100g !== undefined ? clamp(parseFloat(data.vitaminB5Per100g), 0, 100) : orig.vitaminB5Per100g,
            vitaminB6Per100g: data.vitaminB6Per100g !== undefined ? clamp(parseFloat(data.vitaminB6Per100g), 0, 100) : orig.vitaminB6Per100g,
            vitaminB9Per100g: data.vitaminB9Per100g !== undefined ? clamp(parseFloat(data.vitaminB9Per100g), 0, 10000) : orig.vitaminB9Per100g,
            vitaminB12Per100g: data.vitaminB12Per100g !== undefined ? clamp(parseFloat(data.vitaminB12Per100g), 0, 1000) : orig.vitaminB12Per100g,
            vitaminDPer100g: data.vitaminDPer100g !== undefined ? clamp(parseFloat(data.vitaminDPer100g), 0, 1000) : orig.vitaminDPer100g,
            vitaminEPer100g: data.vitaminEPer100g !== undefined ? clamp(parseFloat(data.vitaminEPer100g), 0, 100) : orig.vitaminEPer100g,
            vitaminKPer100g: data.vitaminKPer100g !== undefined ? clamp(parseFloat(data.vitaminKPer100g), 0, 10000) : orig.vitaminKPer100g,
            // Minerals
            magnesiumPer100g: data.magnesiumPer100g !== undefined ? clamp(parseFloat(data.magnesiumPer100g), 0, 10000) : orig.magnesiumPer100g,
            calciumPer100g: data.calciumPer100g !== undefined ? clamp(parseFloat(data.calciumPer100g), 0, 100000) : orig.calciumPer100g,
            phosphorusPer100g: data.phosphorusPer100g !== undefined ? clamp(parseFloat(data.phosphorusPer100g), 0, 10000) : orig.phosphorusPer100g,
            potassiumPer100g: data.potassiumPer100g !== undefined ? clamp(parseFloat(data.potassiumPer100g), 0, 10000) : orig.potassiumPer100g,
            ironPer100g: data.ironPer100g !== undefined ? clamp(parseFloat(data.ironPer100g), 0, 100) : orig.ironPer100g,
            seleniumPer100g: data.seleniumPer100g !== undefined ? clamp(parseFloat(data.seleniumPer100g), 0, 1000) : orig.seleniumPer100g,
            zincPer100g: data.zincPer100g !== undefined ? clamp(parseFloat(data.zincPer100g), 0, 100) : orig.zincPer100g,
            manganesePer100g: data.manganesePer100g !== undefined ? clamp(parseFloat(data.manganesePer100g), 0, 100) : orig.manganesePer100g,
            copperPer100g: data.copperPer100g !== undefined ? clamp(parseFloat(data.copperPer100g), 0, 100) : orig.copperPer100g,
            category: VALID_CATEGORIES.includes(data.category) ? data.category : orig.category,
            unit: data.unit === 'oz' ? 'oz' : orig.unit,
            updatedAt: getTimestamp()
        };

        state.ingredients[idx] = updated;
        ingredientMap.set(id, updated);
        saveToStorage();
        emit('ingredients:updated', state.ingredients);
        return updated;
    };

    const deleteIngredient = (id) => {
        const idx = state.ingredients.findIndex(i => i.id === id);
        if (idx === -1) return false;

        state.ingredients.splice(idx, 1);
        ingredientMap.delete(id);
        state.recipes.forEach(r => {
            r.ingredients = r.ingredients.filter(ri => ri.ingredientId !== id);
        });

        saveToStorage();
        emit('ingredients:updated', state.ingredients);
        return true;
    };

    const deleteAllIngredients = () => {
        state.ingredients = [];
        ingredientMap.clear();
        state.recipes.forEach(r => {
            r.ingredients = [];
        });

        saveToStorage();
        emit('ingredients:updated', state.ingredients);
        emit('recipes:updated', state.recipes);
    };

    const importIngredients = (ingredients) => {
        const result = { imported: [], skipped: [], errors: [] };
        
        for (const ing of ingredients) {
            if (!ing.name || !ing.kcalPer100g) {
                result.errors.push({ name: ing.name || 'unknown', error: 'Missing required fields' });
                continue;
            }
            
            if (findIngredientByName(ing.name)) {
                result.skipped.push({ name: ing.name, error: 'Already exists' });
                continue;
            }
            
            try {
                const added = addIngredient(ing);
                result.imported.push(added);
            } catch (e) {
                result.errors.push({ name: ing.name, error: e.message });
            }
        }
        
        return result;
    };

    const importIngredientsFull = (ingredients) => {
        const result = { imported: [], skipped: [], errors: [] };
        
        for (const ing of ingredients) {
            if (!ing.name || ing.kcalPer100g === undefined) {
                result.errors.push({ name: ing.name || 'unknown', error: 'Missing required fields' });
                continue;
            }
            
            const ingredientId = ing.id || generateId();
            
            // Check if already exists by ID
            const existingById = ingredientMap.get(ingredientId);
            if (existingById) {
                // Update existing
                Object.assign(existingById, {
                    name: ing.name.trim(),
                    kcalPer100g: clamp(parseFloat(ing.kcalPer100g) || 0, 0, Infinity),
                    proteinPer100g: clamp(parseFloat(ing.proteinPer100g) || 0, 0, 100),
                    carbsPer100g: clamp(parseFloat(ing.carbsPer100g) || 0, 0, 100),
                    fatPer100g: clamp(parseFloat(ing.fatPer100g) || 0, 0, 100),
                    saturatedFatPer100g: clamp(parseFloat(ing.saturatedFatPer100g) || 0, 0, 100),
                    fiberPer100g: clamp(parseFloat(ing.fiberPer100g) || 0, 0, 100),
                    sugarPer100g: clamp(parseFloat(ing.sugarPer100g) || 0, 0, 100),
                    category: VALID_CATEGORIES.includes(ing.category) ? ing.category : 'mixed',
                    updatedAt: getTimestamp()
                });
                result.imported.push(existingById);
                continue;
            }
            
            try {
                const ingredient = {
                    id: ingredientId,
                    name: ing.name.trim(),
                    kcalPer100g: clamp(parseFloat(ing.kcalPer100g) || 0, 0, Infinity),
                    proteinPer100g: clamp(parseFloat(ing.proteinPer100g) || 0, 0, 100),
                    carbsPer100g: clamp(parseFloat(ing.carbsPer100g) || 0, 0, 100),
                    fatPer100g: clamp(parseFloat(ing.fatPer100g) || 0, 0, 100),
                    saturatedFatPer100g: clamp(parseFloat(ing.saturatedFatPer100g) || 0, 0, 100),
                    polyunsaturatedFatPer100g: clamp(parseFloat(ing.polyunsaturatedFatPer100g) || 0, 0, 100),
                    monounsaturatedFatPer100g: clamp(parseFloat(ing.monounsaturatedFatPer100g) || 0, 0, 100),
                    sugarPer100g: clamp(parseFloat(ing.sugarPer100g) || 0, 0, 100),
                    fiberPer100g: clamp(parseFloat(ing.fiberPer100g) || 0, 0, 100),
                    cholesterolPer100g: clamp(parseFloat(ing.cholesterolPer100g) || 0, 0, 1000),
                    sodiumPer100g: clamp(parseFloat(ing.sodiumPer100g) || 0, 0, 10000),
                    vitaminAPer100g: clamp(parseFloat(ing.vitaminAPer100g) || 0, 0, 10000),
                    vitaminB1Per100g: clamp(parseFloat(ing.vitaminB1Per100g) || 0, 0, 100),
                    vitaminB2Per100g: clamp(parseFloat(ing.vitaminB2Per100g) || 0, 0, 100),
                    vitaminB3Per100g: clamp(parseFloat(ing.vitaminB3Per100g) || 0, 0, 100),
                    vitaminB5Per100g: clamp(parseFloat(ing.vitaminB5Per100g) || 0, 0, 100),
                    vitaminB6Per100g: clamp(parseFloat(ing.vitaminB6Per100g) || 0, 0, 100),
                    vitaminB9Per100g: clamp(parseFloat(ing.vitaminB9Per100g) || 0, 0, 10000),
                    vitaminB12Per100g: clamp(parseFloat(ing.vitaminB12Per100g) || 0, 0, 1000),
                    vitaminCPer100g: clamp(parseFloat(ing.vitaminCPer100g) || 0, 0, 100),
                    vitaminDPer100g: clamp(parseFloat(ing.vitaminDPer100g) || 0, 0, 1000),
                    vitaminEPer100g: clamp(parseFloat(ing.vitaminEPer100g) || 0, 0, 100),
                    vitaminKPer100g: clamp(parseFloat(ing.vitaminKPer100g) || 0, 0, 10000),
                    magnesiumPer100g: clamp(parseFloat(ing.magnesiumPer100g) || 0, 0, 10000),
                    calciumPer100g: clamp(parseFloat(ing.calciumPer100g) || 0, 0, 100000),
                    phosphorusPer100g: clamp(parseFloat(ing.phosphorusPer100g) || 0, 0, 10000),
                    potassiumPer100g: clamp(parseFloat(ing.potassiumPer100g) || 0, 0, 10000),
                    ironPer100g: clamp(parseFloat(ing.ironPer100g) || 0, 0, 100),
                    seleniumPer100g: clamp(parseFloat(ing.seleniumPer100g) || 0, 0, 1000),
                    zincPer100g: clamp(parseFloat(ing.zincPer100g) || 0, 0, 100),
                    manganesePer100g: clamp(parseFloat(ing.manganesePer100g) || 0, 0, 100),
                    copperPer100g: clamp(parseFloat(ing.copperPer100g) || 0, 0, 100),
                    cholinePer100g: clamp(parseFloat(ing.cholinePer100g) || 0, 0, 10000),
                    category: VALID_CATEGORIES.includes(ing.category) ? ing.category : 'mixed',
                    unit: 'g',
                    createdAt: getTimestamp(), updatedAt: getTimestamp()
                };
                
                state.ingredients.push(ingredient);
                ingredientMap.set(ingredient.id, ingredient);
                result.imported.push(ingredient);
            } catch (e) {
                result.errors.push({ name: ing.name, error: e.message });
            }
        }
        
        if (result.imported.length > 0) {
            saveToStorage();
            emit('ingredients:updated', state.ingredients);
        }
        
        return result;
    };

    // ==========================================
    // RECIPES
    // ==========================================

    const getRecipes = () => [...state.recipes];
    const getRecipe = (id) => recipeMap.get(id) || null;
    const getRecipesByCategory = (cat) => cat === 'all' ? getRecipes() : state.recipes.filter(r => r.category === cat);

    // Calculate full nutrition for a recipe
    const calculateRecipeNutrition = (recipe) => {
        if (!recipe?.ingredients?.length) {
            return { calories: 0, protein: 0, carbs: 0, fat: 0, saturatedFat: 0, sugar: 0, fiber: 0 };
        }
        return recipe.ingredients.reduce((totals, ri) => {
            const ing = ingredientMap.get(ri.ingredientId);
            if (!ing) return totals;
            const factor = ri.grams / 100;
            return {
                calories: totals.calories + (ing.kcalPer100g * factor),
                protein: totals.protein + (ing.proteinPer100g * factor),
                carbs: totals.carbs + (ing.carbsPer100g * factor),
                fat: totals.fat + (ing.fatPer100g * factor),
                saturatedFat: totals.saturatedFat + (ing.saturatedFatPer100g * factor),
                sugar: totals.sugar + (ing.sugarPer100g * factor),
                fiber: totals.fiber + (ing.fiberPer100g * factor)
            };
        }, { calories: 0, protein: 0, carbs: 0, fat: 0, saturatedFat: 0, sugar: 0, fiber: 0 });
    };

    const addRecipe = (data) => {
        const name = data.name.trim();
        if (!name) throw new Error('Recipe name is required');
        if (!data.ingredients?.length) throw new Error('At least one ingredient is required');

        const recipe = {
            id: generateId(), name,
            category: VALID_CATEGORIES.includes(data.category) ? data.category : 'mixed',
            ingredients: data.ingredients.map(ri => ({
                ingredientId: ri.ingredientId,
                grams: clamp(parseInt(ri.grams) || 100, 1, 10000)
            })),
            instructions: data.instructions || '',
            nutrition: calculateRecipeNutrition({ ingredients: data.ingredients }),
            createdAt: getTimestamp(), updatedAt: getTimestamp()
        };

        state.recipes.push(recipe);
        recipeMap.set(recipe.id, recipe);
        saveToStorage();
        emit('recipes:updated', state.recipes);
        emit('recipes:added', recipe);
        return recipe;
    };

    const updateRecipe = (id, data) => {
        const idx = state.recipes.findIndex(r => r.id === id);
        if (idx === -1) return null;

        const orig = state.recipes[idx];
        const updated = {
            ...orig,
            name: data.name?.trim() || orig.name,
            category: VALID_CATEGORIES.includes(data.category) ? data.category : orig.category,
            instructions: data.instructions !== undefined ? data.instructions : orig.instructions,
            updatedAt: getTimestamp()
        };

        if (data.ingredients) {
            updated.ingredients = data.ingredients.map(ri => ({
                ingredientId: ri.ingredientId,
                grams: clamp(parseInt(ri.grams) || 100, 1, 10000)
            }));
        }

        updated.nutrition = calculateRecipeNutrition(updated);
        state.recipes[idx] = updated;
        recipeMap.set(id, updated);
        saveToStorage();
        emit('recipes:updated', state.recipes);
        return updated;
    };

    const deleteRecipe = (id) => {
        const idx = state.recipes.findIndex(r => r.id === id);
        if (idx === -1) return false;

        state.recipes.splice(idx, 1);
        recipeMap.delete(id);
        
        // Remove from all week plans
        Object.values(state.weekPlans).forEach(plan => {
            Object.values(plan).forEach(day => {
                if (day) {
                    Object.keys(day).forEach(mealType => {
                        if (day[mealType] === id) day[mealType] = null;
                    });
                }
            });
        });

        saveToStorage();
        emit('recipes:updated', state.recipes);
        return true;
    };

    // ==========================================
    // WEEK PLAN (Per Template)
    // ==========================================

    const initializeEmptyWeekPlan = () => {
        const plan = {};
        for (const day of DAYS) {
            plan[day] = { breakfast: null, lunch: null, snack: null, dinner: null };
        }
        return plan;
    };

    // Get week plan for current or specific template
    const getWeekPlan = (templateId = null) => {
        const id = templateId || state.currentTemplateId;
        if (!id) return initializeEmptyWeekPlan();
        return { ...(state.weekPlans[id] || initializeEmptyWeekPlan()) };
    };

    // Get day meals for current or specific template
    const getDayMeals = (day, templateId = null) => {
        const id = templateId || state.currentTemplateId;
        if (!id) return { breakfast: null, lunch: null, snack: null, dinner: null };
        return { ...(state.weekPlans[id]?.[day] || { breakfast: null, lunch: null, snack: null, dinner: null }) };
    };

    // Assign meal to current template's week plan
    const assignMeal = (day, mealType, recipeId) => {
        const id = state.currentTemplateId;
        if (!id || !VALID_MEAL_TYPES.includes(mealType)) return false;
        
        if (!state.weekPlans[id]) {
            state.weekPlans[id] = initializeEmptyWeekPlan();
        }
        if (!state.weekPlans[id][day]) {
            state.weekPlans[id][day] = { breakfast: null, lunch: null, snack: null, dinner: null };
        }
        
        state.weekPlans[id][day][mealType] = recipeId;
        saveToStorage();
        emit('weekPlan:updated', { templateId: id, weekPlan: state.weekPlans[id] });
        return true;
    };

    const removeMeal = (day, mealType) => assignMeal(day, mealType, null);

    const clearWeekPlan = (templateId = null) => {
        const id = templateId || state.currentTemplateId;
        if (!id) return;
        state.weekPlans[id] = initializeEmptyWeekPlan();
        saveToStorage();
        emit('weekPlan:updated', { templateId: id, weekPlan: state.weekPlans[id] });
    };

    // Get daily calories for current template
    const getDailyCalories = (day) => {
        const id = state.currentTemplateId;
        const meals = id ? state.weekPlans[id]?.[day] : null;
        if (!meals) return 0;
        let total = 0;
        for (const recipeId of Object.values(meals)) {
            if (recipeId) { const r = recipeMap.get(recipeId); if (r) total += r.totalKcal; }
        }
        return Math.round(total);
    };

    const getWeeklyAverage = () => {
        let total = 0, count = 0;
        for (const day of DAYS) {
            const cal = getDailyCalories(day);
            if (cal > 0) { total += cal; count++; }
        }
        return count > 0 ? Math.round(total / count) : 0;
    };

    const getWeeklyTotal = () => DAYS.reduce((sum, d) => sum + getDailyCalories(d), 0);

    // Set current active template
    const setCurrentTemplate = (templateId) => {
        state.currentTemplateId = templateId;
        const template = getDietTemplate(templateId);
        if (template) {
            updateDietProfile({ goal: template.goal, dailyTarget: template.dailyTarget });
        }
        saveToStorage();
        emit('template:changed', templateId);
        emit('weekPlan:updated', { templateId, weekPlan: getWeekPlan() });
    };

    const getCurrentTemplateId = () => state.currentTemplateId;

    const getDietProfile = () => ({ ...state.dietProfile });
    const updateDietProfile = (data) => {
        state.dietProfile = { ...state.dietProfile, ...data };
        saveToStorage();
        emit('dietProfile:updated', state.dietProfile);
        return state.dietProfile;
    };

    // ==========================================
    // DIET TEMPLATES
    // ==========================================

    const getDefaultDietTemplates = () => [
        {
            id: 'tpl_maintenance',
            name: 'Maintenance',
            description: 'Calorias de mantenimiento',
            goal: 'maintenance',
            dailyTarget: 2000,
            mealDistribution: { breakfast: 25, lunch: 35, snack: 10, dinner: 30 },
            isDefault: true
        },
        {
            id: 'tpl_deficit',
            name: 'Deficit 500',
            description: 'Deficit de 500 kcal para perdida de peso',
            goal: 'deficit',
            dailyTarget: 1500,
            mealDistribution: { breakfast: 25, lunch: 35, snack: 10, dinner: 30 },
            isDefault: true
        },
        {
            id: 'tpl_deficit_800',
            name: 'Deficit 800',
            description: 'Deficit agresivo de 800 kcal',
            goal: 'deficit',
            dailyTarget: 1200,
            mealDistribution: { breakfast: 25, lunch: 35, snack: 10, dinner: 30 },
            isDefault: true
        },
        {
            id: 'tpl_bulking',
            name: 'Bulking',
            description: 'Superavit calorico para ganar masa muscular',
            goal: 'bulking',
            dailyTarget: 3000,
            mealDistribution: { breakfast: 25, lunch: 35, snack: 15, dinner: 25 },
            isDefault: true
        },
        {
            id: 'tpl_performance',
            name: 'Performance',
            description: 'Optimizado para rendimiento deportivo',
            goal: 'performance',
            dailyTarget: 2800,
            mealDistribution: { breakfast: 30, lunch: 30, snack: 15, dinner: 25 },
            isDefault: true
        }
    ];

    const getDietTemplates = () => [...state.dietTemplates];
    const getDietTemplate = (id) => state.dietTemplates.find(t => t.id === id) || null;

    const addDietTemplate = (data) => {
        const template = {
            id: generateId(),
            name: data.name.trim(),
            description: data.description || '',
            goal: DIET_GOALS.includes(data.goal) ? data.goal : 'maintenance',
            dailyTarget: clamp(parseInt(data.dailyTarget) || 2000, 800, 10000),
            mealDistribution: data.mealDistribution || { breakfast: 25, lunch: 35, snack: 10, dinner: 30 },
            isDefault: false,
            createdAt: getTimestamp()
        };
        state.dietTemplates.push(template);
        saveToStorage();
        emit('dietTemplates:updated', state.dietTemplates);
        return template;
    };

    const updateDietTemplate = (id, data) => {
        const idx = state.dietTemplates.findIndex(t => t.id === id);
        if (idx === -1) return null;
        
        state.dietTemplates[idx] = {
            ...state.dietTemplates[idx],
            name: data.name?.trim() || state.dietTemplates[idx].name,
            description: data.description !== undefined ? data.description : state.dietTemplates[idx].description,
            goal: DIET_GOALS.includes(data.goal) ? data.goal : state.dietTemplates[idx].goal,
            dailyTarget: data.dailyTarget ? clamp(parseInt(data.dailyTarget), 800, 10000) : state.dietTemplates[idx].dailyTarget,
            mealDistribution: data.mealDistribution || state.dietTemplates[idx].mealDistribution
        };
        saveToStorage();
        emit('dietTemplates:updated', state.dietTemplates);
        return state.dietTemplates[idx];
    };

    const deleteDietTemplate = (id) => {
        const idx = state.dietTemplates.findIndex(t => t.id === id);
        if (idx === -1 || state.dietTemplates[idx].isDefault) return false;
        state.dietTemplates.splice(idx, 1);
        saveToStorage();
        emit('dietTemplates:updated', state.dietTemplates);
        return true;
    };

    const applyDietTemplate = (templateId) => {
        const template = getDietTemplate(templateId);
        if (!template) return false;
        updateDietProfile({
            goal: template.goal,
            dailyTarget: template.dailyTarget
        });
        return true;
    };

    const generateShoppingList = () => {
        const map = new Map();
        for (const dayMeals of Object.values(state.weekPlan)) {
            for (const id of Object.values(dayMeals)) {
                if (!id) continue;
                const recipe = recipeMap.get(id);
                if (!recipe) continue;
                for (const ri of recipe.ingredients) {
                    const ing = ingredientMap.get(ri.ingredientId);
                    if (!ing) continue;
                    if (map.has(ri.ingredientId)) {
                        map.get(ri.ingredientId).grams += ri.grams;
                    } else {
                        map.set(ri.ingredientId, {
                            ingredientId: ri.ingredientId, name: ing.name,
                            category: ing.category, grams: ri.grams, kcalPer100g: ing.kcalPer100g
                        });
                    }
                }
            }
        }
        return Array.from(map.values()).sort((a, b) => 
            a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
        );
    };

    // ==========================================
    // PATIENTS
    // ==========================================

    const getPatients = () => [...state.patients];
    const getPatient = (id) => patientMap.get(id) || null;

    const findPatientByEmail = (email) => {
        if (!email) return null;
        return state.patients.find(p => p.email?.toLowerCase() === email.trim().toLowerCase());
    };

    const searchPatients = (query) => {
        if (!query || typeof query !== 'string' || !query.trim()) return getPatients();
        const q = query.toLowerCase();
        return state.patients.filter(p => 
            p.firstName?.toLowerCase().includes(q) || p.lastName?.toLowerCase().includes(q) ||
            p.email?.toLowerCase().includes(q) || p.phone?.includes(q)
        );
    };

    const addPatient = (data) => {
        if (!data.firstName?.trim()) throw new Error('First name is required');
        if (!data.lastName?.trim()) throw new Error('Last name is required');
        if (data.email && findPatientByEmail(data.email)) {
            throw new Error('A patient with this email already exists');
        }

        const patient = {
            id: generateId(),
            firstName: data.firstName.trim(), lastName: data.lastName.trim(),
            email: data.email?.trim() || null, phone: data.phone?.trim() || null,
            dateOfBirth: data.dateOfBirth || null,
            gender: GENDERS.includes(data.gender) ? data.gender : null,
            address: { street: '', city: '', zipCode: '', ...pick(data.address || {}, ['street', 'city', 'zipCode']) },
            emergencyContact: { name: '', phone: '', relation: '', ...pick(data.emergencyContact || {}, ['name', 'phone', 'relation']) },
            notes: data.notes?.trim() || '', photo: null,
            status: 'active', createdAt: getTimestamp(), updatedAt: getTimestamp()
        };

        state.patients.push(patient);
        patientMap.set(patient.id, patient);
        saveToStorage();
        emit('patients:updated', state.patients);
        emit('patients:added', patient);
        return patient;
    };

    const updatePatient = (id, data) => {
        const idx = state.patients.findIndex(p => p.id === id);
        if (idx === -1) return null;

        if (data.email) {
            const existing = findPatientByEmail(data.email);
            if (existing && existing.id !== id) throw new Error('A patient with this email already exists');
        }

        const orig = state.patients[idx];
        const updated = {
            ...orig,
            firstName: data.firstName?.trim() || orig.firstName,
            lastName: data.lastName?.trim() || orig.lastName,
            email: data.email !== undefined ? data.email?.trim() || null : orig.email,
            phone: data.phone !== undefined ? data.phone?.trim() || null : orig.phone,
            dateOfBirth: data.dateOfBirth !== undefined ? data.dateOfBirth : orig.dateOfBirth,
            gender: GENDERS.includes(data.gender) ? data.gender : orig.gender,
            address: { ...orig.address, ...pick(data.address || {}, ['street', 'city', 'zipCode']) },
            emergencyContact: { ...orig.emergencyContact, ...pick(data.emergencyContact || {}, ['name', 'phone', 'relation']) },
            notes: data.notes !== undefined ? data.notes?.trim() || '' : orig.notes,
            status: data.status || orig.status,
            updatedAt: getTimestamp()
        };

        state.patients[idx] = updated;
        patientMap.set(id, updated);
        saveToStorage();
        emit('patients:updated', state.patients);
        emit('patients:changed', updated);
        return updated;
    };

    const deletePatient = (id) => {
        const idx = state.patients.findIndex(p => p.id === id);
        if (idx === -1) return false;

        state.patients.splice(idx, 1);
        patientMap.delete(id);
        state.patientMetrics = state.patientMetrics.filter(m => m.patientId !== id);
        state.patientConditions = state.patientConditions.filter(c => c.patientId !== id);
        state.patientPlans = state.patientPlans.filter(p => p.patientId !== id);
        state.patientProgress = state.patientProgress.filter(p => p.patientId !== id);

        saveToStorage();
        emit('patients:updated', state.patients);
        emit('patients:deleted', { id });
        return true;
    };

    // ==========================================
    // PATIENT METRICS
    // ==========================================

    const getPatientMetrics = (patientId) => {
        const metrics = metricMap.get(patientId) || [];
        return [...metrics].sort((a, b) => new Date(b.date) - new Date(a.date));
    };

    const getLatestMetrics = (patientId) => getPatientMetrics(patientId)[0] || null;

    const addPatientMetric = (patientId, data) => {
        if (!patientMap.has(patientId)) throw new Error('Patient not found');

        const weight = parseFloat(data.weight);
        const height = parseFloat(data.height);
        const bmi = calculateBMI(weight, height);

        const metric = {
            id: generateId(), patientId,
            date: data.date || new Date().toISOString().split('T')[0],
            weight: weight || null, height: height || null,
            bmi, bmiCategory: bmi ? getBMICategory(bmi) : null,
            bodyFat: data.bodyFat !== undefined ? parseFloat(data.bodyFat) : null,
            muscleMass: data.muscleMass !== undefined ? parseFloat(data.muscleMass) : null,
            waist: data.waist !== undefined ? parseFloat(data.waist) : null,
            chest: data.chest !== undefined ? parseFloat(data.chest) : null,
            hips: data.hips !== undefined ? parseFloat(data.hips) : null,
            activityLevel: ACTIVITY_LEVELS.includes(data.activityLevel) ? data.activityLevel : 'moderate',
            notes: data.notes?.trim() || '', createdAt: getTimestamp()
        };

        state.patientMetrics.push(metric);
        if (!metricMap.has(patientId)) metricMap.set(patientId, []);
        metricMap.get(patientId).push(metric);
        saveToStorage();
        emit('patientMetrics:updated', { patientId, metrics: getPatientMetrics(patientId) });
        return metric;
    };

    const deletePatientMetric = (id) => {
        const idx = state.patientMetrics.findIndex(m => m.id === id);
        if (idx === -1) return false;

        const metric = state.patientMetrics.splice(idx, 1)[0];
        const list = metricMap.get(metric.patientId);
        if (list) { const i = list.findIndex(m => m.id === id); if (i !== -1) list.splice(i, 1); }

        saveToStorage();
        emit('patientMetrics:updated', { patientId: metric.patientId, metrics: getPatientMetrics(metric.patientId) });
        return true;
    };

    // ==========================================
    // PATIENT CONDITIONS
    // ==========================================

    const getPatientConditions = (patientId) => {
        const list = conditionMap.get(patientId) || [];
        return [...list].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
    };

    const addPatientCondition = (patientId, data) => {
        if (!patientMap.has(patientId)) throw new Error('Patient not found');
        if (!data.name?.trim()) throw new Error('Condition name is required');

        const condition = {
            id: generateId(), patientId,
            type: CONDITION_TYPES.includes(data.type) ? data.type : 'condition',
            name: data.name.trim(),
            severity: CONDITION_SEVERITIES.includes(data.severity) ? data.severity : 'moderate',
            description: data.description?.trim() || '',
            dietaryNotes: data.dietaryNotes?.trim() || '',
            medications: data.medications?.trim() || '',
            createdAt: getTimestamp()
        };

        state.patientConditions.push(condition);
        if (!conditionMap.has(patientId)) conditionMap.set(patientId, []);
        conditionMap.get(patientId).push(condition);
        saveToStorage();
        emit('patientConditions:updated', { patientId, conditions: getPatientConditions(patientId) });
        return condition;
    };

    const updatePatientCondition = (id, data) => {
        const idx = state.patientConditions.findIndex(c => c.id === id);
        if (idx === -1) return null;

        const orig = state.patientConditions[idx];
        const updated = {
            ...orig,
            type: CONDITION_TYPES.includes(data.type) ? data.type : orig.type,
            name: data.name?.trim() || orig.name,
            severity: CONDITION_SEVERITIES.includes(data.severity) ? data.severity : orig.severity,
            description: data.description !== undefined ? data.description?.trim() || '' : orig.description,
            dietaryNotes: data.dietaryNotes !== undefined ? data.dietaryNotes?.trim() || '' : orig.dietaryNotes,
            medications: data.medications !== undefined ? data.medications?.trim() || '' : orig.medications
        };

        state.patientConditions[idx] = updated;
        const list = conditionMap.get(updated.patientId);
        if (list) { const i = list.findIndex(c => c.id === id); if (i !== -1) list[i] = updated; }

        saveToStorage();
        emit('patientConditions:updated', { patientId: updated.patientId, conditions: getPatientConditions(updated.patientId) });
        return updated;
    };

    const deletePatientCondition = (id) => {
        const idx = state.patientConditions.findIndex(c => c.id === id);
        if (idx === -1) return false;

        const cond = state.patientConditions.splice(idx, 1)[0];
        const list = conditionMap.get(cond.patientId);
        if (list) { const i = list.findIndex(c => c.id === id); if (i !== -1) list.splice(i, 1); }

        saveToStorage();
        emit('patientConditions:updated', { patientId: cond.patientId, conditions: getPatientConditions(cond.patientId) });
        return true;
    };

    const getAllergies = (patientId) => getPatientConditions(patientId).filter(c => c.type === 'allergy' || c.type === 'intolerance');

    // ==========================================
    // PATIENT MEAL PLANS
    // ==========================================

    const getPatientPlans = (patientId) => {
        const list = planMap.get(patientId) || [];
        return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    };

    const getActivePlan = (patientId) => getPatientPlans(patientId).find(p => p.status === 'active') || null;

    const addPatientPlan = (patientId, data) => {
        if (!patientMap.has(patientId)) throw new Error('Patient not found');
        if (!data.name?.trim()) throw new Error('Plan name is required');

        // Complete existing active plan
        const active = getActivePlan(patientId);
        if (active && data.status !== 'completed') {
            updatePatientPlan(active.id, { status: 'completed' });
        }

        const plan = {
            id: generateId(), patientId,
            name: data.name.trim(),
            dietGoal: DIET_GOALS.includes(data.dietGoal) ? data.dietGoal : 'maintenance',
            dailyTarget: clamp(parseInt(data.dailyTarget) || 2000, 500, 10000),
            startDate: data.startDate || new Date().toISOString().split('T')[0],
            endDate: data.endDate || null,
            weekPlan: data.weekPlan || initializeEmptyWeekPlan(),
            notes: data.notes?.trim() || '',
            status: PLAN_STATUSES.includes(data.status) ? data.status : 'active',
            createdAt: getTimestamp(), updatedAt: getTimestamp()
        };

        state.patientPlans.push(plan);
        if (!planMap.has(patientId)) planMap.set(patientId, []);
        planMap.get(patientId).push(plan);
        saveToStorage();
        emit('patientPlans:updated', { patientId, plans: getPatientPlans(patientId) });
        return plan;
    };

    const updatePatientPlan = (id, data) => {
        const idx = state.patientPlans.findIndex(p => p.id === id);
        if (idx === -1) return null;

        const orig = state.patientPlans[idx];
        const updated = {
            ...orig,
            name: data.name?.trim() || orig.name,
            dietGoal: DIET_GOALS.includes(data.dietGoal) ? data.dietGoal : orig.dietGoal,
            dailyTarget: data.dailyTarget !== undefined ? clamp(parseInt(data.dailyTarget) || 2000, 500, 10000) : orig.dailyTarget,
            startDate: data.startDate !== undefined ? data.startDate : orig.startDate,
            endDate: data.endDate !== undefined ? data.endDate : orig.endDate,
            weekPlan: data.weekPlan || orig.weekPlan,
            notes: data.notes !== undefined ? data.notes?.trim() || '' : orig.notes,
            status: PLAN_STATUSES.includes(data.status) ? data.status : orig.status,
            updatedAt: getTimestamp()
        };

        state.patientPlans[idx] = updated;
        const list = planMap.get(updated.patientId);
        if (list) { const i = list.findIndex(p => p.id === id); if (i !== -1) list[i] = updated; }

        saveToStorage();
        emit('patientPlans:updated', { patientId: updated.patientId, plans: getPatientPlans(updated.patientId) });
        return updated;
    };

    const deletePatientPlan = (id) => {
        const idx = state.patientPlans.findIndex(p => p.id === id);
        if (idx === -1) return false;

        const plan = state.patientPlans.splice(idx, 1)[0];
        const list = planMap.get(plan.patientId);
        if (list) { const i = list.findIndex(p => p.id === id); if (i !== -1) list.splice(i, 1); }

        saveToStorage();
        emit('patientPlans:updated', { patientId: plan.patientId, plans: getPatientPlans(plan.patientId) });
        return true;
    };

    const getPatientDailyCalories = (patientId, day) => {
        const plan = getActivePlan(patientId);
        if (!plan?.weekPlan?.[day]) return 0;
        let total = 0;
        for (const id of Object.values(plan.weekPlan[day])) {
            if (id) { const r = recipeMap.get(id); if (r) total += r.totalKcal; }
        }
        return Math.round(total);
    };

    // ==========================================
    // PATIENT PROGRESS
    // ==========================================

    const getPatientProgress = (patientId) => {
        const list = progressMap.get(patientId) || [];
        return [...list].sort((a, b) => new Date(b.date) - new Date(a.date));
    };

    const addPatientProgress = (patientId, data) => {
        if (!patientMap.has(patientId)) throw new Error('Patient not found');

        const progress = {
            id: generateId(), patientId,
            date: data.date || new Date().toISOString().split('T')[0],
            weight: data.weight !== undefined ? parseFloat(data.weight) : null,
            adherence: clamp(parseInt(data.adherence) || 0, 0, 100),
            energyLevel: clamp(parseInt(data.energyLevel) || 5, 1, 10),
            sleepQuality: clamp(parseInt(data.sleepQuality) || 5, 1, 10),
            mood: clamp(parseInt(data.mood) || 5, 1, 10),
            symptoms: Array.isArray(data.symptoms) ? data.symptoms : [],
            notes: data.notes?.trim() || '',
            createdAt: getTimestamp()
        };

        state.patientProgress.push(progress);
        if (!progressMap.has(patientId)) progressMap.set(patientId, []);
        progressMap.get(patientId).push(progress);
        saveToStorage();
        emit('patientProgress:updated', { patientId, progress: getPatientProgress(patientId) });
        return progress;
    };

    const updatePatientProgress = (id, data) => {
        const idx = state.patientProgress.findIndex(p => p.id === id);
        if (idx === -1) return null;

        const orig = state.patientProgress[idx];
        const updated = {
            ...orig,
            date: data.date !== undefined ? data.date : orig.date,
            weight: data.weight !== undefined ? parseFloat(data.weight) || null : orig.weight,
            adherence: data.adherence !== undefined ? clamp(parseInt(data.adherence) || 0, 0, 100) : orig.adherence,
            energyLevel: data.energyLevel !== undefined ? clamp(parseInt(data.energyLevel) || 5, 1, 10) : orig.energyLevel,
            sleepQuality: data.sleepQuality !== undefined ? clamp(parseInt(data.sleepQuality) || 5, 1, 10) : orig.sleepQuality,
            mood: data.mood !== undefined ? clamp(parseInt(data.mood) || 5, 1, 10) : orig.mood,
            symptoms: Array.isArray(data.symptoms) ? data.symptoms : orig.symptoms,
            notes: data.notes !== undefined ? data.notes?.trim() || '' : orig.notes
        };

        state.patientProgress[idx] = updated;
        const list = progressMap.get(updated.patientId);
        if (list) { const i = list.findIndex(p => p.id === id); if (i !== -1) list[i] = updated; }

        saveToStorage();
        emit('patientProgress:updated', { patientId: updated.patientId, progress: getPatientProgress(updated.patientId) });
        return updated;
    };

    const deletePatientProgress = (id) => {
        const idx = state.patientProgress.findIndex(p => p.id === id);
        if (idx === -1) return false;

        const prog = state.patientProgress.splice(idx, 1)[0];
        const list = progressMap.get(prog.patientId);
        if (list) { const i = list.findIndex(p => p.id === id); if (i !== -1) list.splice(i, 1); }

        saveToStorage();
        emit('patientProgress:updated', { patientId: prog.patientId, progress: getPatientProgress(prog.patientId) });
        return true;
    };

    // ==========================================
    // PLANNER HELPERS (Patient Context)
    // ==========================================

    /**
     * Get patient context for planner
     */
    const getPatientContext = (patientId) => {
        if (!patientId) return null;
        
        const patient = getPatient(patientId);
        if (!patient) return null;

        const activePlan = getActivePlan(patientId);
        const conditions = getPatientConditions(patientId);
        const latestMetrics = getLatestMetrics(patientId);
        
        // Get allergies and intolerances
        const allergies = conditions
            .filter(c => c.type === 'allergy' || c.type === 'intolerance')
            .map(c => c.name.toLowerCase());
        
        // Get dietary notes from conditions
        const dietaryNotes = conditions
            .filter(c => c.dietaryNotes)
            .map(c => c.dietaryNotes);

        return {
            patient,
            activePlan,
            conditions,
            allergies,
            dietaryNotes,
            latestMetrics,
            targetCalories: activePlan?.dailyTarget || 2000,
            goal: activePlan?.dietGoal || 'maintenance'
        };
    };

    /**
     * Check if recipe contains allergens
     */
    const checkRecipeAllergens = (recipeId, patientId) => {
        if (!patientId) return { hasAllergens: false, allergens: [] };
        
        const recipe = getRecipe(recipeId);
        if (!recipe) return { hasAllergens: false, allergens: [] };

        const context = getPatientContext(patientId);
        if (!context || context.allergies.length === 0) {
            return { hasAllergens: false, allergens: [] };
        }

        // Check recipe ingredients and name for allergens
        const recipeText = `${recipe.name} ${recipe.notes || ''}`.toLowerCase();
        const matchedAllergens = context.allergies.filter(allergy => 
            recipeText.includes(allergy) ||
            recipe.ingredients?.some(ing => {
                const ingredient = getIngredient(ing.ingredientId);
                return ingredient && ingredient.name.toLowerCase().includes(allergy);
            })
        );

        return {
            hasAllergens: matchedAllergens.length > 0,
            allergens: matchedAllergens
        };
    };

    /**
     * Save planner week to patient plan
     */
    const savePlannerToPatient = (patientId, weekPlan, dailyTarget) => {
        if (!patientId) throw new Error('No patient selected');
        
        const plan = addPatientPlan(patientId, {
            name: `Planner - ${new Date().toLocaleDateString()}`,
            dietGoal: 'maintenance',
            dailyTarget: dailyTarget,
            startDate: new Date().toISOString().split('T')[0],
            notes: 'Created from weekly planner',
            status: 'active',
            weekPlan
        });

        return plan;
    };

    // ==========================================
    // EXPORT / IMPORT
    // ==========================================

    const exportData = () => ({
        version: '3.0', exportedAt: getTimestamp(),
        ingredients: state.ingredients, recipes: state.recipes,
        weekPlans: state.weekPlans, currentTemplateId: state.currentTemplateId,
        dietProfile: state.dietProfile, dietTemplates: state.dietTemplates,
        patients: state.patients, patientMetrics: state.patientMetrics,
        patientConditions: state.patientConditions, patientPlans: state.patientPlans,
        patientProgress: state.patientProgress
    });

    const exportPatientData = (patientId) => {
        const patient = patientMap.get(patientId);
        if (!patient) return null;
        return {
            patient,
            metrics: getPatientMetrics(patientId),
            conditions: getPatientConditions(patientId),
            plans: getPatientPlans(patientId),
            progress: getPatientProgress(patientId)
        };
    };

    const importData = (data) => {
        try {
            if (data.ingredients) state.ingredients = data.ingredients;
            if (data.recipes) state.recipes = data.recipes;
            
            // Handle backwards compatibility (old weekPlan -> new weekPlans)
            if (data.weekPlans) {
                state.weekPlans = data.weekPlans;
            } else if (data.weekPlan) {
                // Migrate old weekPlan to new format using first template
                const templates = getDietTemplates();
                if (templates.length > 0) {
                    state.weekPlans[templates[0].id] = data.weekPlan;
                }
            }
            
            if (data.currentTemplateId) state.currentTemplateId = data.currentTemplateId;
            if (data.dietProfile) state.dietProfile = data.dietProfile;
            if (data.dietTemplates) state.dietTemplates = data.dietTemplates;
            if (data.patients) state.patients = data.patients;
            if (data.patientMetrics) state.patientMetrics = data.patientMetrics;
            if (data.patientConditions) state.patientConditions = data.patientConditions;
            if (data.patientPlans) state.patientPlans = data.patientPlans;
            if (data.patientProgress) state.patientProgress = data.patientProgress;

            rebuildMaps();
            saveImmediately();
            emit('data:imported', data);
            emit('ingredients:updated', state.ingredients);
            emit('recipes:updated', state.recipes);
            emit('patients:updated', state.patients);
            return true;
        } catch (error) {
            console.error('[State] Import error:', error);
            return false;
        }
    };

    const init = () => {
        loadFromStorage();
        console.log('[State] Initialized v2.0 with Patient Module');
        emit('state:ready', state);
    };

    // Public API
    return {
        init, subscribe, emit,
        // Enums
        VALID_CATEGORIES, VALID_MEAL_TYPES, DAYS, GENDERS,
        ACTIVITY_LEVELS, CONDITION_TYPES, CONDITION_SEVERITIES, PLAN_STATUSES, DIET_GOALS,
        // Utilities
        calculateAge, calculateBMI, getBMICategory,
        // Ingredients
        getIngredients, getIngredient, addIngredient, updateIngredient, deleteIngredient, deleteAllIngredients,
        importIngredients, importIngredientsFull,
        // Recipes
        getRecipes, getRecipe, getRecipesByCategory, calculateRecipeNutrition,
        addRecipe, updateRecipe, deleteRecipe,
        // Week Plan
        getWeekPlan, getDayMeals, assignMeal, removeMeal, clearWeekPlan,
        getDailyCalories, getWeeklyAverage, getWeeklyTotal,
        // Diet
        getDietProfile, updateDietProfile, generateShoppingList,
        // Diet Templates
        getDietTemplates, getDietTemplate, addDietTemplate, updateDietTemplate, deleteDietTemplate, applyDietTemplate,
        setCurrentTemplate, getCurrentTemplateId,
        // Patients
        getPatients, getPatient, searchPatients, findPatientByEmail,
        addPatient, updatePatient, deletePatient,
        // Metrics
        getPatientMetrics, getLatestMetrics, addPatientMetric, deletePatientMetric,
        // Conditions
        getPatientConditions, addPatientCondition, updatePatientCondition,
        deletePatientCondition, getAllergies,
        // Plans
        getPatientPlans, getActivePlan, addPatientPlan, updatePatientPlan,
        deletePatientPlan, getPatientDailyCalories,
        // Progress
        getPatientProgress, addPatientProgress, updatePatientProgress, deletePatientProgress,
        // Planner Helpers
        getPatientContext, checkRecipeAllergens, savePlannerToPatient,
        // Export
        exportData, exportPatientData, importData
    };
})();

document.addEventListener('DOMContentLoaded', () => State.init());
