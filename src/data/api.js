/**
 * Data access layer.
 *
 * **Every source here is a static file on a CORS-enabled CDN.** That is a
 * deliberate architectural decision, not an accident:
 *
 *  * `api.quran.com/api/v4` — the previously used endpoint — is deprecated. Its
 *    replacement (Quran Foundation Content APIs) requires OAuth2 client
 *    credentials on a backend server, so it *cannot* be called from a static
 *    browser application: the official docs state the browser/public flow must
 *    not be used for Content or Search.
 *  * The static edition catalog below needs no key, no auth, sends
 *    `access-control-allow-origin: *`, and serves the whole Quran (text,
 *    translations, tafsir) as plain JSON.
 *
 * See docs/DATA_SOURCES.md for the full picture and for self-hosting advice.
 */
import { createCache } from './cache.js';
import { TOTAL_AYAHS, getSurah } from './surahs.js';

/** Static editions catalog (jsDelivr mirrors the GitHub repository). */
export const EDITION_BASE = 'https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions';

/**
 * Uthmani text editions, tried in order. All three exist in the catalog; the
 * first is the King Fahd Complex Uthmani Hafs text.
 */
export const TEXT_EDITIONS = ['ara-quranuthmanihaf', 'ara-quranacademy', 'ara-quransimple'];

export const PRIMARY_TEXT_EDITION = TEXT_EDITIONS[0];

export const CACHE_KEYS = {
  surah: (surahNumber, edition) => `surah:${edition}:${surahNumber}:v2`,
  fullText: (edition) => `verses:${edition}:v2`,
};

export class ApiError extends Error {
  /** @param {string} message @param {{status?:number, cause?:unknown, offline?:boolean, edition?:string}} [info] */
  constructor(message, info = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = info.status ?? 0;
    this.offline = info.offline ?? false;
    this.edition = info.edition;
    this.cause = info.cause;
  }
}

/** @param {string} edition @param {number} chapter @param {{baseUrl?:string}} [options] */
export function buildChapterUrl(edition, chapter, options = {}) {
  const baseUrl = options.baseUrl ?? EDITION_BASE;
  return `${baseUrl}/${encodeURIComponent(edition)}/${chapter}.json`;
}

/**
 * @param {string} edition
 * @param {{baseUrl?:string, minified?:boolean}} [options]
 */
export function buildEditionUrl(edition, options = {}) {
  const baseUrl = options.baseUrl ?? EDITION_BASE;
  const suffix = options.minified === false ? '' : '.min';
  return `${baseUrl}/${encodeURIComponent(edition)}${suffix}.json`;
}

/**
 * Normalize every shape the text can arrive in into `{ surah, ayah, text }`:
 *  * static editions per chapter: `{ chapter, verse, text }`
 *  * static editions full file:   `{ quran: [ … ] }` (rows as above)
 *  * a hand-authored local dump:  `{ surah, ayah, text }` or `{ verse_key }`
 * @param {any} raw
 */
export function normalizeVerse(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const text = String(raw.text ?? raw.text_uthmani ?? '');

  if (typeof raw.verse_key === 'string') {
    const [keySurah, keyAyah] = raw.verse_key.split(':').map(Number);
    if (!Number.isFinite(keySurah) || !Number.isFinite(keyAyah)) return null;
    return { surah: keySurah, ayah: keyAyah, text };
  }

  const surah = Number(raw.chapter ?? raw.surah ?? NaN);
  const ayah = Number(raw.verse ?? raw.ayah ?? raw.verse_number ?? NaN);
  if (Number.isFinite(surah) && Number.isFinite(ayah) && surah >= 1 && ayah >= 1 && surah <= 114) {
    return { surah, ayah, text };
  }
  return null;
}

/**
 * Pull the verse array out of any supported payload shape.
 * @param {any} payload
 */
export function extractVerses(payload) {
  const rows = payload?.chapter ?? payload?.quran ?? payload?.verses ?? (Array.isArray(payload) ? payload : []);
  return rows.map(normalizeVerse).filter(Boolean).sort((a, b) => a.surah - b.surah || a.ayah - b.ayah);
}

