/**
 * Bookmarks — web counterpart of `common:bookmark`.
 *
 * Route: `#/bookmarks`
 * Ayah bookmarks, page bookmarks, tags, and JSON import/export (the Android app
 * has an equivalent import/export flow).
 */
import { h, clear, toast } from '../core/dom.js';
import { getSurah } from '../data/surahs.js';
import { pageLabel, toArabicDigits } from '../core/quran-info.js';

/**
 * @param {any} ctx
 * @returns {Promise<HTMLElement>}
 */
export async function render(ctx) {
  const container = h('div', { class: 'page page--bookmarks' });
  const host = h('div', { class: 'bookmarks-host' });
  const tabs = h('div', { class: 'segmented', role: 'tablist' });
  let activeTab = 'ayah';
  let activeTagId = null;

  container.append(
    h('header', { class: 'reader-header reader-header--compact' }, [
      h('h1', { class: 'reader-header__title', text: 'العلامات والوسوم' }),
      h('p', { class: 'reader-header__meta', text: 'تُحفظ محليًا في متصفحك، ويمكن تصديرها كملف JSON.' }),
    ]),
  );

  // -------------------------------------------------------------- data actions
  const exportButton = h('button', {
    class: 'btn',
    type: 'button',
    text: '⬇ تصدير',
    onclick: () => {
      const blob = new Blob([ctx.store.exportJson()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = h('a', { href: url, download: `quran-web-bookmarks-${new Date().toISOString().slice(0, 10)}.json` });
      link.click();
      URL.revokeObjectURL(url);
      toast('تم تصدير العلامات');
    },
  });

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'visually-hidden' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const summary = ctx.store.importJson(await file.text());
      toast(`تم استيراد ${toArabicDigits(summary.bookmarks)} علامة و ${toArabicDigits(summary.tags)} وسم`);
      ctx.rerender();
    } catch (error) {
      toast(`تعذّر الاستيراد: ${error?.message ?? 'ملف غير صالح'}`);
    }
    fileInput.value = '';
  });

  const importButton = h('button', {
    class: 'btn',
    type: 'button',
    text: '⬆ استيراد',
    onclick: () => fileInput.click(),
  });

  container.append(h('div', { class: 'toolbar' }, [exportButton, importButton, fileInput]));

  // ------------------------------------------------------------------- tag form
  const tagNameInput = h('input', {
    class: 'input input--compact',
    placeholder: 'اسم وسم جديد (مثال: وردي اليومي)',
    'aria-label': 'اسم وسم جديد',
  });
  const tagForm = h('form', { class: 'search-inline' }, [
    tagNameInput,
    h('button', { class: 'btn', type: 'submit', text: 'إضافة وسم' }),
  ]);
  tagForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = tagNameInput.value.trim();
    if (!name) return;
    try {
      ctx.store.addTag(name);
      tagNameInput.value = '';
      toast(`أُضيف الوسم «${name}»`);
      draw();
    } catch (error) {
      toast(error?.message ?? 'تعذّر إضافة الوسم');
    }
  });
  container.append(tagForm);

  container.append(tabs, host);

  // -------------------------------------------------------------------- render
  function renderTabs() {
    clear(tabs);
    const counts = {
      ayah: ctx.store.listBookmarks().filter((bookmark) => bookmark.type === 'ayah').length,
      page: ctx.store.listBookmarks().filter((bookmark) => bookmark.type === 'page').length,
      tags: ctx.store.listTags().length,
    };
    for (const [value, label] of [
      ['ayah', `علامات الآيات (${toArabicDigits(counts.ayah)})`],
      ['page', `علامات الصفحات (${toArabicDigits(counts.page)})`],
      ['tags', `الوسوم (${toArabicDigits(counts.tags)})`],
    ]) {
      tabs.append(
        h('button', {
          class: `segmented__item${value === activeTab ? ' is-active' : ''}`,
          type: 'button',
          role: 'tab',
          'aria-selected': value === activeTab ? 'true' : 'false',
          text: label,
          onclick: () => {
            activeTab = value;
            activeTagId = null;
            draw();
          },
        }),
      );
    }
  }

  function bookmarkRow(bookmark) {
    const surah = bookmark.type === 'ayah' ? getSurah(bookmark.surah) : getSurah(bookmark.surah || 1);
    const href = bookmark.type === 'ayah' ? `#/sura/${bookmark.surah}?ayah=${bookmark.ayah}` : `#/page/${bookmark.page}`;
    const title =
      bookmark.type === 'ayah'
        ? `${surah?.nameArabic ?? bookmark.surah} · الآية ${toArabicDigits(bookmark.ayah)}`
        : pageLabel(bookmark.page);
    const tags = ctx.store.listTags();

    const tagSelect = h(
      'select',
      { class: 'select select--compact', 'aria-label': 'وسم العلامة' },
      [
        h('option', { value: '', text: 'بدون وسم' }),
        ...tags.map((tag) =>
          h('option', { value: tag.id, text: tag.name, selected: bookmark.tagId === tag.id ? 'selected' : undefined }),
        ),
      ],
    );
    tagSelect.addEventListener('change', () => {
      ctx.store.setBookmarkTag(bookmark.id, tagSelect.value || null);
      toast('تم تحديث الوسم');
      draw();
    });

    return h('li', { class: 'bookmark-row' }, [
      h('a', { class: 'bookmark-row__link', href }, [
        h('span', { class: 'bookmark-row__title', text: title }),
        h('span', {
          class: 'bookmark-row__meta',
          text: new Date(bookmark.createdAt).toLocaleDateString('ar', { dateStyle: 'medium' }),
        }),
        bookmark.note ? h('span', { class: 'bookmark-row__note', text: bookmark.note }) : null,
      ]),
      tagSelect,
      h('button', {
        class: 'icon-btn icon-btn--danger',
        type: 'button',
        title: 'حذف العلامة',
        'aria-label': 'حذف العلامة',
        text: '✕',
        onclick: () => {
          ctx.store.removeBookmark({ type: bookmark.type, surah: bookmark.surah, ayah: bookmark.ayah, page: bookmark.page });
          toast('حُذفت العلامة');
          draw();
        },
      }),
    ]);
  }

  function draw() {
    renderTabs();
    clear(host);

    if (activeTab === 'tags') {
      const tags = ctx.store.listTags();
      if (!tags.length) {
        host.append(h('p', { class: 'empty', text: 'لا توجد وسوم بعد. أضف وسمًا من الحقل أعلاه.' }));
        return;
      }
      host.append(
        h(
          'ul',
          { class: 'tag-list' },
          tags.map((tag) => {
            const count = ctx.store.listBookmarks(tag.id).length;
            return h('li', { class: `tag-row${activeTagId === tag.id ? ' is-active' : ''}` }, [
              h('button', {
                class: 'btn btn--ghost',
                type: 'button',
                text: `${tag.name} (${toArabicDigits(count)})`,
                onclick: () => {
                  activeTagId = activeTagId === tag.id ? null : tag.id;
                  activeTab = 'ayah';
                  draw();
                },
              }),
              h('button', {
                class: 'icon-btn icon-btn--danger',
                type: 'button',
                title: 'حذف الوسم',
                'aria-label': `حذف الوسم ${tag.name}`,
                text: '✕',
                onclick: () => {
                  ctx.store.removeTag(tag.id);
                  toast('حُذف الوسم');
                  draw();
                },
              }),
            ]);
          }),
        ),
      );
      return;
    }

    const list = ctx.store
      .listBookmarks(activeTab === 'ayah' ? activeTagId : null)
      .filter((bookmark) => bookmark.type === activeTab);

    if (!list.length) {
      host.append(
        h('p', {
          class: 'empty',
          text:
            activeTab === 'ayah'
              ? 'لا توجد علامات آيات. اضغط ☆ عند أي آية لإضافتها.'
              : 'لا توجد علامات صفحات. اضغط «علامة الصفحة» في عارض المصحف.',
        }),
      );
      return;
    }

    host.append(h('ul', { class: 'bookmark-list' }, list.map(bookmarkRow)));
  }

  draw();
  return container;
}
