/**
 * Type and Enum Tests
 */

import { describe, it, expect } from 'vitest';
import {
    VALID_CATEGORIES,
    VALID_MEAL_TYPES,
    DAYS,
    GENDERS,
    ACTIVITY_LEVELS,
    CONDITION_TYPES,
    CONDITION_SEVERITIES,
    PLAN_STATUSES,
    DIET_GOALS,
    UNITS,
} from '../types/enums';

describe('Enums', () => {
    describe('VALID_CATEGORIES', () => {
        it('should contain expected categories', () => {
            expect(VALID_CATEGORIES).toContain('protein');
            expect(VALID_CATEGORIES).toContain('carbs');
            expect(VALID_CATEGORIES).toContain('fats');
            expect(VALID_CATEGORIES).toContain('vegetables');
            expect(VALID_CATEGORIES).toContain('mixed');
            expect(VALID_CATEGORIES.length).toBe(5);
        });
    });

    describe('VALID_MEAL_TYPES', () => {
        it('should contain expected meal types', () => {
            expect(VALID_MEAL_TYPES).toContain('breakfast');
            expect(VALID_MEAL_TYPES).toContain('lunch');
            expect(VALID_MEAL_TYPES).toContain('snack');
            expect(VALID_MEAL_TYPES).toContain('dinner');
            expect(VALID_MEAL_TYPES.length).toBe(4);
        });
    });

    describe('DAYS', () => {
        it('should contain all 7 days', () => {
            expect(DAYS).toContain('monday');
            expect(DAYS).toContain('tuesday');
            expect(DAYS).toContain('wednesday');
            expect(DAYS).toContain('thursday');
            expect(DAYS).toContain('friday');
            expect(DAYS).toContain('saturday');
            expect(DAYS).toContain('sunday');
            expect(DAYS.length).toBe(7);
        });
    });

    describe('GENDERS', () => {
        it('should contain expected genders', () => {
            expect(GENDERS).toContain('male');
            expect(GENDERS).toContain('female');
            expect(GENDERS).toContain('other');
        });
    });

    describe('ACTIVITY_LEVELS', () => {
        it('should contain expected activity levels', () => {
            expect(ACTIVITY_LEVELS).toContain('sedentary');
            expect(ACTIVITY_LEVELS).toContain('light');
            expect(ACTIVITY_LEVELS).toContain('moderate');
            expect(ACTIVITY_LEVELS).toContain('active');
            expect(ACTIVITY_LEVELS).toContain('very_active');
        });
    });

    describe('CONDITION_TYPES', () => {
        it('should contain expected condition types', () => {
            expect(CONDITION_TYPES).toContain('condition');
            expect(CONDITION_TYPES).toContain('allergy');
            expect(CONDITION_TYPES).toContain('intolerance');
            expect(CONDITION_TYPES).toContain('medication');
        });
    });

    describe('DIET_GOALS', () => {
        it('should contain expected diet goals', () => {
            expect(DIET_GOALS).toContain('maintenance');
            expect(DIET_GOALS).toContain('deficit');
            expect(DIET_GOALS).toContain('bulking');
            expect(DIET_GOALS).toContain('performance');
        });
    });

    describe('UNITS', () => {
        it('should contain expected units', () => {
            expect(UNITS).toContain('g');
            expect(UNITS).toContain('oz');
        });
    });
});

describe('Type Guards', () => {
    const isValidCategory = (value: string): boolean => 
        VALID_CATEGORIES.includes(value as typeof VALID_CATEGORIES[number]);

    const isValidMealType = (value: string): boolean => 
        VALID_MEAL_TYPES.includes(value as typeof VALID_MEAL_TYPES[number]);

    const isValidDay = (value: string): boolean => 
        DAYS.includes(value as typeof DAYS[number]);

    it('should validate categories correctly', () => {
        expect(isValidCategory('protein')).toBe(true);
        expect(isValidCategory('invalid')).toBe(false);
    });

    it('should validate meal types correctly', () => {
        expect(isValidMealType('breakfast')).toBe(true);
        expect(isValidMealType('lunch')).toBe(true);
        expect(isValidMealType('supper')).toBe(false);
    });

    it('should validate days correctly', () => {
        expect(isValidDay('monday')).toBe(true);
        expect(isValidDay('sunday')).toBe(true);
        expect(isValidDay('funday')).toBe(false);
    });
});
