/**
 * Test suite entry point
 * 
 * This file re-exports all test modules for comprehensive testing.
 */

// Import all test modules
import './events.test';
import './types.test';
import './utils.test';
import './diet-store.test';
import './patients-store.test';

// Test utilities
export * from './utils.test';

// Re-export vitest for convenience
export { describe, it, expect, beforeEach, vi } from 'vitest';
