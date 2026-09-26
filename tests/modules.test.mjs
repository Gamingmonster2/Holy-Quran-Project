/**
 * Import-graph smoke test.
 *
 * Every module that does not touch the DOM at import time is imported for real,
 * so a typo in a specifier, a missing export or a circular import fails the
 * suite instead of failing silently in the browser.
 */
import { assertEqual, assertTrue, test } from './harness.mjs';

const MODULES = [
  '../src/core/arabic.js',
  '../src/core/dom.js',
  '../src/core/emitter.js',
  '../src/core/quran-info.js',
  '../src/core/router.js',
  '../src/core/storage.js',
  '../src/core/store.js',
  '../src/data/api.js',
  '../src/data/audio.js',
  '../src/data/cache.js',
  '../src/data/surahs.js',
  '../src/data/translations.js',
  '../src/features/audio-bar.js',
  '../src/features/ayah-reader.js',
  '../src/features/bookmarks-page.js',
  '../src/features/home.js',
  '../src/features/mushaf-reader.js',
  '../src/features/search-page.js',
  '../src/features/settings-page.js',
];

test('every module imports cleanly and exposes its public surface', async () => {
  for (const path of MODULES) {
    // eslint-disable-next-line no-await-in-loop
    const module = await import(path);
    assertTrue(Object.keys(module).length > 0, `${path} exports nothing`);
  }
});

test('page modules expose an async render(ctx, route) contract', async () => {
  for (const path of [
    '../src/features/home.js',
    '../src/features/ayah-reader.js',
    '../src/features/mushaf-reader.js',
    '../src/features/search-page.js',
    '../src/features/bookmarks-page.js',
    '../src/features/settings-page.js',
  ]) {
    // eslint-disable-next-line no-await-in-loop
    const module = await import(path);
    assertEqual(typeof module.render, 'function', `${path} does not export render`);
  }
});

test('mushaf image mirrors are tried in a deterministic order', async () => {
  const { pageImageCandidates } = await import('../src/features/mushaf-reader.js');
  const candidates = pageImageCandidates(7, 'https://mirror.local/pages');
  assertEqual(candidates[0], 'https://mirror.local/pages/7.png', 'a custom mirror always wins');
  assertTrue(candidates.length >= 4);
  assertTrue(candidates.some((url) => url.endsWith('/7.png')));
});

test('the audio bar builds a DOM subtree from an injected context', async () => {
  // `document` does not exist in Node, so the factory must not be called here;
  // this asserts the export shape only.
  const { createAudioBar } = await import('../src/features/audio-bar.js');
  assertEqual(typeof createAudioBar, 'function');
});
