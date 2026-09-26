import {
  ApiError, CACHE_KEYS, EDITION_BASE, PRIMARY_TEXT_EDITION, TEXT_EDITIONS,
  buildChapterUrl, buildEditionUrl, createApi, extractVerses, normalizeVerse,
} from '../src/data/api.js';
import { createCache } from '../src/data/cache.js';
import { assertDeepEqual, assertEqual, assertIncludes, assertRejects, assertTrue, test, fakeFetch } from './harness.mjs';

/** A chapter payload exactly as the static editions catalog returns it. */
const CHAPTER_112 = {
  chapter: [
    { chapter: 112, verse: 1, text: 'قُلۡ هُوَ ٱللَّهُ أَحَدٌ' },
    { chapter: 112, verse: 2, text: 'ٱللَّهُ ٱلصَّمَدُ' },
  ],
};

const FULL_EDITION = {
  quran: [
    { chapter: 1, verse: 1, text: 'بِسْمِ ٱللَّهِ' },
    { chapter: 1, verse: 2, text: 'ٱلْحَمْدُ لِلَّهِ' },
    { chapter: 2, verse: 1, text: 'الٓمٓ' },
  ],
};

/** More than 6000 rows, so the completeness check passes. */
function largeEdition() {
  const quran = [];
  for (let surah = 1; surah <= 114; surah += 1) {
    const count = surah === 1 ? 7 : 60;
    for (let ayah = 1; ayah <= count; ayah += 1) quran.push({ chapter: surah, verse: ayah, text: `نص ${surah}:${ayah}` });
  }
  return { quran };
}

async function makeApi(routes, options = {}) {
  const fetchImpl = fakeFetch(routes, options);
  const api = createApi({
    fetchImpl,
    baseUrl: 'https://test.local/editions',
    cache: await createCache({ preferMemory: true }),
    editions: options.editions ?? TEXT_EDITIONS,
  });
  return { api, fetchImpl };
}

test('chapter and edition urls follow the static catalog layout', () => {
  assertEqual(buildChapterUrl('ara-quranuthmanihaf', 2), `${EDITION_BASE}/ara-quranuthmanihaf/2.json`);
  assertEqual(buildEditionUrl('ara-quranuthmanihaf'), `${EDITION_BASE}/ara-quranuthmanihaf.min.json`);
  assertIncludes(buildEditionUrl('ara-quranuthmanihaf', { minified: false }), '/ara-quranuthmanihaf.json');
  assertIncludes(buildChapterUrl('eng-abdelhaleem', 1, { baseUrl: 'https://mirror.local/e' }), 'https://mirror.local/e/eng-abdelhaleem/1.json');
});

test('the primary text edition is the first fallback candidate', () => {
  assertEqual(PRIMARY_TEXT_EDITION, 'ara-quranuthmanihaf');
  assertTrue(TEXT_EDITIONS.includes(PRIMARY_TEXT_EDITION));
  assertEqual(new Set(TEXT_EDITIONS).size, TEXT_EDITIONS.length, 'editions must not repeat');
});

test('normalizeVerse understands every supported payload shape', () => {
  assertDeepEqual(normalizeVerse({ chapter: 112, verse: 2, text: 'آية' }), { surah: 112, ayah: 2, text: 'آية' });
  assertDeepEqual(normalizeVerse({ surah: 2, ayah: 255, text: 'آية' }), { surah: 2, ayah: 255, text: 'آية' });
  assertDeepEqual(normalizeVerse({ verse_key: '2:255', text_uthmani: 'آية' }), { surah: 2, ayah: 255, text: 'آية' });
  assertEqual(normalizeVerse({ nothing: true }), null);
  assertEqual(normalizeVerse(null), null);
  assertEqual(normalizeVerse({ chapter: 115, verse: 1, text: 'x' }), null, 'surah numbers above 114 are rejected');
});

test('extractVerses handles the per-chapter, full-edition and bare-array shapes', () => {
  assertEqual(extractVerses(CHAPTER_112).length, 2);
  assertEqual(extractVerses(FULL_EDITION).length, 3);
  assertEqual(extractVerses([{ chapter: 1, verse: 1, text: 'x' }]).length, 1);
  assertDeepEqual(extractVerses(FULL_EDITION).map((verse) => verse.surah), [1, 1, 2]);
  assertEqual(extractVerses({}).length, 0);
});

test('getSurah returns the verses of the requested chapter', async () => {
  const { api } = await makeApi({ '/ara-quranuthmanihaf/112.json': CHAPTER_112 });
  const payload = await api.getSurah(112);
  assertEqual(payload.surah, 112);
  assertEqual(payload.edition, 'ara-quranuthmanihaf');
  assertEqual(payload.verses.length, 2);
  assertEqual(payload.verses[0].text, 'قُلۡ هُوَ ٱللَّهُ أَحَدٌ');
});

