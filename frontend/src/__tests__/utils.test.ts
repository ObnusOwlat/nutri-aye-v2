/**
 * Utility Functions Tests
 */

import { describe, it, expect } from 'vitest';

// Import pure functions for testing
// These are tested independently without store dependencies

describe('BMI Calculations', () => {
    const calculateBMI = (weight: number, height: number): number | null => {
        if (!weight || !height) return null;
        return weight / Math.pow(height / 100, 2);
    };

    const getBMICategory = (bmi: number): string => {
        if (bmi < 18.5) return 'underweight';
        if (bmi < 25) return 'normal';
        if (bmi < 30) return 'overweight';
        return 'obese';
    };

    it('should calculate BMI correctly', () => {
        // Person: 70kg, 175cm
        const bmi = calculateBMI(70, 175);
        expect(bmi).toBeCloseTo(22.86, 1);
    });

    it('should return null for missing weight', () => {
        expect(calculateBMI(0, 175)).toBeNull();
        expect(calculateBMI(70, 0)).toBeNull();
    });

    it('should categorize underweight correctly', () => {
        expect(getBMICategory(18)).toBe('underweight');
        expect(getBMICategory(18.4)).toBe('underweight');
    });

    it('should categorize normal weight correctly', () => {
        expect(getBMICategory(18.5)).toBe('normal');
        expect(getBMICategory(22)).toBe('normal');
        expect(getBMICategory(24.9)).toBe('normal');
    });

    it('should categorize overweight correctly', () => {
        expect(getBMICategory(25)).toBe('overweight');
        expect(getBMICategory(28)).toBe('overweight');
        expect(getBMICategory(29.9)).toBe('overweight');
    });

    it('should categorize obese correctly', () => {
        expect(getBMICategory(30)).toBe('obese');
        expect(getBMICategory(35)).toBe('obese');
    });
});

describe('Age Calculation', () => {
    const calculateAge = (dob: string): number | null => {
        if (!dob) return null;
        const today = new Date();
        const birth = new Date(dob);
        let age = today.getFullYear() - birth.getFullYear();
        const m = today.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
        return age;
    };

    it('should return null for missing date', () => {
        expect(calculateAge('')).toBeNull();
        expect(calculateAge(null as unknown as string)).toBeNull();
    });

    it('should calculate age correctly', () => {
        const today = new Date();
        const birthYear = today.getFullYear() - 30;
        const dob = `${birthYear}-01-15`;
        expect(calculateAge(dob)).toBe(30);
    });
});

describe('Clamp Function', () => {
    const clamp = (val: number, min: number, max: number): number => 
        Math.max(min, Math.min(max, val));

    it('should return value when within range', () => {
        expect(clamp(5, 0, 10)).toBe(5);
        expect(clamp(0, 0, 10)).toBe(0);
        expect(clamp(10, 0, 10)).toBe(10);
    });

    it('should clamp value below minimum', () => {
        expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('should clamp value above maximum', () => {
        expect(clamp(15, 0, 10)).toBe(10);
    });

    it('should handle negative ranges', () => {
        expect(clamp(5, -10, -5)).toBe(-5);
    });
});

describe('Nutrition Calculation', () => {
    const calculateRecipeNutrition = (
        ingredients: Array<{ kcalPer100g: number; proteinPer100g: number; carbsPer100g: number; fatPer100g: number; grams: number }>
    ) => {
        if (!ingredients.length) {
            return { calories: 0, protein: 0, carbs: 0, fat: 0 };
        }
        return ingredients.reduce(
            (totals, ing) => {
                const factor = ing.grams / 100;
                return {
                    calories: totals.calories + ing.kcalPer100g * factor,
                    protein: totals.protein + ing.proteinPer100g * factor,
                    carbs: totals.carbs + ing.carbsPer100g * factor,
                    fat: totals.fat + ing.fatPer100g * factor,
                };
            },
            { calories: 0, protein: 0, carbs: 0, fat: 0 }
        );
    };

    it('should return zero for empty ingredients', () => {
        const result = calculateRecipeNutrition([]);
        expect(result.calories).toBe(0);
        expect(result.protein).toBe(0);
        expect(result.carbs).toBe(0);
        expect(result.fat).toBe(0);
    });

    it('should calculate nutrition correctly', () => {
        const ingredients = [
            { kcalPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6, grams: 150 },
        ];
        const result = calculateRecipeNutrition(ingredients);
        expect(result.calories).toBeCloseTo(247.5, 1);
        expect(result.protein).toBeCloseTo(46.5, 1);
    });

    it('should sum multiple ingredients', () => {
        const ingredients = [
            { kcalPer100g: 165, proteinPer100g: 31, carbsPer100g: 0, fatPer100g: 3.6, grams: 100 },
            { kcalPer100g: 100, proteinPer100g: 5, carbsPer100g: 20, fatPer100g: 1, grams: 200 },
        ];
        const result = calculateRecipeNutrition(ingredients);
        expect(result.calories).toBeCloseTo(365, 1);
        expect(result.protein).toBeCloseTo(41, 1);
        expect(result.carbs).toBeCloseTo(40, 1);
    });
});

describe('UUID Generation', () => {
    const generateId = (): string => 
        'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
            const r = Math.random() * 16 | 0;
            return (c === 'x' ? r : r & 0x3 | 0x8).toString(16);
        });

    it('should generate valid UUID format', () => {
        const id = generateId();
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        expect(id).toMatch(uuidRegex);
    });

    it('should generate unique IDs', () => {
        const ids = new Set<string>();
        for (let i = 0; i < 100; i++) {
            ids.add(generateId());
        }
        expect(ids.size).toBe(100);
    });
});

describe('CSV Parsing', () => {
    const parseCSVLine = (line: string): string[] => {
        const values: string[] = [];
        let current = '';
        let inQuotes = false;

        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            if (char === '"' && !inQuotes) {
                inQuotes = true;
            } else if (char === '"' && inQuotes) {
                if (nextChar === '"') {
                    current += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else if (char === ',' && !inQuotes) {
                values.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current);
        return values;
    };

    it('should parse simple CSV line', () => {
        const result = parseCSVLine('a,b,c');
        expect(result).toEqual(['a', 'b', 'c']);
    });

    it('should handle quoted values with commas', () => {
        const result = parseCSVLine('"hello, world",test');
        expect(result).toEqual(['hello, world', 'test']);
    });

    it('should handle escaped quotes', () => {
        const result = parseCSVLine('"say ""hello""",test');
        expect(result).toEqual(['say "hello"', 'test']);
    });

    it('should handle empty values', () => {
        const result = parseCSVLine('a,,c');
        expect(result).toEqual(['a', '', 'c']);
    });
});
