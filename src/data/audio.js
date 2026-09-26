/**
 * Audio playback — web counterpart of `feature:audio` + `feature:audiobar`.
 *
 * Per-ayah files come from everyayah.com, laid out as
 * `{folder}/{sss}{aaa}.mp3` with zero-padded 3-digit surah and ayah numbers.
 * Continuous surah playback is produced by queueing the ayah files, which is
 * exactly what the Android app's "gapped" mode does, so no separate gapless
 * mirror is required (add one via `surahUrl` if you have it).
 */
import { getSurah } from './surahs.js';

export const EVERYAYAH_BASE = 'https://everyayah.com/data';

/** @typedef {{id:string, name:string, folder:string}} Reciter */

/** @type {Reciter[]} */
export const RECITERS = [
  { id: 'alafasy', name: 'مشاري راشد العفاسي', folder: 'Alafasy_128kbps' },
  { id: 'husary', name: 'محمود خليل الحصري', folder: 'Husary_128kbps' },
  { id: 'abdulbasit', name: 'عبد الباسط عبد الصمد (مرتّل)', folder: 'Abdul_Basit_Murattal_192kbps' },
  { id: 'minshawi', name: 'محمد صديق المنشاوي (مرتّل)', folder: 'Minshawy_Murattal_128kbps' },
  { id: 'sudais', name: 'عبد الرحمن السديس', folder: 'Sudais_128kbps' },
  { id: 'shuraym', name: 'سعود الشريم', folder: 'Shuraym_128kbps' },
  { id: 'ghamadi', name: 'سعد الغامدي', folder: 'Ghamadi_40kbps' },
  { id: 'ajamy', name: 'أحمد بن علي العجمي', folder: 'Alajamy_128kbps' },
  { id: 'maher', name: 'ماهر المعيقلي', folder: 'MaherAlMuaiqly128kbps' },
  { id: 'ayyoub', name: 'محمد أيوب', folder: 'Muhammad_Ayyoub_128kbps' },
];

export const DEFAULT_RECITER_ID = 'alafasy';

/** @param {string} id */
export function getReciter(id) {
  return RECITERS.find((reciter) => reciter.id === id) ?? RECITERS[0];
}

/** @param {number} value @param {number} [width] */
export function padNumber(value, width = 3) {
  return String(Math.max(0, Math.trunc(value))).padStart(width, '0');
}

/**
 * @param {string} reciterId
 * @param {number} surah 1..114
 * @param {number} ayah 1..ayahCount
 * @param {{baseUrl?: string}} [options]
 */
export function buildAyahUrl(reciterId, surah, ayah, options = {}) {
  const reciter = getReciter(reciterId);
  const baseUrl = options.baseUrl ?? EVERYAYAH_BASE;
  return `${baseUrl}/${reciter.folder}/${padNumber(surah)}${padNumber(ayah)}.mp3`;
}

/**
 * Next position in a surah, honouring repeat mode.
 * @param {{surah:number, ayah:number}} position
 * @param {{repeat?: 'off'|'one'|'all'}} [options]
 * @returns {{surah:number, ayah:number}|null} `null` when playback should stop
 */
export function nextAyah(position, options = {}) {
  const { repeat = 'off' } = options;
  if (repeat === 'one') return { ...position };
  const surah = getSurah(position.surah);
  if (!surah) return null;
  if (position.ayah < surah.ayahCount) return { surah: position.surah, ayah: position.ayah + 1 };
  if (repeat === 'all') {
    const nextSurah = position.surah < 114 ? position.surah + 1 : 1;
    return { surah: nextSurah, ayah: 1 };
  }
  return null;
}

/**
 * Previous position in a surah. Moving back from ayah 1 crosses into the
 * previous surah, as a reader would expect.
 * @param {{surah:number, ayah:number}} position
 */
export function previousAyah(position) {
  if (position.ayah > 1) return { surah: position.surah, ayah: position.ayah - 1 };
  if (position.surah > 1) {
    const previous = getSurah(position.surah - 1);
    if (previous) return { surah: previous.number, ayah: previous.ayahCount };
  }
  return { surah: position.surah, ayah: 1 };
}

/**
 * The player is a thin wrapper around a single `HTMLAudioElement`. The element
 * is injectable so the queue logic can be exercised without a browser.
 *
 * @param {{audio?: any, store?: any, baseUrl?: string,
 *   onState?: (state:any) => void}} [options]
 */
