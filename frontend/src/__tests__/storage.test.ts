/**
 * Storage Tests
 * 
 * Note: These tests verify storage behavior. The localStorage mock
 * from setup.ts may interfere with these tests, so we test the
 * pure functionality.
 */

import { describe, it, expect } from 'vitest';

describe('Storage Keys', () => {
  it('should have all required keys defined', async () => {
    const { STORAGE_KEYS } = await import('../storage/keys');
    
    expect(STORAGE_KEYS.INGREDIENTS).toBeDefined();
    expect(STORAGE_KEYS.RECIPES).toBeDefined();
    expect(STORAGE_KEYS.WEEK_PLANS).toBeDefined();
  });
});

describe('Storage API (integration tests)', () => {
  it('should load return null for non-existent data', async () => {
    const { storage } = await import('../storage/storage');
    
    // Use a unique key for testing
    const testKey = 'TEST_KEY_' + Date.now();
    
    const result = storage.load(testKey as any);
    expect(result).toBeNull();
  });

  it('should save and load work together', async () => {
    const { storage } = await import('../storage/storage');
    const { STORAGE_KEYS } = await import('../storage/keys');
    
    const testData = { test: 'data', value: 123 };
    
    // Save immediately
    storage.saveImmediate(STORAGE_KEYS.INGREDIENTS, testData);
    
    // Load it back
    const loaded = storage.load(STORAGE_KEYS.INGREDIENTS);
    
    expect(loaded).toEqual(testData);
  });

  it('should remove delete specific key', async () => {
    const { storage } = await import('../storage/storage');
    const { STORAGE_KEYS } = await import('../storage/keys');
    
    // Add data using localStorage directly
    localStorage.setItem(STORAGE_KEYS.INGREDIENTS, JSON.stringify({ test: 1 }));
    
    // Remove it
    storage.remove(STORAGE_KEYS.INGREDIENTS);
    
    // Should be null
    expect(storage.load(STORAGE_KEYS.INGREDIENTS)).toBeNull();
  });

  it('should getUsage return valid values', async () => {
    const { storage } = await import('../storage/storage');
    
    const usage = storage.getUsage();
    
    expect(typeof usage.used).toBe('number');
    expect(typeof usage.available).toBe('number');
    expect(usage.used).toBeGreaterThanOrEqual(0);
    expect(usage.available).toBeGreaterThanOrEqual(0);
  });

  it('should isAvailable return boolean', async () => {
    const { storage } = await import('../storage/storage');
    
    const available = storage.isAvailable();
    
    expect(typeof available).toBe('boolean');
  });

  it('should flush write pending saves', async () => {
    const { storage } = await import('../storage/storage');
    const { STORAGE_KEYS } = await import('../storage/keys');
    
    // Add pending save (not immediate)
    storage.save(STORAGE_KEYS.INGREDIENTS, { pending: 'data' });
    
    // Flush should write it
    storage.flush();
    
    // Should be saved now
    const loaded = storage.load(STORAGE_KEYS.INGREDIENTS);
    expect(loaded).toEqual({ pending: 'data' });
  });
});
