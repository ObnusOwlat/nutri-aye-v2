/**
 * Ingredients Store - Ingredient management with CRUD operations
 * 
 * Provides type-safe operations for managing ingredients including
 * import/export functionality.
 */

import { v4 as uuidv4 } from 'uuid';
import { storage, STORAGE_KEYS } from '../storage';
import { events, EventNames } from '../events';
import {
  VALID_CATEGORIES,
  UNITS,
  type Ingredient,
  type IngredientInput,
  type ImportResult,
} from '../types';

// Validation helpers
const clamp = (val: number, min: number, max: number): number => 
  Math.max(min, Math.min(max, val));

const getTimestamp = (): string => new Date().toISOString();

/**
 * Create a new ingredients store instance
 */
export function createIngredientsStore() {
  // Private state
  let ingredients: Ingredient[] = [];
  const ingredientMap = new Map<string, Ingredient>();

  // ==========================================
  // Private Methods
  // ==========================================

  const rebuildMap = (): void => {
    ingredientMap.clear();
    ingredients.forEach(i => ingredientMap.set(i.id, i));
  };

  const findByName = (name: string): Ingredient | undefined => {
    const n = name.trim().toLowerCase();
    return ingredients.find(i => i.name.toLowerCase() === n);
  };

  const validateAndParse = (data: IngredientInput): Omit<Ingredient, 'id' | 'createdAt' | 'updatedAt'> => {
    const name = data.name.trim();
    if (!name) throw new Error('Ingredient name is required');
    
    if (findByName(name)) throw new Error(`"${name}" already exists`);

    return {
      name,
      category: VALID_CATEGORIES.includes(data.category ?? 'mixed') 
        ? (data.category ?? 'mixed') 
        : 'mixed',
      unit: data.unit === 'oz' ? 'oz' : 'g',
      kcalPer100g: clamp(parseFloat(String(data.kcalPer100g)) || 0, 0, Infinity),
      proteinPer100g: clamp(parseFloat(String(data.proteinPer100g)) || 0, 0, 100),
      carbsPer100g: clamp(parseFloat(String(data.carbsPer100g)) || 0, 0, 100),
      fatPer100g: clamp(parseFloat(String(data.fatPer100g)) || 0, 0, 100),
      saturatedFatPer100g: clamp(parseFloat(String(data.saturatedFatPer100g)) || 0, 0, 100),
      polyunsaturatedFatPer100g: clamp(parseFloat(String(data.polyunsaturatedFatPer100g)) || 0, 0, 100),
      monounsaturatedFatPer100g: clamp(parseFloat(String(data.monounsaturatedFatPer100g)) || 0, 0, 100),
      sugarPer100g: clamp(parseFloat(String(data.sugarPer100g)) || 0, 0, 100),
      fiberPer100g: clamp(parseFloat(String(data.fiberPer100g)) || 0, 0, 100),
      cholesterolPer100g: clamp(parseFloat(String(data.cholesterolPer100g)) || 0, 0, 1000),
      sodiumPer100g: clamp(parseFloat(String(data.sodiumPer100g)) || 0, 0, 10000),
      vitaminAPer100g: clamp(parseFloat(String(data.vitaminAPer100g)) || 0, 0, 10000),
      vitaminB1Per100g: clamp(parseFloat(String(data.vitaminB1Per100g)) || 0, 0, 100),
      vitaminB2Per100g: clamp(parseFloat(String(data.vitaminB2Per100g)) || 0, 0, 100),
      vitaminB3Per100g: clamp(parseFloat(String(data.vitaminB3Per100g)) || 0, 0, 100),
      vitaminB5Per100g: clamp(parseFloat(String(data.vitaminB5Per100g)) || 0, 0, 100),
      vitaminB6Per100g: clamp(parseFloat(String(data.vitaminB6Per100g)) || 0, 0, 100),
      vitaminB9Per100g: clamp(parseFloat(String(data.vitaminB9Per100g)) || 0, 0, 10000),
      vitaminB12Per100g: clamp(parseFloat(String(data.vitaminB12Per100g)) || 0, 0, 1000),
      vitaminCPer100g: clamp(parseFloat(String(data.vitaminCPer100g)) || 0, 0, 1000),
      vitaminDPer100g: clamp(parseFloat(String(data.vitaminDPer100g)) || 0, 0, 1000),
      vitaminEPer100g: clamp(parseFloat(String(data.vitaminEPer100g)) || 0, 0, 100),
      vitaminKPer100g: clamp(parseFloat(String(data.vitaminKPer100g)) || 0, 0, 10000),
      magnesiumPer100g: clamp(parseFloat(String(data.magnesiumPer100g)) || 0, 0, 10000),
      calciumPer100g: clamp(parseFloat(String(data.calciumPer100g)) || 0, 0, 100000),
      phosphorusPer100g: clamp(parseFloat(String(data.phosphorusPer100g)) || 0, 0, 10000),
      potassiumPer100g: clamp(parseFloat(String(data.potassiumPer100g)) || 0, 0, 10000),
      ironPer100g: clamp(parseFloat(String(data.ironPer100g)) || 0, 0, 100),
      seleniumPer100g: clamp(parseFloat(String(data.seleniumPer100g)) || 0, 0, 1000),
      zincPer100g: clamp(parseFloat(String(data.zincPer100g)) || 0, 0, 100),
      manganesePer100g: clamp(parseFloat(String(data.manganesePer100g)) || 0, 0, 100),
      copperPer100g: clamp(parseFloat(String(data.copperPer100g)) || 0, 0, 100),
    };
  };

  // ==========================================
  // Public API
  // ==========================================

  const load = (): void => {
    const data = storage.load<Ingredient[]>(STORAGE_KEYS.INGREDIENTS);
    ingredients = data || [];
    rebuildMap();
  };

  const getAll = (): Ingredient[] => [...ingredients];

  const getById = (id: string): Ingredient | undefined => ingredientMap.get(id);

  const add = (data: IngredientInput): Ingredient => {
    const parsed = validateAndParse(data);
    const timestamp = getTimestamp();
    
    const ingredient: Ingredient = {
      ...parsed,
      id: uuidv4(),
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    ingredients.push(ingredient);
    ingredientMap.set(ingredient.id, ingredient);
    storage.save(STORAGE_KEYS.INGREDIENTS, ingredients);
    
    events.emit(EventNames.INGREDIENTS_UPDATED, ingredients);
    events.emit(EventNames.INGREDIENTS_ADDED, ingredient);
    
    return ingredient;
  };

  const update = (id: string, data: Partial<IngredientInput>): Ingredient | null => {
    const idx = ingredients.findIndex(i => i.id === id);
    if (idx === -1) return null;

    const orig = ingredients[idx];
    
    // Validate name uniqueness if name is being changed
    if (data.name?.trim()) {
      const existing = findByName(data.name.trim());
      if (existing && existing.id !== id) {
        throw new Error(`"${data.name}" already exists`);
      }
    }

    const updated: Ingredient = {
      ...orig,
      name: data.name?.trim() || orig.name,
      category: data.category && VALID_CATEGORIES.includes(data.category) 
        ? data.category 
        : orig.category,
      unit: data.unit && UNITS.includes(data.unit) ? data.unit : orig.unit,
      kcalPer100g: data.kcalPer100g !== undefined 
        ? clamp(parseFloat(String(data.kcalPer100g)), 0, Infinity) 
        : orig.kcalPer100g,
      proteinPer100g: data.proteinPer100g !== undefined 
        ? clamp(parseFloat(String(data.proteinPer100g)), 0, 100) 
        : orig.proteinPer100g,
      carbsPer100g: data.carbsPer100g !== undefined 
        ? clamp(parseFloat(String(data.carbsPer100g)), 0, 100) 
        : orig.carbsPer100g,
      fatPer100g: data.fatPer100g !== undefined 
        ? clamp(parseFloat(String(data.fatPer100g)), 0, 100) 
        : orig.fatPer100g,
      saturatedFatPer100g: data.saturatedFatPer100g !== undefined 
        ? clamp(parseFloat(String(data.saturatedFatPer100g)), 0, 100) 
        : orig.saturatedFatPer100g,
      polyunsaturatedFatPer100g: data.polyunsaturatedFatPer100g !== undefined 
        ? clamp(parseFloat(String(data.polyunsaturatedFatPer100g)), 0, 100) 
        : orig.polyunsaturatedFatPer100g,
      monounsaturatedFatPer100g: data.monounsaturatedFatPer100g !== undefined 
        ? clamp(parseFloat(String(data.monounsaturatedFatPer100g)), 0, 100) 
        : orig.monounsaturatedFatPer100g,
      sugarPer100g: data.sugarPer100g !== undefined 
        ? clamp(parseFloat(String(data.sugarPer100g)), 0, 100) 
        : orig.sugarPer100g,
      fiberPer100g: data.fiberPer100g !== undefined 
        ? clamp(parseFloat(String(data.fiberPer100g)), 0, 100) 
        : orig.fiberPer100g,
      cholesterolPer100g: data.cholesterolPer100g !== undefined 
        ? clamp(parseFloat(String(data.cholesterolPer100g)), 0, 1000) 
        : orig.cholesterolPer100g,
      sodiumPer100g: data.sodiumPer100g !== undefined 
        ? clamp(parseFloat(String(data.sodiumPer100g)), 0, 10000) 
        : orig.sodiumPer100g,
      updatedAt: getTimestamp(),
    };

    ingredients[idx] = updated;
    ingredientMap.set(id, updated);
    storage.save(STORAGE_KEYS.INGREDIENTS, ingredients);
    
    events.emit(EventNames.INGREDIENTS_UPDATED, ingredients);
    
    return updated;
  };

  const remove = (id: string): boolean => {
    const idx = ingredients.findIndex(i => i.id === id);
    if (idx === -1) return false;

    ingredients.splice(idx, 1);
    ingredientMap.delete(id);
    storage.save(STORAGE_KEYS.INGREDIENTS, ingredients);
    
    events.emit(EventNames.INGREDIENTS_UPDATED, ingredients);
    
    return true;
  };

  const removeAll = (): void => {
    ingredients = [];
    ingredientMap.clear();
    storage.save(STORAGE_KEYS.INGREDIENTS, ingredients);
    events.emit(EventNames.INGREDIENTS_UPDATED, ingredients);
  };

  const importMany = (items: IngredientInput[]): ImportResult => {
    const result: ImportResult = { imported: [], skipped: [], errors: [] };

    for (const item of items) {
      if (!item.name || item.kcalPer100g === undefined) {
        result.errors.push({ name: item.name || 'unknown', error: 'Missing required fields' });
        continue;
      }
      
      if (findByName(item.name)) {
        result.skipped.push({ name: item.name, error: 'Already exists' });
        continue;
      }
      
      try {
        const added = add(item);
        result.imported.push(added);
      } catch (e) {
        result.errors.push({ name: item.name, error: (e as Error).message });
      }
    }

    return result;
  };

  const importManyFull = (items: Array<Ingredient & { id?: string }>): ImportResult => {
    const result: ImportResult = { imported: [], skipped: [], errors: [] };

    for (const item of items) {
      if (!item.name || item.kcalPer100g === undefined) {
        result.errors.push({ name: item.name || 'unknown', error: 'Missing required fields' });
        continue;
      }
      
      const ingredientId = item.id || uuidv4();
      const existing = ingredientMap.get(ingredientId);
      
      if (existing) {
        // Update existing
        Object.assign(existing, {
          name: item.name.trim(),
          kcalPer100g: clamp(parseFloat(String(item.kcalPer100g)) || 0, 0, Infinity),
          proteinPer100g: clamp(parseFloat(String(item.proteinPer100g)) || 0, 0, 100),
          carbsPer100g: clamp(parseFloat(String(item.carbsPer100g)) || 0, 0, 100),
          fatPer100g: clamp(parseFloat(String(item.fatPer100g)) || 0, 0, 100),
          saturatedFatPer100g: clamp(parseFloat(String(item.saturatedFatPer100g)) || 0, 0, 100),
          fiberPer100g: clamp(parseFloat(String(item.fiberPer100g)) || 0, 0, 100),
          sugarPer100g: clamp(parseFloat(String(item.sugarPer100g)) || 0, 0, 100),
          category: VALID_CATEGORIES.includes(item.category) ? item.category : 'mixed',
          updatedAt: getTimestamp(),
        });
        result.imported.push(existing);
        continue;
      }
      
      try {
        const ingredient: Ingredient = {
          id: ingredientId,
          name: item.name.trim(),
          kcalPer100g: clamp(parseFloat(String(item.kcalPer100g)) || 0, 0, Infinity),
          proteinPer100g: clamp(parseFloat(String(item.proteinPer100g)) || 0, 0, 100),
          carbsPer100g: clamp(parseFloat(String(item.carbsPer100g)) || 0, 0, 100),
          fatPer100g: clamp(parseFloat(String(item.fatPer100g)) || 0, 0, 100),
          saturatedFatPer100g: clamp(parseFloat(String(item.saturatedFatPer100g)) || 0, 0, 100),
          polyunsaturatedFatPer100g: clamp(parseFloat(String(item.polyunsaturatedFatPer100g)) || 0, 0, 100),
          monounsaturatedFatPer100g: clamp(parseFloat(String(item.monounsaturatedFatPer100g)) || 0, 0, 100),
          sugarPer100g: clamp(parseFloat(String(item.sugarPer100g)) || 0, 0, 100),
          fiberPer100g: clamp(parseFloat(String(item.fiberPer100g)) || 0, 0, 100),
          cholesterolPer100g: clamp(parseFloat(String(item.cholesterolPer100g)) || 0, 0, 1000),
          sodiumPer100g: clamp(parseFloat(String(item.sodiumPer100g)) || 0, 0, 10000),
          category: VALID_CATEGORIES.includes(item.category) ? item.category : 'mixed',
          unit: 'g',
          vitaminAPer100g: clamp(parseFloat(String(item.vitaminAPer100g)) || 0, 0, 10000),
          vitaminB1Per100g: clamp(parseFloat(String(item.vitaminB1Per100g)) || 0, 0, 100),
          vitaminB2Per100g: clamp(parseFloat(String(item.vitaminB2Per100g)) || 0, 0, 100),
          vitaminB3Per100g: clamp(parseFloat(String(item.vitaminB3Per100g)) || 0, 0, 100),
          vitaminB5Per100g: clamp(parseFloat(String(item.vitaminB5Per100g)) || 0, 0, 100),
          vitaminB6Per100g: clamp(parseFloat(String(item.vitaminB6Per100g)) || 0, 0, 100),
          vitaminB9Per100g: clamp(parseFloat(String(item.vitaminB9Per100g)) || 0, 0, 10000),
          vitaminB12Per100g: clamp(parseFloat(String(item.vitaminB12Per100g)) || 0, 0, 1000),
          vitaminCPer100g: clamp(parseFloat(String(item.vitaminCPer100g)) || 0, 0, 1000),
          vitaminDPer100g: clamp(parseFloat(String(item.vitaminDPer100g)) || 0, 0, 1000),
          vitaminEPer100g: clamp(parseFloat(String(item.vitaminEPer100g)) || 0, 0, 100),
          vitaminKPer100g: clamp(parseFloat(String(item.vitaminKPer100g)) || 0, 0, 10000),
          magnesiumPer100g: clamp(parseFloat(String(item.magnesiumPer100g)) || 0, 0, 10000),
          calciumPer100g: clamp(parseFloat(String(item.calciumPer100g)) || 0, 0, 100000),
          phosphorusPer100g: clamp(parseFloat(String(item.phosphorusPer100g)) || 0, 0, 10000),
          potassiumPer100g: clamp(parseFloat(String(item.potassiumPer100g)) || 0, 0, 10000),
          ironPer100g: clamp(parseFloat(String(item.ironPer100g)) || 0, 0, 100),
          seleniumPer100g: clamp(parseFloat(String(item.seleniumPer100g)) || 0, 0, 1000),
          zincPer100g: clamp(parseFloat(String(item.zincPer100g)) || 0, 0, 100),
          manganesePer100g: clamp(parseFloat(String(item.manganesePer100g)) || 0, 0, 100),
          copperPer100g: clamp(parseFloat(String(item.copperPer100g)) || 0, 0, 100),
          createdAt: getTimestamp(),
          updatedAt: getTimestamp(),
        };
        
        ingredients.push(ingredient);
        ingredientMap.set(ingredient.id, ingredient);
        result.imported.push(ingredient);
      } catch (e) {
        result.errors.push({ name: item.name, error: (e as Error).message });
      }
    }

    if (result.imported.length > 0) {
      storage.save(STORAGE_KEYS.INGREDIENTS, ingredients);
      events.emit(EventNames.INGREDIENTS_UPDATED, ingredients);
    }

    return result;
  };

  const setAll = (items: Ingredient[]): void => {
    ingredients = items;
    rebuildMap();
    storage.saveImmediate(STORAGE_KEYS.INGREDIENTS, ingredients);
    events.emit(EventNames.INGREDIENTS_UPDATED, ingredients);
  };

  // Public API
  return {
    load,
    getAll,
    getById,
    add,
    update,
    remove,
    removeAll,
    importMany,
    importManyFull,
    setAll,
  };
}

// Export singleton instance
export const ingredientsStore = createIngredientsStore();
