/**
 * Recipes Store Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculateRecipeNutrition } from '../stores/recipes-store';
import { recipesStore } from '../stores/recipes-store';
import { ingredientsStore } from '../stores/ingredients-store';
import { events } from '../events/EventEmitter';
import type { RecipeIngredient } from '../types';

describe('Recipes Store', () => {
  beforeEach(() => {
    events.clear();
    ingredientsStore.removeAll();
    // Clear recipes using setAll with empty array
    recipesStore.setAll([]);
  });

  describe('calculateRecipeNutrition (pure function)', () => {
    it('should return zero nutrition for empty ingredients', () => {
      const result = calculateRecipeNutrition([]);
      expect(result.calories).toBe(0);
      expect(result.protein).toBe(0);
      expect(result.carbs).toBe(0);
      expect(result.fat).toBe(0);
    });

    it('should calculate nutrition for single ingredient', () => {
      // Use the singleton instance directly
      const ingredient = ingredientsStore.add({
        name: 'Chicken',
        kcalPer100g: 165,
        proteinPer100g: 31,
        carbsPer100g: 0,
        fatPer100g: 3.6,
        saturatedFatPer100g: 1,
        sugarPer100g: 0,
        fiberPer100g: 0,
      });
      
      const recipeIngredients: RecipeIngredient[] = [
        { ingredientId: ingredient.id, grams: 100 },
      ];
      
      const result = calculateRecipeNutrition(recipeIngredients);
      expect(result.calories).toBe(165);
      expect(result.protein).toBe(31);
      expect(result.fat).toBe(3.6);
    });

    it('should scale nutrition by grams', () => {
      const ingredient = ingredientsStore.add({
        name: 'Rice',
        kcalPer100g: 130,
        proteinPer100g: 2.7,
        carbsPer100g: 28,
        fatPer100g: 0.3,
        saturatedFatPer100g: 0.1,
        sugarPer100g: 0.1,
        fiberPer100g: 0.4,
      });
      
      const recipeIngredients: RecipeIngredient[] = [
        { ingredientId: ingredient.id, grams: 200 }, // Double the amount
      ];
      
      const result = calculateRecipeNutrition(recipeIngredients);
      expect(result.calories).toBe(260); // 130 * 2
      expect(result.carbs).toBe(56); // 28 * 2
    });

    it('should handle multiple ingredients', () => {
      const chicken = ingredientsStore.add({
        name: 'Chicken',
        kcalPer100g: 165,
        proteinPer100g: 31,
        carbsPer100g: 0,
        fatPer100g: 3.6,
        saturatedFatPer100g: 1,
        sugarPer100g: 0,
        fiberPer100g: 0,
      });
      
      const rice = ingredientsStore.add({
        name: 'Rice',
        kcalPer100g: 130,
        proteinPer100g: 2.7,
        carbsPer100g: 28,
        fatPer100g: 0.3,
        saturatedFatPer100g: 0.1,
        sugarPer100g: 0.1,
        fiberPer100g: 0.4,
      });
      
      const recipeIngredients: RecipeIngredient[] = [
        { ingredientId: chicken.id, grams: 100 },
        { ingredientId: rice.id, grams: 100 },
      ];
      
      const result = calculateRecipeNutrition(recipeIngredients);
      expect(result.calories).toBe(295); // 165 + 130
      expect(result.protein).toBe(33.7); // 31 + 2.7
      expect(result.carbs).toBe(28);
      expect(result.fat).toBe(3.9); // 3.6 + 0.3
    });

    it('should skip unknown ingredient IDs', () => {
      const recipeIngredients: RecipeIngredient[] = [
        { ingredientId: 'unknown-id', grams: 100 },
      ];
      
      const result = calculateRecipeNutrition(recipeIngredients);
      expect(result.calories).toBe(0);
    });
  });

  describe('load and getAll', () => {
    it('should return empty array when no data', () => {
      recipesStore.setAll([]);
      expect(recipesStore.getAll()).toEqual([]);
    });

    it('should return all recipes', () => {
      const ingredient = ingredientsStore.add({ name: 'Chicken', kcalPer100g: 165 });
      recipesStore.add({ name: 'Grilled Chicken', ingredients: [{ ingredientId: ingredient.id, grams: 100 }] });
      expect(recipesStore.getAll()).toHaveLength(1);
    });
  });

  describe('add', () => {
    it('should add recipe with generated id', () => {
      const ingredient = ingredientsStore.add({ name: 'Chicken', kcalPer100g: 165 });
      const result = recipesStore.add({
        name: 'Grilled Chicken',
        ingredients: [{ ingredientId: ingredient.id, grams: 100 }],
      });
      
      expect(result.id).toBeDefined();
      expect(result.name).toBe('Grilled Chicken');
      expect(result.nutrition.calories).toBe(165);
    });

    it('should calculate nutrition on add', () => {
      const ingredient = ingredientsStore.add({
        name: 'Chicken',
        kcalPer100g: 165,
        proteinPer100g: 31,
        carbsPer100g: 0,
        fatPer100g: 3.6,
        saturatedFatPer100g: 1,
        sugarPer100g: 0,
        fiberPer100g: 0,
      });
      
      const result = recipesStore.add({
        name: 'Grilled Chicken',
        ingredients: [{ ingredientId: ingredient.id, grams: 150 }],
      });
      
      expect(result.nutrition.calories).toBe(247.5); // 165 * 1.5
      expect(result.nutrition.protein).toBe(46.5); // 31 * 1.5
    });

    it('should throw error for empty name', () => {
      expect(() => recipesStore.add({ name: '', ingredients: [] })).toThrow('Recipe name is required');
    });

    it('should throw error for empty ingredients', () => {
      expect(() => recipesStore.add({ name: 'No Ingredients', ingredients: [] })).toThrow('At least one ingredient is required');
    });

    it('should emit recipes:updated and recipes:added events', () => {
      const updatedSpy = vi.fn();
      const addedSpy = vi.fn();
      events.subscribe('recipes:updated', updatedSpy);
      events.subscribe('recipes:added', addedSpy);
      
      const ingredient = ingredientsStore.add({ name: 'Chicken', kcalPer100g: 165 });
      recipesStore.add({ name: 'Test', ingredients: [{ ingredientId: ingredient.id, grams: 100 }] });
      
      expect(updatedSpy).toHaveBeenCalled();
      expect(addedSpy).toHaveBeenCalled();
    });
  });

  describe('getById', () => {
    it('should return recipe by id', () => {
      const ingredient = ingredientsStore.add({ name: 'Chicken', kcalPer100g: 165 });
      const added = recipesStore.add({
        name: 'Grilled Chicken',
        ingredients: [{ ingredientId: ingredient.id, grams: 100 }],
      });
      
      const result = recipesStore.getById(added.id);
      expect(result?.name).toBe('Grilled Chicken');
    });

    it('should return undefined for non-existent id', () => {
      expect(recipesStore.getById('non-existent')).toBeUndefined();
    });
  });

  describe('getByCategory', () => {
    it('should filter by category', () => {
      const chicken = ingredientsStore.add({ name: 'Chicken', kcalPer100g: 165 });
      ingredientsStore.add({ name: 'Rice', kcalPer100g: 130 }); // Default category
      
      recipesStore.add({ name: 'Chicken Recipe', category: 'protein', ingredients: [{ ingredientId: chicken.id, grams: 100 }] });
      recipesStore.add({ name: 'Rice Recipe', category: 'mixed', ingredients: [{ ingredientId: ingredientsStore.getAll()[1].id, grams: 100 }] });
      
      const proteinRecipes = recipesStore.getByCategory('protein');
      expect(proteinRecipes).toHaveLength(1);
      expect(proteinRecipes[0].name).toBe('Chicken Recipe');
    });

    it('should return all recipes for "all" category', () => {
      const ingredient = ingredientsStore.add({ name: 'Test', kcalPer100g: 100 });
      recipesStore.add({ name: 'Recipe 1', ingredients: [{ ingredientId: ingredient.id, grams: 100 }] });
      recipesStore.add({ name: 'Recipe 2', ingredients: [{ ingredientId: ingredient.id, grams: 100 }] });
      
      const allRecipes = recipesStore.getByCategory('all');
      expect(allRecipes).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('should update recipe', () => {
      const ingredient = ingredientsStore.add({ name: 'Chicken', kcalPer100g: 165 });
      const added = recipesStore.add({
        name: 'Original Name',
        ingredients: [{ ingredientId: ingredient.id, grams: 100 }],
      });
      
      const result = recipesStore.update(added.id, { name: 'Updated Name' });
      expect(result?.name).toBe('Updated Name');
    });

    it('should recalculate nutrition on ingredient change', () => {
      const chicken = ingredientsStore.add({ name: 'Chicken', kcalPer100g: 165 });
      const rice = ingredientsStore.add({ name: 'Rice', kcalPer100g: 130 });
      
      const added = recipesStore.add({
        name: 'Recipe',
        ingredients: [{ ingredientId: chicken.id, grams: 100 }],
      });
      
      const result = recipesStore.update(added.id, {
        ingredients: [{ ingredientId: rice.id, grams: 100 }],
      });
      
      expect(result?.nutrition.calories).toBe(130);
    });

    it('should return null for non-existent id', () => {
      expect(recipesStore.update('non-existent', { name: 'Test' })).toBeNull();
    });
  });

  describe('remove', () => {
    it('should remove recipe by id', () => {
      const ingredient = ingredientsStore.add({ name: 'Chicken', kcalPer100g: 165 });
      const added = recipesStore.add({
        name: 'Grilled Chicken',
        ingredients: [{ ingredientId: ingredient.id, grams: 100 }],
      });
      
      expect(recipesStore.remove(added.id)).toBe(true);
      expect(recipesStore.getById(added.id)).toBeUndefined();
    });

    it('should return false for non-existent id', () => {
      expect(recipesStore.remove('non-existent')).toBe(false);
    });

    it('should emit recipes:updated event', () => {
      const spy = vi.fn();
      events.subscribe('recipes:updated', spy);
      
      const ingredient = ingredientsStore.add({ name: 'Chicken', kcalPer100g: 165 });
      const added = recipesStore.add({
        name: 'Recipe',
        ingredients: [{ ingredientId: ingredient.id, grams: 100 }],
      });
      
      recipesStore.remove(added.id);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('removeOrphanedIngredients', () => {
    it('should remove ingredient references from recipes', () => {
      const ingredient = ingredientsStore.add({ name: 'Chicken', kcalPer100g: 165 });
      const added = recipesStore.add({
        name: 'Recipe',
        ingredients: [{ ingredientId: ingredient.id, grams: 100 }],
      });
      
      recipesStore.removeOrphanedIngredients(ingredient.id);
      
      const recipe = recipesStore.getById(added.id);
      expect(recipe?.ingredients).toHaveLength(0);
    });
  });

  describe('setAll', () => {
    it('should replace all recipes', () => {
      const ingredient = ingredientsStore.add({ name: 'Chicken', kcalPer100g: 165 });
      recipesStore.add({
        name: 'Old Recipe',
        ingredients: [{ ingredientId: ingredient.id, grams: 100 }],
      });
      
      recipesStore.setAll([{
        id: 'new-1',
        name: 'New Recipe',
        category: 'protein',
        ingredients: [{ ingredientId: ingredient.id, grams: 150 }],
        instructions: 'New instructions',
        nutrition: { calories: 247.5, protein: 46.5, carbs: 0, fat: 5.4, saturatedFat: 1.5, sugar: 0, fiber: 0 },
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      }]);
      
      expect(recipesStore.getAll()).toHaveLength(1);
      expect(recipesStore.getAll()[0].name).toBe('New Recipe');
    });
  });
});
