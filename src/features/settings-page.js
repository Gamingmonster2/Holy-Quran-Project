/**
 * Settings — web counterpart of `common:preference`.
 *
 * Route: `#/settings`
 */
import { h, toast } from '../core/dom.js';
import { DEFAULT_SETTINGS } from '../core/store.js';
import { RECITERS } from '../data/audio.js';
import { FEATURED_TRANSLATIONS } from '../data/translations.js';
import { MADANI_PAGE_COUNT, TOTAL_AYAHS } from '../data/surahs.js';
import { toArabicDigits } from '../core/quran-info.js';

/** @param {string} label @param {HTMLElement} control @param {string} [hint] */
function field(label, control, hint) {
  return h('div', { class: 'field' }, [
    h('label', { class: 'field__label', text: label }),
    control,
    hint ? h('p', { class: 'field__hint', text: hint }) : null,
  ]);
}

/** @param {any} ctx @returns {Promise<HTMLElement>} */
export async function render(ctx) {
  const container = h('div', { class: 'page page--settings' });
  const settings = ctx.store.getState().settings;

  container.append(
    h('header', { class: 'reader-header reader-header--compact' }, [
      h('h1', { class: 'reader-header__title', text: 'الإعدادات' }),
      h('p', { class: 'reader-header__meta', text: 'كل الإعدادات تُحفظ في متصفحك فقط.' }),
    ]),
  );

  // -------------------------------------------------------------------- display
  const themeSelect = h(
    'select',
    { class: 'select' },
    [
      ['auto', 'تلقائي حسب النظام'],
      ['light', 'نهاري'],
      ['dark', 'ليلي'],
      ['sepia', 'ورقي (بيج)'],
    ].map(([value, label]) => h('option', { value, text: label, selected: settings.theme === value ? 'selected' : undefined })),
  );
  themeSelect.addEventListener('change', () => ctx.store.setSetting('theme', themeSelect.value));

  const fontSelect = h(
    'select',
    { class: 'select' },
    [1, 2, 3, 4, 5, 6].map((size) =>
      h('option', { value: String(size), text: `${toArabicDigits(size)} — ${['صغير جدًا', 'صغير', 'متوسط', 'كبير', 'كبير جدًا', 'ضخم'][size - 1]}`, selected: settings.fontSize === size ? 'selected' : undefined }),
    ),
  );
  fontSelect.addEventListener('change', () => ctx.store.setSetting('fontSize', Number(fontSelect.value)));

  const autoScroll = h('input', { type: 'checkbox', checked: settings.autoScroll ? 'checked' : undefined });
  autoScroll.addEventListener('change', () => ctx.store.setSetting('autoScroll', autoScroll.checked));

  container.append(
    h('section', { class: 'card' }, [
      h('h2', { class: 'card__title', text: 'العرض' }),
      field('المظهر', themeSelect),
      field('حجم خط النص القرآني', fontSelect),
      field('تتبّع الآية أثناء التلاوة', autoScroll, 'يمرّر الشاشة تلقائيًا إلى الآية التي تُتلى.'),
    ]),
  );

  // ----------------------------------------------------------------- translation
  const translationToggle = h('input', { type: 'checkbox', checked: settings.translationEnabled ? 'checked' : undefined });
  translationToggle.addEventListener('change', () => ctx.store.setSetting('translationEnabled', translationToggle.checked));

  const editionSelect = h(
    'select',
    { class: 'select' },
    FEATURED_TRANSLATIONS.map((edition) =>
      h('option', { value: edition.id, text: edition.label, selected: settings.translationEdition === edition.id ? 'selected' : undefined }),
    ),
  );
  editionSelect.addEventListener('change', () => {
    ctx.store.setSetting('translationEdition', editionSelect.value);
    toast('تم تغيير الترجمة');
  });

  const catalogStatus = h('p', { class: 'field__hint' });
  const catalogButton = h('button', {
    class: 'btn',
    type: 'button',
    text: 'تحميل كل اللغات المتاحة',
    onclick: async () => {
      catalogButton.disabled = true;
      catalogStatus.textContent = 'جارٍ تحميل القائمة…';
      try {
        const editions = await ctx.translations.listEditions();
        const languages = new Set(editions.map((edition) => edition.language));
        catalogStatus.textContent = `تم تحميل ${toArabicDigits(editions.length)} إصدارًا في ${toArabicDigits(languages.size)} لغة.`;
        for (const edition of editions) {
          if (editionSelect.querySelector(`option[value="${CSS.escape(edition.id)}"]`)) continue;
          editionSelect.append(
            h('option', {
              value: edition.id,
              text: `${edition.language} — ${edition.label}`,
              selected: settings.translationEdition === edition.id ? 'selected' : undefined,
            }),
          );
        }
      } catch (error) {
        catalogStatus.textContent = `تعذّر التحميل: ${error?.message ?? 'خطأ غير معروف'}`;
      } finally {
        catalogButton.disabled = false;
      }
    },
  });

  container.append(
    h('section', { class: 'card' }, [
      h('h2', { class: 'card__title', text: 'الترجمة والتفسير' }),
      field('إظهار الترجمة', translationToggle),
      field('الإصدار', editionSelect),
      h('div', { class: 'card__actions' }, [catalogButton]),
      catalogStatus,
    ]),
  );

  // ----------------------------------------------------------------------- audio
  const reciterSelect = h(
    'select',
    { class: 'select' },
    RECITERS.map((reciter) =>
      h('option', { value: reciter.id, text: reciter.name, selected: settings.reciterId === reciter.id ? 'selected' : undefined }),
    ),
  );
  reciterSelect.addEventListener('change', () => {
    ctx.player.setReciter(reciterSelect.value);
    toast(`القارئ: ${reciterSelect.selectedOptions[0]?.text ?? ''}`);
  });

  const repeatSelect = h(
    'select',
    { class: 'select' },
    [
      ['off', 'بدون تكرار (توقف في نهاية السورة)'],
      ['one', 'تكرار الآية'],
      ['all', 'تكرار مستمر (السور التالية)'],
    ].map(([value, label]) => h('option', { value, text: label, selected: settings.repeatMode === value ? 'selected' : undefined })),
  );
  repeatSelect.addEventListener('change', () => {
    ctx.store.setSetting('repeatMode', repeatSelect.value);
    ctx.player.syncSettings();
  });

  container.append(
    h('section', { class: 'card' }, [
      h('h2', { class: 'card__title', text: 'التلاوة' }),
      field('القارئ', reciterSelect),
      field('التكرار', repeatSelect),
    ]),
  );

  // ------------------------------------------------------------------------ data
  const imageBaseInput = h('input', {
    class: 'input',
    value: settings.mushafImageBase,
    placeholder: 'https://example.com/pages',
    'aria-label': 'مصدر صور المصحف',
  });
  imageBaseInput.addEventListener('change', () => ctx.store.setSetting('mushafImageBase', imageBaseInput.value.trim()));

  const reportHost = h('div', { class: 'storage-report' });
  const refreshReport = async () => {
    const report = await ctx.api.storageReport();
    reportHost.replaceChildren(
      h('ul', { class: 'kv-list' }, [
        h('li', {}, [h('span', { text: 'نوع التخزين' }), h('strong', { text: report.backend === 'indexeddb' ? 'IndexedDB' : 'ذاكرة مؤقتة (لا يُحفظ)' })]),
        h('li', {}, [h('span', { text: 'نص القرآن محفوظ' }), h('strong', { text: report.hasFullText ? `نعم (${toArabicDigits(report.fullTextVerses)} آية من ${toArabicDigits(TOTAL_AYAHS)})` : 'لا' })]),
        h('li', {}, [h('span', { text: 'عدد المدخلات المخزَّنة' }), h('strong', { text: toArabicDigits(report.entries) })]),
        h('li', {}, [h('span', { text: 'علامات محفوظة' }), h('strong', { text: toArabicDigits(ctx.store.getState().bookmarks.length) })]),
        h('li', {}, [h('span', { text: 'صفحات مقروءة أخيرًا' }), h('strong', { text: toArabicDigits(ctx.store.listRecentPages().length) })]),
      ]),
    );
  };

  const downloadTextButton = h('button', {
    class: 'btn btn--primary',
    type: 'button',
    text: 'تنزيل نص القرآن كاملًا (للقراءة دون إنترنت)',
    onclick: async () => {
      downloadTextButton.disabled = true;
      const original = downloadTextButton.textContent;
      downloadTextButton.textContent = 'جارٍ التنزيل…';
      try {
        const verses = await ctx.api.downloadFullText();
        toast(`تم تنزيل ${toArabicDigits(verses.length)} آية`);
        await refreshReport();
      } catch (error) {
        toast(error?.message ?? 'فشل التنزيل');
      } finally {
        downloadTextButton.textContent = original;
        downloadTextButton.disabled = false;
      }
    },
  });

  const clearCacheButton = h('button', {
    class: 'btn btn--danger',
    type: 'button',
    text: 'حذف النص المخزَّن',
    onclick: async () => {
      await ctx.api.clearCache();
      toast('حُذف النص المخزَّن');
      await refreshReport();
    },
  });

  container.append(
    h('section', { class: 'card' }, [
      h('h2', { class: 'card__title', text: 'البيانات والتخزين' }),
      field('مصدر صور المصحف (اختياري)', imageBaseInput, 'اتركه فارغًا لاستخدام المصادر المدمجة. اكتب مسارًا ينتهي بدون / ليصبح {base}/{page}.png.'),
      h('div', { class: 'card__actions' }, [downloadTextButton, clearCacheButton]),
      reportHost,
      h('p', { class: 'field__hint', text: `صور المصحف ${toArabicDigits(MADANI_PAGE_COUNT)} صفحة من مشروع quran.com-images، والتلاوات من everyayah.com.` }),
    ]),
  );
  await refreshReport();

  // ----------------------------------------------------------------------- about
  const resetButton = h('button', {
    class: 'btn btn--danger',
    type: 'button',
    text: 'إعادة الإعدادات إلى الوضع الافتراضي',
    onclick: () => {
      ctx.store.resetSettings();
      toast('أُعيدت الإعدادات الافتراضية');
      ctx.rerender();
    },
  });

  container.append(
    h('section', { class: 'card' }, [
      h('h2', { class: 'card__title', text: 'حول التطبيق' }),
      h('p', {
        text:
          'تطبيق ويب لقراءة القرآن الكريم، مبني بإلهام من مشروع Quran for Android مفتوح المصدر. ' +
          'الكود تحت رخصة GPL-3.0، أما النصوص والترجمات والتلاوات فلكل مصدر رخصته الخاصة — ' +
          'استخدم التطبيق لأغراض غير تجارية.',
      }),
      h('ul', { class: 'link-list' }, [
        h('li', {}, [h('a', { href: 'https://github.com/quran/quran_android', target: '_blank', rel: 'noopener', text: 'Quran for Android (المشروع الأصلي)' })]),
        h('li', {}, [h('a', { href: 'https://github.com/fawazahmed0/quran-api', target: '_blank', rel: 'noopener', text: 'quran-api — النص العثماني والترجمات والتفسير' })]),
        h('li', {}, [h('a', { href: 'https://github.com/sufone/medina-mushaf', target: '_blank', rel: 'noopener', text: 'medina-mushaf — صور صفحات المصحف' })]),
        h('li', {}, [h('a', { href: 'https://everyayah.com', target: '_blank', rel: 'noopener', text: 'everyayah.com — التلاوات' })]),
        h('li', {}, [h('a', { href: './docs.html?f=DATA_SOURCES.md', target: '_blank', rel: 'noopener', text: 'توثيق مصادر البيانات والرخص' })]),
        h('li', {}, [h('a', { href: './docs.html?f=DEPLOY-GITHUB-PAGES.md', target: '_blank', rel: 'noopener', text: 'طريقة النشر على GitHub Pages' })]),
      ]),
      h('div', { class: 'card__actions' }, [resetButton]),
      h('p', { class: 'field__hint', text: `الإعدادات الافتراضية: المظهر ${DEFAULT_SETTINGS.theme} · الخط ${toArabicDigits(DEFAULT_SETTINGS.fontSize)}` }),
    ]),
  );

  return container;
}
