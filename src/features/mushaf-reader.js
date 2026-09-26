/**
 * Mushaf page reader — web counterpart of `pages:madani`.
 *
 * Route: `#/page/:page` (1..604).
 *
 * The primary image source is the `sufone/medina-mushaf` scans mirrored by
 * jsDelivr, which was verified to return `image/png` for every page and is
 * CORS-friendly and key-free. Two fallbacks follow (the same repository on
 * GitHub's raw host, then the historical quran.com CDN paths), and if all of
 * them fail the page shows the text of its surah instead of a dead end.
 * A custom mirror can be configured in Settings (`mushafImageBase`).
 */
import { h, toast, clear } from '../core/dom.js';
import {
  JUZ_NAMES, clampPage, isValidPage, juzForPage, pageLabel, surahForPage, surahsOnPage, toArabicDigits,
} from '../core/quran-info.js';
import { getSurah } from '../data/surahs.js';

/** @param {number} page @param {number} [width] */
const pad3 = (page, width = 3) => String(page).padStart(width, '0');

/** How many verses of the fallback text to show before linking out. */
const FALLBACK_VERSE_LIMIT = 15;

/**
 * Candidate image URLs, most likely first. The first two are the verified
 * mirror; the rest are historical quran.com paths kept as a last resort.
 * @type {((page:number) => string)[]}
 */
export const PAGE_MIRRORS = [
  (page) => `https://cdn.jsdelivr.net/gh/sufone/medina-mushaf@master/png-d150/${page}.png`,
  (page) => `https://raw.githubusercontent.com/sufone/medina-mushaf/master/png-d150/${page}.png`,
  (page) => `https://static.qurancdn.com/images/pages/madani/${page}.png`,
  (page) => `https://android.quran.com/data/pages/madani/width_1260/page${pad3(page)}.png`,
];

/**
 * @param {number} page
 * @param {string} [customBase] e.g. "https://my.mirror/pages"
 */
export function pageImageCandidates(page, customBase) {
  const list = [];
  if (customBase) list.push(`${customBase.replace(/\/+$/, '')}/${page}.png`);
  list.push(...PAGE_MIRRORS.map((build) => build(page)));
  return list;
}

/**
 * @param {any} ctx
 * @param {{params: Record<string,string>}} route
 * @returns {Promise<HTMLElement>}
 */
