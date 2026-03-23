/**
 * Patients Store - Patient management with metrics, conditions, plans, and progress
 * 
 * Comprehensive patient management including:
 * - Patient profiles
 * - Body metrics tracking
 * - Medical conditions and allergies
 * - Meal plans
 * - Progress tracking
 */

import { v4 as uuidv4 } from 'uuid';
import { storage, STORAGE_KEYS } from '../storage';
import { events, EventNames } from '../events';
import { weekPlanStore } from './week-plan-store';
import {
  GENDERS,
  ACTIVITY_LEVELS,
  CONDITION_TYPES,
  CONDITION_SEVERITIES,
  PLAN_STATUSES,
  DIET_GOALS,
  type Patient,
  type PatientInput,
  type PatientMetric,
  type PatientMetricInput,
  type PatientCondition,
  type PatientConditionInput,
  type PatientPlan,
  type PatientPlanInput,
  type PatientProgress,
  type PatientProgressInput,
  type PatientContext,
  type AllergenCheck,
} from '../types';

// Validation helpers
const clamp = (val: number, min: number, max: number): number => 
  Math.max(min, Math.min(max, val));

const getTimestamp = (): string => new Date().toISOString();

/**
 * Pure function to calculate age from date of birth
 */
export function calculateAge(dob: string | null): number | null {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/**
 * Pure function to calculate BMI
 */
export function calculateBMI(weight: number, height: number): number | null {
  if (!weight || !height) return null;
  return weight / Math.pow(height / 100, 2);
}

/**
 * Pure function to get BMI category
 */
export function getBMICategory(bmi: number): 'underweight' | 'normal' | 'overweight' | 'obese' {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

/**
 * Create a patients store instance
 */
export function createPatientsStore() {
  // Private state
  let patients: Patient[] = [];
  let patientMetrics: PatientMetric[] = [];
  let patientConditions: PatientCondition[] = [];
  let patientPlans: PatientPlan[] = [];
  let patientProgress: PatientProgress[] = [];

  // Lookups
  const patientMap = new Map<string, Patient>();
  const metricsMap = new Map<string, PatientMetric[]>();
  const conditionsMap = new Map<string, PatientCondition[]>();
  const plansMap = new Map<string, PatientPlan[]>();
  const progressMap = new Map<string, PatientProgress[]>();

  // ==========================================
  // Private Methods
  // ==========================================

  const rebuildMaps = (): void => {
    patientMap.clear();
    metricsMap.clear();
    conditionsMap.clear();
    plansMap.clear();
    progressMap.clear();

    patients.forEach(p => patientMap.set(p.id, p));

    patientMetrics.forEach(m => {
      if (!metricsMap.has(m.patientId)) metricsMap.set(m.patientId, []);
      metricsMap.get(m.patientId)!.push(m);
    });

    patientConditions.forEach(c => {
      if (!conditionsMap.has(c.patientId)) conditionsMap.set(c.patientId, []);
      conditionsMap.get(c.patientId)!.push(c);
    });

    patientPlans.forEach(p => {
      if (!plansMap.has(p.patientId)) plansMap.set(p.patientId, []);
      plansMap.get(p.patientId)!.push(p);
    });

    patientProgress.forEach(p => {
      if (!progressMap.has(p.patientId)) progressMap.set(p.patientId, []);
      progressMap.get(p.patientId)!.push(p);
    });
  };

  const pick = <T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> => {
    const result = {} as Pick<T, K>;
    for (const key of keys) {
      if (obj[key] !== undefined) result[key] = obj[key];
    }
    return result;
  };

  // ==========================================
  // Patients API
  // ==========================================

  const getPatients = (): Patient[] => [...patients];

  const getPatient = (id: string): Patient | undefined => patientMap.get(id);

  const findByEmail = (email: string): Patient | undefined => {
    if (!email) return undefined;
    return patients.find(p => p.email?.toLowerCase() === email.trim().toLowerCase());
  };

  const searchPatients = (query: string): Patient[] => {
    if (!query || typeof query !== 'string' || !query.trim()) return [...patients];
    const q = query.toLowerCase();
    return patients.filter(p => 
      p.firstName?.toLowerCase().includes(q) || 
      p.lastName?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q) || 
      p.phone?.includes(q)
    );
  };

  const addPatient = (data: PatientInput): Patient => {
    if (!data.firstName?.trim()) throw new Error('First name is required');
    if (!data.lastName?.trim()) throw new Error('Last name is required');
    if (data.email && findByEmail(data.email)) {
      throw new Error('A patient with this email already exists');
    }

    const timestamp = getTimestamp();
    const patient: Patient = {
      id: uuidv4(),
      firstName: data.firstName.trim(),
      lastName: data.lastName.trim(),
      email: data.email?.trim() || null,
      phone: data.phone?.trim() || null,
      dateOfBirth: data.dateOfBirth || null,
      gender: data.gender && GENDERS.includes(data.gender) ? data.gender : null,
      address: {
        street: '',
        city: '',
        zipCode: '',
        ...pick(data.address || {}, ['street', 'city', 'zipCode']),
      },
      emergencyContact: {
        name: '',
        phone: '',
        relation: '',
        ...pick(data.emergencyContact || {}, ['name', 'phone', 'relation']),
      },
      notes: data.notes?.trim() || '',
      photo: null,
      status: 'active',
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    patients.push(patient);
    patientMap.set(patient.id, patient);
    saveAll();
    events.emit(EventNames.PATIENTS_UPDATED, patients);
    events.emit(EventNames.PATIENTS_ADDED, patient);
    return patient;
  };

  const updatePatient = (id: string, data: Partial<PatientInput>): Patient | null => {
    const idx = patients.findIndex(p => p.id === id);
    if (idx === -1) return null;

    if (data.email) {
      const existing = findByEmail(data.email);
      if (existing && existing.id !== id) {
        throw new Error('A patient with this email already exists');
      }
    }

    const orig = patients[idx];
    const updated: Patient = {
      ...orig,
      firstName: data.firstName?.trim() || orig.firstName,
      lastName: data.lastName?.trim() || orig.lastName,
      email: data.email !== undefined ? data.email?.trim() || null : orig.email,
      phone: data.phone !== undefined ? data.phone?.trim() || null : orig.phone,
      dateOfBirth: data.dateOfBirth !== undefined ? data.dateOfBirth : orig.dateOfBirth,
      gender: data.gender && GENDERS.includes(data.gender) ? data.gender : orig.gender,
      address: { ...orig.address, ...pick(data.address || {}, ['street', 'city', 'zipCode']) },
      emergencyContact: { ...orig.emergencyContact, ...pick(data.emergencyContact || {}, ['name', 'phone', 'relation']) },
      notes: data.notes !== undefined ? data.notes?.trim() || '' : orig.notes,
      status: data.status || orig.status,
      updatedAt: getTimestamp(),
    };

    patients[idx] = updated;
    patientMap.set(id, updated);
    saveAll();
    events.emit(EventNames.PATIENTS_UPDATED, patients);
    events.emit(EventNames.PATIENTS_CHANGED, updated);
    return updated;
  };

  const deletePatient = (id: string): boolean => {
    const idx = patients.findIndex(p => p.id === id);
    if (idx === -1) return false;

    patients.splice(idx, 1);
    patientMap.delete(id);
    
    // Cascade delete related data
    patientMetrics = patientMetrics.filter(m => m.patientId !== id);
    patientConditions = patientConditions.filter(c => c.patientId !== id);
    patientPlans = patientPlans.filter(p => p.patientId !== id);
    patientProgress = patientProgress.filter(p => p.patientId !== id);

    saveAll();
    events.emit(EventNames.PATIENTS_UPDATED, patients);
    events.emit(EventNames.PATIENTS_DELETED, { id });
    return true;
  };

  // ==========================================
  // Metrics API
  // ==========================================

  const getPatientMetrics = (patientId: string): PatientMetric[] => {
    const metrics = metricsMap.get(patientId) || [];
    return [...metrics].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const getLatestMetrics = (patientId: string): PatientMetric | undefined => 
    getPatientMetrics(patientId)[0];

  const addPatientMetric = (patientId: string, data: PatientMetricInput): PatientMetric => {
    if (!patientMap.has(patientId)) throw new Error('Patient not found');

    const weight = parseFloat(String(data.weight));
    const height = parseFloat(String(data.height));
    const bmi = calculateBMI(weight, height);

    const metric: PatientMetric = {
      id: uuidv4(),
      patientId,
      date: data.date || new Date().toISOString().split('T')[0],
      weight: isNaN(weight) ? null : weight,
      height: isNaN(height) ? null : height,
      bmi,
      bmiCategory: bmi ? getBMICategory(bmi) : null,
      bodyFat: data.bodyFat !== undefined ? parseFloat(String(data.bodyFat)) : null,
      muscleMass: data.muscleMass !== undefined ? parseFloat(String(data.muscleMass)) : null,
      waist: data.waist !== undefined ? parseFloat(String(data.waist)) : null,
      chest: data.chest !== undefined ? parseFloat(String(data.chest)) : null,
      hips: data.hips !== undefined ? parseFloat(String(data.hips)) : null,
      activityLevel: data.activityLevel && ACTIVITY_LEVELS.includes(data.activityLevel) 
        ? data.activityLevel 
        : 'moderate',
      notes: data.notes?.trim() || '',
      createdAt: getTimestamp(),
    };

    patientMetrics.push(metric);
    if (!metricsMap.has(patientId)) metricsMap.set(patientId, []);
    metricsMap.get(patientId)!.push(metric);
    saveAll();
    events.emit(EventNames.PATIENT_METRICS_UPDATED, { patientId, metrics: getPatientMetrics(patientId) });
    return metric;
  };

  const deletePatientMetric = (id: string): boolean => {
    const idx = patientMetrics.findIndex(m => m.id === id);
    if (idx === -1) return false;

    const metric = patientMetrics.splice(idx, 1)[0];
    const list = metricsMap.get(metric.patientId);
    if (list) {
      const i = list.findIndex(m => m.id === id);
      if (i !== -1) list.splice(i, 1);
    }

    saveAll();
    events.emit(EventNames.PATIENT_METRICS_UPDATED, { patientId: metric.patientId, metrics: getPatientMetrics(metric.patientId) });
    return true;
  };

  // ==========================================
  // Conditions API
  // ==========================================

  const getPatientConditions = (patientId: string): PatientCondition[] => {
    const conditions = conditionsMap.get(patientId) || [];
    return [...conditions].sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  };

  const addPatientCondition = (patientId: string, data: PatientConditionInput): PatientCondition => {
    if (!patientMap.has(patientId)) throw new Error('Patient not found');
    if (!data.name?.trim()) throw new Error('Condition name is required');

    const condition: PatientCondition = {
      id: uuidv4(),
      patientId,
      type: data.type && CONDITION_TYPES.includes(data.type) ? data.type : 'condition',
      name: data.name.trim(),
      severity: data.severity && CONDITION_SEVERITIES.includes(data.severity) ? data.severity : 'moderate',
      description: data.description?.trim() || '',
      dietaryNotes: data.dietaryNotes?.trim() || '',
      medications: data.medications?.trim() || '',
      createdAt: getTimestamp(),
    };

    patientConditions.push(condition);
    if (!conditionsMap.has(patientId)) conditionsMap.set(patientId, []);
    conditionsMap.get(patientId)!.push(condition);
    saveAll();
    events.emit(EventNames.PATIENT_CONDITIONS_UPDATED, { patientId, conditions: getPatientConditions(patientId) });
    return condition;
  };

  const updatePatientCondition = (id: string, data: Partial<PatientConditionInput>): PatientCondition | null => {
    const idx = patientConditions.findIndex(c => c.id === id);
    if (idx === -1) return null;

    const orig = patientConditions[idx];
    const updated: PatientCondition = {
      ...orig,
      type: data.type && CONDITION_TYPES.includes(data.type) ? data.type : orig.type,
      name: data.name?.trim() || orig.name,
      severity: data.severity && CONDITION_SEVERITIES.includes(data.severity) ? data.severity : orig.severity,
      description: data.description !== undefined ? data.description?.trim() || '' : orig.description,
      dietaryNotes: data.dietaryNotes !== undefined ? data.dietaryNotes?.trim() || '' : orig.dietaryNotes,
      medications: data.medications !== undefined ? data.medications?.trim() || '' : orig.medications,
    };

    patientConditions[idx] = updated;
    const list = conditionsMap.get(updated.patientId);
    if (list) {
      const i = list.findIndex(c => c.id === id);
      if (i !== -1) list[i] = updated;
    }

    saveAll();
    events.emit(EventNames.PATIENT_CONDITIONS_UPDATED, { patientId: updated.patientId, conditions: getPatientConditions(updated.patientId) });
    return updated;
  };

  const deletePatientCondition = (id: string): boolean => {
    const idx = patientConditions.findIndex(c => c.id === id);
    if (idx === -1) return false;

    const cond = patientConditions.splice(idx, 1)[0];
    const list = conditionsMap.get(cond.patientId);
    if (list) {
      const i = list.findIndex(c => c.id === id);
      if (i !== -1) list.splice(i, 1);
    }

    saveAll();
    events.emit(EventNames.PATIENT_CONDITIONS_UPDATED, { patientId: cond.patientId, conditions: getPatientConditions(cond.patientId) });
    return true;
  };

  const getAllergies = (patientId: string): PatientCondition[] =>
    getPatientConditions(patientId).filter(c => c.type === 'allergy' || c.type === 'intolerance');

  // ==========================================
  // Plans API
  // ==========================================

  const getPatientPlans = (patientId: string): PatientPlan[] => {
    const plans = plansMap.get(patientId) || [];
    return [...plans].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  };

  const getActivePlan = (patientId: string): PatientPlan | undefined =>
    getPatientPlans(patientId).find(p => p.status === 'active');

  const addPatientPlan = (patientId: string, data: PatientPlanInput): PatientPlan => {
    if (!patientMap.has(patientId)) throw new Error('Patient not found');
    if (!data.name?.trim()) throw new Error('Plan name is required');

    // Complete existing active plan
    const active = getActivePlan(patientId);
    if (active && data.status !== 'completed') {
      updatePatientPlan(active.id, { status: 'completed' });
    }

    const plan: PatientPlan = {
      id: uuidv4(),
      patientId,
      name: data.name.trim(),
      dietGoal: data.dietGoal && DIET_GOALS.includes(data.dietGoal) ? data.dietGoal : 'maintenance',
      dailyTarget: clamp(parseInt(String(data.dailyTarget)) || 2000, 500, 10000),
      startDate: data.startDate || new Date().toISOString().split('T')[0],
      endDate: data.endDate || null,
      weekPlan: data.weekPlan || weekPlanStore.getWeekPlan(),
      notes: data.notes?.trim() || '',
      status: data.status && PLAN_STATUSES.includes(data.status) ? data.status : 'active',
      createdAt: getTimestamp(),
      updatedAt: getTimestamp(),
    };

    patientPlans.push(plan);
    if (!plansMap.has(patientId)) plansMap.set(patientId, []);
    plansMap.get(patientId)!.push(plan);
    saveAll();
    events.emit(EventNames.PATIENT_PLANS_UPDATED, { patientId, plans: getPatientPlans(patientId) });
    return plan;
  };

  const updatePatientPlan = (id: string, data: Partial<PatientPlanInput>): PatientPlan | null => {
    const idx = patientPlans.findIndex(p => p.id === id);
    if (idx === -1) return null;

    const orig = patientPlans[idx];
    const updated: PatientPlan = {
      ...orig,
      name: data.name?.trim() || orig.name,
      dietGoal: data.dietGoal && DIET_GOALS.includes(data.dietGoal) ? data.dietGoal : orig.dietGoal,
      dailyTarget: data.dailyTarget !== undefined 
        ? clamp(parseInt(String(data.dailyTarget)) || 2000, 500, 10000) 
        : orig.dailyTarget,
      startDate: data.startDate !== undefined ? data.startDate : orig.startDate,
      endDate: data.endDate !== undefined ? data.endDate : orig.endDate,
      weekPlan: data.weekPlan || orig.weekPlan,
      notes: data.notes !== undefined ? data.notes?.trim() || '' : orig.notes,
      status: data.status && PLAN_STATUSES.includes(data.status) ? data.status : orig.status,
      updatedAt: getTimestamp(),
    };

    patientPlans[idx] = updated;
    const list = plansMap.get(updated.patientId);
    if (list) {
      const i = list.findIndex(p => p.id === id);
      if (i !== -1) list[i] = updated;
    }

    saveAll();
    events.emit(EventNames.PATIENT_PLANS_UPDATED, { patientId: updated.patientId, plans: getPatientPlans(updated.patientId) });
    return updated;
  };

  const deletePatientPlan = (id: string): boolean => {
    const idx = patientPlans.findIndex(p => p.id === id);
    if (idx === -1) return false;

    const plan = patientPlans.splice(idx, 1)[0];
    const list = plansMap.get(plan.patientId);
    if (list) {
      const i = list.findIndex(p => p.id === id);
      if (i !== -1) list.splice(i, 1);
    }

    saveAll();
    events.emit(EventNames.PATIENT_PLANS_UPDATED, { patientId: plan.patientId, plans: getPatientPlans(plan.patientId) });
    return true;
  };

  const getPatientDailyCalories = (patientId: string, day: string): number => {
    const plan = getActivePlan(patientId);
    if (!plan?.weekPlan?.[day]) return 0;

    let total = 0;
    for (const recipeId of Object.values(plan.weekPlan[day])) {
      if (recipeId) {
        const recipe = recipesStore.getById(recipeId);
        if (recipe) total += recipe.nutrition.calories;
      }
    }
    return Math.round(total);
  };

  // ==========================================
  // Progress API
  // ==========================================

  const getPatientProgress = (patientId: string): PatientProgress[] => {
    const progress = progressMap.get(patientId) || [];
    return [...progress].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  };

  const addPatientProgress = (patientId: string, data: PatientProgressInput): PatientProgress => {
    if (!patientMap.has(patientId)) throw new Error('Patient not found');

    const progress: PatientProgress = {
      id: uuidv4(),
      patientId,
      date: data.date || new Date().toISOString().split('T')[0],
      weight: data.weight !== undefined ? parseFloat(String(data.weight)) : null,
      adherence: clamp(parseInt(String(data.adherence)) || 0, 0, 100),
      energyLevel: clamp(parseInt(String(data.energyLevel)) || 5, 1, 10),
      sleepQuality: clamp(parseInt(String(data.sleepQuality)) || 5, 1, 10),
      mood: clamp(parseInt(String(data.mood)) || 5, 1, 10),
      symptoms: Array.isArray(data.symptoms) ? data.symptoms : [],
      notes: data.notes?.trim() || '',
      createdAt: getTimestamp(),
    };

    patientProgress.push(progress);
    if (!progressMap.has(patientId)) progressMap.set(patientId, []);
    progressMap.get(patientId)!.push(progress);
    saveAll();
    events.emit(EventNames.PATIENT_PROGRESS_UPDATED, { patientId, progress: getPatientProgress(patientId) });
    return progress;
  };

  const updatePatientProgress = (id: string, data: Partial<PatientProgressInput>): PatientProgress | null => {
    const idx = patientProgress.findIndex(p => p.id === id);
    if (idx === -1) return null;

    const orig = patientProgress[idx];
    const updated: PatientProgress = {
      ...orig,
      date: data.date !== undefined ? data.date : orig.date,
      weight: data.weight !== undefined ? parseFloat(String(data.weight)) || null : orig.weight,
      adherence: data.adherence !== undefined ? clamp(parseInt(String(data.adherence)) || 0, 0, 100) : orig.adherence,
      energyLevel: data.energyLevel !== undefined ? clamp(parseInt(String(data.energyLevel)) || 5, 1, 10) : orig.energyLevel,
      sleepQuality: data.sleepQuality !== undefined ? clamp(parseInt(String(data.sleepQuality)) || 5, 1, 10) : orig.sleepQuality,
      mood: data.mood !== undefined ? clamp(parseInt(String(data.mood)) || 5, 1, 10) : orig.mood,
      symptoms: Array.isArray(data.symptoms) ? data.symptoms : orig.symptoms,
      notes: data.notes !== undefined ? data.notes?.trim() || '' : orig.notes,
    };

    patientProgress[idx] = updated;
    const list = progressMap.get(updated.patientId);
    if (list) {
      const i = list.findIndex(p => p.id === id);
      if (i !== -1) list[i] = updated;
    }

    saveAll();
    events.emit(EventNames.PATIENT_PROGRESS_UPDATED, { patientId: updated.patientId, progress: getPatientProgress(updated.patientId) });
    return updated;
  };

  const deletePatientProgress = (id: string): boolean => {
    const idx = patientProgress.findIndex(p => p.id === id);
    if (idx === -1) return false;

    const prog = patientProgress.splice(idx, 1)[0];
    const list = progressMap.get(prog.patientId);
    if (list) {
      const i = list.findIndex(p => p.id === id);
      if (i !== -1) list.splice(i, 1);
    }

    saveAll();
    events.emit(EventNames.PATIENT_PROGRESS_UPDATED, { patientId: prog.patientId, progress: getPatientProgress(prog.patientId) });
    return true;
  };

  // ==========================================
  // Planner Helpers
  // ==========================================

  const getPatientContext = (patientId: string): PatientContext | null => {
    if (!patientId) return null;

    const patient = getPatient(patientId);
    if (!patient) return null;

    const activePlan = getActivePlan(patientId);
    const conditions = getPatientConditions(patientId);
    const latestMetrics = getLatestMetrics(patientId);

    const allergies = conditions
      .filter(c => c.type === 'allergy' || c.type === 'intolerance')
      .map(c => c.name.toLowerCase());

    const dietaryNotes = conditions
      .filter(c => c.dietaryNotes)
      .map(c => c.dietaryNotes);

    return {
      patient,
      activePlan,
      conditions,
      allergies,
      dietaryNotes,
      latestMetrics,
      targetCalories: activePlan?.dailyTarget || 2000,
      goal: activePlan?.dietGoal || 'maintenance',
    };
  };

  const checkRecipeAllergens = (recipeId: string, patientId: string): AllergenCheck => {
    if (!patientId) return { hasAllergens: false, allergens: [] };

    const recipe = recipesStore.getById(recipeId);
    if (!recipe) return { hasAllergens: false, allergens: [] };

    const context = getPatientContext(patientId);
    if (!context || context.allergies.length === 0) {
      return { hasAllergens: false, allergens: [] };
    }

    const recipeText = `${recipe.name} ${recipe.notes || ''}`.toLowerCase();
    const matchedAllergens = context.allergies.filter(allergy =>
      recipeText.includes(allergy) ||
      recipe.ingredients?.some(ing => {
        const ingredient = ingredientsStore.getById(ing.ingredientId);
        return ingredient && ingredient.name.toLowerCase().includes(allergy);
      })
    );

    return {
      hasAllergens: matchedAllergens.length > 0,
      allergens: matchedAllergens,
    };
  };

  const savePlannerToPatient = (patientId: string, weekPlan: ReturnType<typeof weekPlanStore.getWeekPlan>, dailyTarget: number): PatientPlan => {
    if (!patientId) throw new Error('No patient selected');

    return addPatientPlan(patientId, {
      name: `Planner - ${new Date().toLocaleDateString()}`,
      dietGoal: 'maintenance',
      dailyTarget,
      startDate: new Date().toISOString().split('T')[0],
      notes: 'Created from weekly planner',
      status: 'active',
      weekPlan,
    });
  };

  // ==========================================
  // Persistence
  // ==========================================

  const load = (): void => {
    patients = storage.load(STORAGE_KEYS.PATIENTS) || [];
    patientMetrics = storage.load(STORAGE_KEYS.PATIENT_METRICS) || [];
    patientConditions = storage.load(STORAGE_KEYS.PATIENT_CONDITIONS) || [];
    patientPlans = storage.load(STORAGE_KEYS.PATIENT_PLANS) || [];
    patientProgress = storage.load(STORAGE_KEYS.PATIENT_PROGRESS) || [];
    rebuildMaps();
  };

  const saveAll = (): void => {
    storage.save(STORAGE_KEYS.PATIENTS, patients);
    storage.save(STORAGE_KEYS.PATIENT_METRICS, patientMetrics);
    storage.save(STORAGE_KEYS.PATIENT_CONDITIONS, patientConditions);
    storage.save(STORAGE_KEYS.PATIENT_PLANS, patientPlans);
    storage.save(STORAGE_KEYS.PATIENT_PROGRESS, patientProgress);
  };

  const setAll = (
    p: Patient[],
    m: PatientMetric[],
    c: PatientCondition[],
    pl: PatientPlan[],
    pr: PatientProgress[]
  ): void => {
    patients = p;
    patientMetrics = m;
    patientConditions = c;
    patientPlans = pl;
    patientProgress = pr;
    rebuildMaps();
    saveAll();
    events.emit(EventNames.PATIENTS_UPDATED, patients);
  };

  // Public API
  return {
    // Lifecycle
    load,
    setAll,
    // Patients
    getPatients,
    getPatient,
    searchPatients,
    findByEmail,
    addPatient,
    updatePatient,
    deletePatient,
    // Metrics
    getPatientMetrics,
    getLatestMetrics,
    addPatientMetric,
    deletePatientMetric,
    // Conditions
    getPatientConditions,
    addPatientCondition,
    updatePatientCondition,
    deletePatientCondition,
    getAllergies,
    // Plans
    getPatientPlans,
    getActivePlan,
    addPatientPlan,
    updatePatientPlan,
    deletePatientPlan,
    getPatientDailyCalories,
    // Progress
    getPatientProgress,
    addPatientProgress,
    updatePatientProgress,
    deletePatientProgress,
    // Planner helpers
    getPatientContext,
    checkRecipeAllergens,
    savePlannerToPatient,
    // Utilities
    calculateAge,
    calculateBMI,
    getBMICategory,
  };
}

// Import recipesStore for calorie calculation
import { recipesStore } from './recipes-store';

// Export singleton instance
export const patientsStore = createPatientsStore();
