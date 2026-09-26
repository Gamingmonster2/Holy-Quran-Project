/**
 * Documentation viewer for `docs.html`.
 *
 * GitHub Pages serves `.md` files as downloads rather than pages, so the
 * project's own docs are rendered in-app instead. Only the files in this
 * whitelist can be requested — the URL never reaches the filesystem, so there
 * is no path-traversal surface.
 */
import { h, qs, render } from './core/dom.js';
import { renderMarkdown } from './core/markdown.js';

/** @type {{id:string, path:string, title:string}[]} */
export const DOCS = [
  { id: 'DATA_SOURCES.md', path: './docs/DATA_SOURCES.md', title: 'مصادر البيانات والرخص' },
  { id: 'DEPLOY-GITHUB-PAGES.md', path: './docs/DEPLOY-GITHUB-PAGES.md', title: 'النشر على GitHub Pages' },
  { id: 'MIGRATION-FROM-ANDROID.md', path: './docs/MIGRATION-FROM-ANDROID.md', title: 'الترحيل من مشروع أندرويد' },
  { id: 'TESTING.md', path: './docs/TESTING.md', title: 'استراتيجية الاختبار' },
  { id: 'README.md', path: './README.md', title: 'دليل المشروع (README)' },
];

export const DEFAULT_DOC_ID = DOCS[0].id;

/** @param {string} id */
export function findDoc(id) {
  return DOCS.find((doc) => doc.id === id) ?? null;
}

/** @param {string} [search] */
export function docIdFromSearch(search) {
  const params = new URLSearchParams(search ?? globalThis.location?.search ?? '');
  return params.get('f') ?? DEFAULT_DOC_ID;
}

async function main() {
  const host = qs('#doc-body');
  const menu = qs('#doc-menu');
  const title = qs('#doc-title');
  if (!host || !menu) return;

  const requested = docIdFromSearch();
  const doc = findDoc(requested);

  render(
    menu,
    DOCS.map((entry) =>
      h('a', {
        class: `docs-menu__link${entry.id === (doc?.id ?? '') ? ' is-active' : ''}`,
        href: `./docs.html?f=${encodeURIComponent(entry.id)}`,
        text: entry.title,
      }),
    ),
  );

  if (!doc) {
    if (title) title.textContent = 'مستند غير موجود';
    render(host, [
      h('p', { class: 'notice notice--error', text: `لا يوجد مستند بالمعرّف «${requested}».` }),
      h('p', {}, [h('a', { href: `./docs.html?f=${encodeURIComponent(DEFAULT_DOC_ID)}`, text: 'فتح مصادر البيانات والرخص' })]),
    ]);
    return;
  }

  if (title) title.textContent = doc.title;
  render(host, [h('p', { class: 'loading', text: 'جارٍ تحميل المستند…' })]);

  try {
    const response = await fetch(doc.path);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const article = h('article', { class: 'md', html: renderMarkdown(await response.text()) });
    render(host, [article]);
  } catch (error) {
    render(host, [
      h('p', { class: 'notice notice--error', text: `تعذّر تحميل المستند (${error?.message ?? 'خطأ غير معروف'}).` }),
      h('p', {}, [h('a', { href: doc.path, text: 'فتح الملف مباشرة' })]),
    ]);
  }
}

// Guarded so the module stays importable (and therefore testable) outside a
// browser, where `document` does not exist.
if (typeof document !== 'undefined') main();
