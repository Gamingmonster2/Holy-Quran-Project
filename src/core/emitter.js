/**
 * Minimal synchronous event emitter.
 *
 * Deliberately tiny: the app has one store and one audio queue, so a library
 * would be more surface area than value.
 */
export function createEmitter() {
  /** @type {Map<string, Set<Function>>} */
  const listeners = new Map();

  return {
    /**
     * @param {string} event
     * @param {Function} handler
     * @returns {() => void} unsubscribe
     */
    on(event, handler) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event).add(handler);
      return () => listeners.get(event)?.delete(handler);
    },

    /** @param {string} event @param {unknown} payload */
    emit(event, payload) {
      for (const handler of listeners.get(event) ?? []) {
        try {
          handler(payload);
        } catch (error) {
          // One broken subscriber must not stop the others.
          console.error(`[emitter] handler for "${event}" failed`, error);
        }
      }
    },

    /** @param {string} [event] clears one event's listeners, or all of them */
    clear(event) {
      if (event) listeners.delete(event);
      else listeners.clear();
    },
  };
}
