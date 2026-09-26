/**
 * Page / juz / surah arithmetic.
 *
 * Web counterpart of the Android app's `QuranInfo` (`common:data`). Pure
 * functions only: no DOM, no network, no globals — so they are directly
 * unit-testable (see tests/quran-info.test.mjs).
 */
import { MADANI_PAGE_COUNT, SURAHS, getSurah } from '../data/surahs.js';

/** First mushaf page of each of the 30 juz (Madani mushaf). Index 0 → juz 1. */
export const JUZ_PAGE_STARTS = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182,
  201, 222, 242, 262, 282, 302, 322, 342, 362, 382,
  402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
];

/** Arabic ordinal names for the juz, for the navigation UI. */
export const JUZ_NAMES = [
  'الجزء الأول', 'الجزء الثاني', 'الجزء الثالث', 'الجزء الرابع', 'الجزء الخامس',
  'الجزء السادس', 'الجزء السابع', 'الجزء الثامن', 'الجزء التاسع', 'الجزء العاشر',
  'الجزء الحادي عشر', 'الجزء الثاني عشر', 'الجزء الثالث عشر', 'الجزء الرابع عشر',
  'الجزء الخامس عشر', 'الجزء السادس عشر', 'الجزء السابع عشر', 'الجزء الثامن عشر',
  'الجزء التاسع عشر', 'الجزء العشرون', 'الجزء الحادي والعشرون', 'الجزء الثاني والعشرون',
  'الجزء الثالث والعشرون', 'الجزء الرابع والعشرون', 'الجزء الخامس والعشرون',
  'الجزء السادس والعشرون', 'الجزء السابع والعشرون', 'الجزء الثامن والعشرون',
  'الجزء التاسع والعشرون', 'الجزء الثلاثون',
];

/** Navigation anchor (surah:ayah) where each juz begins. */
export const JUZ_START = [
  { surah: 1, ayah: 1 }, { surah: 2, ayah: 142 }, { surah: 2, ayah: 253 }, { surah: 3, ayah: 92 },
  { surah: 4, ayah: 24 }, { surah: 4, ayah: 148 }, { surah: 5, ayah: 82 }, { surah: 6, ayah: 111 },
  { surah: 7, ayah: 88 }, { surah: 8, ayah: 41 }, { surah: 9, ayah: 93 }, { surah: 11, ayah: 6 },
  { surah: 12, ayah: 53 }, { surah: 15, ayah: 1 }, { surah: 17, ayah: 1 }, { surah: 18, ayah: 75 },
  { surah: 21, ayah: 1 }, { surah: 23, ayah: 1 }, { surah: 25, ayah: 21 }, { surah: 27, ayah: 56 },
  { surah: 29, ayah: 46 }, { surah: 33, ayah: 31 }, { surah: 36, ayah: 28 }, { surah: 39, ayah: 32 },
  { surah: 41, ayah: 47 }, { surah: 46, ayah: 1 }, { surah: 51, ayah: 31 }, { surah: 58, ayah: 1 },
  { surah: 67, ayah: 1 }, { surah: 78, ayah: 1 },
];

/** @param {number} page */
export function isValidPage(page) {
  return Number.isInteger(page) && page >= 1 && page <= MADANI_PAGE_COUNT;
}

/** @param {number} page */
export function clampPage(page) {
  if (!Number.isFinite(page)) return 1;
  return Math.min(MADANI_PAGE_COUNT, Math.max(1, Math.trunc(page)));
}

/**
 * Every surah that has content on `page`. Two surahs can share a page (one
 * ends, the next begins), which is why this returns an array.
 * @param {number} page
 */
export function surahsOnPage(page) {
  if (!isValidPage(page)) return [];
  return SURAHS.filter((surah) => page >= surah.pageStart && page <= surah.pageEnd);
}

/**
 * The surah a page "belongs" to: the most recently started one, falling back to
 * the first surah of the mushaf.
 * @param {number} page
 */
export function surahForPage(page) {
  if (!isValidPage(page)) return null;
  let found = SURAHS[0];
  for (const surah of SURAHS) {
    if (surah.pageStart <= page) found = surah;
    else break;
  }
  return found;
}

/** @param {number} juz 1..30 */
export function isValidJuz(juz) {
  return Number.isInteger(juz) && juz >= 1 && juz <= 30;
}

/** @param {number} page */
export function juzForPage(page) {
  if (!isValidPage(page)) return 1;
  let juz = 1;
  for (let i = 0; i < JUZ_PAGE_STARTS.length; i += 1) {
    if (page >= JUZ_PAGE_STARTS[i]) juz = i + 1;
    else break;
  }
  return juz;
}

/** Inclusive page range of a juz. @param {number} juz */
export function juzPageRange(juz) {
  if (!isValidJuz(juz)) return null;
  const start = JUZ_PAGE_STARTS[juz - 1];
  const end = juz === 30 ? MADANI_PAGE_COUNT : JUZ_PAGE_STARTS[juz] - 1;
  return { start, end, count: end - start + 1 };
}

/** @param {number} surahNumber 1..114 */
export function isValidSurah(surahNumber) {
  return Number.isInteger(surahNumber) && surahNumber >= 1 && surahNumber <= SURAHS.length;
}

/**
 * Validate a surah:ayah pair against the surah table.
 * @param {number} surahNumber
 * @param {number} ayahNumber
 */
export function isValidAyah(surahNumber, ayahNumber) {
  if (!isValidSurah(surahNumber)) return false;
  return Number.isInteger(ayahNumber) && ayahNumber >= 1 && ayahNumber <= getSurah(surahNumber).ayahCount;
}

/**
 * Total number of ayahs in the surahs that come before `surahNumber`, i.e. the
 * global ayah index offset.
 * @param {number} surahNumber
 */
export function ayahOffset(surahNumber) {
  let total = 0;
  for (const surah of SURAHS) {
    if (surah.number >= surahNumber) break;
    total += surah.ayahCount;
  }
  return total;
}

/** Global 1-based index of an ayah within the whole mushaf. */
export function globalAyahIndex(surahNumber, ayahNumber) {
  if (!isValidAyah(surahNumber, ayahNumber)) return -1;
  return ayahOffset(surahNumber) + ayahNumber;
}

/** Convert a global index back to `{surah, ayah}`. */
export function fromGlobalAyahIndex(index) {
  if (!Number.isInteger(index) || index < 1) return null;
  let remaining = index;
  for (const surah of SURAHS) {
    if (remaining <= surah.ayahCount) return { surah: surah.number, ayah: remaining };
    remaining -= surah.ayahCount;
  }
  return null;
}

const ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

/**
 * Render a number with Arabic-Indic digits (what mushaf margins use).
 * @param {number|string} value
 */
export function toArabicDigits(value) {
  return String(value).replace(/[0-9]/g, (digit) => ARABIC_DIGITS[Number(digit)]);
}

/** Human label for a page, e.g. "صفحة ٢٥٥ · الجزء الثالث عشر". */
export function pageLabel(page) {
  if (!isValidPage(page)) return '';
  return `صفحة ${toArabicDigits(page)} · ${JUZ_NAMES[juzForPage(page) - 1]}`;
}
