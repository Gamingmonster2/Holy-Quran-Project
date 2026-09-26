# مصادر البيانات والرخص

التطبيق **لا يحزم أي بيانات قرآنية**. النص والترجمات وصور المصحف والتلاوات
تُجلب وقت التشغيل من مصادر ساكنة عامة، ثم تُخزَّن في المتصفح (IndexedDB)، فيعمل
النص كاملًا دون إنترنت بعد تنزيله مرة واحدة.

اقرأ هذه الصفحة قبل نشر أي شيء.

---

## ١. المصادر المستخدمة (كلها مُتحقَّق منها فعليًا)

| ما يُجلب | الرابط | التحقق |
|----------|--------|--------|
| نص السورة (النص العثماني) | `cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ara-quranuthmanihaf/{رقم السورة}.json` | HTTP 200 + JSON صحيح |
| النص كاملًا للبحث والقراءة دون اتصال | `…/editions/ara-quranuthmanihaf.min.json` | الملف موجود، حجمه ١.٥٩ ميجابايت |
| الترجمات والتفسير (أكثر من ٤٤٠ إصدارًا) | `…/editions/{edition}/{رقم السورة}.json` | HTTP 200 + JSON صحيح |
| كتالوج كل الإصدارات واللغات | `…/editions.json` | HTTP 200 |
| صور صفحات المصحف (٦٠٤ صفحات) | `cdn.jsdelivr.net/gh/sufone/medina-mushaf@master/png-d150/{رقم الصفحة}.png` | `content-type: image/png` |
| التلاوات (آية بآية) | `everyayah.com/data/{القارئ}/{٣ أرقام للسورة}{٣ أرقام للآية}.mp3` | النمط القياسي المتّبع |
| بيانات السور الوصفية | لقطة ساكنة داخل `src/data/surahs.js` | لا اتصال وقت التشغيل |

كل ما سبق يمرّ عبر **jsDelivr** الذي يرسل `access-control-allow-origin: *`، لذا
يعمل من متصفح مباشرة دون أي مفتاح أو تسجيل.

---

## ٢. لماذا لا نستخدم `api.quran.com`؟

كان هذا التطبيق يستخدم `https://api.quran.com/api/v4` في نسخته الأولى، ثم تبيّن
أنه **في طور الإهمال**: البديل الرسمي (Quran Foundation Content APIs) يتطلب
مصادقة OAuth2 بمفتاح `client_secret` على **خادم خلفي**، ووثائقهم تنص صراحة على
أن مسار المتصفح/التطبيقات العامة **لا يجوز** استخدامه للـ Content أو Search:

