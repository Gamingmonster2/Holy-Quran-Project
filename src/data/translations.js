/**
 * Translations and tafsir — web counterpart of `common:translation`.
 *
 * Source: the static quran-api editions catalog on jsDelivr, one file per
 * chapter (`/editions/{edition}/{chapter}.json`). No key, no auth, CORS-enabled,
 * tiny payloads; the same catalog also supplies the Quran text itself (see
 * `src/data/api.js`), which is why this app has no dependency on any
 * authenticated API.
 *
 * See docs/DATA_SOURCES.md.
 */
import { createCache } from './cache.js';

export const EDITIONS_BASE = 'https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions';
/** Catalog of every available edition (~60 KB, fetched only on demand). */
export const EDITIONS_CATALOG_URL = 'https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions.json';

/**
 * A short, curated list for the settings screen. The full catalog (~440
 * editions, every language) can be loaded on demand via `listEditions()`.
 * @type {{id:string, label:string, language:string, direction:'rtl'|'ltr'}[]}
 */
export const FEATURED_TRANSLATIONS = [
  { id: 'ara-sirajtafseer', label: 'تفسير السراج — عربي', language: 'ar', direction: 'rtl' },
  { id: 'ara-jalaladdinalmah', label: 'تفسير الجلالين — عربي', language: 'ar', direction: 'rtl' },
  { id: 'eng-mustafakhattaba', label: 'The Clear Quran — Dr. Mustafa Khattab', language: 'en', direction: 'ltr' },
  { id: 'eng-abdelhaleem', label: 'M. A. S. Abdel Haleem', language: 'en', direction: 'ltr' },
  { id: 'eng-abdullahyusufal', label: 'Abdullah Yusuf Ali', language: 'en', direction: 'ltr' },
  { id: 'eng-mohammedmarmadu', label: 'Marmaduke Pickthall', language: 'en', direction: 'ltr' },
  { id: 'eng-ajarberry', label: 'A. J. Arberry', language: 'en', direction: 'ltr' },
  { id: 'eng-muhammadasad', label: 'Muhammad Asad', language: 'en', direction: 'ltr' },
  { id: 'eng-talalitani', label: 'Talal Itani', language: 'en', direction: 'ltr' },
  { id: 'eng-wahiduddinkhan', label: 'Wahiduddin Khan', language: 'en', direction: 'ltr' },
  { id: 'fra-muhammadhamidul', label: 'Muhammad Hamidullah — français', language: 'fr', direction: 'ltr' },
  { id: 'ind-indonesianislam', label: 'Kemenag — Indonesia', language: 'id', direction: 'ltr' },
];

export const CACHE_KEYS = {
  editions: 'editions:v1',
  chapter: (edition, chapter) => `translation:${edition}:${chapter}:v1`,
};

/** @param {string} id */
export function getFeaturedTranslation(id) {
  return FEATURED_TRANSLATIONS.find((item) => item.id === id) ?? null;
}

/** @param {string} edition @param {number} chapter @param {{baseUrl?:string}} [options] */
export function buildEditionChapterUrl(edition, chapter, options = {}) {
  const baseUrl = options.baseUrl ?? EDITIONS_BASE;
  return `${baseUrl}/${encodeURIComponent(edition)}/${chapter}.json`;
}

/**
 * Accepts the edition file shape (`{chapter:[{chapter,verse,text}]}`), the
 * full-edition shape (`{quran:[...]}`) or a bare array.
 * @param {any} payload
 * @returns {{surah:number, ayah:number, text:string}[]}
 */
export function normalizeEditionPayload(payload) {
  const rows = payload?.chapter ?? payload?.quran ?? (Array.isArray(payload) ? payload : []);
  return rows
    .map((row) => {
      const surah = Number(row?.chapter ?? row?.surah);
      const ayah = Number(row?.verse ?? row?.ayah);
      const text = row?.text;
      if (!Number.isFinite(surah) || !Number.isFinite(ayah) || typeof text !== 'string') return null;
      return { surah, ayah, text };
    })
    .filter(Boolean)
    .sort((a, b) => a.ayah - b.ayah);
}

/**
 * @param {{fetchImpl?: typeof fetch, baseUrl?: string, cache?: any,
 *   timeoutMs?: number}} [options]
 */
export function createTranslations(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  const baseUrl = options.baseUrl ?? EDITIONS_BASE;
  const catalogUrl = options.catalogUrl ?? EDITIONS_CATALOG_URL;
  const timeoutMs = options.timeoutMs ?? 25000;
  /** @type {Promise<any>} */
  let cachePromise = options.cache ? Promise.resolve(options.cache) : createCache();
  /** @type {Map<string, {surah:number,ayah:number,text:string}[]>} */
  const memory = new Map();

  const getCache = () => cachePromise;

  /** @param {string} url */
  async function request(url) {
    if (typeof fetchImpl !== 'function') throw new Error('fetch is not available in this environment');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { signal: controller.signal, headers: { accept: 'application/json' } });
      if (!response.ok) throw new Error(`request failed (${response.status})`);
      return await response.json();
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    async setCache(next) {
      cachePromise = Promise.resolve(next);
      memory.clear();
    },

    /** @param {string} edition @param {number} chapter */
    async getChapter(edition, chapter) {
      const key = `${edition}:${chapter}`;
      if (memory.has(key)) return memory.get(key).map((verse) => ({ ...verse }));
      const cache = await getCache();
      const cacheKey = CACHE_KEYS.chapter(edition, chapter);
      const cached = await cache.get(cacheKey);
      if (cached?.length) {
        memory.set(key, cached);
        return cached.map((verse) => ({ ...verse }));
      }
      const payload = await request(buildEditionChapterUrl(edition, chapter, { baseUrl }));
      const verses = normalizeEditionPayload(payload);
      if (verses.length) {
        await cache.set(cacheKey, verses);
        memory.set(key, verses);
      }
      return verses.map((verse) => ({ ...verse }));
    },

    /** @param {string} edition @param {number} surah @param {number} ayah */
    async getVerse(edition, surah, ayah) {
      const verses = await this.getChapter(edition, surah);
      return verses.find((verse) => verse.ayah === ayah) ?? null;
    },

    /**
     * The complete editions catalog. Fetch once, then cached — the payload is
     * around 60 KB.
     * @returns {Promise<{id:string,label:string,language:string,direction:string}[]>}
     */
    async listEditions() {
      const cache = await getCache();
      const cached = await cache.get(CACHE_KEYS.editions);
      if (cached?.length) return cached;
      const payload = await request(catalogUrl);
      const list = Object.values(payload ?? {})
        .map((entry) => ({
          id: String(entry?.name ?? ''),
          label: String(entry?.author ?? entry?.name ?? ''),
          language: String(entry?.language ?? ''),
          direction: entry?.direction === 'rtl' ? 'rtl' : 'ltr',
        }))
        .filter((entry) => entry.id)
        .sort((a, b) => a.language.localeCompare(b.language) || a.label.localeCompare(b.label));
      if (list.length) await cache.set(CACHE_KEYS.editions, list);
      return list;
    },
  };
}
