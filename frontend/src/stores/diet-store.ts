/**
 * Diet Store - Diet profiles and templates
 * 
 * Manages diet profiles, templates, and shopping list generation.
 */

import { v4 as uuidv4 } from 'uuid';
import { storage, STORAGE_KEYS } from '../storage';
import { events, EventNames } from '../events';
import { ingredientsStore } from './ingredients-store';
import { recipesStore } from './recipes-store';
import { weekPlanStore } from './week-plan-store';
import {
  DIET_GOALS,
  type DietProfile,
  type DietTemplate,
  type DietTemplateInput,
  type MealDistribution,
  type ShoppingItem,
} from '../types';

const DEFAULT_MEAL_DISTRIBUTION: MealDistribution = {
  breakfast: 25,
  lunch: 35,
  snack: 10,
  dinner: 30,
};

/**
 * Get default diet templates
 */
export function getDefaultDietTemplates(): DietTemplate[] {
  return [
    {
      id: 'tpl_maintenance',
      name: 'Maintenance',
      description: 'Calorias de mantenimiento',
      goal: 'maintenance',
      dailyTarget: 2000,
      mealDistribution: DEFAULT_MEAL_DISTRIBUTION,
      isDefault: true,
    },
    {
      id: 'tpl_deficit',
      name: 'Deficit 500',
      description: 'Deficit de 500 kcal para perdida de peso',
      goal: 'deficit',
      dailyTarget: 1500,
      mealDistribution: DEFAULT_MEAL_DISTRIBUTION,
      isDefault: true,
    },
    {
      id: 'tpl_deficit_800',
      name: 'Deficit 800',
      description: 'Deficit agresivo de 800 kcal',
      goal: 'deficit',
      dailyTarget: 1200,
      mealDistribution: DEFAULT_MEAL_DISTRIBUTION,
      isDefault: true,
    },
    {
      id: 'tpl_bulking',
      name: 'Bulking',
      description: 'Superavit calorico para ganar masa muscular',
      goal: 'bulking',
      dailyTarget: 3000,
      mealDistribution: { breakfast: 25, lunch: 35, snack: 15, dinner: 25 },
      isDefault: true,
    },
    {
      id: 'tpl_performance',
      name: 'Performance',
      description: 'Optimizado para rendimiento deportivo',
      goal: 'performance',
      dailyTarget: 2800,
      mealDistribution: { breakfast: 30, lunch: 30, snack: 15, dinner: 25 },
      isDefault: true,
    },
  ];
}

/**
 * Create a diet store instance
 */
