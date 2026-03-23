/**
 * Vitest setup file
 * 
 * This file is run before each test file.
 */

// Mock localStorage for browser environment
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
        clear: () => { store = {}; },
        get length() { return Object.keys(store).length; },
        key: (i: number) => Object.keys(store)[i] || null,
    };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock console.error to keep test output clean (optional)
// Uncomment to suppress console errors during tests
// const originalError = console.error;
// console.error = (...args: unknown[]) => {
//     if (args[0]?.toString().includes('[EventEmitter]')) return;
//     originalError(...args);
// };

// Reset localStorage before each test
beforeEach(() => {
    localStorage.clear();
});
