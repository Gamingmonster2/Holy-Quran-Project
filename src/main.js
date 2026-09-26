/**
 * Application entry point: wires the store, data layer, audio player, router and
 * pages together, and owns the tiny amount of global UI (theme, nav, tag dialog,
 * error states).
 */
import { h, qs, render, toast } from './core/dom.js';
import { createRouter } from './core/router.js';
import { createStore } from './core/store.js';
import { createApi } from './data/api.js';
import { createAudioPlayer } from './data/audio.js';
import { createTranslations } from './data/translations.js';
import { createAudioBar } from './features/audio-bar.js';
import * as ayahReader from './features/ayah-reader.js';
import * as bookmarksPage from './features/bookmarks-page.js';
import * as home from './features/home.js';
import * as mushafReader from './features/mushaf-reader.js';
import * as searchPage from './features/search-page.js';
import * as settingsPage from './features/settings-page.js';
import { pageLabel, toArabicDigits } from './core/quran-info.js';
import { getSurah } from './data/surahs.js';

const ROUTES = [
  { name: 'home', path: '/', page: home },
  { name: 'surah', path: '/sura/:surah', page: ayahReader },
  { name: 'page', path: '/page/:page', page: mushafReader },
  { name: 'search', path: '/search', page: searchPage },
  { name: 'bookmarks', path: '/bookmarks', page: bookmarksPage },
  { name: 'settings', path: '/settings', page: settingsPage },
];

const main = /** @type {HTMLElement} */ (qs('#main'));
const audioBarHost = /** @type {HTMLElement} */ (qs('#audio-bar-host'));
const dialogHost = /** @type {HTMLElement} */ (qs('#dialog-host'));

const store = createStore();
const api = createApi();
const translations = createTranslations();
const player = createAudioPlayer({ store });

/** @type {(() => void)[]} */
let cleanups = [];
let renderToken = 0;
/** @type {any} */
let currentRoute = null;

// ---------------------------------------------------------------------- theme

function applyTheme() {
  const theme = store.getSetting('theme');
  const prefersDark = globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches;
  const resolved = theme === 'auto' ? (prefersDark ? 'dark' : 'light') : theme;
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = theme;
  const meta = qs('meta[name="theme-color"]');
  if (meta) {
    const colors = { light: '#f7f5ef', dark: '#11161b', sepia: '#f3ead7' };
    meta.setAttribute('content', colors[resolved] ?? colors.light);
  }
}

function applyFontSize() {
  document.documentElement.dataset.fontSize = String(store.getSetting('fontSize'));
}

// -------------------------------------------------------------- tag dialog

/**
 * Ask for a tag (existing or new) and store the bookmark with it.
 * @param {{type:'ayah'|'page', surah?:number, ayah?:number, page?:number}} target
 */
function openTagDialog(target) {
  const dialog = h('dialog', { class: 'dialog' });
  const tags = store.listTags();

  const select = h('select', { class: 'select' }, [
    h('option', { value: '', text: 'بدون وسم' }),
    ...tags.map((tag) => h('option', { value: tag.id, text: tag.name })),
  ]);
  const newTagInput = h('input', { class: 'input', placeholder: 'أو أنشئ وسمًا جديدًا…', 'aria-label': 'وسم جديد' });

  const close = () => {
    dialog.close();
    dialog.remove();
  };

  const save = () => {
    const name = newTagInput.value.trim();
    let tagId = select.value || null;
    if (name) tagId = store.addTag(name).id;
    if (tagId) {
      store.addBookmark({ ...target, tagId });
      toast('حُفظت العلامة مع الوسم');
    } else {
      store.removeBookmark(target);
      toast('لم يُحدَّد وسم — أُزيلت العلامة');
    }
    close();
  };

  dialog.append(
    h('form', { method: 'dialog', class: 'dialog__body' }, [
      h('h2', { class: 'dialog__title', text: 'إضافة وسم للعلامة' }),
      h('p', {
        class: 'dialog__subtitle',
        text: target.type === 'ayah'
          ? `${getSurah(Number(target.surah))?.nameArabic ?? ''} · الآية ${toArabicDigits(Number(target.ayah))}`
          : pageLabel(Number(target.page)),
      }),
      select,
      newTagInput,
      h('div', { class: 'dialog__actions' }, [
        h('button', { class: 'btn', type: 'button', text: 'إلغاء', onclick: close }),
        h('button', { class: 'btn btn--primary', type: 'button', text: 'حفظ', onclick: save }),
      ]),
    ]),
  );

  dialog.addEventListener('close', () => dialog.remove());
  dialogHost.append(dialog);
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
  newTagInput.focus();
}

