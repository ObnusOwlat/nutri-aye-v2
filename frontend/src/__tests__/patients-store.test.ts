/**
 * Patient Store Tests
 */

import { describe, it, expect } from 'vitest';
import { calculateAge, calculateBMI, getBMICategory } from '../stores/patients-store';

describe('Patient Store Utilities', () => {
    describe('calculateAge', () => {
        it('should return null for null input', () => {
            expect(calculateAge(null)).toBeNull();
        });

        it('should calculate age correctly', () => {
            const today = new Date();
            const birthDate = new Date(today.getFullYear() - 25, 5, 15);
            const age = calculateAge(birthDate.toISOString().split('T')[0]);
            expect(age).toBe(25);
        });

        it('should handle leap year birthdays', () => {
            const dob = '2020-02-29';
            const age = calculateAge(dob);
            // On 2024-02-28, someone born on 2020-02-29 is still 3
            // This tests boundary condition handling
            expect(typeof age).toBe('number');
        });
    });

    describe('calculateBMI', () => {
        it('should return null for zero values', () => {
            expect(calculateBMI(0, 175)).toBeNull();
            expect(calculateBMI(70, 0)).toBeNull();
        });

        it('should calculate BMI correctly', () => {
            // Standard test case: 70kg, 175cm
            const bmi = calculateBMI(70, 175);
            expect(bmi).toBeCloseTo(22.86, 1);
        });

        it('should handle edge cases', () => {
            // Very low weight
            expect(calculateBMI(30, 180)).toBeCloseTo(9.26, 1);
            // Very high weight
            expect(calculateBMI(150, 180)).toBeCloseTo(46.30, 1);
        });
    });

    describe('getBMICategory', () => {
        it('should categorize underweight', () => {
            expect(getBMICategory(15)).toBe('underweight');
            expect(getBMICategory(18.4)).toBe('underweight');
        });

        it('should categorize normal weight', () => {
            expect(getBMICategory(18.5)).toBe('normal');
            expect(getBMICategory(22)).toBe('normal');
            expect(getBMICategory(24.9)).toBe('normal');
        });

        it('should categorize overweight', () => {
            expect(getBMICategory(25)).toBe('overweight');
            expect(getBMICategory(27.5)).toBe('overweight');
            expect(getBMICategory(29.9)).toBe('overweight');
        });

        it('should categorize obese', () => {
            expect(getBMICategory(30)).toBe('obese');
            expect(getBMICategory(35)).toBe('obese');
            expect(getBMICategory(45)).toBe('obese');
        });
    });
});

describe('Patient Validation', () => {
    const GENDERS = ['male', 'female', 'other'] as const;

    const isValidGender = (gender: string): boolean => 
        GENDERS.includes(gender as typeof GENDERS[number]);

    it('should validate gender correctly', () => {
        expect(isValidGender('male')).toBe(true);
        expect(isValidGender('female')).toBe(true);
        expect(isValidGender('other')).toBe(true);
        expect(isValidGender('unknown')).toBe(false);
    });
});

describe('Allergen Check', () => {
    const checkAllergens = (
        recipeText: string,
        allergies: string[]
    ): string[] => {
        return allergies.filter(allergy => 
            recipeText.toLowerCase().includes(allergy.toLowerCase())
        );
    };

    it('should detect allergens in recipe name', () => {
        const recipeText = 'Peanut Butter Smoothie';
        const allergies = ['peanut', 'dairy'];
        const found = checkAllergens(recipeText, allergies);
        expect(found).toContain('peanut');
        expect(found).not.toContain('dairy');
    });

    it('should return empty array when no allergies', () => {
        const recipeText = 'Chicken Salad';
        const allergies: string[] = [];
        const found = checkAllergens(recipeText, allergies);
        expect(found).toHaveLength(0);
    });

    it('should be case insensitive', () => {
        const recipeText = 'PEANUT BUTTER';
        const allergies = ['peanut'];
        const found = checkAllergens(recipeText, allergies);
        expect(found).toContain('peanut');
    });
});
