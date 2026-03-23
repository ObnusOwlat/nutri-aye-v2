/**
 * Week Plan Store - Weekly meal planning
 * 
 * Manages meal assignments across days and templates.
 */

import { storage, STORAGE_KEYS } from '../storage';
import { events, EventNames } from '../events';
import { recipesStore } from './recipes-store';
import { VALID_MEAL_TYPES, DAYS, type Day, type MealType, type DayMeals, type WeekPlan, type WeekPlans } from '../types';

/**
 * Create an empty week plan structure
 */
export function initializeEmptyWeekPlan(): WeekPlan {
  const plan: WeekPlan = {} as WeekPlan;
  for (const day of DAYS) {
    plan[day] = { breakfast: null, lunch: null, snack: null, dinner: null };
  }
  return plan;
}

/**
 * Create a week plan store instance
 */
export function createWeekPlanStore() {
  // Private state
  let weekPlans: WeekPlans = {};
  let currentTemplateId: string | null = null;

  // ==========================================
  // Public API
  // ==========================================

  const load = (templateId: string | null): void => {
    const data = storage.load<WeekPlans>(STORAGE_KEYS.WEEK_PLANS);
    weekPlans = data || {};
    currentTemplateId = templateId;
  };

  const getWeekPlan = (templateId?: string): WeekPlan => {
    const id = templateId || currentTemplateId;
    if (!id) return initializeEmptyWeekPlan();
    return { ...(weekPlans[id] || initializeEmptyWeekPlan()) };
  };

  const getDayMeals = (day: Day, templateId?: string): DayMeals => {
    const id = templateId || currentTemplateId;
    if (!id) return { breakfast: null, lunch: null, snack: null, dinner: null };
    return { ...(weekPlans[id]?.[day] || { breakfast: null, lunch: null, snack: null, dinner: null }) };
  };

  const assignMeal = (day: Day, mealType: MealType, recipeId: string | null, templateId?: string): boolean => {
    const id = templateId || currentTemplateId;
    if (!id || !VALID_MEAL_TYPES.includes(mealType)) return false;
    
    if (!weekPlans[id]) {
      weekPlans[id] = initializeEmptyWeekPlan();
    }
    if (!weekPlans[id][day]) {
      weekPlans[id][day] = { breakfast: null, lunch: null, snack: null, dinner: null };
    }
    
    weekPlans[id][day][mealType] = recipeId;
    storage.save(STORAGE_KEYS.WEEK_PLANS, weekPlans);
    events.emit(EventNames.WEEK_PLAN_UPDATED, { templateId: id, weekPlan: weekPlans[id] });
    return true;
  };

  const removeMeal = (day: Day, mealType: MealType, templateId?: string): boolean => {
    return assignMeal(day, mealType, null, templateId);
  };

  const clearWeekPlan = (templateId?: string): void => {
    const id = templateId || currentTemplateId;
    if (!id) return;
    weekPlans[id] = initializeEmptyWeekPlan();
    storage.save(STORAGE_KEYS.WEEK_PLANS, weekPlans);
    events.emit(EventNames.WEEK_PLAN_UPDATED, { templateId: id, weekPlan: weekPlans[id] });
  };

  const getDailyCalories = (day: Day, templateId?: string): number => {
    const id = templateId || currentTemplateId;
    const meals = id ? weekPlans[id]?.[day] : null;
    if (!meals) return 0;

    let total = 0;
    for (const recipeId of Object.values(meals)) {
      if (recipeId) {
        const recipe = recipesStore.getById(recipeId);
        if (recipe) total += recipe.nutrition.calories;
      }
    }
    return Math.round(total);
  };

  const getWeeklyAverage = (templateId?: string): number => {
    let total = 0;
    let count = 0;
    for (const day of DAYS) {
      const cal = getDailyCalories(day, templateId);
      if (cal > 0) { total += cal; count++; }
    }
    return count > 0 ? Math.round(total / count) : 0;
  };

  const getWeeklyTotal = (templateId?: string): number => {
    return DAYS.reduce((sum, day) => sum + getDailyCalories(day, templateId), 0);
  };

  const getCurrentTemplateId = (): string | null => currentTemplateId;

  const setCurrentTemplate = (templateId: string | null): void => {
    currentTemplateId = templateId;
  };

  const removeRecipeFromPlans = (recipeId: string): void => {
    for (const plan of Object.values(weekPlans)) {
      for (const day of Object.values(plan)) {
        for (const mealType of VALID_MEAL_TYPES) {
          if (day[mealType] === recipeId) {
            day[mealType] = null;
          }
        }
      }
    }
    storage.save(STORAGE_KEYS.WEEK_PLANS, weekPlans);
  };

  const setAll = (plans: WeekPlans, templateId: string | null): void => {
    weekPlans = plans;
    currentTemplateId = templateId;
    storage.saveImmediate(STORAGE_KEYS.WEEK_PLANS, weekPlans);
  };

  // Public API
  return {
    load,
    getWeekPlan,
    getDayMeals,
    assignMeal,
    removeMeal,
    clearWeekPlan,
    getDailyCalories,
    getWeeklyAverage,
    getWeeklyTotal,
    getCurrentTemplateId,
    setCurrentTemplate,
    removeRecipeFromPlans,
    setAll,
  };
}

// Export singleton instance
export const weekPlanStore = createWeekPlanStore();