// ------------------------------------------------------------------- contexts

/** @type {any} */
const ctx = {
  store,
  api,
  translations,
  player,
  navigate: (path) => router.navigate(path),
  rerender: () => renderRoute(currentRoute, { keepScroll: true }),
  onCleanup: (fn) => cleanups.push(fn),
  openTagDialog,
  getSetting: (key) => store.getSetting(key),
};

// --------------------------------------------------------------------- routing

/** @param {any} route */
function titleFor(route) {
  switch (route.name) {
    case 'surah': {
      const surah = getSurah(Number(route.params.surah));
      return surah ? `سورة ${surah.nameArabic} — القرآن الكريم` : 'القرآن الكريم';
    }
    case 'page':
      return `صفحة ${toArabicDigits(Number(route.params.page))} — المصحف`;
    case 'search':
      return route.query.q ? `بحث: ${route.query.q}` : 'البحث — القرآن الكريم';
    case 'bookmarks':
      return 'العلامات — القرآن الكريم';
    case 'settings':
      return 'الإعدادات — القرآن الكريم';
    default:
      return 'القرآن الكريم — قراءة وبحث وتلاوة';
  }
}

/** @param {any} route */
function setActiveNav(route) {
  for (const link of document.querySelectorAll('[data-nav]')) {
    const name = link.getAttribute('data-nav');
    const active = name === route.name || (route.name === 'page' && name === 'mushaf');
    link.classList.toggle('is-active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
}

function loadingCard(message = 'جارٍ التحميل…') {
  return h('div', { class: 'loading', role: 'status' }, [
    h('span', { class: 'spinner', 'aria-hidden': 'true' }),
    h('span', { text: message }),
  ]);
}

/** @param {unknown} error */
function errorCard(error) {
  const message = error instanceof Error ? error.message : String(error);
  return h('div', { class: 'page' }, [
    h('div', { class: 'card card--error' }, [
      h('h2', { class: 'card__title', text: 'حدث خطأ' }),
      h('p', { text: message }),
      h('p', { class: 'field__hint', text: 'تأكد من الاتصال بالإنترنت، أو جرّب تنزيل النص كاملًا من الإعدادات للقراءة دون اتصال.' }),
      h('div', { class: 'card__actions' }, [
        h('button', { class: 'btn btn--primary', type: 'button', text: 'إعادة المحاولة', onclick: () => ctx.rerender() }),
        h('a', { class: 'btn', href: '#/', text: 'الصفحة الرئيسية' }),
      ]),
    ]),
  ]);
}

/**
 * @param {any} route
 * @param {{keepScroll?: boolean}} [options]
 */
async function renderRoute(route, options = {}) {
  if (!route) return;
  currentRoute = route;
  const token = ++renderToken;

  for (const cleanup of cleanups.splice(0)) {
    try {
      cleanup();
    } catch (error) {
      console.error('[cleanup]', error);
    }
  }

  setActiveNav(route);
  document.title = titleFor(route);
  main.setAttribute('aria-busy', 'true');
  render(main, [loadingCard()]);
  if (!options.keepScroll) globalThis.scrollTo({ top: 0 });

  const definition = ROUTES.find((entry) => entry.name === route.name) ?? ROUTES[0];
  try {
    const page = await definition.page.render(ctx, route);
    if (token !== renderToken) return; // a newer navigation won
    render(main, [page]);
  } catch (error) {
    if (token !== renderToken) return;
    console.error('[route]', error);
    render(main, [errorCard(error)]);
  } finally {
    if (token === renderToken) {
      main.removeAttribute('aria-busy');
      main.focus({ preventScroll: true });
    }
  }
}

const router = createRouter({ routes: ROUTES, fallback: 'home', onRoute: renderRoute });

// ------------------------------------------------------------------ audio bar

const audioBar = createAudioBar(ctx);
audioBarHost.append(audioBar.element);

// ------------------------------------------------------------------ app start

applyTheme();
applyFontSize();

store.subscribe(({ what }) => {
  if (what === 'settings') {
    applyTheme();
    applyFontSize();
  }
});

globalThis.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
  if (store.getSetting('theme') === 'auto') applyTheme();
});

router.start();

// Expose a tiny surface for debugging in the browser console.
globalThis.quranWeb = { store, api, translations, player, router };