> **Do not use this when:** You need Content, Search, or `client_secret`.
> — [Quran Foundation docs: Public Quickstart](https://api-docs.quran.foundation/docs/sdk/javascript/public-quickstart/)

موقع ساكن على GitHub Pages لا يملك خادمًا ولا يمكنه إخفاء مفتاح، لذلك **أُزيل
هذا الاعتماد بالكامل**، ولم يبقَ في الشيفرة أي استدعاء له. هذا يجعل التطبيق:

* لا يعتمد على واجهة قد تُغلق أو تتغيّر.
* بلا حدود معدل استهلاك (rate limits) ولا مفاتيح.
* قابل للعمل بلا خادم خلفي ولا تكلفة.

الاستثناء الوحيد هو **لقطة** أسماء السور وأرقام صفحاتها، وهي ملف ساكن مرفق داخل
المستودع ولا تُجلب عبر الشبكة.

---

## ٣. التخزين في المتصفح

| ما يُخزَّن | المكان | الحجم التقريبي |
|-----------|--------|----------------|
| نص سورة عند قراءتها | IndexedDB | ٥–٤٠ كيلوبايت للسورة |
| النص كاملًا (عند البحث أو التنزيل) | IndexedDB | ~١.٦ ميجابايت |
| ترجمة سورة | IndexedDB | ٥–٥٠ كيلوبايت |
| صور المصحف | ذاكرة المتصفح المؤقتة (HTTP cache) | ~٢٠٠–٦٠٠ كيلوبايت للصفحة |
| العلامات والوسوم وآخر قراءة والإعدادات | `localStorage` | أقل من ١٠٠ كيلوبايت |
| التلاوات | لا تُخزَّن (تشغيل مباشر) | — |

---

## ٤. التراخيص — اقرأ هذا بعناية

* **شيفرة التطبيق**: GPL-3.0-or-later، موروثة من Quran for Android. أي نسخة
  تنشرها يجب أن تبقى مفتوحة المصدر.
* **النص القرآني والترجمات والتفسير**: عمل علماء ومؤسسات، وغالبًا برخصة
  **CC BY-NC-ND** أو ما يشبهها عبر [tanzil.net](http://tanzil.net) و
  [quranenc.com](https://quranenc.com) و[مجمع الملك فهد](https://qurancomplex.gov.sa).
* **صور المصحف**: مصحف المدينة الممسوح ضوئيًا، رفعه
  [sufone/medina-mushaf](https://github.com/sufone/medina-mushaf) لتسهيل
  الاستخدام البرمجي، وأصله من مجمع الملك فهد.
* **التلاوات**: تسجيلات القرّاء، تستضيفها everyayah.com.

المشروع الأصلي واضح في هذا:

> Quran for Android costs money to run - all the data (pages, audio files, and
> translations) are hosted on servers that people volunteer their money to pay
> for every month. […] people planning on taking this project and profiting from
> it (by way of ads, in app purchases, etc) are in fact stealing from the work of
> the contributors of this project.

**استخدم هذا التطبيق لأغراض غير تجارية فقط**، ولا تُحوّل حركة مرور ضخمة إلى
هذه الخوادم.

---

## ٥. تغيير المصادر أو الاستضافة الذاتية

كل الثوابت في مكان واحد:

| الثابت | الملف | الوظيفة |
|--------|-------|---------|
| `EDITION_BASE` | `src/data/api.js` | مصدر نص القرآن |
| `TEXT_EDITIONS` | `src/data/api.js` | ترتيب الإصدارات البديلة |
| `EDITIONS_BASE` / `EDITIONS_CATALOG_URL` | `src/data/translations.js` | مصدر الترجمات |
| `PAGE_MIRRORS` | `src/features/mushaf-reader.js` | مرايا صور المصحف |
| `EVERYAYAH_BASE` | `src/data/audio.js` | مصدر التلاوات |

**لتغيير مصدر الصور دون تعديل الشيفرة**: الإعدادات → «مصدر صور المصحف»، واكتب
مسارًا ينتهي بدون `/` ليصبح `{المسار}/{رقم الصفحة}.png`.

**للاستضافة الذاتية الكاملة:**

```bash
# مثال: تنزيل النص العثماني كاملًا وملفات الترجمات التي تحتاجها
mkdir -p data/text
curl -L -o data/text/ara-quranuthmanihaf.min.json \
  https://cdn.jsdelivr.net/gh/fawazahmed0/quran-api@1/editions/ara-quranuthmanihaf.min.json
```

ثم وجّه `EDITION_BASE` إلى مجلدك (مثل `./data/text/editions`) واستضف الصور
والتلاوات عندك. هذا هو الخيار الصحيح إن كبر المشروع، لأن jsDelivr خدمة مجانية
مخصصة للمشاريع مفتوحة المصدر ولا يجب استنزافها.

---

## ٦. تحديث بيانات السور الوصفية

`src/data/surahs.js` لقطة جاهزة ولا تحتاج تحديثًا للعمل. إن أردت إعادة توليدها
فأي مصدر يوفّر: رقم السورة، الاسم بالعربية، عدد الآيات، مكية/مدنية، وأول وآخر
صفحة في المصحف المدني — يكفي لبناء الملف بنفس الترتيب الموجود.