export function createAudioPlayer(options = {}) {
  const store = options.store ?? null;
  const audio = options.audio ?? (typeof Audio !== 'undefined' ? new Audio() : null);
  const baseUrl = options.baseUrl ?? EVERYAYAH_BASE;
  /** @type {Set<(state:any)=>void>} */
  const listeners = new Set();

  /** @type {{playing:boolean, loading:boolean, surah:number, ayah:number,
   *   reciterId:string, repeat:'off'|'one'|'all', error:string|null}} */
  let state = {
    playing: false,
    loading: false,
    surah: 0,
    ayah: 0,
    reciterId: store?.getSetting('reciterId') ?? DEFAULT_RECITER_ID,
    repeat: store?.getSetting('repeatMode') ?? 'off',
    error: null,
  };

  function publish(patch = {}) {
    state = { ...state, ...patch };
    for (const listener of listeners) listener({ ...state });
    options.onState?.({ ...state });
  }

  function attach() {
    if (!audio || audio.__quranWired) return;
    audio.__quranWired = true;
    audio.addEventListener?.('ended', () => advance(1));
    audio.addEventListener?.('play', () => publish({ playing: true, loading: false }));
    audio.addEventListener?.('pause', () => publish({ playing: false }));
    audio.addEventListener?.('waiting', () => publish({ loading: true }));
    audio.addEventListener?.('playing', () => publish({ loading: false, playing: true }));
    audio.addEventListener?.('error', () => {
      publish({ playing: false, loading: false, error: 'تعذّر تشغيل التلاوة — تحقّق من الاتصال' });
    });
  }

  /** @param {number} surah @param {number} ayah */
  function load(surah, ayah) {
    if (!audio) return;
    const url = buildAyahUrl(state.reciterId, surah, ayah, { baseUrl });
    audio.src = url;
    audio.load?.();
  }

  /** @param {number} delta +1 / -1 */
  function advance(delta) {
    const position = { surah: state.surah, ayah: state.ayah };
    const target = delta > 0 ? nextAyah(position, { repeat: state.repeat }) : previousAyah(position);
    if (!target) {
      publish({ playing: false });
      return;
    }
    play(target.surah, target.ayah);
  }

  /** @param {number} surah @param {number} ayah */
  function play(surah, ayah) {
    const surahMeta = getSurah(surah);
    if (!surahMeta || ayah < 1 || ayah > surahMeta.ayahCount) {
      publish({ error: 'موضع تلاوة غير صحيح', playing: false });
      return;
    }
    publish({ surah, ayah, error: null, loading: true });
    load(surah, ayah);
    const result = audio?.play?.();
    if (result && typeof result.catch === 'function') {
      result.catch(() => {
        // Autoplay policies reject silently on first interaction; surface it.
        publish({ playing: false, loading: false, error: 'اضغط على زر التشغيل للسماح بالصوت' });
      });
    }
  }

  attach();

  return {
    /** @param {(state:any) => void} listener */
    subscribe(listener) {
      listeners.add(listener);
      listener({ ...state });
      return () => listeners.delete(listener);
    },
    getState() {
      return { ...state };
    },

    /** Play one ayah (does not change the mode). */
    playAyah(surah, ayah) {
      play(surah, ayah);
    },

    /** Start continuous playback of a surah from `ayah`. */
    playSurah(surah, ayah = 1) {
      play(surah, ayah);
    },

    /** Re-read the reciter/repeat settings from the store. */
    syncSettings() {
      publish({
        reciterId: store?.getSetting('reciterId') ?? state.reciterId,
        repeat: store?.getSetting('repeatMode') ?? state.repeat,
      });
    },

    /** @param {string} reciterId */
    setReciter(reciterId) {
      if (!audio) return;
      publish({ reciterId });
      store?.setSetting('reciterId', reciterId);
      if (state.surah) {
        load(state.surah, state.ayah);
        if (state.playing) audio.play?.();
      }
    },

    toggle() {
      if (!audio) return;
      if (!state.surah) return;
      if (state.playing) audio.pause?.();
      else audio.play?.();
    },

    next() {
      advance(1);
    },

    previous() {
      advance(-1);
    },

    stop() {
      if (!audio) return;
      audio.pause?.();
      audio.removeAttribute?.('src');
      publish({ playing: false, loading: false, error: null });
    },

    /** @param {number} value seconds */
    seek(value) {
      if (!audio || !Number.isFinite(value)) return;
      audio.currentTime = value;
      publish({});
    },

    get duration() {
      return audio?.duration ?? 0;
    },

    get currentTime() {
      return audio?.currentTime ?? 0;
    },

    get element() {
      return audio;
    },
  };
}
