// Data models for the application

import type {
  Category,
  MealType,
  Day,
  Gender,
  ActivityLevel,
  ConditionType,
  ConditionSeverity,
  PlanStatus,
  DietGoal,
  Unit,
} from './enums';

// ============================================
// Ingredient Models
// ============================================

export interface Ingredient {
  id: string;
  name: string;
  category: Category;
  unit: Unit;
  createdAt: string;
  updatedAt: string;
  // Basic macros (per 100g)
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  saturatedFatPer100g: number;
  polyunsaturatedFatPer100g: number;
  monounsaturatedFatPer100g: number;
  sugarPer100g: number;
  fiberPer100g: number;
  cholesterolPer100g: number;
  sodiumPer100g: number;
  // Vitamins (mg or mcg per 100g)
  vitaminAPer100g: number;
  vitaminB1Per100g: number;
  vitaminB2Per100g: number;
  vitaminB3Per100g: number;
  vitaminB5Per100g: number;
  vitaminB6Per100g: number;
  vitaminB9Per100g: number;
  vitaminB12Per100g: number;
  vitaminCPer100g: number;
  vitaminDPer100g: number;
  vitaminEPer100g: number;
  vitaminKPer100g: number;
  // Minerals (mg per 100g)
  magnesiumPer100g: number;
  calciumPer100g: number;
  phosphorusPer100g: number;
  potassiumPer100g: number;
  ironPer100g: number;
  seleniumPer100g: number;
  zincPer100g: number;
  manganesePer100g: number;
  copperPer100g: number;
}

export interface IngredientInput {
  name: string;
  category?: Category;
  unit?: Unit;
  kcalPer100g: number;
  proteinPer100g?: number;
  carbsPer100g?: number;
  fatPer100g?: number;
  saturatedFatPer100g?: number;
  polyunsaturatedFatPer100g?: number;
  monounsaturatedFatPer100g?: number;
  sugarPer100g?: number;
  fiberPer100g?: number;
  cholesterolPer100g?: number;
  sodiumPer100g?: number;
  vitaminAPer100g?: number;
  vitaminB1Per100g?: number;
  vitaminB2Per100g?: number;
  vitaminB3Per100g?: number;
  vitaminB5Per100g?: number;
  vitaminB6Per100g?: number;
  vitaminB9Per100g?: number;
  vitaminB12Per100g?: number;
  vitaminCPer100g?: number;
  vitaminDPer100g?: number;
  vitaminEPer100g?: number;
  vitaminKPer100g?: number;
  magnesiumPer100g?: number;
  calciumPer100g?: number;
  phosphorusPer100g?: number;
  potassiumPer100g?: number;
  ironPer100g?: number;
  seleniumPer100g?: number;
  zincPer100g?: number;
  manganesePer100g?: number;
  copperPer100g?: number;
}

// ============================================
// Recipe Models
// ============================================

export interface RecipeIngredient {
  ingredientId: string;
  grams: number;
}

export interface NutritionInfo {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  saturatedFat: number;
  sugar: number;
  fiber: number;
}

export interface Recipe {
  id: string;
  name: string;
  category: Category;
  ingredients: RecipeIngredient[];
  instructions: string;
  nutrition: NutritionInfo;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeInput {
  name: string;
  category?: Category;
  ingredients: RecipeIngredient[];
  instructions?: string;
  notes?: string;
}

// ============================================
// Week Plan Models
// ============================================

export interface DayMeals {
  breakfast: string | null;
  lunch: string | null;
  snack: string | null;
  dinner: string | null;
}

export type WeekPlan = Record<Day, DayMeals>;

export interface WeekPlans {
  [templateId: string]: WeekPlan;
}

// ============================================
// Diet Models
// ============================================

export interface MealDistribution {
  breakfast: number;
  lunch: number;
  snack: number;
  dinner: number;
}

export interface DietProfile {
  goal: DietGoal;
  dailyTarget: number;
}

export interface DietTemplate {
  id: string;
  name: string;
  description: string;
  goal: DietGoal;
  dailyTarget: number;
  mealDistribution: MealDistribution;
  isDefault: boolean;
  createdAt?: string;
}

export interface DietTemplateInput {
  name: string;
  description?: string;
  goal?: DietGoal;
  dailyTarget?: number;
  mealDistribution?: MealDistribution;
}

// ============================================
// Patient Models
// ============================================

export interface Address {
  street: string;
  city: string;
  zipCode: string;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relation: string;
}

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;
  address: Address;
  emergencyContact: EmergencyContact;
  notes: string;
  photo: string | null;
  status: 'active';
  createdAt: string;
  updatedAt: string;
}

