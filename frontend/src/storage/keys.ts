/**
 * Storage keys configuration
 * Centralized storage key management
 */

export const STORAGE_KEYS = {
  INGREDIENTS: 'mp_ingredients_v1',
  RECIPES: 'mp_dishes_v3',
  WEEK_PLANS: 'mp_week_plans_v1',
  DIET_PROFILE: 'mp_diet_v3',
  DIET_TEMPLATES: 'mp_diet_templates_v1',
  PATIENTS: 'mp_patients_v1',
  PATIENT_METRICS: 'mp_patient_metrics_v1',
  PATIENT_CONDITIONS: 'mp_patient_conditions_v1',
  PATIENT_PLANS: 'mp_patient_plans_v1',
  PATIENT_PROGRESS: 'mp_patient_progress_v1',
} as const;

export type StorageKey = keyof typeof STORAGE_KEYS;
