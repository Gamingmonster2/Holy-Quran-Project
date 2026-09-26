/**
 * Persistent audio bar — web counterpart of `feature:audiobar`.
 *
 * Subscribes to the player, renders the current position, and re-broadcasts
 * ayah changes as a `quran:ayah` DOM event so the reader can highlight and
 * follow along.
 */
import { h } from '../core/dom.js';
import { getReciter } from '../data/audio.js';
import { getSurah } from '../data/surahs.js';
import { toArabicDigits } from '../core/quran-info.js';

/**
 * @param {any} ctx
 * @returns {{element: HTMLElement, destroy: () => void}}
 */
export function createAudioBar(ctx) {
  const label = h('span', { class: 'audio-bar__label', text: 'لم تبدأ التلاوة' });
  const reciterLabel = h('span', { class: 'audio-bar__reciter' });
  const status = h('span', { class: 'audio-bar__status' });

  const playButton = h('button', {
    class: 'audio-bar__button audio-bar__button--play',
    type: 'button',
    title: 'تشغيل/إيقاف',
    'aria-label': 'تشغيل أو إيقاف التلاوة',
    text: '▶',
    onclick: () => ctx.player.toggle(),
  });

  const repeatButton = h('button', {
    class: 'audio-bar__button',
    type: 'button',
    title: 'وضع التكرار',
    'aria-label': 'تغيير وضع التكرار',
    text: 'تكرار: لا',
    onclick: () => {
      const order = ['off', 'one', 'all'];
      const current = ctx.player.getState().repeat;
      const next = order[(order.indexOf(current) + 1) % order.length];
      ctx.store.setSetting('repeatMode', next);
      ctx.player.syncSettings();
    },
  });

  const openLink = h('a', { class: 'audio-bar__link', href: '#/', text: 'فتح' });

  const root = h('div', { class: 'audio-bar', hidden: true, role: 'region', 'aria-label': 'مشغل التلاوة' }, [
    h('div', { class: 'audio-bar__controls' }, [
      h('button', {
        class: 'audio-bar__button',
        type: 'button',
        title: 'الآية السابقة',
        'aria-label': 'الآية السابقة',
        text: '⏮',
        onclick: () => ctx.player.previous(),
      }),
      playButton,
      h('button', {
        class: 'audio-bar__button',
        type: 'button',
        title: 'الآية التالية',
        'aria-label': 'الآية التالية',
        text: '⏭',
        onclick: () => ctx.player.next(),
      }),
    ]),
    h('div', { class: 'audio-bar__info' }, [label, reciterLabel]),
    h('div', { class: 'audio-bar__right' }, [
      status,
      repeatButton,
      openLink,
      h('button', {
        class: 'audio-bar__button',
        type: 'button',
        title: 'إغلاق المشغل',
        'aria-label': 'إغلاق المشغل',
        text: '✕',
        onclick: () => {
          ctx.player.stop();
          root.hidden = true;
        },
      }),
    ]),
  ]);

  let lastKey = '';
  const unsubscribe = ctx.player.subscribe((state) => {
    if (!state.surah) {
      root.hidden = true;
      return;
    }
    root.hidden = false;
    const surah = getSurah(state.surah);
    label.textContent = `${surah ? `سورة ${surah.nameArabic}` : `سورة ${state.surah}`} · الآية ${toArabicDigits(state.ayah)}`;
    reciterLabel.textContent = getReciter(state.reciterId).name;
    playButton.textContent = state.playing ? '⏸' : '▶';
    status.textContent = state.error ? state.error : state.loading ? 'جارٍ التحميل…' : '';
    status.classList.toggle('is-error', Boolean(state.error));
    repeatButton.textContent = `تكرار: ${state.repeat === 'off' ? 'لا' : state.repeat === 'one' ? 'الآية' : 'مستمر'}`;
    openLink.href = `#/sura/${state.surah}?ayah=${state.ayah}`;

    const key = `${state.surah}:${state.ayah}:${state.playing}`;
    if (key !== lastKey) {
      lastKey = key;
      document.dispatchEvent(new CustomEvent('quran:ayah', { detail: { surah: state.surah, ayah: state.ayah } }));
    }
  });

  return { element: root, destroy: unsubscribe };
}
