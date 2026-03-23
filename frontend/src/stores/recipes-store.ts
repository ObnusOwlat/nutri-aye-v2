/**
 * Recipes Store - Recipe management with nutrition calculation
 * 
 * Handles recipe CRUD operations and calculates nutrition
 * based on ingredient composition.
 */

import { v4 as uuidv4 } from 'uuid';
import { storage, STORAGE_KEYS } from '../storage';
import { events, EventNames } from '../events';
import { ingredientsStore } from './ingredients-store';
import {
  VALID_CATEGORIES,
  type Recipe,
  type RecipeIngredient,
  type RecipeInput,
  type NutritionInfo,
} from '../types';

// Validation helpers
const clamp = (val: number, min: number, max: number): number => 
  Math.max(min, Math.min(max, val));

const getTimestamp = (): string => new Date().toISOString();

/**
 * Pure function to calculate recipe nutrition
 */
export function calculateRecipeNutrition(
  recipeIngredients: RecipeIngredient[]
): NutritionInfo {
  if (!recipeIngredients.length) {
    return { calories: 0, protein: 0, carbs: 0, fat: 0, saturatedFat: 0, sugar: 0, fiber: 0 };
  }

  return recipeIngredients.reduce(
    (totals, ri) => {
      const ing = ingredientsStore.getById(ri.ingredientId);
      if (!ing) return totals;

      const factor = ri.grams / 100;
      return {
        calories: totals.calories + ing.kcalPer100g * factor,
        protein: totals.protein + ing.proteinPer100g * factor,
        carbs: totals.carbs + ing.carbsPer100g * factor,
        fat: totals.fat + ing.fatPer100g * factor,
        saturatedFat: totals.saturatedFat + ing.saturatedFatPer100g * factor,
        sugar: totals.sugar + ing.sugarPer100g * factor,
        fiber: totals.fiber + ing.fiberPer100g * factor,
      };
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, saturatedFat: 0, sugar: 0, fiber: 0 }
  );
}

/**
 * Create a recipes store instance
 */
export function createRecipesStore() {
  // Private state
  let recipes: Recipe[] = [];
  const recipeMap = new Map<string, Recipe>();

  // ==========================================
  // Private Methods
  // ==========================================

  const rebuildMap = (): void => {
    recipeMap.clear();
    recipes.forEach(r => recipeMap.set(r.id, r));
  };

  // ==========================================
  // Public API
  // ==========================================

  const load = (): void => {
    const data = storage.load<Recipe[]>(STORAGE_KEYS.RECIPES);
    recipes = data || [];
    rebuildMap();
  };

  const getAll = (): Recipe[] => [...recipes];

  const getById = (id: string): Recipe | undefined => recipeMap.get(id);

  const getByCategory = (category: string): Recipe[] => {
    if (category === 'all') return [...recipes];
    return recipes.filter(r => r.category === category);
  };

  const add = (data: RecipeInput): Recipe => {
    const name = data.name.trim();
    if (!name) throw new Error('Recipe name is required');
    if (!data.ingredients?.length) throw new Error('At least one ingredient is required');

    const recipe: Recipe = {
      id: uuidv4(),
      name,
      category: VALID_CATEGORIES.includes(data.category ?? 'mixed') 
        ? (data.category ?? 'mixed') 
        : 'mixed',
      ingredients: data.ingredients.map(ri => ({
        ingredientId: ri.ingredientId,
        grams: clamp(Math.round(ri.grams) || 100, 1, 10000),
      })),
      instructions: data.instructions || '',
      notes: data.notes,
      nutrition: calculateRecipeNutrition(data.ingredients),
      createdAt: getTimestamp(),
      updatedAt: getTimestamp(),
    };

    recipes.push(recipe);
    recipeMap.set(recipe.id, recipe);
    storage.save(STORAGE_KEYS.RECIPES, recipes);
    
    events.emit(EventNames.RECIPES_UPDATED, recipes);
    events.emit(EventNames.RECIPES_ADDED, recipe);
    
    return recipe;
  };

  const update = (id: string, data: Partial<RecipeInput>): Recipe | null => {
    const idx = recipes.findIndex(r => r.id === id);
    if (idx === -1) return null;

    const orig = recipes[idx];
    const updatedIngredients = data.ingredients ?? orig.ingredients;

    const updated: Recipe = {
      ...orig,
      name: data.name?.trim() || orig.name,
      category: data.category && VALID_CATEGORIES.includes(data.category) 
        ? data.category 
        : orig.category,
      instructions: data.instructions !== undefined ? data.instructions : orig.instructions,
      notes: data.notes !== undefined ? data.notes : orig.notes,
      ingredients: updatedIngredients.map(ri => ({
        ingredientId: ri.ingredientId,
        grams: clamp(Math.round(ri.grams) || 100, 1, 10000),
      })),
      nutrition: calculateRecipeNutrition(updatedIngredients),
      updatedAt: getTimestamp(),
    };

    recipes[idx] = updated;
    recipeMap.set(id, updated);
    storage.save(STORAGE_KEYS.RECIPES, recipes);
    
    events.emit(EventNames.RECIPES_UPDATED, recipes);
    
    return updated;
  };

  const remove = (id: string): boolean => {
    const idx = recipes.findIndex(r => r.id === id);
    if (idx === -1) return false;

    recipes.splice(idx, 1);
    recipeMap.delete(id);
    storage.save(STORAGE_KEYS.RECIPES, recipes);
    
    events.emit(EventNames.RECIPES_UPDATED, recipes);
    
    return true;
  };

  const removeOrphanedIngredients = (ingredientId: string): void => {
    recipes.forEach(recipe => {
      recipe.ingredients = recipe.ingredients.filter(ri => ri.ingredientId !== ingredientId);
    });
  };

  const setAll = (items: Recipe[]): void => {
    recipes = items;
    rebuildMap();
    storage.saveImmediate(STORAGE_KEYS.RECIPES, recipes);
    events.emit(EventNames.RECIPES_UPDATED, recipes);
  };

  // Public API
  return {
    load,
    getAll,
    getById,
    getByCategory,
    add,
    update,
    remove,
    removeOrphanedIngredients,
    setAll,
    calculateNutrition: calculateRecipeNutrition,
  };
}

// Export singleton instance
export const recipesStore = createRecipesStore();
