# Migration: Quran for Android → Quran Web

This document records what was **kept**, what was **dropped**, and **why**, when
turning the Android project's material into a browser application.

## 1. What the source material actually was

The material that seeded this project was the **root configuration layer** of
[`quran/quran_android`](https://github.com/quran/quran_android):

| File | Kind |
|------|------|
| `build.gradle.kts`, `settings.gradle.kts`, `gradle.properties` | Gradle / AGP build config |
| `gradlew`, `gradlew.bat` | Gradle wrapper scripts |
| `lint.xml` | Android Lint config |
| `quran_android-code_style.xml` | Android Studio / IntelliJ code style |
| `.editorconfig` | Editor conventions (host agnostic) |
| `.gitignore` | VCS ignore list |
| `README.md` | Project overview, data credits, license notes |
| `TESTING_STRATEGY.md` | Testing philosophy, patterns, phases 1–6 |
| `CONTRIBUTORS.md`, `LICENSE` | Attribution and GPL-3.0 text |

No application source code and no Quran data (text, page images, translations,
audio) were part of it — those live in the Android repository tree and on the
upstream CDNs. **A web app must therefore obtain its data at runtime**: see
`DATA_SOURCES.md`.

## 2. Dropped ❌

| Dropped | Reason |
|---------|--------|
| `build.gradle.kts` | Kotlin DSL Gradle build with Android application/library plugins — meaningless in a browser. |
| `settings.gradle.kts` | Declares 40+ Gradle modules (`:common:*`, `:feature:*`, `:pages:*`) for JVM/Android compilation. |
| `gradle.properties` | AGP flags (`android.useAndroidX`, KSP, R8 resource shrinking, JVM heap for the Gradle daemon). |
| `gradlew`, `gradlew.bat` | Gradle wrapper bootstrap; the wrapper JAR was not even present. |
| `lint.xml` | Android Lint issue ids (`InvalidPackage`, `UnusedResources`, `TypographyDashes`). |
| `quran_android-code_style.xml` | IntelliJ/Android Studio code style scheme (XML serialized IDE settings). |
| Android-only parts of `TESTING_STRATEGY.md` | Robolectric, Espresso, MockWebServer, Kover, SQLDelight JDBC, Turbine, RxJava rules — none of these exist in the browser. |
| `.gitignore` (original) | Ignored `.gradle`, `app/src/beta`, `google-services.json`, `crashlytics.properties`, etc. Replaced with a web ignore list. |

Nothing was deleted from the original attachment copies; this migration simply
**does not carry them forward**.

## 3. Kept ✅ and adapted

| Kept | Adaptation |
|------|-----------|
| `.editorconfig` | Unchanged in substance (LF, UTF-8, 2-space) — already valid for JS/CSS/HTML. One rule added for generated JSON dumps. |
| `LICENSE` (GPL-3.0) | Kept verbatim. The web app is a derivative work of GPL-3.0 code/design, so it stays GPL-3.0. |
| `CONTRIBUTORS.md` | Kept verbatim as attribution for the original project. |
| `README.md` | Rewritten for the web app, preserving the upstream credits and the non-commercial data notice. |
| `TESTING_STRATEGY.md` → `docs/TESTING.md` | Philosophy preserved (test behavior not implementation, **fakes over mocks**, fast + deterministic, real infrastructure where possible, AAA structure, behavior-named tests). Tooling re-targeted to a zero-dependency Node test runner so it actually runs in this environment. |
| Architectural vocabulary from `settings.gradle.kts` | The module names guided the web module layout: `common:data` → `src/data/`, `common:bookmark` → `src/core/store.js`, `common:search` → `src/features/search-page.js`, `feature:audio` + `feature:audiobar` → `src/data/audio.js` + `src/features/audio-bar.js`, `feature:linebyline` → the ayah-by-ayah reader, `pages:madani` → the mushaf image reader. |

## 4. Feature mapping

| Quran for Android | Quran Web |
|-------------------|-----------|
| Madani page images (`pages:madani`, 604 pages) | `#/page/:n` — `medina-mushaf` scans via jsDelivr (verified `image/png`), swipe/keyboard navigation, text fallback |
| Page selection + bookmarks | `#/page/:n` + `#/bookmarks` (page bookmarks) |
| Ayah-by-ayah (`feature:linebyline`) | `#/sura/:n` — Uthmani text, verse numbers, per-ayah actions |
| Translations (`common:translation`) | translation panel in the ayah reader |
| Bookmarks + tags (`common:bookmark`) | `#/bookmarks` — ayah & page bookmarks with tags in `localStorage` |
| Recent pages | "متابعة القراءة" on the home page |
| Search (`common:search`) | `#/search` — normalized Arabic search over the downloadable text |
| Audio (`feature:audio`, `feature:audiobar`) | persistent audio bar, per-ayah and full-surah playback |
| Settings (`common:preference`) | `#/settings` — theme, font size, reciter, translation |
| `QuranInfo` (page/juz/sura math) | `src/data/surahs.js` + tested helpers in `src/core/quran-info.js` |

## 5. Deliberate non-goals

* No Android/Kotlin artifacts, no Gradle, no build step, no npm dependencies.
* **No dependency on any authenticated or third-party API.** The Android app
  talked to `api.quran.com`; that endpoint is deprecated and its official
  replacement requires OAuth2 credentials on a backend, which a static site
  cannot hold. Every source used here is a static, CORS-enabled CDN file —
  see `DATA_SOURCES.md` for the verified list and the reasoning.
* No bundled Quran text in the repository by default (licensing + size);
  the app downloads and caches it in the browser.
