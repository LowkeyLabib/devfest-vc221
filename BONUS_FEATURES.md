# Bonus batch

All existing mandatory status, expiry, hashing, duplicate-assignment and source
page-copying rules are retained. `src/model.js` is unchanged. No server, cloud
storage, processing API, secret, signature placement or AI help was added.

## Controls

- **Auto-match** sits above the checklist. It normalizes case, punctuation,
  spaces, underscores, hyphens, `.pdf`, leading ordering numbers, title/ID
  combinations and explicit version/copy suffixes. Both English and Bangla
  requirement titles are supported. Only unambiguous matches are applied.
  Different-content versions, shared titles and conflicting duplicate hashes
  remain unmatched. Existing matches and dates are never overwritten; new
  expiry-bearing matches still require manual dates. All matches remain editable.
- **Export Checklist CSV** exports every requirement in numerical order with
  `Document, File Name, Pages, Expiry Date, Status`. Titles/statuses follow the
  selected language; column names remain the requested English names. Values are
  quoted, internal quotes doubled, rows CRLF-delimited and UTF-8 BOM-prefixed for
  office spreadsheet software. Formula-like user text is prefixed with an
  apostrophe to prevent spreadsheet execution.
- **Export Project / Import Project** sit with the tender controls. The local ZIP
  includes the tender JSON, original PDF binary data, matches, expiry dates,
  language and index setting. No PDFs need to be reselected. Storage is entirely
  user-managed; a reload without an export still clears the workspace.
  Import re-reads every PDF, counts its pages and hashes actual bytes. It checks
  archive limits, schema, IDs, dates and duplicate assignments before changing
  any UI state. A bad project leaves the entire current workspace intact.
- **Include document index after the cover** is enabled by default. Unticking it
  produces the original mandatory cover + documents layout. The index is one
  page, immediately after the cover, listing only included documents in numerical
  requirement order. Multi-page lengths determine exact 1-based starting page
  numbers. Very long lists use a taller index page to keep the single-page offset
  reliable. The existing exact footer applies to the index and every other page.
- **Bangla index titles** follow the language switch. The cover remains English.
  Browser FontFace/Canvas uses the existing local Noto Sans Bengali bytes for
  correct conjuncts and combining marks, with 3× rasterization for clarity.
  Transparent PNG title images are embedded with pdf-lib. Grapheme-aware wrapping
  avoids splitting Bangla clusters. If optional rendering fails, an English index
  is generated instead and the user receives a localized message.
- **Unreadable/protected PDFs** have distinct friendly localized messages.
  Protected PDFs are rejected without requesting passwords; users may provide
  an unlocked local copy. Failed files do not interrupt the other uploads.

## Files changed

Added:

- `src/bonuses.js`: conservative auto-match, CSV serialization and index offsets.
- `src/project.js`: bounded, self-contained project ZIP export/import.
- `src/downloads.js`: browser downloads for CSV/project artifacts.
- `src/banglaIndex.js`: native local-font Bangla layout for index images.
- `tests/bonuses.test.js`, `tests/project.test.js`: focused feature tests.
- `BONUS_FEATURES.md`: this report.

Modified:

- `src/App.jsx`: additive controls, project restoration and index preference.
- `src/i18n.js`: English/Bangla controls and error/feedback messages.
- `src/pdfReader.js`: clearer corrupt/protected/local-read errors and cleanup.
- `src/packagePdf.js`: optional index, Bangla title support and updated totals.
  Source-copying and footer-margin functions are unchanged.
- `src/styles.css`: small toolbar and checkbox styles within the existing design.
- `tests/packagePdf.test.js`: actual index page/order/numbering and fallback tests.
- `package.json`, `package-lock.json`: `fflate` for local ZIP handling. No other
  direct dependency was added.
- `README.md`, `DEVELOPMENT.md`: updated feature and workflow documentation.

Existing sample output, screenshots, core status/duplicate model, license and
competition compliance report were not changed by this batch.

## Validation

- `npm test`: **25 tests passed**, none failed, skipped or disabled. All existing
  mandatory tests remain intact, including exact statuses, inclusive same-day
  expiry, actual-byte hashes, duplicate constraints, rotated/cropped pages,
  UserUnit, blank pages, annotations and filled forms.
- Focused tests cover conservative matching and ambiguity, CSV quoting/escaping,
  project binary roundtrip, incomplete work, invalid/tampered projects, forged
  matches, duplicate content, archive bounds and actual PDF index offsets.
- `npm run build`: passed; the existing PDF-library bundle-size warning remains.
- Production Chromium: corrupt and protected PDFs first in a mixed batch, then
  valid PDFs; every valid file still loads. English/Bangla controls, CSVs,
  auto-match, manual corrections, ZIP export, reload/import restoration and
  invalid-project rollback all pass. Mobile layout fits without horizontal
  overflow. No page errors and no external requests or document uploads.
- Sample package: **17 pages with the index**, **16 without**. Index starts are
  exactly **3, 4, 5, 6, 7, 9, 15, 17**. Every page has its correct exact footer.
- English, Bangla, restored-project and no-index generated packages preserve all
  **15 original source pages pixel-for-pixel at 144 DPI**, in the same order.
- Bangla index rendering was visually inspected; all eight titles are legible and
  the page numbers and footer remain correct. Rendering failure is separately
  tested to fall back safely to English.

## Limitations and regression risks

No mandatory regression was found in the checks performed. Bonuses deliberately
avoid changing the underlying status and duplicate engine.

- Auto-match is conservative: abbreviations, vague scan filenames and competing
  document versions still need manual matching.
- Project ZIPs contain the original PDFs and can be roughly 50 MB plus JSON and
  ZIP overhead. Export/import temporarily needs additional browser memory; files
  and uncompressed archive entries are bounded before restoration.
- Bangla index title images are readable but not searchable/copyable text.
  Cover fields and English index text remain native PDF text. Rendering falls
  back to English if native font/canvas support is unavailable.
- No seal/signature or AI-help features were implemented, as requested.

No commits, pushes or deployments were made during this batch.
