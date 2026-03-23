// Enums and constants for the application

export const VALID_CATEGORIES = ['protein', 'carbs', 'fats', 'vegetables', 'mixed'] as const;
export type Category = typeof VALID_CATEGORIES[number];

export const VALID_MEAL_TYPES = ['breakfast', 'lunch', 'snack', 'dinner'] as const;
export type MealType = typeof VALID_MEAL_TYPES[number];

export const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
export type Day = typeof DAYS[number];

export const GENDERS = ['male', 'female', 'other'] as const;
export type Gender = typeof GENDERS[number];

export const ACTIVITY_LEVELS = ['sedentary', 'light', 'moderate', 'active', 'very_active'] as const;
export type ActivityLevel = typeof ACTIVITY_LEVELS[number];

export const CONDITION_TYPES = ['condition', 'allergy', 'intolerance', 'medication'] as const;
export type ConditionType = typeof CONDITION_TYPES[number];

export const CONDITION_SEVERITIES = ['mild', 'moderate', 'severe'] as const;
export type ConditionSeverity = typeof CONDITION_SEVERITIES[number];

export const PLAN_STATUSES = ['active', 'completed', 'cancelled'] as const;
export type PlanStatus = typeof PLAN_STATUSES[number];

export const DIET_GOALS = ['maintenance', 'deficit', 'bulking', 'performance'] as const;
export type DietGoal = typeof DIET_GOALS[number];

export const UNITS = ['g', 'oz'] as const;
export type Unit = typeof UNITS[number];
