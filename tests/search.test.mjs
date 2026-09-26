import {
  escapeHtml, findWordPrefix, highlight, matchTokens, normalizeArabic, normalizeWithMap, searchVerses, tokenize,
} from '../src/core/arabic.js';
import { assertDeepEqual, assertEqual, assertFalse, assertTrue, test } from './harness.mjs';

test('normalization strips diacritics and unifies letter forms', () => {
  assertEqual(normalizeArabic('الرَّحْمَٰنِ'), 'الرحمن');
  assertEqual(normalizeArabic('أَحْمَد'), 'احمد');
  assertEqual(normalizeArabic('إِبْرَاهِيم'), 'ابراهيم');
  assertEqual(normalizeArabic('مَكَّة'), 'مكه');
  assertEqual(normalizeArabic('مُوسَى'), 'موسي');
  assertEqual(normalizeArabic('الْقُرْآنُ'), 'القران');
});

test('normalization drops punctuation and collapses whitespace', () => {
  assertEqual(normalizeArabic('بسم الله، الرحمن؛'), 'بسم الله الرحمن');
  assertEqual(normalizeArabic('  متعدد    الفراغات  '), 'متعدد الفراغات');
  assertEqual(normalizeArabic(''), '');
  assertEqual(normalizeArabic(null), '');
});

test('tokenizing a query removes empty fragments', () => {
  assertDeepEqual(tokenize('  الرحمٰن   الرحيم '), ['الرحمن', 'الرحيم']);
  assertDeepEqual(tokenize('،،،'), []);
});

test('a token matches a whole word or a word prefix, but not a word suffix', () => {
  const ayah = normalizeArabic('بسم الله الرحمن الرحيم');
  assertTrue(matchTokens(ayah, ['الرحم']).matched, 'prefix of الرحمن should match');
  assertTrue(matchTokens(ayah, ['الرحمن']).matched);
  assertTrue(matchTokens(ayah, ['بسم', 'الرحيم']).matched);
  assertFalse(matchTokens(ayah, ['الرحمن', 'الفاتحة']).matched, 'all tokens must match');
  assertFalse(matchTokens(ayah, ['رحمن']).matched, 'mid-word match is not a prefix match');
  assertFalse(matchTokens(ayah, []).matched);
});

test('word-prefix search refuses matches that start mid-word', () => {
  assertEqual(findWordPrefix('قال المنافقون', 'من'), null);
  assertDeepEqual(findWordPrefix('قال المنافقون', 'المنافق'), { start: 4, end: 11 });
  assertDeepEqual(findWordPrefix('منهم', 'من'), { start: 0, end: 2 });
});

test('normalizeWithMap keeps a usable index back into the original text', () => {
  const { normalized, map } = normalizeWithMap('الْحَمْدُ');
  assertEqual(normalized, 'الحمد');
  assertEqual(map.length, normalized.length);
  map.forEach((originalIndex, index) => {
    assertEqual('الْحَمْدُ'[originalIndex].normalize('NFD')[0], normalized[index].normalize('NFD')[0]);
  });
});

test('highlight wraps only the matched span and escapes the rest', () => {
  assertEqual(highlight('بسم الله', [{ start: 0, end: 3 }]), '<mark>بسم</mark> الله');
  assertEqual(highlight('<b>', []), '&lt;b&gt;');
  assertEqual(highlight('abc', [{ start: 1, end: 2 }]), 'a<mark>b</mark>c');
});

test('escapeHtml neutralizes markup in ayah text', () => {
  assertEqual(escapeHtml('<img src=x onerror=1>'), '&lt;img src=x onerror=1&gt;');
});

test('searchVerses finds ayahs containing every query word', () => {
  const verses = [
    { surah: 1, ayah: 1, text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ' },
    { surah: 1, ayah: 2, text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ' },
    { surah: 112, ayah: 1, text: 'قُلْ هُوَ اللَّهُ أَحَدٌ' },
  ];

  const results = searchVerses(verses, 'الرحمن');
  assertEqual(results.length, 1);
  assertEqual(results[0].surah, 1);
  assertEqual(results[0].ayah, 1);

  assertEqual(searchVerses(verses, 'الله').length, 2);
  assertEqual(searchVerses(verses, 'لا يوجد').length, 0);
  assertEqual(searchVerses(verses, '').length, 0);
});

test('search results report spans that map onto the original diacritic text', () => {
  const verses = [{ surah: 1, ayah: 2, text: 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ' }];
  const [result] = searchVerses(verses, 'الحمد');
  const marked = highlight(result.text, result.spans);
  assertTrue(marked.startsWith('<mark>الْحَمْدُ'), `unexpected highlight: ${marked}`);
  assertTrue(marked.endsWith('الْعَالَمِينَ'));
});

test('the result limit is honoured and short ayahs rank first', () => {
  const verses = [
    { surah: 2, ayah: 1, text: 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ' },
    { surah: 112, ayah: 1, text: 'قُلْ هُوَ اللَّهُ أَحَدٌ' },
  ];
  const results = searchVerses(verses, 'الله', { limit: 1 });
  assertEqual(results.length, 1);
  assertEqual(results[0].surah, 112, 'the shorter ayah should rank first');
});
