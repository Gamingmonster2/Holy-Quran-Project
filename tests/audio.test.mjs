import { RECITERS, buildAyahUrl, getReciter, nextAyah, padNumber, previousAyah } from '../src/data/audio.js';
import { assertDeepEqual, assertEqual, assertIncludes, assertTrue, test } from './harness.mjs';

test('ayah numbers are zero-padded to three digits', () => {
  assertEqual(padNumber(1), '001');
  assertEqual(padNumber(114), '114');
  assertEqual(padNumber(6), '006');
});

test('the ayah audio url follows the everyayah layout', () => {
  assertEqual(buildAyahUrl('alafasy', 1, 1), 'https://everyayah.com/data/Alafasy_128kbps/001001.mp3');
  assertEqual(buildAyahUrl('husary', 114, 6), 'https://everyayah.com/data/Husary_128kbps/114006.mp3');
  assertIncludes(buildAyahUrl('alafasy', 2, 255, { baseUrl: 'https://mirror.local' }), 'https://mirror.local/Alafasy_128kbps/002255.mp3');
});

test('every reciter has a usable folder, and unknown ids fall back to the first', () => {
  for (const reciter of RECITERS) {
    assertTrue(Boolean(reciter.folder), `${reciter.id} has no folder`);
    assertIncludes(buildAyahUrl(reciter.id, 1, 1), `/${reciter.folder}/`);
  }
  assertEqual(getReciter('does-not-exist').id, RECITERS[0].id);
});

test('playback advances to the next ayah within the surah', () => {
  assertDeepEqual(nextAyah({ surah: 2, ayah: 1 }), { surah: 2, ayah: 2 });
});

test('playback stops at the end of a surah unless repeat-all is set', () => {
  assertEqual(nextAyah({ surah: 1, ayah: 7 }), null);
  assertDeepEqual(nextAyah({ surah: 1, ayah: 7 }, { repeat: 'all' }), { surah: 2, ayah: 1 });
  assertDeepEqual(nextAyah({ surah: 114, ayah: 6 }, { repeat: 'all' }), { surah: 1, ayah: 1 });
});

test('repeat-one replays the same ayah forever', () => {
  assertDeepEqual(nextAyah({ surah: 1, ayah: 7 }, { repeat: 'one' }), { surah: 1, ayah: 7 });
  assertDeepEqual(nextAyah({ surah: 5, ayah: 3 }, { repeat: 'one' }), { surah: 5, ayah: 3 });
});

test('stepping backwards crosses surah boundaries', () => {
  assertDeepEqual(previousAyah({ surah: 2, ayah: 2 }), { surah: 2, ayah: 1 });
  assertDeepEqual(previousAyah({ surah: 2, ayah: 1 }), { surah: 1, ayah: 7 });
  assertDeepEqual(previousAyah({ surah: 1, ayah: 1 }), { surah: 1, ayah: 1 });
});

test('an invalid position is refused instead of producing a broken url', () => {
  assertEqual(nextAyah({ surah: 200, ayah: 1 }), null);
});
