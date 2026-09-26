/**
 * Surah metadata snapshot.
 *
 * A one-time snapshot taken from the quran.com chapters endpoint while it was
 * still public. It is bundled so the index renders instantly and offline, with
 * **no runtime dependency** on any API — see docs/DATA_SOURCES.md.
 *
 * Compact tuple form keeps the file reviewable:
 *   [number, nameArabic, nameSimple, ayahCount, revelationPlace,
 *    pageStart, pageEnd, bismillahPre]
 */
const RAW = [
  [1, 'الفاتحة', 'Al-Fatihah', 7, 'makkah', 1, 1, false],
  [2, 'البقرة', 'Al-Baqarah', 286, 'madinah', 2, 49, true],
  [3, 'آل عمران', "Ali 'Imran", 200, 'madinah', 50, 76, true],
  [4, 'النساء', 'An-Nisa', 176, 'madinah', 77, 106, true],
  [5, 'المائدة', "Al-Ma'idah", 120, 'madinah', 106, 127, true],
  [6, 'الأنعام', "Al-An'am", 165, 'makkah', 128, 150, true],
  [7, 'الأعراف', "Al-A'raf", 206, 'makkah', 151, 176, true],
  [8, 'الأنفال', 'Al-Anfal', 75, 'madinah', 177, 186, true],
  [9, 'التوبة', 'At-Tawbah', 129, 'madinah', 187, 207, false],
  [10, 'يونس', 'Yunus', 109, 'makkah', 208, 221, true],
  [11, 'هود', 'Hud', 123, 'makkah', 221, 235, true],
  [12, 'يوسف', 'Yusuf', 111, 'makkah', 235, 248, true],
  [13, 'الرعد', "Ar-Ra'd", 43, 'madinah', 249, 255, true],
  [14, 'إبراهيم', 'Ibrahim', 52, 'makkah', 255, 261, true],
  [15, 'الحجر', 'Al-Hijr', 99, 'makkah', 262, 267, true],
  [16, 'النحل', 'An-Nahl', 128, 'makkah', 267, 281, true],
  [17, 'الإسراء', 'Al-Isra', 111, 'makkah', 282, 293, true],
  [18, 'الكهف', 'Al-Kahf', 110, 'makkah', 293, 304, true],
  [19, 'مريم', 'Maryam', 98, 'makkah', 305, 312, true],
  [20, 'طه', 'Taha', 135, 'makkah', 312, 321, true],
  [21, 'الأنبياء', 'Al-Anbya', 112, 'makkah', 322, 331, true],
  [22, 'الحج', 'Al-Hajj', 78, 'madinah', 332, 341, true],
  [23, 'المؤمنون', "Al-Mu'minun", 118, 'makkah', 342, 349, true],
  [24, 'النور', 'An-Nur', 64, 'madinah', 350, 359, true],
  [25, 'الفرقان', 'Al-Furqan', 77, 'makkah', 359, 366, true],
  [26, 'الشعراء', "Ash-Shu'ara", 227, 'makkah', 367, 376, true],
  [27, 'النمل', 'An-Naml', 93, 'makkah', 377, 385, true],
  [28, 'القصص', 'Al-Qasas', 88, 'makkah', 385, 396, true],
  [29, 'العنكبوت', "Al-'Ankabut", 69, 'makkah', 396, 404, true],
  [30, 'الروم', 'Ar-Rum', 60, 'makkah', 404, 410, true],
  [31, 'لقمان', 'Luqman', 34, 'makkah', 411, 414, true],
  [32, 'السجدة', 'As-Sajdah', 30, 'makkah', 415, 417, true],
  [33, 'الأحزاب', 'Al-Ahzab', 73, 'madinah', 418, 427, true],
  [34, 'سبأ', 'Saba', 54, 'makkah', 428, 434, true],
  [35, 'فاطر', 'Fatir', 45, 'makkah', 434, 440, true],
  [36, 'يس', 'Ya-Sin', 83, 'makkah', 440, 445, true],
  [37, 'الصافات', 'As-Saffat', 182, 'makkah', 446, 452, true],
  [38, 'ص', 'Sad', 88, 'makkah', 453, 458, true],
  [39, 'الزمر', 'Az-Zumar', 75, 'makkah', 458, 467, true],
  [40, 'غافر', 'Ghafir', 85, 'makkah', 467, 476, true],
  [41, 'فصلت', 'Fussilat', 54, 'makkah', 477, 482, true],
  [42, 'الشورى', 'Ash-Shuraa', 53, 'makkah', 483, 489, true],
  [43, 'الزخرف', 'Az-Zukhruf', 89, 'makkah', 489, 495, true],
  [44, 'الدخان', 'Ad-Dukhan', 59, 'makkah', 496, 498, true],
  [45, 'الجاثية', 'Al-Jathiyah', 37, 'makkah', 499, 502, true],
  [46, 'الأحقاف', 'Al-Ahqaf', 35, 'makkah', 502, 506, true],
  [47, 'محمد', 'Muhammad', 38, 'madinah', 507, 510, true],
  [48, 'الفتح', 'Al-Fath', 29, 'madinah', 511, 515, true],
  [49, 'الحجرات', 'Al-Hujurat', 18, 'madinah', 515, 517, true],
  [50, 'ق', 'Qaf', 45, 'makkah', 518, 520, true],
  [51, 'الذاريات', 'Adh-Dhariyat', 60, 'makkah', 520, 523, true],
  [52, 'الطور', 'At-Tur', 49, 'makkah', 523, 525, true],
  [53, 'النجم', 'An-Najm', 62, 'makkah', 526, 528, true],
  [54, 'القمر', 'Al-Qamar', 55, 'makkah', 528, 531, true],
  [55, 'الرحمن', 'Ar-Rahman', 78, 'madinah', 531, 534, true],
  [56, 'الواقعة', "Al-Waqi'ah", 96, 'makkah', 534, 537, true],
  [57, 'الحديد', 'Al-Hadid', 29, 'madinah', 537, 541, true],
  [58, 'المجادلة', 'Al-Mujadila', 22, 'madinah', 542, 545, true],
  [59, 'الحشر', 'Al-Hashr', 24, 'madinah', 545, 548, true],
  [60, 'الممتحنة', 'Al-Mumtahanah', 13, 'madinah', 549, 551, true],
  [61, 'الصف', 'As-Saf', 14, 'madinah', 551, 552, true],
  [62, 'الجمعة', "Al-Jumu'ah", 11, 'madinah', 553, 554, true],
  [63, 'المنافقون', 'Al-Munafiqun', 11, 'madinah', 554, 555, true],
  [64, 'التغابن', 'At-Taghabun', 18, 'madinah', 556, 557, true],
  [65, 'الطلاق', 'At-Talaq', 12, 'madinah', 558, 559, true],
  [66, 'التحريم', 'At-Tahrim', 12, 'madinah', 560, 561, true],
  [67, 'الملك', 'Al-Mulk', 30, 'makkah', 562, 564, true],
  [68, 'القلم', 'Al-Qalam', 52, 'makkah', 564, 566, true],
  [69, 'الحاقة', 'Al-Haqqah', 52, 'makkah', 566, 568, true],
  [70, 'المعارج', "Al-Ma'arij", 44, 'makkah', 568, 570, true],
  [71, 'نوح', 'Nuh', 28, 'makkah', 570, 571, true],
  [72, 'الجن', 'Al-Jinn', 28, 'makkah', 572, 573, true],
  [73, 'المزمل', 'Al-Muzzammil', 20, 'makkah', 574, 575, true],
  [74, 'المدثر', 'Al-Muddaththir', 56, 'makkah', 575, 577, true],
  [75, 'القيامة', 'Al-Qiyamah', 40, 'makkah', 577, 578, true],
  [76, 'الانسان', 'Al-Insan', 31, 'madinah', 578, 580, true],
  [77, 'المرسلات', 'Al-Mursalat', 50, 'makkah', 580, 581, true],
  [78, 'النبإ', 'An-Naba', 40, 'makkah', 582, 583, true],
  [79, 'النازعات', "An-Nazi'at", 46, 'makkah', 583, 584, true],
  [80, 'عبس', "'Abasa", 42, 'makkah', 585, 585, true],
  [81, 'التكوير', 'At-Takwir', 29, 'makkah', 586, 586, true],
  [82, 'الإنفطار', 'Al-Infitar', 19, 'makkah', 587, 587, true],
  [83, 'المطففين', 'Al-Mutaffifin', 36, 'makkah', 587, 589, true],
  [84, 'الإنشقاق', 'Al-Inshiqaq', 25, 'makkah', 589, 589, true],
  [85, 'البروج', 'Al-Buruj', 22, 'makkah', 590, 590, true],
  [86, 'الطارق', 'At-Tariq', 17, 'makkah', 591, 591, true],
  [87, 'الأعلى', "Al-A'la", 19, 'makkah', 591, 592, true],
  [88, 'الغاشية', 'Al-Ghashiyah', 26, 'makkah', 592, 592, true],
  [89, 'الفجر', 'Al-Fajr', 30, 'makkah', 593, 594, true],
  [90, 'البلد', 'Al-Balad', 20, 'makkah', 594, 594, true],
  [91, 'الشمس', 'Ash-Shams', 15, 'makkah', 595, 595, true],
  [92, 'الليل', 'Al-Layl', 21, 'makkah', 595, 596, true],
  [93, 'الضحى', 'Ad-Duhaa', 11, 'makkah', 596, 596, true],
  [94, 'الشرح', 'Ash-Sharh', 8, 'makkah', 596, 596, true],
  [95, 'التين', 'At-Tin', 8, 'makkah', 597, 597, true],
  [96, 'العلق', "Al-'Alaq", 19, 'makkah', 597, 597, true],
  [97, 'القدر', 'Al-Qadr', 5, 'makkah', 598, 598, true],
  [98, 'البينة', 'Al-Bayyinah', 8, 'madinah', 598, 599, true],
  [99, 'الزلزلة', 'Az-Zalzalah', 8, 'madinah', 599, 599, true],
  [100, 'العاديات', "Al-'Adiyat", 11, 'makkah', 599, 600, true],
  [101, 'القارعة', "Al-Qari'ah", 11, 'makkah', 600, 600, true],
  [102, 'التكاثر', 'At-Takathur', 8, 'makkah', 600, 600, true],
  [103, 'العصر', "Al-'Asr", 3, 'makkah', 601, 601, true],
  [104, 'الهمزة', 'Al-Humazah', 9, 'makkah', 601, 601, true],
  [105, 'الفيل', 'Al-Fil', 5, 'makkah', 601, 601, true],
  [106, 'قريش', 'Quraysh', 4, 'makkah', 602, 602, true],
  [107, 'الماعون', "Al-Ma'un", 7, 'makkah', 602, 602, true],
  [108, 'الكوثر', 'Al-Kawthar', 3, 'makkah', 602, 602, true],
  [109, 'الكافرون', 'Al-Kafirun', 6, 'makkah', 603, 603, true],
  [110, 'النصر', 'An-Nasr', 3, 'madinah', 603, 603, true],
  [111, 'المسد', 'Al-Masad', 5, 'makkah', 603, 603, true],
  [112, 'الإخلاص', 'Al-Ikhlas', 4, 'makkah', 604, 604, true],
  [113, 'الفلق', 'Al-Falaq', 5, 'makkah', 604, 604, true],
  [114, 'الناس', 'An-Nas', 6, 'makkah', 604, 604, true],
];

export const MADANI_PAGE_COUNT = 604;
export const TOTAL_AYAHS = 6236;

/** @typedef {{number:number, nameArabic:string, nameSimple:string, ayahCount:number,
 *   revelationPlace:'makkah'|'madinah', pageStart:number, pageEnd:number,
 *   bismillahPre:boolean}} Surah */

/** @type {Surah[]} */
export const SURAHS = RAW.map(
  ([number, nameArabic, nameSimple, ayahCount, revelationPlace, pageStart, pageEnd, bismillahPre]) => ({
    number,
    nameArabic,
    nameSimple,
    ayahCount,
    revelationPlace,
    pageStart,
    pageEnd,
    bismillahPre,
  }),
);

/** @param {number} surahNumber 1..114 */
export function getSurah(surahNumber) {
  return SURAHS[surahNumber - 1] ?? null;
}

/**
 * Arabic ordinal label used by the reader header, e.g. "سورة البقرة".
 * @param {number} surahNumber
 */
export function surahTitle(surahNumber) {
  const surah = getSurah(surahNumber);
  return surah ? `سورة ${surah.nameArabic}` : '';
}
