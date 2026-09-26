/**
 * Full-text search — web counterpart of `common:search`.
 *
 * Route: `#/search?q=...`
 *
 * Search needs the whole text locally, which is a single ~1.3 MB request
 * cached in IndexedDB afterwards. Until it is downloaded the page offers the
 * download instead of silently failing.
 */
import { h, toast, clear } from '../core/dom.js';
import { highlight, searchVerses } from '../core/arabic.js';
import { getSurah } from '../data/surahs.js';
import { toArabicDigits } from '../core/quran-info.js';

const RESULT_LIMIT = 200;

/**
 * @param {any} ctx
 * @param {{query: Record<string,string>}} route
 * @returns {Promise<HTMLElement>}
 */
export async function render(ctx, route) {
  const query = (route.query.q ?? '').trim();
  const container = h('div', { class: 'page page--search' });
  const resultsHost = h('div', { class: 'search-results' });

  const input = h('input', {
    type: 'search',
    class: 'input',
    name: 'q',
    value: query,
    placeholder: 'اكتب كلمة أو أكثر… مثال: الرحمن، موسى، الصلاة',
    'aria-label': 'نص البحث',
    autocomplete: 'off',
  });

  const form = h('form', { class: 'search-inline search-inline--wide', role: 'search' }, [
    input,
    h('button', { class: 'btn btn--primary', type: 'submit', text: 'بحث' }),
  ]);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const value = input.value.trim();
    ctx.navigate(`/search${value ? `?q=${encodeURIComponent(value)}` : ''}`);
  });

  container.append(
    h('header', { class: 'reader-header reader-header--compact' }, [
      h('h1', { class: 'reader-header__title', text: 'البحث في القرآن الكريم' }),
      h('p', {
        class: 'reader-header__meta',
        text: 'بحث بالكلمة أو ببداية الكلمة، مع تجاهل التشكيل واختلاف رسم الألف والهمزة.',
      }),
    ]),
    form,
  );

  if (!query) {
    container.append(h('p', { class: 'empty', text: 'اكتب كلمة للبحث عنها في النص القرآني.' }));
    return container;
  }

  const hasText = await ctx.api.hasFullText();
  if (!hasText) {
    const progress = h('p', { class: 'muted' });
    const button = h('button', {
      class: 'btn btn--primary',
      type: 'button',
      text: 'تنزيل النص كاملًا (~1.3 ميجابايت)',
      onclick: async () => {
        button.disabled = true;
        progress.textContent = 'جارٍ التنزيل…';
        try {
          await ctx.api.downloadFullText({ onProgress: ({ phase }) => {
            progress.textContent = phase === 'done' ? 'اكتمل التنزيل.' : 'جارٍ التنزيل…';
          } });
          toast('تم تنزيل النص — يمكنك البحث الآن، وسيعمل البحث دون إنترنت لاحقًا.');
          ctx.rerender();
        } catch (error) {
          progress.textContent = error?.message ?? 'فشل التنزيل.';
          button.disabled = false;
        }
      },
    });
    container.append(
      h('div', { class: 'card' }, [
        h('p', { text: 'البحث يحتاج تنزيل نص القرآن كاملًا مرة واحدة، ثم يُخزَّن في متصفحك.' }),
        h('div', { class: 'card__actions' }, [button]),
        progress,
      ]),
    );
    return container;
  }

  const verses = await ctx.api.peekFullText();
  const started = performance.now();
  const results = searchVerses(verses ?? [], query, { limit: RESULT_LIMIT });
  const elapsed = performance.now() - started;

  container.append(
    h('p', {
      class: 'search-summary',
      text: results.length
        ? `${toArabicDigits(results.length)} نتيجة${results.length === RESULT_LIMIT ? ' (الحد الأقصى)' : ''} في ${toArabicDigits(Math.max(1, Math.round(elapsed)))} ملي ثانية`
        : 'لا توجد نتائج مطابقة.',
    }),
  );

  if (!results.length) {
    container.append(
      h('p', {
        class: 'empty',
        text: 'جرّب كلمة أقصر، أو اكتب بداية الكلمة فقط — مثل «الرحم» للبحث عن «الرحمن» و«الرحيم».',
      }),
    );
    return container;
  }

  clear(resultsHost);
  for (const result of results) {
    const surah = getSurah(result.surah);
    resultsHost.append(
      h('article', { class: 'search-result' }, [
        h('a', {
          class: 'search-result__ref',
          href: `#/sura/${result.surah}?ayah=${result.ayah}`,
          text: `${surah?.nameArabic ?? result.surah} · الآية ${toArabicDigits(result.ayah)}`,
        }),
        h('p', {
          class: 'search-result__text',
          dir: 'rtl',
          lang: 'ar',
          // `highlight` escapes the text before inserting the <mark> tags.
          html: highlight(result.text, result.spans),
        }),
      ]),
    );
  }
  container.append(resultsHost);

  return container;
}
