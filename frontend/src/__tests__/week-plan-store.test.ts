/**
 * Week Plan Store Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { initializeEmptyWeekPlan } from '../stores/week-plan-store';
import { recipesStore } from '../stores/recipes-store';
import { ingredientsStore } from '../stores/ingredients-store';
import { weekPlanStore } from '../stores/week-plan-store';
import { events } from '../events/EventEmitter';

describe('Week Plan Store', () => {
  const templateId = 'test-template-1';

  beforeEach(() => {
    events.clear();
    ingredientsStore.removeAll();
    recipesStore.setAll([]);
    // Reset week plan store state
    weekPlanStore.setAll({}, null);
  });

  describe('initializeEmptyWeekPlan', () => {
    it('should create week plan with all days', () => {
      const plan = initializeEmptyWeekPlan();
      
      expect(plan.monday).toEqual({ breakfast: null, lunch: null, snack: null, dinner: null });
      expect(plan.tuesday).toEqual({ breakfast: null, lunch: null, snack: null, dinner: null });
      expect(plan.wednesday).toEqual({ breakfast: null, lunch: null, snack: null, dinner: null });
      expect(plan.thursday).toEqual({ breakfast: null, lunch: null, snack: null, dinner: null });
      expect(plan.friday).toEqual({ breakfast: null, lunch: null, snack: null, dinner: null });
      expect(plan.saturday).toEqual({ breakfast: null, lunch: null, snack: null, dinner: null });
      expect(plan.sunday).toEqual({ breakfast: null, lunch: null, snack: null, dinner: null });
    });
  });

  describe('load and getWeekPlan', () => {
    it('should return empty plan when no data', () => {
      weekPlanStore.setAll({}, null);
      weekPlanStore.load(templateId);
      const plan = weekPlanStore.getWeekPlan(templateId);
      
      expect(plan.monday.breakfast).toBeNull();
    });

    it('should get assigned meals from current plan', () => {
      // Assign a meal
      const result = weekPlanStore.assignMeal('monday', 'breakfast', 'recipe-1', templateId);
      expect(result).toBe(true);
      
      // Get the plan and verify
      const plan = weekPlanStore.getWeekPlan(templateId);
      expect(plan.monday.breakfast).toBe('recipe-1');
    });
  });

  describe('assignMeal', () => {
    it('should assign recipe to day and meal type', () => {
      const result = weekPlanStore.assignMeal('monday', 'breakfast', 'recipe-1', templateId);
      
      expect(result).toBe(true);
      const plan = weekPlanStore.getWeekPlan(templateId);
      expect(plan.monday.breakfast).toBe('recipe-1');
    });

    it('should return false for invalid meal type', () => {
      const result = weekPlanStore.assignMeal('monday', 'invalid' as any, 'recipe-1', templateId);
      expect(result).toBe(false);
    });

    it('should return false when no template is set', () => {
      const result = weekPlanStore.assignMeal('monday', 'breakfast', 'recipe-1');
      expect(result).toBe(false);
    });

    it('should emit weekPlan:updated event', () => {
      const spy = vi.fn();
      events.subscribe('weekPlan:updated', spy);
      
      weekPlanStore.assignMeal('monday', 'breakfast', 'recipe-1', templateId);
      
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({
        templateId,
        weekPlan: expect.objectContaining({ monday: expect.objectContaining({ breakfast: 'recipe-1' }) }),
      }));
    });

    it('should overwrite existing assignment', () => {
      weekPlanStore.assignMeal('monday', 'breakfast', 'recipe-1', templateId);
      weekPlanStore.assignMeal('monday', 'breakfast', 'recipe-2', templateId);
      
      const plan = weekPlanStore.getWeekPlan(templateId);
      expect(plan.monday.breakfast).toBe('recipe-2');
    });
  });

  describe('removeMeal', () => {
    it('should remove recipe from day and meal type', () => {
      weekPlanStore.assignMeal('monday', 'breakfast', 'recipe-1', templateId);
      weekPlanStore.removeMeal('monday', 'breakfast', templateId);
      
      const plan = weekPlanStore.getWeekPlan(templateId);
      expect(plan.monday.breakfast).toBeNull();
    });

    it('should return true when meal exists', () => {
      weekPlanStore.assignMeal('monday', 'breakfast', 'recipe-1', templateId);
      const result = weekPlanStore.removeMeal('monday', 'breakfast', templateId);
      expect(result).toBe(true);
    });

    it('should return true when meal does not exist', () => {
      const result = weekPlanStore.removeMeal('monday', 'breakfast', templateId);
      expect(result).toBe(true);
    });
  });

  describe('clearWeekPlan', () => {
    it('should clear all meals for a day', () => {
      weekPlanStore.assignMeal('monday', 'breakfast', 'recipe-1', templateId);
      weekPlanStore.assignMeal('monday', 'lunch', 'recipe-2', templateId);
      weekPlanStore.assignMeal('monday', 'snack', 'recipe-3', templateId);
      weekPlanStore.assignMeal('monday', 'dinner', 'recipe-4', templateId);
      
      weekPlanStore.clearWeekPlan(templateId);
      
      const plan = weekPlanStore.getWeekPlan(templateId);
      expect(plan.monday).toEqual({ breakfast: null, lunch: null, snack: null, dinner: null });
    });

    it('should emit weekPlan:updated event', () => {
      const spy = vi.fn();
      events.subscribe('weekPlan:updated', spy);
      
      weekPlanStore.clearWeekPlan(templateId);
      
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('getDailyCalories', () => {
    it('should return 0 when no meals assigned', () => {
      weekPlanStore.load(templateId);
      expect(weekPlanStore.getDailyCalories('monday', templateId)).toBe(0);
    });

    it('should calculate calories from recipes', () => {
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
      
      const recipe = recipesStore.add({
        name: 'Chicken Breast',
        ingredients: [{ ingredientId: ingredient.id, grams: 100 }],
      });
      
      weekPlanStore.assignMeal('monday', 'breakfast', recipe.id, templateId);
      
      expect(weekPlanStore.getDailyCalories('monday', templateId)).toBe(165);
    });

    it('should sum calories from multiple meals', () => {
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
      
      const breakfast = recipesStore.add({
        name: 'Chicken Breakfast',
        ingredients: [{ ingredientId: chicken.id, grams: 100 }],
      });
      
      const lunch = recipesStore.add({
        name: 'Rice Lunch',
        ingredients: [{ ingredientId: rice.id, grams: 200 }],
      });
      
      weekPlanStore.assignMeal('monday', 'breakfast', breakfast.id, templateId);
      weekPlanStore.assignMeal('monday', 'lunch', lunch.id, templateId);
      
      expect(weekPlanStore.getDailyCalories('monday', templateId)).toBe(425); // 165 + 260
    });
  });

  describe('getWeeklyAverage', () => {
    it('should return 0 when no meals assigned', () => {
      weekPlanStore.load(templateId);
      expect(weekPlanStore.getWeeklyAverage(templateId)).toBe(0);
    });

    it('should calculate average of days with meals', () => {
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
      
      const recipe = recipesStore.add({
        name: 'Chicken Meal',
        ingredients: [{ ingredientId: ingredient.id, grams: 100 }],
      });
      
      // Only 2 days with meals
      weekPlanStore.assignMeal('monday', 'breakfast', recipe.id, templateId);
      weekPlanStore.assignMeal('tuesday', 'breakfast', recipe.id, templateId);
      
      const average = weekPlanStore.getWeeklyAverage(templateId);
      expect(average).toBe(165); // (165 + 165) / 2
    });
  });

  describe('getWeeklyTotal', () => {
    it('should return 0 when no meals assigned', () => {
      weekPlanStore.load(templateId);
      expect(weekPlanStore.getWeeklyTotal(templateId)).toBe(0);
    });

    it('should sum all daily calories', () => {
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
      
      const recipe = recipesStore.add({
        name: 'Chicken Meal',
        ingredients: [{ ingredientId: ingredient.id, grams: 100 }],
      });
      
      weekPlanStore.assignMeal('monday', 'breakfast', recipe.id, templateId);
      weekPlanStore.assignMeal('tuesday', 'breakfast', recipe.id, templateId);
      weekPlanStore.assignMeal('wednesday', 'breakfast', recipe.id, templateId);
      
      expect(weekPlanStore.getWeeklyTotal(templateId)).toBe(495); // 165 * 3
    });
  });

  describe('template management', () => {
    it('should get and set current template', () => {
      weekPlanStore.setCurrentTemplate(templateId);
      expect(weekPlanStore.getCurrentTemplateId()).toBe(templateId);
    });

    it('should return null when no template set', () => {
      weekPlanStore.setAll({}, null);
      expect(weekPlanStore.getCurrentTemplateId()).toBeNull();
    });

    it('should work with multiple templates', () => {
      const template1 = 'template-1';
      const template2 = 'template-2';
      
      weekPlanStore.assignMeal('monday', 'breakfast', 'recipe-1', template1);
      weekPlanStore.assignMeal('monday', 'lunch', 'recipe-2', template2);
      
      const plan1 = weekPlanStore.getWeekPlan(template1);
      const plan2 = weekPlanStore.getWeekPlan(template2);
      
      expect(plan1.monday.breakfast).toBe('recipe-1');
      expect(plan2.monday.lunch).toBe('recipe-2');
    });
  });

  describe('removeRecipeFromPlans', () => {
    it('should remove recipe from all plans and days', () => {
      const ingredient = ingredientsStore.add({ name: 'Chicken', kcalPer100g: 165 });
      const recipe = recipesStore.add({
        name: 'Chicken Recipe',
        ingredients: [{ ingredientId: ingredient.id, grams: 100 }],
      });
      
      weekPlanStore.assignMeal('monday', 'breakfast', recipe.id, templateId);
      weekPlanStore.assignMeal('tuesday', 'dinner', recipe.id, templateId);
      
      weekPlanStore.removeRecipeFromPlans(recipe.id);
      
      const plan = weekPlanStore.getWeekPlan(templateId);
      expect(plan.monday.breakfast).toBeNull();
      expect(plan.tuesday.dinner).toBeNull();
    });
  });

  describe('getDayMeals', () => {
    it('should return meals for specific day', () => {
      weekPlanStore.assignMeal('monday', 'breakfast', 'recipe-1', templateId);
      weekPlanStore.assignMeal('monday', 'lunch', 'recipe-2', templateId);
      
      const meals = weekPlanStore.getDayMeals('monday', templateId);
      expect(meals.breakfast).toBe('recipe-1');
      expect(meals.lunch).toBe('recipe-2');
      expect(meals.snack).toBeNull();
      expect(meals.dinner).toBeNull();
    });

    it('should return empty meals for non-existent day', () => {
      const meals = weekPlanStore.getDayMeals('monday', templateId);
      expect(meals).toEqual({ breakfast: null, lunch: null, snack: null, dinner: null });
    });
  });

  describe('setAll', () => {
    it('should replace all plans', () => {
      weekPlanStore.assignMeal('monday', 'breakfast', 'recipe-1', templateId);
      
      weekPlanStore.setAll({
        'new-template': {
          monday: { breakfast: 'recipe-2', lunch: null, snack: null, dinner: null },
          tuesday: { breakfast: null, lunch: null, snack: null, dinner: null },
          wednesday: { breakfast: null, lunch: null, snack: null, dinner: null },
          thursday: { breakfast: null, lunch: null, snack: null, dinner: null },
          friday: { breakfast: null, lunch: null, snack: null, dinner: null },
          saturday: { breakfast: null, lunch: null, snack: null, dinner: null },
          sunday: { breakfast: null, lunch: null, snack: null, dinner: null },
        },
      }, 'new-template');
      
      const plan = weekPlanStore.getWeekPlan('new-template');
      expect(plan.monday.breakfast).toBe('recipe-2');
      
      // Old template should not exist
      const oldPlan = weekPlanStore.getWeekPlan(templateId);
      expect(oldPlan.monday.breakfast).toBeNull();
    });
  });
});
