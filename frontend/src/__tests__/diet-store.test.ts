/**
 * Diet Store Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getDefaultDietTemplates } from '../stores/diet-store';

describe('Diet Store', () => {
    describe('getDefaultDietTemplates', () => {
        it('should return 5 default templates', () => {
            const templates = getDefaultDietTemplates();
            expect(templates.length).toBe(5);
        });

        it('should include maintenance template', () => {
            const templates = getDefaultDietTemplates();
            const maintenance = templates.find(t => t.id === 'tpl_maintenance');
            expect(maintenance).toBeDefined();
            expect(maintenance?.goal).toBe('maintenance');
            expect(maintenance?.dailyTarget).toBe(2000);
        });

        it('should include deficit templates', () => {
            const templates = getDefaultDietTemplates();
            const deficit500 = templates.find(t => t.id === 'tpl_deficit');
            const deficit800 = templates.find(t => t.id === 'tpl_deficit_800');
            
            expect(deficit500?.goal).toBe('deficit');
            expect(deficit500?.dailyTarget).toBe(1500);
            
            expect(deficit800?.goal).toBe('deficit');
            expect(deficit800?.dailyTarget).toBe(1200);
        });

        it('should include bulking template', () => {
            const templates = getDefaultDietTemplates();
            const bulking = templates.find(t => t.id === 'tpl_bulking');
            expect(bulking?.goal).toBe('bulking');
            expect(bulking?.dailyTarget).toBe(3000);
        });

        it('should include performance template', () => {
            const templates = getDefaultDietTemplates();
            const performance = templates.find(t => t.id === 'tpl_performance');
            expect(performance?.goal).toBe('performance');
            expect(performance?.dailyTarget).toBe(2800);
        });

        it('should mark all templates as default', () => {
            const templates = getDefaultDietTemplates();
            templates.forEach(t => {
                expect(t.isDefault).toBe(true);
            });
        });

        it('should have valid meal distributions', () => {
            const templates = getDefaultDietTemplates();
            templates.forEach(t => {
                const dist = t.mealDistribution;
                expect(dist.breakfast).toBeGreaterThan(0);
                expect(dist.lunch).toBeGreaterThan(0);
                expect(dist.dinner).toBeGreaterThan(0);
                // Snack is optional
                const total = dist.breakfast + dist.lunch + (dist.snack || 0) + dist.dinner;
                expect(total).toBeLessThanOrEqual(100);
            });
        });
    });

    describe('Meal Distribution', () => {
        it('should calculate percentages correctly for maintenance', () => {
            const templates = getDefaultDietTemplates();
            const maintenance = templates.find(t => t.id === 'tpl_maintenance')!;
            const dist = maintenance.mealDistribution;
            
            expect(dist.breakfast).toBe(25);
            expect(dist.lunch).toBe(35);
            expect(dist.snack).toBe(10);
            expect(dist.dinner).toBe(30);
        });

        it('should have different distribution for performance', () => {
            const templates = getDefaultDietTemplates();
            const performance = templates.find(t => t.id === 'tpl_performance')!;
            const maintenance = templates.find(t => t.id === 'tpl_maintenance')!;
            
            expect(performance.mealDistribution).not.toEqual(maintenance.mealDistribution);
            expect(performance.mealDistribution.breakfast).toBe(30); // Higher breakfast for athletes
        });
    });
});
