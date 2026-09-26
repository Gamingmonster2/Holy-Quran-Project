/**
 * Storage abstraction.
 *
 * `localStorage` is not available in every context (private mode, `file://` in
 * some browsers, tests). Everything above this layer talks to the returned
 * object, so tests can inject `memoryStorage()` and the app keeps working when
 * persistence is unavailable (it just forgets on reload).
 */

const PREFIX = 'quran-web:';

/** @returns {Storage|null} */
export function browserStorage() {
  try {
    const probe = `${PREFIX}__probe__`;
    globalThis.localStorage.setItem(probe, '1');
    globalThis.localStorage.removeItem(probe);
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

/** In-memory `Storage`-like implementation (used by tests and as a fallback). */
export function memoryStorage() {
  /** @type {Map<string, string>} */
  const map = new Map();
  return {
    get length() {
      return map.size;
    },
    key: (index) => [...map.keys()][index] ?? null,
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => void map.set(key, String(value)),
    removeItem: (key) => void map.delete(key),
    clear: () => map.clear(),
  };
}

/**
 * @param {Storage|null} [backing] defaults to `localStorage` when usable
 */
export function createStorage(backing = browserStorage()) {
  const backingStore = backing ?? memoryStorage();
  const persistent = Boolean(backing);

  /** @param {string} key */
  const fullKey = (key) => PREFIX + key;

  return {
    /** Whether writes actually survive a reload. */
    persistent,

    /**
     * @template T
     * @param {string} key
     * @param {T} fallback
     * @returns {T}
     */
    read(key, fallback) {
      const raw = backingStore.getItem(fullKey(key));
      if (raw == null) return fallback;
      try {
        return JSON.parse(raw);
      } catch {
        // Corrupted entry: drop it rather than breaking the whole app.
        backingStore.removeItem(fullKey(key));
        return fallback;
      }
    },

    /**
     * @param {string} key
     * @param {unknown} value
     */
    write(key, value) {
      try {
        backingStore.setItem(fullKey(key), JSON.stringify(value));
        return true;
      } catch {
        return false;
      }
    },

    /** @param {string} key */
    remove(key) {
      backingStore.removeItem(fullKey(key));
    },

    /** Keys without the app prefix. */
    keys() {
      const out = [];
      for (let i = 0; i < backingStore.length; i += 1) {
        const key = backingStore.key(i);
        if (key && key.startsWith(PREFIX)) out.push(key.slice(PREFIX.length));
      }
      return out;
    },
  };
}
