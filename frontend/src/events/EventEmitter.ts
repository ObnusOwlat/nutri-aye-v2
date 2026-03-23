/**
 * EventEmitter - Pub/Sub event system
 * 
 * Provides a simple event system for decoupled communication
 * between modules. Supports wildcard listeners with '*'.
 */

type EventCallback<T = unknown> = (data: T) => void;

interface ListenerEntry {
  callback: EventCallback;
  once: boolean;
}

class EventEmitter {
  private listeners: Map<string, ListenerEntry[]> = new Map();

  /**
   * Subscribe to an event
   * @param event Event name (use '*' for all events)
   * @param callback Function to call when event fires
   * @returns Unsubscribe function
   */
  subscribe<T = unknown>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    const entry: ListenerEntry = { callback: callback as EventCallback, once: false };
    this.listeners.get(event)!.push(entry);

    // Return unsubscribe function
    return () => this.unsubscribe(event, callback);
  }

  /**
   * Subscribe to an event once
   * @param event Event name
   * @param callback Function to call when event fires
   * @returns Unsubscribe function
   */
  once<T = unknown>(event: string, callback: EventCallback<T>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    
    const entry: ListenerEntry = { callback: callback as EventCallback, once: true };
    this.listeners.get(event)!.push(entry);

    return () => this.unsubscribe(event, callback);
  }

  /**
   * Emit an event
   * @param event Event name
   * @param data Data to pass to listeners
   */
  emit<T = unknown>(event: string, data?: T): void {
    // Call specific event listeners
    const listeners = this.listeners.get(event);
    if (listeners) {
      this.invokeListeners(listeners, data);
    }

    // Call wildcard listeners
    const wildcardListeners = this.listeners.get('*');
    if (wildcardListeners) {
      this.invokeListeners(wildcardListeners, { event, data });
    }
  }

  /**
   * Unsubscribe from an event
   * @param event Event name
   * @param callback Original callback to remove
   */
  private unsubscribe(event: string, callback: EventCallback): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.findIndex(entry => entry.callback === callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Invoke listeners and remove 'once' entries
   */
  private invokeListeners<T>(listeners: ListenerEntry[], data: T): void {
    const toRemove: ListenerEntry[] = [];
    
    for (const entry of listeners) {
      try {
        entry.callback(data);
      } catch (error) {
        console.error(`[EventEmitter] Error in listener:`, error);
      }
      
      if (entry.once) {
        toRemove.push(entry);
      }
    }

    // Remove 'once' listeners
    for (const entry of toRemove) {
      const index = listeners.indexOf(entry);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * Remove all listeners for an event (or all events)
   * @param event Event name (optional, removes all if not provided)
   */
  clear(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }

  /**
   * Get listener count for an event
   * @param event Event name
   */
  listenerCount(event: string): number {
    return this.listeners.get(event)?.length ?? 0;
  }
}

// Export singleton instance
export const events = new EventEmitter();

// Event names as constants for type safety
export const EventNames = {
  // State events
  STATE_READY: 'state:ready',
  STATE_ERROR: 'state:error',
  
  // Ingredient events
  INGREDIENTS_UPDATED: 'ingredients:updated',
  INGREDIENTS_ADDED: 'ingredients:added',
  
  // Recipe events
  RECIPES_UPDATED: 'recipes:updated',
  RECIPES_ADDED: 'recipes:added',
  
  // Week plan events
  WEEK_PLAN_UPDATED: 'weekPlan:updated',
  
  // Diet events
  DIET_PROFILE_UPDATED: 'dietProfile:updated',
  DIET_TEMPLATES_UPDATED: 'dietTemplates:updated',
  TEMPLATE_CHANGED: 'template:changed',
  
  // Patient events
  PATIENTS_UPDATED: 'patients:updated',
  PATIENTS_ADDED: 'patients:added',
  PATIENTS_CHANGED: 'patients:changed',
  PATIENTS_DELETED: 'patients:deleted',
  
  // Patient metrics events
  PATIENT_METRICS_UPDATED: 'patientMetrics:updated',
  
  // Patient conditions events
  PATIENT_CONDITIONS_UPDATED: 'patientConditions:updated',
  
  // Patient plans events
  PATIENT_PLANS_UPDATED: 'patientPlans:updated',
  
  // Patient progress events
  PATIENT_PROGRESS_UPDATED: 'patientProgress:updated',
  
  // Data events
  DATA_IMPORTED: 'data:imported',
} as const;

export type EventName = typeof EventNames[keyof typeof EventNames];