/**
 * @param {{fetchImpl?: typeof fetch, baseUrl?: string, timeoutMs?: number,
 *   cache?: any, editions?: string[]}} [options]
 */
export function createApi(options = {}) {
  const fetchImpl = options.fetchImpl ?? globalThis.fetch?.bind(globalThis);
  const baseUrl = options.baseUrl ?? EDITION_BASE;
  const timeoutMs = options.timeoutMs ?? 30000;
  const editions = options.editions ?? TEXT_EDITIONS;
  /** @type {Promise<any>} */
  let cachePromise = options.cache ? Promise.resolve(options.cache) : createCache();

  /** @type {{surah:number,ayah:number,text:string}[]|null} */
  let fullTextMemory = null;
  /** @type {Map<string, {surah:number,ayah:number,text:string}>|null} */
  let fullTextIndex = null;

  const getCache = () => cachePromise;

  /** @param {string} url */
  async function request(url) {
    if (typeof fetchImpl !== 'function') {
      throw new ApiError('fetch is not available in this environment', { offline: true });
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { signal: controller.signal, headers: { accept: 'application/json' } });
      if (!response.ok) throw new ApiError(`request failed (${response.status})`, { status: response.status });
      return await response.json();
    } catch (error) {
      if (error instanceof ApiError) throw error;
      const offline = error?.name === 'AbortError' || error instanceof TypeError;
      throw new ApiError(
        offline ? 'تعذّر الاتصال بمصدر البيانات — تحقّق من الإنترنت' : String(error?.message ?? error),
        { offline, cause: error },
      );
    } finally {
      clearTimeout(timer);
    }
  }

  const api = {
    get cache() {
      return getCache();
    },

    /** Which editions are available/attempted, in priority order. */
    get editions() {
      return [...editions];
    },

    async setCache(next) {
      cachePromise = Promise.resolve(next);
      fullTextMemory = null;
      fullTextIndex = null;
    },

    /**
     * One surah of Uthmani text. Editions are tried in order and each result is
     * cached separately, so a later outage of the first edition is invisible.
     * @param {number} surahNumber
     * @param {{force?: boolean}} [options]
     * @returns {Promise<{surah:number, edition:string, fetchedAt:number,
     *   verses:{surah:number,ayah:number,text:string}[]}>}
     */
    async getSurah(surahNumber, options = {}) {
      const surah = getSurah(surahNumber);
      if (!surah) throw new ApiError(`سورة غير صحيحة: ${surahNumber}`, { status: 400 });

      const cache = await getCache();
      /** @type {ApiError|null} */
      let lastError = null;

      for (const edition of editions) {
        const key = CACHE_KEYS.surah(surahNumber, edition);
        if (!options.force) {
          // eslint-disable-next-line no-await-in-loop
          const cached = await cache.get(key);
          if (cached?.verses?.length) return cached;
        }
        try {
          // eslint-disable-next-line no-await-in-loop
          const payload = await request(buildChapterUrl(edition, surahNumber, { baseUrl }));
          const verses = extractVerses(payload);
          if (!verses.length) throw new ApiError('لم يُرجع المصدر أي نص', { edition });
          const result = { surah: surahNumber, edition, fetchedAt: Date.now(), verses };
          // eslint-disable-next-line no-await-in-loop
          await cache.set(key, result);
          return result;
        } catch (error) {
          lastError = error instanceof ApiError ? error : new ApiError(String(error), { cause: error });
        }
      }

      throw lastError ?? new ApiError('تعذّر تحميل نص السورة من كل المصادر المتاحة');
    },

    /**
     * Download the whole Quran in a single file (~1.6 MB) and cache it. This is
     * what makes offline reading and full-text search work.
     * @param {{force?: boolean, onProgress?: (state:{phase:string, edition?:string}) => void}} [options]
     */
    async downloadFullText(options = {}) {
      if (fullTextMemory && !options.force) return fullTextMemory;
      const cache = await getCache();
      if (!options.force) {
        for (const edition of editions) {
          // eslint-disable-next-line no-await-in-loop
          const cached = await cache.get(CACHE_KEYS.fullText(edition));
          if (cached?.verses?.length) {
            fullTextMemory = cached.verses;
            return fullTextMemory;
          }
        }
      }

      /** @type {ApiError|null} */
      let lastError = null;
      for (const edition of editions) {
        options.onProgress?.({ phase: 'downloading', edition });
        try {
          // eslint-disable-next-line no-await-in-loop
          const payload = await request(buildEditionUrl(edition, { baseUrl }));
          const verses = extractVerses(payload);
          if (verses.length < 6000) {
            throw new ApiError(`النص المُنزَّل غير مكتمل (${verses.length} آية)`, { edition });
          }
          // eslint-disable-next-line no-await-in-loop
          await cache.set(CACHE_KEYS.fullText(edition), { verses, edition, fetchedAt: Date.now() });
          fullTextMemory = verses;
          options.onProgress?.({ phase: 'done', edition });
          return verses;
        } catch (error) {
          lastError = error instanceof ApiError ? error : new ApiError(String(error), { cause: error });
        }
      }
      throw lastError ?? new ApiError('تعذّر تنزيل النص الكامل');
    },

    async hasFullText() {
      if (fullTextMemory) return true;
      const cache = await getCache();
      for (const edition of editions) {
        // eslint-disable-next-line no-await-in-loop
        const cached = await cache.get(CACHE_KEYS.fullText(edition));
        if (cached?.verses?.length) return true;
      }
      return false;
    },

    /** Cached full text without triggering a download, or `null`. */
    async peekFullText() {
      if (fullTextMemory) return fullTextMemory;
      const cache = await getCache();
      for (const edition of editions) {
        // eslint-disable-next-line no-await-in-loop
        const cached = await cache.get(CACHE_KEYS.fullText(edition));
        if (cached?.verses?.length) {
          fullTextMemory = cached.verses;
          return fullTextMemory;
        }
      }
      return null;
    },

    /** @returns {Promise<Map<string, {surah:number,ayah:number,text:string}>>} */
    async getVerseIndex() {
      if (fullTextIndex) return fullTextIndex;
      const verses = (await api.peekFullText()) ?? (await api.downloadFullText());
      fullTextIndex = new Map(verses.map((verse) => [`${verse.surah}:${verse.ayah}`, verse]));
      return fullTextIndex;
    },

    /** @param {number} surahNumber @param {number} ayahNumber */
    async getVerse(surahNumber, ayahNumber) {
      const index = await api.getVerseIndex();
      return index.get(`${surahNumber}:${ayahNumber}`) ?? null;
    },

    /** Metadata about local storage, for the settings screen. */
    async storageReport() {
      const cache = await getCache();
      const keys = await cache.keys();
      /** @type {any} */
      let full = null;
      for (const edition of editions) {
        // eslint-disable-next-line no-await-in-loop
        const cached = await cache.get(CACHE_KEYS.fullText(edition));
        if (cached?.verses?.length) {
          full = cached;
          break;
        }
      }
      return {
        backend: cache.kind,
        entries: keys.length,
        hasFullText: Boolean(full?.verses?.length),
        fullTextVerses: full?.verses?.length ?? 0,
        expectedVerses: TOTAL_AYAHS,
        edition: full?.edition ?? null,
        downloadedAt: full?.fetchedAt ?? null,
      };
    },

    async clearCache() {
      const cache = await getCache();
      await cache.clear();
      fullTextMemory = null;
      fullTextIndex = null;
    },

    /**
     * Fetch several surahs sequentially — friendlier to a volunteer-funded CDN
     * than a burst of parallel requests.
     * @param {number[]} surahNumbers
     * @param {{onProgress?: (done:number,total:number) => void}} [options]
     */
    async prefetchSurahs(surahNumbers, options = {}) {
      let done = 0;
      for (const surahNumber of surahNumbers) {
        try {
          // eslint-disable-next-line no-await-in-loop
          await api.getSurah(surahNumber);
        } catch {
          // Keep going: a single failure must not abort a bulk download.
        }
        done += 1;
        options.onProgress?.(done, surahNumbers.length);
      }
      return done;
    },
  };

  return api;
}
