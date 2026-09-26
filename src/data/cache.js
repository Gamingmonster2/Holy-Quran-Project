/**
 * Key/value cache.
 *
 * Backed by IndexedDB when available (the Quran text is ~1 MB, far past what
 * `localStorage` should hold), with a transparent in-memory fallback so the app
 * still behaves correctly where IndexedDB is blocked.
 */

const DB_NAME = 'quran-web';
const DB_VERSION = 1;
const STORE = 'kv';

/** In-memory cache with the same async surface. */
function memoryCache() {
  /** @type {Map<string, any>} */
  const map = new Map();
  return {
    kind: 'memory',
    async available() {
      return true;
    },
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async set(key, value) {
      map.set(key, value);
    },
    async delete(key) {
      map.delete(key);
    },
    async keys() {
      return [...map.keys()];
    },
    async clear() {
      map.clear();
    },
  };
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = globalThis.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbCache(db) {
  /** @param {IDBMode} mode */
  const tx = (mode) => db.transaction(STORE, mode).objectStore(STORE);

  const wrap = (request) =>
    new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

  return {
    kind: 'indexeddb',
    async available() {
      return true;
    },
    async get(key) {
      const value = await wrap(tx('readonly').get(key));
      return value === undefined ? null : value;
    },
    async set(key, value) {
      await wrap(tx('readwrite').put(value, key));
    },
    async delete(key) {
      await wrap(tx('readwrite').delete(key));
    },
    async keys() {
      return wrap(tx('readonly').getAllKeys());
    },
    async clear() {
      await wrap(tx('readwrite').clear());
    },
  };
}

/**
 * @param {{preferMemory?: boolean}} [options]
 */
export async function createCache(options = {}) {
  if (options.preferMemory) return memoryCache();
  if (!globalThis.indexedDB) return memoryCache();
  try {
    const db = await openDatabase();
    return idbCache(db);
  } catch {
    return memoryCache();
  }
}

/**
 * Remember an async producer's result.
 * @template T
 * @param {ReturnType<typeof createCache> extends Promise<infer C> ? C : never} cache
 * @param {string} key
 * @param {() => Promise<T>} producer
 */
export async function cached(cache, key, producer) {
  const hit = await cache.get(key);
  if (hit !== null && hit !== undefined) return hit;
  const value = await producer();
  await cache.set(key, value);
  return value;
}
