/**
 * Ayah-by-ayah reader — web counterpart of `feature:linebyline`.
 *
 * Route: `#/sura/:surah` with an optional `?ayah=` deep link.
 */
import { h, toast } from '../core/dom.js';
import { JUZ_NAMES, juzForPage, toArabicDigits } from '../core/quran-info.js';
import { PRIMARY_TEXT_EDITION } from '../data/api.js';
import { getSurah } from '../data/surahs.js';
import { FEATURED_TRANSLATIONS } from '../data/translations.js';

const BISMILLAH = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ';

/** @param {string} editionId */
export function editionLabel(editionId) {
  return FEATURED_TRANSLATIONS.find((item) => item.id === editionId)?.label ?? editionId;
}

/**
 * Load the text of a surah. Edition fallbacks live in the data layer, so this
 * either resolves or throws a message that is safe to show to the reader.
 * @param {any} ctx
 * @param {number} surahNumber
 */
async function loadSurah(ctx, surahNumber) {
  return ctx.api.getSurah(surahNumber);
}

/**
 * @param {any} ctx
 * @param {{params: Record<string,string>, query: Record<string,string>}} route
 * @returns {Promise<HTMLElement>}
 */
export async function render(ctx, route) {
  const surahNumber = Number(route.params.surah);
  const surah = getSurah(surahNumber);
  if (!surah) {
    return h('div', { class: 'page' }, [h('p', { class: 'notice notice--error', text: 'رقم السورة غير صحيح.' })]);
  }

  const settings = ctx.store.getState().settings;
  const payload = await loadSurah(ctx, surahNumber);
  const targetAyah = Number(route.query.ayah) || 0;

  // Translations come from the editions catalog (see docs/DATA_SOURCES.md).
  /** @type {Map<number, string>} */
  let translationsByAyah = new Map();
  let translationFailed = false;
  if (settings.translationEnabled && settings.translationEdition) {
    try {
      const verses = await ctx.translations.getChapter(settings.translationEdition, surahNumber);
      translationsByAyah = new Map(verses.map((verse) => [verse.ayah, verse.text]));
      translationFailed = verses.length === 0;
    } catch {
      translationFailed = true;
    }
  }

  ctx.store.setLastRead({ surah: surahNumber, ayah: targetAyah || 1, page: surah.pageStart });
  ctx.store.addRecentPage(surah.pageStart, { surah: surahNumber, ayah: targetAyah || 1 });

  const container = h('div', { class: 'page page--reader' });

  // ------------------------------------------------------------------- header
  const header = h('header', { class: 'reader-header' }, [
    h('div', { class: 'reader-header__top' }, [
      surahNumber > 1
        ? h('a', {
            class: 'btn btn--ghost',
            href: `#/sura/${surahNumber - 1}`,
            text: `‹ ${getSurah(surahNumber - 1).nameArabic}`,
          })
        : h('span', {}),
      surahNumber < 114
        ? h('a', {
            class: 'btn btn--ghost',
            href: `#/sura/${surahNumber + 1}`,
            text: `${getSurah(surahNumber + 1).nameArabic} ›`,
          })
        : h('span', {}),
    ]),
    h('h1', { class: 'reader-header__title', text: `سورة ${surah.nameArabic}` }),
    h('p', {
      class: 'reader-header__meta',
      text:
        `${surah.revelationPlace === 'makkah' ? 'مكية' : 'مدنية'} · ` +
        `${toArabicDigits(surah.ayahCount)} آية · ` +
        `${JUZ_NAMES[juzForPage(surah.pageStart) - 1]} · ` +
        `صفحة ${toArabicDigits(surah.pageStart)}`,
    }),
  ]);

  const toolbar = h('div', { class: 'toolbar' }, [
    h('a', { class: 'btn', href: `#/page/${surah.pageStart}`, text: 'عرض المصحف' }),
    h('button', {
      class: 'btn',
      type: 'button',
      text: '▶ تلاوة السورة',
      onclick: () => ctx.player.playSurah(surahNumber, targetAyah || 1),
    }),
    h('button', {
      class: 'btn',
      type: 'button',
      text: settings.translationEnabled ? 'إخفاء الترجمة' : 'إظهار الترجمة',
      onclick: () => {
        ctx.store.setSetting('translationEnabled', !settings.translationEnabled);
        ctx.rerender();
      },
    }),
    h('span', { class: 'toolbar__spacer' }),
    h('button', {
      class: 'btn btn--icon',
      type: 'button',
      title: 'تصغير الخط',
      'aria-label': 'تصغير الخط',
      text: '−',
      onclick: () => ctx.store.setSetting('fontSize', Math.max(1, ctx.store.getSetting('fontSize') - 1)),
    }),
    h('button', {
      class: 'btn btn--icon',
      type: 'button',
      title: 'تكبير الخط',
      'aria-label': 'تكبير الخط',
      text: '+',
      onclick: () => ctx.store.setSetting('fontSize', Math.min(6, ctx.store.getSetting('fontSize') + 1)),
    }),
  ]);

  if (settings.translationEnabled) {
    toolbar.append(
      h('span', {
        class: `toolbar__hint${translationFailed ? ' toolbar__hint--warn' : ''}`,
        text: translationFailed ? 'الترجمة غير متاحة حاليًا' : editionLabel(settings.translationEdition),
      }),
    );
  }

  container.append(header, toolbar);

  if (surah.bismillahPre) {
    container.append(h('p', { class: 'bismillah', dir: 'rtl', text: BISMILLAH }));
  }

  if (payload.edition && payload.edition !== PRIMARY_TEXT_EDITION) {
    container.append(
      h('p', { class: 'notice notice--warn', text: `تم تحميل النص من إصدار بديل (${payload.edition}) لأن الإصدار الأساسي غير متاح.` }),
    );
  }

  // -------------------------------------------------------------------- verses
  const verseList = h('ol', { class: 'verses' });

  for (const verse of payload.verses) {
    const isTarget = verse.ayah === targetAyah;
    const bookmarkTarget = { type: /** @type {'ayah'} */ ('ayah'), surah: surahNumber, ayah: verse.ayah };
    const bookmarked = ctx.store.isBookmarked(bookmarkTarget);
    const translation = translationsByAyah.get(verse.ayah);

    const actions = h('div', { class: 'verse__actions' }, [
      h('button', {
        class: 'icon-btn',
        type: 'button',
        title: 'تلاوة الآية',
        'aria-label': `تلاوة الآية ${verse.ayah}`,
        text: '▶',
        onclick: () => ctx.player.playAyah(surahNumber, verse.ayah),
      }),
      h('button', {
        class: `icon-btn${bookmarked ? ' is-active' : ''}`,
        type: 'button',
        title: bookmarked ? 'إزالة العلامة' : 'إضافة علامة',
        'aria-label': bookmarked ? 'إزالة العلامة' : 'إضافة علامة',
        text: bookmarked ? '★' : '☆',
        onclick: (event) => {
          const nowBookmarked = ctx.store.toggleBookmark(bookmarkTarget);
          const button = /** @type {HTMLButtonElement} */ (event.currentTarget);
          button.textContent = nowBookmarked ? '★' : '☆';
          button.classList.toggle('is-active', nowBookmarked);
          toast(nowBookmarked ? `حُفظت العلامة عند ${surah.nameArabic}: ${verse.ayah}` : 'أُزيلت العلامة');
        },
      }),
      h('button', {
        class: 'icon-btn',
        type: 'button',
        title: 'نسخ الآية',
        'aria-label': 'نسخ الآية',
        text: '⧉',
        onclick: async () => {
          try {
            await navigator.clipboard.writeText(`${verse.text}\n\n${surah.nameArabic}: ${verse.ayah}`);
            toast('نُسخت الآية');
          } catch {
            toast('تعذّر النسخ — المتصفح يمنع الوصول إلى الحافظة');
          }
        },
      }),
    ]);

    verseList.append(
      h(
        'li',
        {
          class: `verse${isTarget ? ' is-target' : ''}`,
          id: `ayah-${verse.ayah}`,
          dataset: { ayah: String(verse.ayah) },
        },
        [
          h('div', { class: 'verse__head' }, [
            h('span', { class: 'verse__number', text: toArabicDigits(verse.ayah) }),
            actions,
          ]),
          h('p', { class: 'verse__text', dir: 'rtl', lang: 'ar', text: verse.text }),
          translation ? h('p', { class: 'verse__translation', text: translation }) : null,
          h('div', { class: 'verse__footer' }, [
            h('button', {
              class: 'link-btn',
              type: 'button',
              text: 'إضافة وسم',
              onclick: () => ctx.openTagDialog(bookmarkTarget),
            }),
            h('a', {
              class: 'link-btn',
              href: `#/page/${versePage(verse.ayah, surah.number)}`,
              text: 'في المصحف',
            }),
            h('span', { class: 'verse__ref', text: `${surah.nameArabic}: ${toArabicDigits(verse.ayah)}` }),
          ]),
        ],
      ),
    );
  }

  container.append(verseList);

  // --------------------------------------------------------- audio highlighting
  const onAyah = (event) => {
    const detail = /** @type {CustomEvent} */ (event).detail;
    if (!detail || detail.surah !== surahNumber) return;
    const node = container.querySelector(`#ayah-${detail.ayah}`);
    if (!node) return;
    for (const active of container.querySelectorAll('.verse.is-playing')) active.classList.remove('is-playing');
    node.classList.add('is-playing');
    if (ctx.store.getSetting('autoScroll')) node.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  document.addEventListener('quran:ayah', onAyah);
  ctx.onCleanup(() => document.removeEventListener('quran:ayah', onAyah));

  if (targetAyah) {
    requestAnimationFrame(() => container.querySelector(`#ayah-${targetAyah}`)?.scrollIntoView({ block: 'center' }));
  }

  return container;
}

/**
 * Approximate page of an ayah: the surah's page range is linear enough for a
 * "jump to mushaf" link, and the mushaf reader accepts any page in range.
 * @param {number} ayah
 * @param {number} surahNumber
 */
function versePage(ayah, surahNumber) {
  const surah = getSurah(surahNumber);
  if (!surah) return 1;
  const span = Math.max(1, surah.pageEnd - surah.pageStart);
  const ratio = surah.ayahCount <= 1 ? 0 : (ayah - 1) / (surah.ayahCount - 1);
  return Math.min(surah.pageEnd, Math.max(surah.pageStart, surah.pageStart + Math.round(ratio * span)));
}
