/**
 * Home: continue reading, juz navigation, search entry point and the surah index.
 */
import { h, clear, debounce } from '../core/dom.js';
import { JUZ_NAMES, JUZ_PAGE_STARTS, toArabicDigits } from '../core/quran-info.js';
import { SURAHS, getSurah } from '../data/surahs.js';

/**
 * @param {any} ctx
 * @returns {Promise<HTMLElement>}
 */
export async function render(ctx) {
  const state = ctx.store.getState();
  const lastRead = state.lastRead;
  const persistent = state.persistent;

  const container = h('div', { class: 'page page--home' });

  // ---------------------------------------------------------- continue reading
  const resume = lastRead
    ? h('div', { class: 'resume card card--accent' }, [
        h('div', { class: 'resume__text' }, [
          h('span', { class: 'resume__label', text: 'متابعة القراءة' }),
          h('strong', {
            class: 'resume__title',
            text: `${getSurah(lastRead.surah)?.nameArabic ?? ''} · الآية ${toArabicDigits(lastRead.ayah)}`,
          }),
          h('span', { class: 'resume__meta', text: `صفحة ${toArabicDigits(lastRead.page)}` }),
        ]),
        h('a', {
          class: 'btn btn--primary',
          href: `#/sura/${lastRead.surah}?ayah=${lastRead.ayah}`,
          text: 'متابعة',
        }),
      ])
    : h('div', { class: 'resume card' }, [
        h('div', { class: 'resume__text' }, [
          h('span', { class: 'resume__label', text: 'ابدأ القراءة' }),
          h('strong', { class: 'resume__title', text: 'سورة الفاتحة' }),
          h('span', { class: 'resume__meta', text: '٦٢٣٦ آية · ٦٠٤ صفحات' }),
        ]),
        h('a', { class: 'btn btn--primary', href: '#/sura/1', text: 'ابدأ' }),
      ]);

  if (!persistent) {
    container.append(
      h('p', {
        class: 'notice notice--warn',
        text: 'تنبيه: تخزين المتصفح غير متاح، لذا لن تُحفظ العلامات وآخر موضع قراءة بعد إغلاق الصفحة.',
      }),
    );
  }

  container.append(resume);

  // ------------------------------------------------------------------- search
  const searchForm = h('form', { class: 'search-inline', role: 'search' }, [
    h('input', {
      type: 'search',
      name: 'q',
      class: 'input',
      placeholder: 'ابحث في نص القرآن الكريم…',
      'aria-label': 'بحث في النص القرآني',
      autocomplete: 'off',
    }),
    h('button', { class: 'btn', type: 'submit', text: 'بحث' }),
  ]);
  searchForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = /** @type {HTMLInputElement} */ (searchForm.elements.namedItem('q')).value.trim();
    ctx.navigate(`/search${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  });
  container.append(searchForm);

  // ------------------------------------------------------- surah / juz switch
  const listHost = h('div', { class: 'index-host' });
  const tabs = h('div', { class: 'segmented', role: 'tablist' });

  const filterInput = h('input', {
    type: 'search',
    class: 'input input--compact',
    placeholder: 'تصفية السور بالاسم أو الرقم…',
    'aria-label': 'تصفية قائمة السور',
  });

  /** @param {'surahs'|'juz'} mode */
  function setMode(mode) {
    clear(tabs);
    for (const [value, label] of [['surahs', 'السور'], ['juz', 'الأجزاء']]) {
      tabs.append(
        h('button', {
          class: `segmented__item${value === mode ? ' is-active' : ''}`,
          type: 'button',
          role: 'tab',
          'aria-selected': value === mode ? 'true' : 'false',
          text: label,
          onclick: () => setMode(/** @type {any} */ (value)),
        }),
      );
    }
    if (mode === 'surahs') renderSurahList();
    else renderJuzList();
    renderSearchToggle(mode);
  }

  /** @param {'surahs'|'juz'} mode */
  function renderSearchToggle(mode) {
    filterInput.hidden = mode !== 'surahs';
  }

  function renderSurahList() {
    const query = filterInput.value.trim().toLowerCase();
    const matches = SURAHS.filter((surah) => {
      if (!query) return true;
      return (
        surah.nameArabic.includes(query) ||
        surah.nameSimple.toLowerCase().includes(query) ||
        String(surah.number) === query ||
        toArabicDigits(surah.number) === query
      );
    });

    clear(listHost);
    if (matches.length === 0) {
      listHost.append(h('p', { class: 'empty', text: 'لا توجد سورة مطابقة.' }));
      return;
    }
    listHost.append(
      h(
        'ul',
        { class: 'surah-list' },
        matches.map((surah) =>
          h('li', { class: 'surah-list__item' }, [
            h('a', { class: 'surah-list__link', href: `#/sura/${surah.number}` }, [
              h('span', { class: 'surah-list__number', text: toArabicDigits(surah.number) }),
              h('span', { class: 'surah-list__body' }, [
                h('span', { class: 'surah-list__name', text: surah.nameArabic }),
                h('span', {
                  class: 'surah-list__meta',
                  text: `${surah.revelationPlace === 'makkah' ? 'مكية' : 'مدنية'} · ${toArabicDigits(surah.ayahCount)} آية`,
                }),
              ]),
              h('span', { class: 'surah-list__page', text: `ص ${toArabicDigits(surah.pageStart)}` }),
            ]),
            h('a', {
              class: 'surah-list__mushaf',
              href: `#/page/${surah.pageStart}`,
              title: 'فتح في المصحف',
              'aria-label': `فتح سورة ${surah.nameArabic} في المصحف`,
              text: 'مصحف',
            }),
          ]),
        ),
      ),
    );
  }

  function renderJuzList() {
    clear(listHost);
    listHost.append(
      h(
        'ul',
        { class: 'juz-grid' },
        JUZ_NAMES.map((name, index) => {
          const juz = index + 1;
          const page = JUZ_PAGE_STARTS[index];
          return h('li', {}, [
            h('a', { class: 'juz-card', href: `#/page/${page}` }, [
              h('span', { class: 'juz-card__name', text: name }),
              h('span', { class: 'juz-card__meta', text: `تبدأ من صفحة ${toArabicDigits(page)}` }),
            ]),
          ]);
        }),
      ),
    );
  }

  filterInput.addEventListener('input', debounce(() => renderSurahList(), 120));

  container.append(h('div', { class: 'index-controls' }, [tabs, filterInput]));
  container.append(listHost);
  setMode('surahs');

  return container;
}
