/**
 * Storage - Wrapper for localStorage/sessionStorage
 */

export class Storage {
  constructor(storageType = 'local') {
    this.storage = storageType === 'session' ? sessionStorage : localStorage;
  }

  /**
   * Get item from storage
   */
  get(key, defaultValue = null) {
    try {
      const item = this.storage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.error(`Error reading from storage: ${key}`, error);
      return defaultValue;
    }
  }

  /**
   * Set item in storage
   */
  set(key, value) {
    try {
      this.storage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error(`Error writing to storage: ${key}`, error);
      return false;
    }
  }

  /**
   * Remove item from storage
   */
  remove(key) {
    try {
      this.storage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`Error removing from storage: ${key}`, error);
      return false;
    }
  }

  /**
   * Clear all items from storage
   */
  clear() {
    try {
      this.storage.clear();
      return true;
    } catch (error) {
      console.error('Error clearing storage', error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  has(key) {
    return this.storage.getItem(key) !== null;
  }

  /**
   * Get all keys
   */
  keys() {
    return Object.keys(this.storage);
  }
}

// Create singleton instances
export const localStorage = new Storage('local');
export const sessionStorage = new Storage('session');

// Default export for convenience
export const storage = localStorage;
export default storage;