export async function render(ctx, route) {
  const page = clampPage(Number(route.params.page));
  if (!isValidPage(Number(route.params.page))) {
    toast(`الصفحة خارج النطاق — تم فتح الصفحة ${toArabicDigits(page)}`);
  }

  const settings = ctx.store.getState().settings;
  const container = h('div', { class: 'page page--mushaf' });
  const surah = surahForPage(page);
  const surahNumber = surah?.number ?? 1;
  const bookmarkTarget = { type: /** @type {'page'} */ ('page'), page };

  ctx.store.addRecentPage(page, { surah: surahNumber });
  ctx.store.setLastRead({ surah: surahNumber, ayah: 1, page });

  const bookmarkButton = h('button', {
    class: `btn${ctx.store.isBookmarked(bookmarkTarget) ? ' is-active' : ''}`,
    type: 'button',
    text: ctx.store.isBookmarked(bookmarkTarget) ? '★ علامة الصفحة' : '☆ علامة الصفحة',
    onclick: () => {
      const nowBookmarked = ctx.store.toggleBookmark(bookmarkTarget);
      bookmarkButton.textContent = nowBookmarked ? '★ علامة الصفحة' : '☆ علامة الصفحة';
      bookmarkButton.classList.toggle('is-active', nowBookmarked);
      toast(nowBookmarked ? `حُفظت الصفحة ${toArabicDigits(page)}` : 'أُزيلت علامة الصفحة');
    },
  });

  const jumpInput = h('input', {
    class: 'input input--tiny',
    type: 'number',
    min: '1',
    max: '604',
    value: String(page),
    'aria-label': 'رقم الصفحة',
  });
  const jump = () => {
    const value = Number(jumpInput.value);
    if (isValidPage(value)) ctx.navigate(`/page/${value}`);
    else toast('أدخل رقم صفحة بين ١ و ٦٠٤');
  };
  jumpInput.addEventListener('keydown', (event) => {
    if (/** @type {KeyboardEvent} */ (event).key === 'Enter') jump();
  });

  container.append(
    h('header', { class: 'reader-header reader-header--compact' }, [
      h('h1', { class: 'reader-header__title', text: pageLabel(page) }),
      h('p', {
        class: 'reader-header__meta',
        text: `السور في هذه الصفحة: ${surahsOnPage(page).map((item) => `سورة ${item.nameArabic}`).join(' · ')}`,
      }),
    ]),
    h('div', { class: 'toolbar' }, [
      h('a', { class: 'btn', href: `#/page/${Math.max(1, page - 1)}`, text: '‹ السابقة' }),
      h('a', { class: 'btn', href: `#/page/${Math.min(604, page + 1)}`, text: 'التالية ›' }),
      h('span', { class: 'toolbar__group' }, [
        h('label', { class: 'toolbar__label', for: 'page-jump', text: 'اذهب إلى' }),
        jumpInput,
        h('button', { class: 'btn', type: 'button', text: 'فتح', onclick: jump }),
      ]),
      bookmarkButton,
      h('a', { class: 'btn', href: `#/sura/${surahNumber}`, text: 'قراءة بالآيات' }),
      h('span', { class: 'toolbar__spacer' }),
      h('span', { class: 'toolbar__hint', text: JUZ_NAMES[juzForPage(page) - 1] }),
    ]),
  );

  // ------------------------------------------------------------------ the page
  const imageHost = h('div', { class: 'mushaf' });
  const image = h('img', {
    class: 'mushaf__image',
    alt: `صفحة ${toArabicDigits(page)} من المصحف`,
    loading: 'eager',
    decoding: 'async',
  });

  const candidates = pageImageCandidates(page, settings.mushafImageBase);
  let candidateIndex = 0;
  let fallbackShown = false;

  /**
   * When every mirror fails, show the surah text for this page rather than an
   * empty box — the reader can always continue reading.
   * @param {string} reason
   */
  const showTextFallback = async (reason) => {
    if (fallbackShown) return;
    fallbackShown = true;
    clear(imageHost);
    imageHost.append(
      h('div', { class: 'notice notice--warn' }, [
        h('p', { text: `${reason}. سيتم عرض نص السورة بدلًا من صورة الصفحة.` }),
        h('div', { class: 'card__actions' }, [
          h('a', { class: 'btn', href: '#/settings', text: 'تحديد مرآة صور أخرى' }),
          h('a', { class: 'btn', href: `#/sura/${surahNumber}`, text: `قراءة سورة ${surah?.nameArabic ?? ''} كاملة` }),
        ]),
      ]),
    );

    const textHost = h('div', { class: 'mushaf__text' });
    imageHost.append(textHost);
    textHost.append(h('p', { class: 'loading', text: 'جارٍ تحميل نص السورة…' }));

    try {
      const payload = await ctx.api.getSurah(surahNumber);
      clear(textHost);
      for (const verse of payload.verses.slice(0, FALLBACK_VERSE_LIMIT)) {
        textHost.append(
          h('p', { class: 'mushaf__ayah' }, [
            h('span', { class: 'mushaf__ayah-ref', text: `${surah?.nameArabic ?? ''} ${toArabicDigits(verse.ayah)}` }),
            h('span', { class: 'mushaf__ayah-text', dir: 'rtl', lang: 'ar', text: verse.text }),
          ]),
        );
      }
      if (payload.verses.length > FALLBACK_VERSE_LIMIT) {
        textHost.append(
          h('p', { class: 'field__hint', text: `تُعرض أول ${toArabicDigits(FALLBACK_VERSE_LIMIT)} آية فقط من ${toArabicDigits(payload.verses.length)}.` }),
        );
      }
    } catch (error) {
      clear(textHost);
      textHost.append(h('p', { class: 'empty', text: error?.message ?? 'تعذّر تحميل نص السورة أيضًا.' }));
    }
  };

  image.addEventListener('load', () => imageHost.classList.add('is-loaded'));
  image.addEventListener('error', () => {
    candidateIndex += 1;
    if (candidateIndex < candidates.length) {
      image.src = candidates[candidateIndex];
      return;
    }
    showTextFallback('تعذّر تحميل صورة الصفحة من كل المرايا المتاحة');
  });

  image.src = candidates[0];
  imageHost.append(image);
  container.append(imageHost);

  container.append(
    h('div', { class: 'mushaf__nav' }, [
      h('a', { class: 'btn btn--big', href: `#/page/${Math.max(1, page - 1)}`, text: '‹ الصفحة السابقة' }),
      h('a', { class: 'btn btn--big', href: `#/page/${Math.min(604, page + 1)}`, text: 'الصفحة التالية ›' }),
    ]),
  );

  // ------------------------------------------------------------------ gestures
  let touchStartX = 0;
  const onTouchStart = (event) => {
    touchStartX = event.changedTouches[0].clientX;
  };
  const onTouchEnd = (event) => {
    const delta = event.changedTouches[0].clientX - touchStartX;
    if (Math.abs(delta) < 60) return;
    // RTL: swiping right moves to the next page.
    if (delta > 0 && page < 604) ctx.navigate(`/page/${page + 1}`);
    if (delta < 0 && page > 1) ctx.navigate(`/page/${page - 1}`);
  };
  container.addEventListener('touchstart', onTouchStart, { passive: true });
  container.addEventListener('touchend', onTouchEnd, { passive: true });

  const onKeyDown = (event) => {
    if (/** @type {KeyboardEvent} */ (event).key === 'ArrowLeft' && page < 604) ctx.navigate(`/page/${page + 1}`);
    if (/** @type {KeyboardEvent} */ (event).key === 'ArrowRight' && page > 1) ctx.navigate(`/page/${page - 1}`);
  };
  document.addEventListener('keydown', onKeyDown);
  ctx.onCleanup(() => document.removeEventListener('keydown', onKeyDown));

  return container;
}
