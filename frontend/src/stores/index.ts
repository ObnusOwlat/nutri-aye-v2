// Stores barrel export
export { ingredientsStore, createIngredientsStore } from './ingredients-store';
export { recipesStore, createRecipesStore, calculateRecipeNutrition } from './recipes-store';
export { weekPlanStore, createWeekPlanStore, initializeEmptyWeekPlan } from './week-plan-store';
export { dietStore, createDietStore, getDefaultDietTemplates } from './diet-store';
export { 
  patientsStore, 
  createPatientsStore,
  calculateAge,
  calculateBMI,
  getBMICategory 
} from './patients-store';
