/**
 * Application store.
 *
 * Web counterpart of the Android app's `common:bookmark` + `common:preference`
 * modules: bookmarks (ayah and page), tags, recent pages, last-read position and
 * user settings. State lives in memory and is mirrored to `storage` on every
 * mutation, so the reader keeps working when storage is missing.
 */
import { createEmitter } from './emitter.js';
import { createStorage } from './storage.js';

export const STORAGE_KEYS = {
  settings: 'settings',
  bookmarks: 'bookmarks',
  tags: 'tags',
  recent: 'recent-pages',
  lastRead: 'last-read',
};

export const DEFAULT_SETTINGS = Object.freeze({
  /** auto | light | dark | sepia */
  theme: 'auto',
  /** 1..6 text scale steps */
  fontSize: 3,
  /** edition id from src/data/translations.js */
  translationEdition: 'ara-sirajtafseer',
  translationEnabled: true,
  /** '' means "use the built-in list of mushaf image mirrors" */
  mushafImageBase: '',
  reciterId: 'alafasy',
  /** off | one | all */
  repeatMode: 'off',
  autoScroll: true,
  /** show the ayah text panel on the mushaf page reader */
  showPageOverlay: true,
});

export const MAX_RECENT_PAGES = 30;
const MAX_TAG_NAME = 32;

/**
 * Stable identity for a bookmark, so toggling is idempotent.
 * @param {{type:'ayah'|'page', surah?:number, ayah?:number, page?:number}} target
 */
export function bookmarkId(target) {
  if (target.type === 'page') return `page:${target.page}`;
  return `ayah:${target.surah}:${target.ayah}`;
}

/** @param {unknown} value */
function asInt(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : fallback;
}

/**
 * Coerce a bookmark shaped object into a valid bookmark, or `null` when it is
 * unusable. Keeps corrupted/legacy entries from crashing the UI.
 * @param {any} raw
 */
export function normalizeBookmark(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const type = raw.type === 'page' ? 'page' : 'ayah';
  const surah = asInt(raw.surah, 0);
  const ayah = asInt(raw.ayah, 0);
  const page = asInt(raw.page, 0);
  if (type === 'ayah' && (surah < 1 || ayah < 1)) return null;
  if (type === 'page' && (page < 1 || page > 604)) return null;

  const target = { type, surah, ayah, page };
  return {
    id: typeof raw.id === 'string' && raw.id ? raw.id : bookmarkId(target),
    type,
    surah,
    ayah,
    page,
    tagId: typeof raw.tagId === 'string' ? raw.tagId : null,
    note: typeof raw.note === 'string' ? raw.note.slice(0, 500) : '',
    createdAt: asInt(raw.createdAt, Date.now()),
  };
}

/** @param {any} raw */
function normalizeTag(raw) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null;
  const name = String(raw.name ?? '').trim().slice(0, MAX_TAG_NAME);
  if (!name) return null;
  return { id: raw.id, name, color: typeof raw.color === 'string' ? raw.color : '#2e7d32', createdAt: asInt(raw.createdAt, Date.now()) };
}

/** @param {any} raw */
function normalizeRecent(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const page = asInt(raw.page, 0);
  if (page < 1 || page > 604) return null;
  return {
    page,
    surah: asInt(raw.surah, 0),
    ayah: asInt(raw.ayah, 0),
    at: asInt(raw.at, Date.now()),
  };
}

/**
 * @param {{storage?: ReturnType<typeof createStorage>}} [options]
 */
