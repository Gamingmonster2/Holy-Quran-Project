import { createStorage, memoryStorage } from '../src/core/storage.js';
import { MAX_RECENT_PAGES, bookmarkId, createStore, normalizeBookmark } from '../src/core/store.js';
import { assertDeepEqual, assertEqual, assertFalse, assertThrows, assertTrue, test } from './harness.mjs';

const freshStore = () => createStore({ storage: createStorage(memoryStorage()) });

test('a new store starts empty and reports whether storage persists', () => {
  const store = freshStore();
  const state = store.getState();
  assertEqual(state.bookmarks.length, 0);
  assertEqual(state.tags.length, 0);
  assertEqual(state.lastRead, null);
  assertTrue(state.persistent, 'an explicit memory storage is still persistent for the session');
});

test('bookmark identity is stable for ayah and page targets', () => {
  assertEqual(bookmarkId({ type: 'ayah', surah: 2, ayah: 255 }), 'ayah:2:255');
  assertEqual(bookmarkId({ type: 'page', page: 604 }), 'page:604');
});

test('adding an ayah bookmark is idempotent and toggleable', () => {
  const store = freshStore();
  store.addBookmark({ type: 'ayah', surah: 2, ayah: 255 });
  store.addBookmark({ type: 'ayah', surah: 2, ayah: 255 });

  assertEqual(store.listBookmarks().length, 1);
  assertTrue(store.isBookmarked({ type: 'ayah', surah: 2, ayah: 255 }));

  assertEqual(store.toggleBookmark({ type: 'ayah', surah: 2, ayah: 255 }), false);
  assertFalse(store.isBookmarked({ type: 'ayah', surah: 2, ayah: 255 }));
  assertEqual(store.listBookmarks().length, 0);
});

test('page bookmarks are stored separately from ayah bookmarks', () => {
  const store = freshStore();
  store.addBookmark({ type: 'page', page: 255 });
  store.addBookmark({ type: 'ayah', surah: 2, ayah: 255 });
  assertEqual(store.listBookmarks().length, 2);
  assertTrue(store.isBookmarked({ type: 'page', page: 255 }));
  assertFalse(store.isBookmarked({ type: 'page', page: 256 }));
});

test('removing a bookmark that does not exist is a no-op', () => {
  const store = freshStore();
  assertEqual(store.removeBookmark({ type: 'page', page: 12 }), false);
});

test('tags are unique by name and detach from bookmarks when removed', () => {
  const store = freshStore();
  const tag = store.addTag('وردي');
  const duplicate = store.addTag('وردي');
  assertEqual(tag.id, duplicate.id, 'adding the same name returns the existing tag');

  store.addBookmark({ type: 'ayah', surah: 18, ayah: 10, tagId: tag.id });
  assertEqual(store.listBookmarks(tag.id).length, 1);

  store.removeTag(tag.id);
  assertEqual(store.listTags().length, 0);
  assertEqual(store.listBookmarks()[0].tagId, null);
  assertThrows(() => store.addTag('   '), 'blank tag names are rejected');
});

test('recent pages dedupe, move to the front and are capped', () => {
  const store = freshStore();
  store.addRecentPage(5);
  store.addRecentPage(6);
  store.addRecentPage(5);

  const recent = store.listRecentPages();
  assertEqual(recent.length, 2);
  assertEqual(recent[0].page, 5, 're-reading a page moves it to the front');

  for (let page = 1; page <= 40; page += 1) store.addRecentPage(page);
  assertEqual(store.listRecentPages(1000).length, MAX_RECENT_PAGES);
  assertEqual(store.addRecentPage(9999), null, 'invalid pages are ignored');
});

test('the last-read position survives a reload', () => {
  const storage = createStorage(memoryStorage());
  const first = createStore({ storage });
  first.setLastRead({ surah: 2, ayah: 255, page: 42 });

  const second = createStore({ storage });
  assertEqual(second.getLastRead().surah, 2);
  assertEqual(second.getLastRead().page, 42);
});

test('settings persist, validate keys and reset to defaults', () => {
  const storage = createStorage(memoryStorage());
  const store = createStore({ storage });
  store.setSetting('theme', 'dark');
  store.setSetting('fontSize', 5);

  const reloaded = createStore({ storage });
  assertEqual(reloaded.getSetting('theme'), 'dark');
  assertEqual(reloaded.getSetting('fontSize'), 5);

  assertThrows(() => store.setSetting('nope', 1));
  reloaded.resetSettings();
  assertEqual(reloaded.getSetting('theme'), 'auto');
});

test('export and import round-trip bookmarks and tags', () => {
  const source = freshStore();
  const tag = source.addTag('حفظ');
  source.addBookmark({ type: 'ayah', surah: 36, ayah: 1, tagId: tag.id });
  source.addBookmark({ type: 'page', page: 300 });

  const target = freshStore();
  const summary = target.importJson(source.exportJson());
  assertEqual(summary.bookmarks, 2);
  assertEqual(target.listTags().length, 1);
  assertEqual(target.listBookmarks().length, 2);

  const imported = target.listBookmarks().find((bookmark) => bookmark.type === 'ayah');
  assertEqual(imported.surah, 36);
  assertEqual(imported.tagId, target.listTags()[0].id, 'tag ids are remapped on import');
  assertThrows(() => target.importJson('null'));
});

test('importing merges into existing data instead of replacing it', () => {
  const target = freshStore();
  target.addBookmark({ type: 'page', page: 1 });

  const source = freshStore();
  source.addBookmark({ type: 'page', page: 2 });
  target.importJson(source.exportJson());

  assertEqual(target.listBookmarks().length, 2);
});

test('corrupted storage entries are dropped rather than crashing the store', () => {
  const backing = memoryStorage();
  backing.setItem('quran-web:bookmarks', '{not json');
  backing.setItem('quran-web:tags', '{"also":"wrong"}');
  const store = createStore({ storage: createStorage(backing) });
  assertEqual(store.listBookmarks().length, 0);
  assertEqual(store.listTags().length, 0);
});

test('invalid bookmark payloads are rejected by the normalizer', () => {
  assertEqual(normalizeBookmark(null), null);
  assertEqual(normalizeBookmark({ type: 'ayah', surah: 0, ayah: 1 }), null);
  assertEqual(normalizeBookmark({ type: 'page', page: 900 }), null);
  assertDeepEqual(normalizeBookmark({ type: 'page', page: 12 }).id, 'page:12');
});

test('subscribers are notified on every mutation', () => {
  const store = freshStore();
  const seen = [];
  const unsubscribe = store.subscribe(({ what }) => seen.push(what));
  store.addBookmark({ type: 'page', page: 3 });
  store.setSetting('theme', 'sepia');
  unsubscribe();
  store.addBookmark({ type: 'page', page: 4 });
  assertDeepEqual(seen, ['bookmarks', 'settings']);
});
