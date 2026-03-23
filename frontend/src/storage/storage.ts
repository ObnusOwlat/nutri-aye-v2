/**
 * Storage - localStorage abstraction with debounced saves
 * 
 * Provides a clean interface for persisting data to localStorage
 * with automatic debouncing to reduce write frequency.
 */

import { STORAGE_KEYS, type StorageKey } from './keys';
import { events, EventNames } from '../events';

// Debounce configuration
const SAVE_DEBOUNCE_MS = 100;

class Storage {
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingSaves: Map<StorageKey, unknown> = new Map();

  /**
   * Load data from localStorage
   * @param key Storage key
   * @returns Parsed data or null if not found
   */
  load<T>(key: StorageKey): T | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS[key]);
      return data ? (JSON.parse(data) as T) : null;
    } catch (error) {
      console.error(`[Storage] Load error for ${key}:`, error);
      return null;
    }
  }

  /**
   * Save data to localStorage (debounced)
   * @param key Storage key
   * @param data Data to save
   */
  save(key: StorageKey, data: unknown): void {
    this.pendingSaves.set(key, data);
    this.scheduleSave();
  }

  /**
   * Save data immediately (bypasses debounce)
   * @param key Storage key
   * @param data Data to save
   */
  saveImmediate(key: StorageKey, data: unknown): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.persist(key, data);
  }

  /**
   * Schedule a debounced save of all pending data
   */
  private scheduleSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    
    this.saveTimer = setTimeout(() => {
      this.flush();
    }, SAVE_DEBOUNCE_MS);
  }

  /**
   * Flush all pending saves to localStorage
   */
  flush(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    const errors: string[] = [];
    
    for (const [key, data] of this.pendingSaves) {
      try {
        this.persist(key, data);
      } catch (error) {
        errors.push(key);
        console.error(`[Storage] Save error for ${key}:`, error);
      }
    }

    this.pendingSaves.clear();

    // Emit quota exceeded event if any saves failed
    if (errors.length > 0) {
      const lastError = new Error('Storage save failed');
      events.emit(EventNames.STATE_ERROR, {
        type: 'storage_error',
        keys: errors,
        message: lastError.message,
      });
    }
  }

  /**
   * Persist data to localStorage
   * @param key Storage key
   * @param data Data to persist
   */
  private persist(key: StorageKey, data: unknown): void {
    try {
      localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(data));
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'QuotaExceededError') {
        events.emit(EventNames.STATE_ERROR, {
          type: 'quota_exceeded',
          message: 'Storage limit reached. Please export and clear some data.',
        });
      }
      throw error;
    }
  }

  /**
   * Remove an item from storage
   * @param key Storage key
   */
  remove(key: StorageKey): void {
    localStorage.removeItem(STORAGE_KEYS[key]);
  }

  /**
   * Clear all application data from storage
   */
  clearAll(): void {
    for (const key of Object.keys(STORAGE_KEYS) as StorageKey[]) {
      localStorage.removeItem(STORAGE_KEYS[key]);
    }
  }

  /**
   * Get approximate storage usage
   * @returns Object with used and available bytes
   */
  getUsage(): { used: number; available: number } {
    let used = 0;
    
    for (const key of Object.keys(STORAGE_KEYS) as StorageKey[]) {
      const data = localStorage.getItem(STORAGE_KEYS[key]);
      if (data) {
        used += data.length * 2; // UTF-16 characters
      }
    }

    // localStorage typically has 5MB limit
    const total = 5 * 1024 * 1024;
    return {
      used,
      available: Math.max(0, total - used),
    };
  }

  /**
   * Check if storage is available
   */
  isAvailable(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const storage = new Storage();
