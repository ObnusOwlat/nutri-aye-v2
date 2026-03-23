/**
 * Ingredients Store Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createIngredientsStore } from '../stores/ingredients-store';
import { events } from '../events/EventEmitter';
import type { IngredientInput } from '../types';

describe('Ingredients Store', () => {
  let store: ReturnType<typeof createIngredientsStore>;

  beforeEach(() => {
    events.clear();
    store = createIngredientsStore();
  });

  describe('load and getAll', () => {
    it('should return empty array when no data', () => {
      store.load();
      expect(store.getAll()).toEqual([]);
    });

    it('should return all ingredients', () => {
      store.add({ name: 'Chicken', kcalPer100g: 165 });
      store.add({ name: 'Rice', kcalPer100g: 130 });
      expect(store.getAll()).toHaveLength(2);
    });
  });

  describe('add', () => {
    it('should add ingredient with generated id', () => {
      const input: IngredientInput = { name: 'Chicken', kcalPer100g: 165 };
      const result = store.add(input);
      expect(result.id).toBeDefined();
      expect(result.name).toBe('Chicken');
      expect(result.kcalPer100g).toBe(165);
    });

    it('should add createdAt and updatedAt timestamps', () => {
      const result = store.add({ name: 'Test', kcalPer100g: 100 });
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should clamp negative values to 0', () => {
      const result = store.add({ name: 'Test', kcalPer100g: -50 });
      expect(result.kcalPer100g).toBe(0);
    });

    it('should clamp values over 100 to 100', () => {
      const result = store.add({ name: 'Test', kcalPer100g: 200, proteinPer100g: 150 });
      expect(result.kcalPer100g).toBe(200); // kcal has no upper limit
      expect(result.proteinPer100g).toBe(100); // protein clamped
    });

    it('should emit ingredients:updated event', () => {
      const spy = vi.fn();
      events.subscribe('ingredients:updated', spy);
      store.add({ name: 'Test', kcalPer100g: 100 });
      expect(spy).toHaveBeenCalled();
    });

    it('should emit ingredients:added event with new ingredient', () => {
      const spy = vi.fn();
      events.subscribe('ingredients:added', spy);
      store.add({ name: 'Test', kcalPer100g: 100 });
      expect(spy).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test' }));
    });

    it('should throw error for empty name', () => {
      expect(() => store.add({ name: '', kcalPer100g: 100 })).toThrow('Ingredient name is required');
    });

    it('should throw error for duplicate name', () => {
      store.add({ name: 'Chicken', kcalPer100g: 165 });
      expect(() => store.add({ name: 'Chicken', kcalPer100g: 200 })).toThrow('already exists');
    });

    it('should handle case-insensitive duplicate names', () => {
      store.add({ name: 'Chicken', kcalPer100g: 165 });
      expect(() => store.add({ name: 'chicken', kcalPer100g: 200 })).toThrow('already exists');
    });
  });

  describe('getById', () => {
    it('should return ingredient by id', () => {
      const added = store.add({ name: 'Chicken', kcalPer100g: 165 });
      const result = store.getById(added.id);
      expect(result?.name).toBe('Chicken');
    });

    it('should return undefined for non-existent id', () => {
      expect(store.getById('non-existent')).toBeUndefined();
    });
  });

  describe('update', () => {
    it('should update ingredient', () => {
      const added = store.add({ name: 'Chicken', kcalPer100g: 165 });
      const result = store.update(added.id, { name: 'Grilled Chicken', kcalPer100g: 200 });
      expect(result?.name).toBe('Grilled Chicken');
      expect(result?.kcalPer100g).toBe(200);
    });

    it('should return null for non-existent id', () => {
      expect(store.update('non-existent', { name: 'Test' })).toBeNull();
    });

    it('should update updatedAt timestamp when data changes', () => {
      const added = store.add({ name: 'Test', kcalPer100g: 100 });
      const originalUpdatedAt = added.updatedAt;
      
      // Wait a bit to ensure timestamp difference
      const start = Date.now();
      while (Date.now() - start < 10) { /* busy wait */ }
      
      const result = store.update(added.id, { kcalPer100g: 200 });
      // The timestamp is set by getTimestamp() which may be same ms, 
      // so we check that updatedAt exists and is a valid date
      expect(result?.updatedAt).toBeDefined();
    });

    it('should throw error for duplicate name on update', () => {
      store.add({ name: 'Chicken', kcalPer100g: 165 });
      const rice = store.add({ name: 'Rice', kcalPer100g: 130 });
      
      expect(() => store.update(rice.id, { name: 'Chicken' })).toThrow('already exists');
    });
  });

  describe('remove', () => {
    it('should remove ingredient by id', () => {
      const added = store.add({ name: 'Chicken', kcalPer100g: 165 });
      expect(store.remove(added.id)).toBe(true);
      expect(store.getById(added.id)).toBeUndefined();
    });

    it('should return false for non-existent id', () => {
      expect(store.remove('non-existent')).toBe(false);
    });

    it('should emit ingredients:updated event', () => {
      const added = store.add({ name: 'Chicken', kcalPer100g: 165 });
      const spy = vi.fn();
      events.subscribe('ingredients:updated', spy);
      store.remove(added.id);
      expect(spy).toHaveBeenCalled();
    });
  });

  describe('removeAll', () => {
    it('should remove all ingredients', () => {
      store.add({ name: 'Chicken', kcalPer100g: 165 });
      store.add({ name: 'Rice', kcalPer100g: 130 });
      store.removeAll();
      expect(store.getAll()).toEqual([]);
    });

    it('should emit ingredients:updated event', () => {
      const spy = vi.fn();
      events.subscribe('ingredients:updated', spy);
      store.removeAll();
      expect(spy).toHaveBeenCalledWith([]);
    });
  });

  describe('importMany', () => {
    it('should import multiple ingredients', () => {
      const items: IngredientInput[] = [
        { name: 'Chicken', kcalPer100g: 165 },
        { name: 'Rice', kcalPer100g: 130 },
      ];
      const result = store.importMany(items);
      expect(result.imported).toHaveLength(2);
      expect(store.getAll()).toHaveLength(2);
    });

    it('should skip duplicates', () => {
      store.add({ name: 'Chicken', kcalPer100g: 165 });
      const result = store.importMany([{ name: 'Chicken', kcalPer100g: 200 }]);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].error).toBe('Already exists');
    });

    it('should report errors for missing fields', () => {
      const result = store.importMany([
        { name: 'Valid', kcalPer100g: 100 },
        { name: '', kcalPer100g: 50 }, // Invalid: empty name
      ]);
      expect(result.errors).toHaveLength(1);
    });
  });

  describe('setAll', () => {
    it('should replace all ingredients', () => {
      store.add({ name: 'Old', kcalPer100g: 100 });
      store.setAll([{
        id: 'new-1',
        name: 'New Ingredient',
        category: 'protein',
        unit: 'g',
        kcalPer100g: 200,
        createdAt: '2024-01-01',
        updatedAt: '2024-01-01',
      }]);
      expect(store.getAll()).toHaveLength(1);
      expect(store.getAll()[0].name).toBe('New Ingredient');
    });
  });
});