test('getSurah serves the second call from the cache', async () => {
  const { api, fetchImpl } = await makeApi({ '/ara-quranuthmanihaf/112.json': CHAPTER_112 });
  await api.getSurah(112);
  await api.getSurah(112);
  assertEqual(fetchImpl.calls.length, 1);
});

test('getSurah falls back to the next edition when the first one fails', async () => {
  const { api, fetchImpl } = await makeApi(
    { '/ara-quranacademy/112.json': CHAPTER_112 },
    { editions: ['ara-quranuthmanihaf', 'ara-quranacademy'] },
  );
  const payload = await api.getSurah(112);
  assertEqual(payload.edition, 'ara-quranacademy');
  assertEqual(fetchImpl.calls.length, 2, 'the primary edition is tried first');
});

test('getSurah reports the failure only after every edition failed', async () => {
  const { api } = await makeApi({}, { editions: ['ara-quranuthmanihaf', 'ara-quranacademy'] });
  await assertRejects(() => api.getSurah(112));
});

test('an invalid surah is rejected before any network call', async () => {
  const { api, fetchImpl } = await makeApi({});
  await assertRejects(() => api.getSurah(115));
  assertEqual(fetchImpl.calls.length, 0);
});

test('downloadFullText caches the whole text and re-serves it', async () => {
  const { api, fetchImpl } = await makeApi({ '.min.json': largeEdition() });
  const verses = await api.downloadFullText();
  assertTrue(verses.length >= 6000);
  assertTrue(await api.hasFullText());

  const again = await api.downloadFullText();
  assertEqual(again.length, verses.length);
  assertEqual(fetchImpl.calls.length, 1, 'the download happens once');
});

test('an incomplete download is rejected and the next edition is tried', async () => {
  const { api } = await makeApi(
    { '/ara-quranuthmanihaf.min.json': FULL_EDITION, '/ara-quranacademy.min.json': largeEdition() },
    { editions: ['ara-quranuthmanihaf', 'ara-quranacademy'] },
  );
  const verses = await api.downloadFullText();
  assertTrue(verses.length >= 6000, 'the complete edition wins over the truncated one');
});

test('downloadFullText fails loudly when no edition yields a complete text', async () => {
  const { api } = await makeApi({ '.min.json': FULL_EDITION });
  await assertRejects(() => api.downloadFullText());
});

test('an offline download surfaces a localized, retryable error', async () => {
  const { api } = await makeApi({}, { failOn: ['.min.json'], editions: ['ara-quranuthmanihaf'] });
  try {
    await api.downloadFullText();
    assertTrue(false, 'expected the download to fail');
  } catch (error) {
    assertTrue(error instanceof ApiError);
    assertTrue(error.offline, 'a TypeError from fetch must be reported as offline');
    assertIncludes(error.message, 'تعذّر الاتصال');
  }
});

test('getVerseIndex allows O(1) lookup without another network call', async () => {
  const { api, fetchImpl } = await makeApi({ '.min.json': largeEdition() });
  const verse = await api.getVerse(2, 1);
  assertEqual(verse.text, 'نص 2:1');
  assertEqual(fetchImpl.calls.length, 1);
});

test('storageReport describes what is cached locally', async () => {
  const { api } = await makeApi({ '.min.json': largeEdition() });
  await api.downloadFullText();
  const report = await api.storageReport();
  assertEqual(report.backend, 'memory');
  assertTrue(report.hasFullText);
  assertEqual(report.edition, 'ara-quranuthmanihaf');
  assertTrue(report.fullTextVerses >= 6000);
  assertEqual(report.expectedVerses, 6236);
});

test('clearCache empties the cache and forces a fresh download', async () => {
  const { api, fetchImpl } = await makeApi({ '.min.json': largeEdition() });
  await api.downloadFullText();
  await api.clearCache();
  assertEqual(await api.hasFullText(), false);
  await api.downloadFullText();
  assertEqual(fetchImpl.calls.length, 2);
});

test('prefetchSurahs keeps going after a failure and reports progress', async () => {
  const routes = { '/ara-quranuthmanihaf/1.json': CHAPTER_112, '/ara-quranuthmanihaf/3.json': CHAPTER_112 };
  const { api } = await makeApi(routes, { editions: ['ara-quranuthmanihaf'] });
  const seen = [];
  const done = await api.prefetchSurahs([1, 2, 3], { onProgress: (count, total) => seen.push(`${count}/${total}`) });
  assertEqual(done, 3);
  assertDeepEqual(seen, ['1/3', '2/3', '3/3']);
});

test('cache keys include the edition so fallbacks do not collide', () => {
  assertEqual(CACHE_KEYS.surah(2, 'ara-quranuthmanihaf'), 'surah:ara-quranuthmanihaf:2:v2');
  assertEqual(CACHE_KEYS.fullText('ara-quranacademy'), 'verses:ara-quranacademy:v2');
});
