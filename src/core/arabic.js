/**
 * Arabic text utilities: normalization and matching.
 *
 * Web counterpart of the Android app's `common:search`
 * (`SearchTextUtil` + `ArabicCharacterHelper`), reduced to what the browser
 * needs. Everything here is pure — see tests/search.test.mjs.
 */

const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08F0-\u08FF\uFE00-\uFE0F\u0640]/g;
/** Same character set, but without the `g` flag so `test()` has no state. */
const DIACRITIC_CHAR = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08F0-\u08FF\uFE00-\uFE0F\u0640]/;
const ALEF_VARIANTS = /[\u0622\u0623\u0625\u0671\u0672\u0673]/g;
const PUNCTUATION = /[\u060C\u061B\u061F\u066A-\u066D\u06D4!?.,;:"'()[\]{}«»\u06DE\uFD3E\uFD3F]/g;
const TATWEEL_AND_SPACES = /[\s\u00A0\u200B-\u200F\u202A-\u202E]+/g;

/**
 * Normalize Arabic text for searching: strip diacritics and tatweel, unify
 * alef/hamza/ya/ta-marbuta forms, drop punctuation, collapse whitespace.
 * @param {string} text
 */
export function normalizeArabic(text) {
  if (!text) return '';
  return String(text)
    .normalize('NFC')
    .replace(DIACRITICS, '')
    .replace(ALEF_VARIANTS, '\u0627')
    .replace(/\u0649/g, '\u064A') // alef maqsura → ya
    .replace(/\u0626/g, '\u064A') // ya with hamza → ya
    .replace(/\u0624/g, '\u0648') // waw with hamza → waw
    .replace(/\u0629/g, '\u0647') // ta marbuta → ha
    .replace(PUNCTUATION, ' ')
    .replace(TATWEEL_AND_SPACES, ' ')
    .trim();
}

/**
 * Normalize while remembering where each character came from, so matches found
 * on the normalized string can be highlighted in the original text.
 * @param {string} text
 * @returns {{normalized: string, map: number[]}} `map[i]` is the index in `text`
 *   of the character that produced `normalized[i]`.
 */
export function normalizeWithMap(text) {
  const source = String(text ?? '');
  let normalized = '';
  /** @type {number[]} */
  const map = [];
  let pendingSpace = false;

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    const collapsed = char
      .normalize('NFC')
      .replace(DIACRITICS, '')
      .replace(ALEF_VARIANTS, '\u0627')
      .replace(/\u0649/g, '\u064A')
      .replace(/\u0626/g, '\u064A')
      .replace(/\u0624/g, '\u0648')
      .replace(/\u0629/g, '\u0647')
      .replace(PUNCTUATION, ' ');
    if (!collapsed) continue;

    for (const piece of collapsed) {
      if (/\s/.test(piece)) {
        pendingSpace = normalized.length > 0;
        continue;
      }
      if (pendingSpace) {
        normalized += ' ';
        map.push(i);
        pendingSpace = false;
      }
      normalized += piece;
      map.push(i);
    }
  }
  return { normalized, map };
}

/** Split a query into normalized, non-empty words. @param {string} query */
export function tokenize(query) {
  return normalizeArabic(query).split(' ').filter(Boolean);
}

/**
 * Match all query tokens against a normalized ayah. A token matches when it
 * appears in the ayah as a whole word **or as a word prefix** — the behaviour
 * the Android searcher uses, so "الرحم" finds "الرحمن" and "الرحيم".
 *
 * @param {string} normalizedAyah
 * @param {string[]} tokens
 * @returns {{matched: boolean, spans: {start: number, end: number}[]}}
 */
export function matchTokens(normalizedAyah, tokens) {
  if (!normalizedAyah || tokens.length === 0) return { matched: false, spans: [] };
  /** @type {{start:number,end:number}[]} */
  const spans = [];

  for (const token of tokens) {
    const found = findWordPrefix(normalizedAyah, token);
    if (!found) return { matched: false, spans: [] };
    spans.push(found);
  }
  spans.sort((a, b) => a.start - b.start);
  return { matched: true, spans };
}

/**
 * Find the first occurrence of `token` that starts at a word boundary. The
 * token may be the whole word **or a prefix of it**, which is the behaviour the
 * Android searcher uses: "الرحم" finds "الرحمن" and "الرحيم".
 * @param {string} haystack already normalized
 * @param {string} token already normalized
 */
export function findWordPrefix(haystack, token) {
  let from = 0;
  while (from <= haystack.length - token.length) {
    const index = haystack.indexOf(token, from);
    if (index === -1) return null;
    if (index === 0 || haystack[index - 1] === ' ') return { start: index, end: index + token.length };
    from = index + 1;
  }
  return null;
}

/**
 * Grow a match end so trailing diacritics of the last matched letter stay
 * inside the highlight (`الْحَمْد` → `الْحَمْدُ`).
 * @param {string} text the original, diacritized text
 * @param {number} end exclusive end offset in `text`
 */
export function extendOverDiacritics(text, end) {
  let index = end;
  while (index < text.length && DIACRITIC_CHAR.test(text[index])) index += 1;
  return index;
}

/**
 * Search a collection of ayahs.
 *
 * @param {Iterable<{surah:number, ayah:number, text:string}>} verses
 * @param {string} query
 * @param {{limit?: number}} [options]
 * @returns {{surah:number, ayah:number, text:string, spans:{start:number,end:number}[], score:number}[]}
 */
export function searchVerses(verses, query, options = {}) {
  const { limit = 200 } = options;
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  /** @type {any[]} */
  const results = [];
  for (const verse of verses) {
    const { normalized, map } = normalizeWithMap(verse.text);
    const { matched, spans } = matchTokens(normalized, tokens);
    if (!matched) continue;
    // Shorter ayahs first: a match in a short ayah is usually more relevant.
    const score = tokens.length * 1000 - normalized.length;
    results.push({
      surah: verse.surah,
      ayah: verse.ayah,
      text: verse.text,
      score,
      spans: spans.map(({ start, end }) => ({
        start: map[start] ?? 0,
        // `end` is exclusive in normalized space; the original character that
        // produced the last normalized char must be included, along with any
        // diacritics that follow it.
        end: extendOverDiacritics(
          verse.text,
          (map[end - 1] ?? map[start] ?? 0) + 1,
        ),
      })),
    });
  }
  results.sort((a, b) => b.score - a.score || a.surah - b.surah || a.ayah - b.ayah);
  return results.slice(0, limit);
}

/**
 * Wrap matched spans in `<mark>`; the text is escaped first so this is safe to
 * assign with innerHTML.
 * @param {string} text
 * @param {{start:number,end:number}[]} spans
 */
export function highlight(text, spans) {
  const escaped = String(text);
  if (!spans || spans.length === 0) return escapeHtml(escaped);
  let out = '';
  let cursor = 0;
  for (const { start, end } of spans) {
    if (start < cursor) continue;
    out += escapeHtml(escaped.slice(cursor, start));
    out += `<mark>${escapeHtml(escaped.slice(start, end))}</mark>`;
    cursor = end;
  }
  out += escapeHtml(escaped.slice(cursor));
  return out;
}

/** Escape text for safe interpolation into HTML. @param {string} text */
export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
