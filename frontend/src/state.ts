/**
 * State - Main application state orchestrator
 * 
 * Initializes and coordinates all stores, providing a unified API
 * that maintains backward compatibility with the original State module.
 */

import { events, EventNames } from './events';
import { ingredientsStore } from './stores/ingredients-store';
import { recipesStore } from './stores/recipes-store';
import { weekPlanStore } from './stores/week-plan-store';
import { dietStore, getDefaultDietTemplates } from './stores/diet-store';
import { patientsStore } from './stores/patients-store';
import type {
  Ingredient,
  Recipe,
  Patient,
  PatientMetric,
  PatientCondition,
  PatientPlan,
  PatientProgress,
  ExportData,
  PatientExportData,
} from './types';

/**
 * Initialize all stores and return unified API
 */
export function createState() {
  // Load all stores
  ingredientsStore.load();
  recipesStore.load();
  
  // Get templates to set current template
  const templates = dietStore.getTemplates();
  const currentTemplateId = templates.length > 0 ? templates[0].id : null;
  weekPlanStore.load(currentTemplateId);
  
  dietStore.load();
  patientsStore.load();

  // ==========================================
  // Export / Import
  // ==========================================

  const exportData = (): ExportData => ({
    version: '3.0',
    exportedAt: new Date().toISOString(),
    ingredients: ingredientsStore.getAll(),
    recipes: recipesStore.getAll(),
    weekPlans: {},
    currentTemplateId: weekPlanStore.getCurrentTemplateId(),
    dietProfile: dietStore.getProfile(),
    dietTemplates: dietStore.getTemplates(),
    patients: patientsStore.getPatients(),
    patientMetrics: [],
    patientConditions: [],
    patientPlans: [],
    patientProgress: [],
  });

  const exportPatientData = (patientId: string): PatientExportData | null => {
    const patient = patientsStore.getPatient(patientId);
    if (!patient) return null;

    return {
      patient,
      metrics: patientsStore.getPatientMetrics(patientId),
      conditions: patientsStore.getPatientConditions(patientId),
      plans: patientsStore.getPatientPlans(patientId),
      progress: patientsStore.getPatientProgress(patientId),
    };
  };

  const importData = (data: Partial<ExportData>): boolean => {
    try {
      if (data.ingredients) ingredientsStore.setAll(data.ingredients);
      if (data.recipes) recipesStore.setAll(data.recipes);
      if (data.dietProfile || data.dietTemplates) {
        dietStore.setAll(
          data.dietProfile || dietStore.getProfile(),
          data.dietTemplates || dietStore.getTemplates()
        );
      }
      if (data.patients) {
        patientsStore.setAll(
          data.patients,
          data.patientMetrics || [],
          data.patientConditions || [],
          data.patientPlans || [],
          data.patientProgress || []
        );
      }
      
      events.emit(EventNames.DATA_IMPORTED, data);
      return true;
    } catch (error) {
      console.error('[State] Import error:', error);
      return false;
    }
  };

  // ==========================================
  // Initialize
  // ==========================================

  const init = (): void => {
    console.log('[State] Initialized v3.0 (modular)');
    events.emit(EventNames.STATE_READY, null);
  };

  // ==========================================
  // Legacy support - re-export stores as properties
  // ==========================================

  return {
    // Lifecycle
    init,
    
    // Event subscription
    subscribe: events.subscribe.bind(events),
    emit: events.emit.bind(events),
    
    // Enums (for backward compatibility)
    VALID_CATEGORIES: ['protein', 'carbs', 'fats', 'vegetables', 'mixed'] as const,
    VALID_MEAL_TYPES: ['breakfast', 'lunch', 'snack', 'dinner'] as const,
    DAYS: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const,
    GENDERS: ['male', 'female', 'other'] as const,
    ACTIVITY_LEVELS: ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const,
    CONDITION_TYPES: ['condition', 'allergy', 'intolerance', 'medication'] as const,
    CONDITION_SEVERITIES: ['mild', 'moderate', 'severe'] as const,
    PLAN_STATUSES: ['active', 'completed', 'cancelled'] as const,
    DIET_GOALS: ['maintenance', 'deficit', 'bulking', 'performance'] as const,
    
    // Utilities
    calculateAge: patientsStore.calculateAge,
    calculateBMI: patientsStore.calculateBMI,
    getBMICategory: patientsStore.getBMICategory,
    
    // Ingredients (delegates to store)
    getIngredients: ingredientsStore.getAll,
    getIngredient: ingredientsStore.getById,
    addIngredient: ingredientsStore.add,
    updateIngredient: ingredientsStore.update,
    deleteIngredient: ingredientsStore.remove,
    deleteAllIngredients: ingredientsStore.removeAll,
    importIngredients: ingredientsStore.importMany,
    importIngredientsFull: ingredientsStore.importManyFull,
    
    // Recipes (delegates to store)
    getRecipes: recipesStore.getAll,
    getRecipe: recipesStore.getById,
    getRecipesByCategory: recipesStore.getByCategory,
    calculateRecipeNutrition: recipesStore.calculateNutrition,
    addRecipe: recipesStore.add,
    updateRecipe: recipesStore.update,
    deleteRecipe: (id: string) => {
      const result = recipesStore.remove(id);
      if (result) {
        weekPlanStore.removeRecipeFromPlans(id);
      }
      return result;
    },
    
    // Week Plan (delegates to store)
    getWeekPlan: weekPlanStore.getWeekPlan,
    getDayMeals: weekPlanStore.getDayMeals,
    assignMeal: weekPlanStore.assignMeal,
    removeMeal: weekPlanStore.removeMeal,
    clearWeekPlan: weekPlanStore.clearWeekPlan,
    getDailyCalories: weekPlanStore.getDailyCalories,
    getWeeklyAverage: weekPlanStore.getWeeklyAverage,
    getWeeklyTotal: weekPlanStore.getWeeklyTotal,
    setCurrentTemplate: weekPlanStore.setCurrentTemplate,
    getCurrentTemplateId: weekPlanStore.getCurrentTemplateId,
    
    // Diet (delegates to store)
    getDietProfile: dietStore.getProfile,
    updateDietProfile: dietStore.updateProfile,
    generateShoppingList: dietStore.generateShoppingList,
    getDietTemplates: dietStore.getTemplates,
    getDietTemplate: dietStore.getTemplate,
    addDietTemplate: dietStore.addTemplate,
    updateDietTemplate: dietStore.updateTemplate,
    deleteDietTemplate: dietStore.deleteTemplate,
    applyDietTemplate: dietStore.applyTemplate,
    
    // Patients (delegates to store)
    getPatients: patientsStore.getPatients,
    getPatient: patientsStore.getPatient,
    searchPatients: patientsStore.searchPatients,
    findPatientByEmail: patientsStore.findByEmail,
    addPatient: patientsStore.addPatient,
    updatePatient: patientsStore.updatePatient,
    deletePatient: patientsStore.deletePatient,
    
    // Patient Metrics
    getPatientMetrics: patientsStore.getPatientMetrics,
    getLatestMetrics: patientsStore.getLatestMetrics,
    addPatientMetric: patientsStore.addPatientMetric,
    deletePatientMetric: patientsStore.deletePatientMetric,
    
    // Patient Conditions
    getPatientConditions: patientsStore.getPatientConditions,
    addPatientCondition: patientsStore.addPatientCondition,
    updatePatientCondition: patientsStore.updatePatientCondition,
    deletePatientCondition: patientsStore.deletePatientCondition,
    getAllergies: patientsStore.getAllergies,
    
    // Patient Plans
    getPatientPlans: patientsStore.getPatientPlans,
    getActivePlan: patientsStore.getActivePlan,
    addPatientPlan: patientsStore.addPatientPlan,
    updatePatientPlan: patientsStore.updatePatientPlan,
    deletePatientPlan: patientsStore.deletePatientPlan,
    getPatientDailyCalories: patientsStore.getPatientDailyCalories,
    
    // Patient Progress
    getPatientProgress: patientsStore.getPatientProgress,
    addPatientProgress: patientsStore.addPatientProgress,
    updatePatientProgress: patientsStore.updatePatientProgress,
    deletePatientProgress: patientsStore.deletePatientProgress,
    
    // Planner Helpers
    getPatientContext: patientsStore.getPatientContext,
    checkRecipeAllergens: patientsStore.checkRecipeAllergens,
    savePlannerToPatient: patientsStore.savePlannerToPatient,
    
    // Export/Import
    exportData,
    exportPatientData,
    importData,
  };
}

// Export singleton
export const State = createState();
