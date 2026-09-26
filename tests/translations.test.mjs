import {
  CACHE_KEYS, EDITIONS_BASE, FEATURED_TRANSLATIONS,
  buildEditionChapterUrl, createTranslations, getFeaturedTranslation, normalizeEditionPayload,
} from '../src/data/translations.js';
import { createCache } from '../src/data/cache.js';
import { assertDeepEqual, assertEqual, assertIncludes, assertTrue, test, fakeFetch } from './harness.mjs';

const CHAPTER_PAYLOAD = {
  chapter: [
    { chapter: 112, verse: 2, text: 'Allah—the Sustainer' },
    { chapter: 112, verse: 1, text: 'Say, He is Allah—One' },
    { chapter: 112, verse: 3, text: 'He has never had offspring' },
    { chapter: 112, verse: 4, text: 'And there is none comparable to Him' },
  ],
};

const CATALOG = {
  eng_mustafakhattaba: { name: 'eng-mustafakhattaba', author: 'Mustafa Khattab', language: 'English', direction: 'ltr' },
  ara_sirajtafseer: { name: 'ara-sirajtafseer', author: 'Siraj Tafseer', language: 'Arabic', direction: 'rtl' },
};

async function makeTranslations(routes, options = {}) {
  const fetchImpl = fakeFetch(routes, options);
  const translations = createTranslations({
    fetchImpl,
    baseUrl: 'https://test.local/editions',
    catalogUrl: 'https://test.local/editions.json',
    cache: await createCache({ preferMemory: true }),
  });
  return { translations, fetchImpl };
}

test('edition chapter urls follow the static catalog layout', () => {
  assertEqual(buildEditionChapterUrl('eng-mustafakhattaba', 112), `${EDITIONS_BASE}/eng-mustafakhattaba/112.json`);
  assertIncludes(buildEditionChapterUrl('ara-sirajtafseer', 2, { baseUrl: 'https://mirror.local/e' }), 'https://mirror.local/e/ara-sirajtafseer/2.json');
});

test('normalizeEditionPayload handles the chapter shape and sorts by ayah', () => {
  const verses = normalizeEditionPayload(CHAPTER_PAYLOAD);
  assertDeepEqual(verses.map((verse) => verse.ayah), [1, 2, 3, 4]);
  assertEqual(verses[0].surah, 112);
  assertEqual(verses[0].text, 'Say, He is Allah—One');
});

test('normalizeEditionPayload accepts a bare array and drops malformed rows', () => {
  const verses = normalizeEditionPayload([{ chapter: 1, verse: 1, text: 'بسم الله' }, { chapter: 1, verse: 2 }, null]);
  assertEqual(verses.length, 1);
  assertEqual(normalizeEditionPayload(null).length, 0);
});

test('getChapter fetches once and then serves from the cache', async () => {
  const { translations, fetchImpl } = await makeTranslations({ '/eng-mustafakhattaba/112.json': CHAPTER_PAYLOAD });
  const first = await translations.getChapter('eng-mustafakhattaba', 112);
  const second = await translations.getChapter('eng-mustafakhattaba', 112);
  assertEqual(first.length, 4);
  assertEqual(second.length, 4);
  assertEqual(fetchImpl.calls.length, 1);
});

test('getVerse returns a single ayah from the chapter', async () => {
  const { translations } = await makeTranslations({ '/eng-mustafakhattaba/112.json': CHAPTER_PAYLOAD });
  const verse = await translations.getVerse('eng-mustafakhattaba', 112, 3);
  assertEqual(verse.text, 'He has never had offspring');
  assertEqual(await translations.getVerse('eng-mustafakhattaba', 112, 99), null);
});

test('a missing edition propagates the failure instead of returning junk', async () => {
  const { translations } = await makeTranslations({});
  let failed = false;
  try {
    await translations.getChapter('eng-mustafakhattaba', 112);
  } catch {
    failed = true;
  }
  assertTrue(failed, 'a 404 must reject');
});

test('listEditions maps the catalog into a sorted, displayable list', async () => {
  const { translations } = await makeTranslations({ 'editions.json': CATALOG });
  const editions = await translations.listEditions();
  assertEqual(editions.length, 2);
  assertEqual(editions[0].language, 'Arabic', 'Arabic sorts before English');
  assertEqual(editions[0].label, 'Siraj Tafseer');
  assertEqual(editions[1].direction, 'ltr');
});

test('the featured list is deduplicated and resolvable by id', () => {
  const ids = FEATURED_TRANSLATIONS.map((item) => item.id);
  assertEqual(new Set(ids).size, ids.length);
  assertEqual(getFeaturedTranslation('eng-mustafakhattaba').label, 'The Clear Quran — Dr. Mustafa Khattab');
  assertEqual(getFeaturedTranslation('nope'), null);
});

test('cache keys are edition and chapter specific', () => {
  assertEqual(CACHE_KEYS.chapter('eng-abdelhaleem', 2), 'translation:eng-abdelhaleem:2:v1');
});
