import {
  JUZ_NAMES, JUZ_PAGE_STARTS, JUZ_START,
  ayahOffset, clampPage, fromGlobalAyahIndex, globalAyahIndex, isValidAyah, isValidPage,
  juzForPage, juzPageRange, pageLabel, surahForPage, surahsOnPage, toArabicDigits,
} from '../src/core/quran-info.js';
import { TOTAL_AYAHS } from '../src/data/surahs.js';
import { assertDeepEqual, assertEqual, assertFalse, assertTrue, test } from './harness.mjs';

test('the 30 juz page ranges tile the mushaf exactly once', () => {
  assertEqual(JUZ_PAGE_STARTS.length, 30);
  assertEqual(JUZ_NAMES.length, 30);
  assertEqual(JUZ_START.length, 30);
  let covered = 0;
  for (let juz = 1; juz <= 30; juz += 1) {
    const range = juzPageRange(juz);
    assertTrue(range.start <= range.end, `juz ${juz} has an inverted range`);
    covered += range.count;
  }
  assertEqual(covered, 604);
});

test('juz boundaries land on the expected pages', () => {
  assertEqual(juzForPage(1), 1);
  assertEqual(juzForPage(21), 1);
  assertEqual(juzForPage(22), 2);
  assertEqual(juzForPage(581), 29);
  assertEqual(juzForPage(582), 30);
  assertEqual(juzForPage(604), 30);
});

test('juzPageRange reports the inclusive bounds of a juz', () => {
  assertDeepEqual(juzPageRange(1), { start: 1, end: 21, count: 21 });
  assertDeepEqual(juzPageRange(30), { start: 582, end: 604, count: 23 });
  assertEqual(juzPageRange(31), null);
});

test('surahsOnPage lists both surahs when one page ends a surah and starts another', () => {
  const shared = surahsOnPage(106);
  assertDeepEqual(shared.map((surah) => surah.number), [4, 5]);
  assertEqual(surahsOnPage(604).map((surah) => surah.number).join(','), '112,113,114');
  assertDeepEqual(surahsOnPage(0), []);
});

test('surahForPage picks the most recently started surah', () => {
  assertEqual(surahForPage(1).number, 1);
  assertEqual(surahForPage(106).number, 5);
  assertEqual(surahForPage(604).number, 114);
  assertEqual(surahForPage(9999), null);
});

test('page validation clamps instead of producing out-of-range pages', () => {
  assertTrue(isValidPage(604));
  assertFalse(isValidPage(605));
  assertFalse(isValidPage(0));
  assertEqual(clampPage(-5), 1);
  assertEqual(clampPage(999), 604);
  assertEqual(clampPage(Number.NaN), 1);
});

test('ayah validation is bounded by the surah ayah count', () => {
  assertTrue(isValidAyah(2, 286));
  assertFalse(isValidAyah(2, 287));
  assertFalse(isValidAyah(115, 1));
  assertFalse(isValidAyah(1, 0));
});

test('global ayah indexing matches the mushaf order and round-trips', () => {
  assertEqual(ayahOffset(1), 0);
  assertEqual(ayahOffset(2), 7);
  assertEqual(globalAyahIndex(1, 1), 1);
  assertEqual(globalAyahIndex(2, 1), 8);
  assertEqual(globalAyahIndex(114, 6), TOTAL_AYAHS);
  assertDeepEqual(fromGlobalAyahIndex(1), { surah: 1, ayah: 1 });
  assertDeepEqual(fromGlobalAyahIndex(8), { surah: 2, ayah: 1 });
  assertDeepEqual(fromGlobalAyahIndex(TOTAL_AYAHS), { surah: 114, ayah: 6 });
  assertEqual(fromGlobalAyahIndex(0), null);
});

test('every global index round-trips back to the same ayah', () => {
  for (let index = 1; index <= TOTAL_AYAHS; index += 137) {
    const position = fromGlobalAyahIndex(index);
    assertEqual(globalAyahIndex(position.surah, position.ayah), index, `index ${index} did not round-trip`);
  }
});

test('numbers render with Arabic-Indic digits', () => {
  assertEqual(toArabicDigits(255), '٢٥٥');
  assertEqual(toArabicDigits('2:255'), '٢:٢٥٥');
  assertEqual(pageLabel(255), 'صفحة ٢٥٥ · الجزء الثالث عشر');
  assertEqual(pageLabel(0), '');
});