export interface PatientInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: Gender;
  address?: Partial<Address>;
  emergencyContact?: Partial<EmergencyContact>;
  notes?: string;
}

// ============================================
// Patient Metrics Models
// ============================================

export interface BMICategory {
  category: 'underweight' | 'normal' | 'overweight' | 'obese';
}

export interface PatientMetric {
  id: string;
  patientId: string;
  date: string;
  weight: number | null;
  height: number | null;
  bmi: number | null;
  bmiCategory: string | null;
  bodyFat: number | null;
  muscleMass: number | null;
  waist: number | null;
  chest: number | null;
  hips: number | null;
  activityLevel: ActivityLevel;
  notes: string;
  createdAt: string;
}

export interface PatientMetricInput {
  date?: string;
  weight?: number;
  height?: number;
  bodyFat?: number;
  muscleMass?: number;
  waist?: number;
  chest?: number;
  hips?: number;
  activityLevel?: ActivityLevel;
  notes?: string;
}

// ============================================
// Patient Condition Models
// ============================================

export interface PatientCondition {
  id: string;
  patientId: string;
  type: ConditionType;
  name: string;
  severity: ConditionSeverity;
  description: string;
  dietaryNotes: string;
  medications: string;
  createdAt: string;
}

export interface PatientConditionInput {
  type?: ConditionType;
  name: string;
  severity?: ConditionSeverity;
  description?: string;
  dietaryNotes?: string;
  medications?: string;
}

// ============================================
// Patient Plan Models
// ============================================

export interface PatientPlan {
  id: string;
  patientId: string;
  name: string;
  dietGoal: DietGoal;
  dailyTarget: number;
  startDate: string;
  endDate: string | null;
  weekPlan: WeekPlan;
  notes: string;
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
}

export interface PatientPlanInput {
  name: string;
  dietGoal?: DietGoal;
  dailyTarget?: number;
  startDate?: string;
  endDate?: string;
  weekPlan?: WeekPlan;
  notes?: string;
  status?: PlanStatus;
}

// ============================================
// Patient Progress Models
// ============================================

export interface PatientProgress {
  id: string;
  patientId: string;
  date: string;
  weight: number | null;
  adherence: number;
  energyLevel: number;
  sleepQuality: number;
  mood: number;
  symptoms: string[];
  notes: string;
  createdAt: string;
}

export interface PatientProgressInput {
  date?: string;
  weight?: number;
  adherence?: number;
  energyLevel?: number;
  sleepQuality?: number;
  mood?: number;
  symptoms?: string[];
  notes?: string;
}

// ============================================
// Shopping List Models
// ============================================

export interface ShoppingItem {
  ingredientId: string;
  name: string;
  category: Category;
  grams: number;
  kcalPer100g: number;
}

// ============================================
// Import/Export Models
// ============================================

export interface ImportResult {
  imported: unknown[];
  skipped: { name: string; error: string }[];
  errors: { name: string; error: string }[];
}

export interface ExportData {
  version: string;
  exportedAt: string;
  ingredients: Ingredient[];
  recipes: Recipe[];
  weekPlans: WeekPlans;
  currentTemplateId: string | null;
  dietProfile: DietProfile;
  dietTemplates: DietTemplate[];
  patients: Patient[];
  patientMetrics: PatientMetric[];
  patientConditions: PatientCondition[];
  patientPlans: PatientPlan[];
  patientProgress: PatientProgress[];
}

export interface PatientExportData {
  patient: Patient;
  metrics: PatientMetric[];
  conditions: PatientCondition[];
  plans: PatientPlan[];
  progress: PatientProgress[];
}

// ============================================
// Utility Types
// ============================================

export interface PatientContext {
  patient: Patient;
  activePlan: PatientPlan | null;
  conditions: PatientCondition[];
  allergies: string[];
  dietaryNotes: string[];
  latestMetrics: PatientMetric | null;
  targetCalories: number;
  goal: DietGoal;
}

export interface AllergenCheck {
  hasAllergens: boolean;
  allergens: string[];
}
