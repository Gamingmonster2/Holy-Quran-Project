import { SURAHS, TOTAL_AYAHS, MADANI_PAGE_COUNT, getSurah, surahTitle } from '../src/data/surahs.js';
import { assertEqual, assertTrue, assertFalse, test } from './harness.mjs';

test('has exactly 114 surahs numbered 1..114 without gaps', () => {
  assertEqual(SURAHS.length, 114);
  SURAHS.forEach((surah, index) => {
    assertEqual(surah.number, index + 1, `surah at index ${index} is misnumbered`);
  });
});

test('totals 6236 ayahs', () => {
  const total = SURAHS.reduce((sum, surah) => sum + surah.ayahCount, 0);
  assertEqual(total, TOTAL_AYAHS);
});

test('every surah has a name, a positive ayah count and a sane page range', () => {
  for (const surah of SURAHS) {
    assertTrue(surah.nameArabic.length > 0, `surah ${surah.number} has no Arabic name`);
    assertTrue(surah.ayahCount > 0, `surah ${surah.number} has no ayahs`);
    assertTrue(surah.pageStart >= 1 && surah.pageStart <= MADANI_PAGE_COUNT);
    assertTrue(surah.pageEnd >= surah.pageStart && surah.pageEnd <= MADANI_PAGE_COUNT);
    assertTrue(surah.revelationPlace === 'makkah' || surah.revelationPlace === 'madinah');
  }
});

test('page ranges cover every page of the 604-page mushaf', () => {
  const covered = new Set();
  for (const surah of SURAHS) {
    for (let page = surah.pageStart; page <= surah.pageEnd; page += 1) covered.add(page);
  }
  const missing = [];
  for (let page = 1; page <= MADANI_PAGE_COUNT; page += 1) if (!covered.has(page)) missing.push(page);
  assertEqual(missing, []);
});

test('only Al-Fatihah and At-Tawbah open without the basmala', () => {
  const withoutBasmala = SURAHS.filter((surah) => !surah.bismillahPre).map((surah) => surah.number);
  assertEqual(withoutBasmala, [1, 9]);
});

test('getSurah returns the surah or null, never throwing', () => {
  assertEqual(getSurah(2).nameArabic, 'البقرة');
  assertEqual(getSurah(114).ayahCount, 6);
  assertEqual(getSurah(0), null);
  assertEqual(getSurah(115), null);
});

test('surahTitle renders the Arabic surah label', () => {
  assertEqual(surahTitle(36), 'سورة يس');
  assertEqual(surahTitle(999), '');
});