export function createDietStore() {
  // Private state
  let dietProfile: DietProfile = { goal: 'maintenance', dailyTarget: 2000 };
  let dietTemplates: DietTemplate[] = getDefaultDietTemplates();

  // ==========================================
  // Public API
  // ==========================================

  const load = (): void => {
    const profile = storage.load<DietProfile>(STORAGE_KEYS.DIET_PROFILE);
    const templates = storage.load<DietTemplate[]>(STORAGE_KEYS.DIET_TEMPLATES);
    
    dietProfile = profile || { goal: 'maintenance', dailyTarget: 2000 };
    dietTemplates = templates || getDefaultDietTemplates();
  };

  const getProfile = (): DietProfile => ({ ...dietProfile });

  const updateProfile = (data: Partial<DietProfile>): DietProfile => {
    dietProfile = { ...dietProfile, ...data };
    storage.save(STORAGE_KEYS.DIET_PROFILE, dietProfile);
    events.emit(EventNames.DIET_PROFILE_UPDATED, dietProfile);
    return dietProfile;
  };

  const getTemplates = (): DietTemplate[] => [...dietTemplates];

  const getTemplate = (id: string): DietTemplate | undefined => 
    dietTemplates.find(t => t.id === id);

  const addTemplate = (data: DietTemplateInput): DietTemplate => {
    const template: DietTemplate = {
      id: uuidv4(),
      name: data.name.trim(),
      description: data.description || '',
      goal: data.goal && DIET_GOALS.includes(data.goal) ? data.goal : 'maintenance',
      dailyTarget: Math.max(800, Math.min(10000, parseInt(String(data.dailyTarget)) || 2000)),
      mealDistribution: data.mealDistribution || DEFAULT_MEAL_DISTRIBUTION,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };

    dietTemplates.push(template);
    storage.save(STORAGE_KEYS.DIET_TEMPLATES, dietTemplates);
    events.emit(EventNames.DIET_TEMPLATES_UPDATED, dietTemplates);
    return template;
  };

  const updateTemplate = (id: string, data: Partial<DietTemplateInput>): DietTemplate | null => {
    const idx = dietTemplates.findIndex(t => t.id === id);
    if (idx === -1) return null;

    dietTemplates[idx] = {
      ...dietTemplates[idx],
      name: data.name?.trim() || dietTemplates[idx].name,
      description: data.description !== undefined ? data.description : dietTemplates[idx].description,
      goal: data.goal && DIET_GOALS.includes(data.goal) ? data.goal : dietTemplates[idx].goal,
      dailyTarget: data.dailyTarget 
        ? Math.max(800, Math.min(10000, parseInt(String(data.dailyTarget)) || 2000)) 
        : dietTemplates[idx].dailyTarget,
      mealDistribution: data.mealDistribution || dietTemplates[idx].mealDistribution,
    };

    storage.save(STORAGE_KEYS.DIET_TEMPLATES, dietTemplates);
    events.emit(EventNames.DIET_TEMPLATES_UPDATED, dietTemplates);
    return dietTemplates[idx];
  };

  const deleteTemplate = (id: string): boolean => {
    const idx = dietTemplates.findIndex(t => t.id === id);
    if (idx === -1 || dietTemplates[idx].isDefault) return false;

    dietTemplates.splice(idx, 1);
    storage.save(STORAGE_KEYS.DIET_TEMPLATES, dietTemplates);
    events.emit(EventNames.DIET_TEMPLATES_UPDATED, dietTemplates);
    return true;
  };

  const applyTemplate = (templateId: string): boolean => {
    const template = getTemplate(templateId);
    if (!template) return false;

    updateProfile({
      goal: template.goal,
      dailyTarget: template.dailyTarget,
    });
    return true;
  };

  const generateShoppingList = (templateId?: string): ShoppingItem[] => {
    const weekPlan = weekPlanStore.getWeekPlan(templateId);
    const map = new Map<string, ShoppingItem>();

    for (const dayMeals of Object.values(weekPlan)) {
      for (const recipeId of Object.values(dayMeals)) {
        if (!recipeId) continue;

        const recipe = recipesStore.getById(recipeId);
        if (!recipe) continue;

        for (const ri of recipe.ingredients) {
          const ing = ingredientsStore.getById(ri.ingredientId);
          if (!ing) continue;

          if (map.has(ri.ingredientId)) {
            map.get(ri.ingredientId)!.grams += ri.grams;
          } else {
            map.set(ri.ingredientId, {
              ingredientId: ri.ingredientId,
              name: ing.name,
              category: ing.category,
              grams: ri.grams,
              kcalPer100g: ing.kcalPer100g,
            });
          }
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => 
      a.category.localeCompare(b.category) || a.name.localeCompare(b.name)
    );
  };

  const setAll = (profile: DietProfile, templates: DietTemplate[]): void => {
    dietProfile = profile;
    dietTemplates = templates;
    storage.saveImmediate(STORAGE_KEYS.DIET_PROFILE, dietProfile);
    storage.saveImmediate(STORAGE_KEYS.DIET_TEMPLATES, dietTemplates);
    events.emit(EventNames.DIET_PROFILE_UPDATED, dietProfile);
    events.emit(EventNames.DIET_TEMPLATES_UPDATED, dietTemplates);
  };

  // Public API
  return {
    load,
    getProfile,
    updateProfile,
    getTemplates,
    getTemplate,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    applyTemplate,
    generateShoppingList,
    setAll,
    getDefaultTemplates: getDefaultDietTemplates,
  };
}

// Export singleton instance
export const dietStore = createDietStore();