export function createStore(options = {}) {
  const storage = options.storage ?? createStorage();
  const emitter = createEmitter();

  const storedSettings = storage.read(STORAGE_KEYS.settings, {});
  const settings = {
    ...DEFAULT_SETTINGS,
    ...(storedSettings && typeof storedSettings === 'object' && !Array.isArray(storedSettings) ? storedSettings : {}),
  };

  /** @param {string} key */
  const readArray = (key) => {
    const value = storage.read(key, []);
    return Array.isArray(value) ? value : [];
  };

  /** @type {ReturnType<typeof normalizeBookmark>[]} */
  const bookmarks = readArray(STORAGE_KEYS.bookmarks).map(normalizeBookmark).filter(Boolean);
  /** @type {ReturnType<typeof normalizeTag>[]} */
  const tags = readArray(STORAGE_KEYS.tags).map(normalizeTag).filter(Boolean);
  /** @type {ReturnType<typeof normalizeRecent>[]} */
  const recentPages = readArray(STORAGE_KEYS.recent).map(normalizeRecent).filter(Boolean);
  /** @type {{surah:number, ayah:number, page:number, at:number}|null} */
  let lastRead = (() => {
    const raw = storage.read(STORAGE_KEYS.lastRead, null);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const surah = asInt(raw.surah, 0);
    const ayah = asInt(raw.ayah, 0);
    if (surah < 1 || ayah < 1) return null;
    return { surah, ayah, page: Math.min(604, Math.max(1, asInt(raw.page, 1))), at: asInt(raw.at, Date.now()) };
  })();

  const persist = {
    settings: () => storage.write(STORAGE_KEYS.settings, settings),
    bookmarks: () => storage.write(STORAGE_KEYS.bookmarks, bookmarks),
    tags: () => storage.write(STORAGE_KEYS.tags, tags),
    recent: () => storage.write(STORAGE_KEYS.recent, recentPages),
    lastRead: () => storage.write(STORAGE_KEYS.lastRead, lastRead),
  };

  const changed = (what) => emitter.emit('change', { what, state: api.getState() });

  /** @param {{type:'ayah'|'page', surah?:number, ayah?:number, page?:number}} target */
  function findBookmark(target) {
    const id = bookmarkId(target);
    return bookmarks.find((bookmark) => bookmark.id === id) ?? null;
  }

  const api = {
    /** @returns {ReturnType<typeof createEmitter>} */
    get emitter() {
      return emitter;
    },

    /** @param {(payload:{what:string, state:any}) => void} handler */
    subscribe(handler) {
      return emitter.on('change', handler);
    },

    getState() {
      return {
        settings: { ...settings },
        bookmarks: bookmarks.map((bookmark) => ({ ...bookmark })),
        tags: tags.map((tag) => ({ ...tag })),
        recentPages: recentPages.map((entry) => ({ ...entry })),
        lastRead: lastRead ? { ...lastRead } : null,
        persistent: storage.persistent,
      };
    },

    // ---------------------------------------------------------------- settings

    /** @param {keyof typeof DEFAULT_SETTINGS} key @param {unknown} value */
    setSetting(key, value) {
      if (!(key in DEFAULT_SETTINGS)) throw new Error(`unknown setting: ${key}`);
      settings[key] = value;
      persist.settings();
      changed('settings');
      return settings[key];
    },

    getSetting(key) {
      return settings[key];
    },

    resetSettings() {
      Object.assign(settings, DEFAULT_SETTINGS);
      persist.settings();
      changed('settings');
    },

    // --------------------------------------------------------------- bookmarks

    /** @param {{type:'ayah'|'page', surah?:number, ayah?:number, page?:number}} target */
    isBookmarked(target) {
      return findBookmark(target) !== null;
    },

    /**
     * @param {{type:'ayah'|'page', surah?:number, ayah?:number, page?:number,
     *   tagId?:string|null, note?:string, createdAt?:number}} target
     */
    addBookmark(target) {
      const bookmark = normalizeBookmark({ ...target, createdAt: target.createdAt ?? Date.now() });
      if (!bookmark) throw new Error('invalid bookmark target');
      const existingIndex = bookmarks.findIndex((entry) => entry.id === bookmark.id);
      if (existingIndex >= 0) bookmarks[existingIndex] = bookmark;
      else bookmarks.push(bookmark);
      persist.bookmarks();
      changed('bookmarks');
      return bookmark;
    },

    /** @param {{type:'ayah'|'page', surah?:number, ayah?:number, page?:number}} target */
    removeBookmark(target) {
      const id = bookmarkId(target);
      const index = bookmarks.findIndex((bookmark) => bookmark.id === id);
      if (index === -1) return false;
      bookmarks.splice(index, 1);
      persist.bookmarks();
      changed('bookmarks');
      return true;
    },

    /**
     * Add the bookmark when absent, remove it when present.
     * @param {{type:'ayah'|'page', surah?:number, ayah?:number, page?:number,
     *   tagId?:string|null}} target
     * @returns {boolean} the new bookmark state
     */
    toggleBookmark(target) {
      if (findBookmark(target)) {
        api.removeBookmark(target);
        return false;
      }
      api.addBookmark(target);
      return true;
    },

    /** @param {string} id */
    setBookmarkTag(id, tagId) {
      const bookmark = bookmarks.find((entry) => entry.id === id);
      if (!bookmark) return null;
      bookmark.tagId = tagId ?? null;
      persist.bookmarks();
      changed('bookmarks');
      return bookmark;
    },

    /** @param {string} [tagId] */
    listBookmarks(tagId) {
      const list = tagId ? bookmarks.filter((bookmark) => bookmark.tagId === tagId) : bookmarks;
      return list
        .map((bookmark) => ({ ...bookmark }))
        .sort((a, b) => b.createdAt - a.createdAt);
    },

    // -------------------------------------------------------------------- tags

    /** @param {string} name @param {string} [color] */
    addTag(name, color) {
      const trimmed = String(name ?? '').trim().slice(0, MAX_TAG_NAME);
      if (!trimmed) throw new Error('tag name is required');
      const existing = tags.find((tag) => tag.name === trimmed);
      if (existing) return { ...existing };
      const tag = { id: `tag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: trimmed, color: color ?? '#2e7d32', createdAt: Date.now() };
      tags.push(tag);
      persist.tags();
      changed('tags');
      return { ...tag };
    },

    /** @param {string} id */
    removeTag(id) {
      const index = tags.findIndex((tag) => tag.id === id);
      if (index === -1) return false;
      tags.splice(index, 1);
      for (const bookmark of bookmarks) if (bookmark.tagId === id) bookmark.tagId = null;
      persist.tags();
      persist.bookmarks();
      changed('tags');
      return true;
    },

    listTags() {
      return tags.map((tag) => ({ ...tag }));
    },

    /** @param {string} id */
    getTag(id) {
      const tag = tags.find((entry) => entry.id === id);
      return tag ? { ...tag } : null;
    },

    // -------------------------------------------------------------- recently read

    /** @param {number} page @param {{surah?:number, ayah?:number}} [position] */
    addRecentPage(page, position = {}) {
      const entry = normalizeRecent({ page, surah: position.surah, ayah: position.ayah, at: Date.now() });
      if (!entry) return null;
      const index = recentPages.findIndex((item) => item.page === entry.page);
      if (index >= 0) recentPages.splice(index, 1);
      recentPages.unshift(entry);
      if (recentPages.length > MAX_RECENT_PAGES) recentPages.length = MAX_RECENT_PAGES;
      persist.recent();
      changed('recent');
      return entry;
    },

    removeRecentPage(page) {
      const index = recentPages.findIndex((entry) => entry.page === page);
      if (index === -1) return false;
      recentPages.splice(index, 1);
      persist.recent();
      changed('recent');
      return true;
    },

    /** @param {number} [limit] */
    listRecentPages(limit = MAX_RECENT_PAGES) {
      return recentPages.slice(0, limit).map((entry) => ({ ...entry }));
    },

    clearRecentPages() {
      recentPages.length = 0;
      persist.recent();
      changed('recent');
    },

    /** @param {{surah:number, ayah:number, page:number}} position */
    setLastRead(position) {
      lastRead = {
        surah: asInt(position.surah, 1),
        ayah: asInt(position.ayah, 1),
        page: asInt(position.page, 1),
        at: Date.now(),
      };
      persist.lastRead();
      changed('lastRead');
      return { ...lastRead };
    },

    getLastRead() {
      return lastRead ? { ...lastRead } : null;
    },

    // ------------------------------------------------------------ import / export

    exportJson() {
      return JSON.stringify(
        {
          app: 'quran-web',
          version: 1,
          exportedAt: new Date().toISOString(),
          bookmarks: bookmarks.map((bookmark) => ({ ...bookmark })),
          tags: tags.map((tag) => ({ ...tag })),
        },
        null,
        2,
      );
    },

    /**
     * Merge an exported payload back in. Existing bookmarks with the same id are
     * replaced; nothing is deleted.
     * @param {string|object} payload
     */
    importJson(payload) {
      const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      if (!data || typeof data !== 'object') throw new Error('invalid backup file');

      const importedTags = Array.isArray(data.tags) ? data.tags.map(normalizeTag).filter(Boolean) : [];
      const tagIdMap = new Map();
      for (const tag of importedTags) {
        const match = tags.find((entry) => entry.name === tag.name);
        if (match) tagIdMap.set(tag.id, match.id);
        else {
          tags.push(tag);
          tagIdMap.set(tag.id, tag.id);
        }
      }

      const importedBookmarks = Array.isArray(data.bookmarks)
        ? data.bookmarks.map(normalizeBookmark).filter(Boolean)
        : [];
      let added = 0;
      for (const bookmark of importedBookmarks) {
        const mapped = { ...bookmark, tagId: bookmark.tagId ? tagIdMap.get(bookmark.tagId) ?? null : null };
        const index = bookmarks.findIndex((entry) => entry.id === mapped.id);
        if (index >= 0) bookmarks[index] = mapped;
        else bookmarks.push(mapped);
        added += 1;
      }

      persist.tags();
      persist.bookmarks();
      changed('import');
      return { tags: importedTags.length, bookmarks: added };
    },
  };

  return api;
}
