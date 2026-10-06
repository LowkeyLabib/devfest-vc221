# Tender Document Package Builder

A React + Vite application written in JavaScript. All document bytes, hashes,
validation and PDF generation remain in browser memory. The application has no
backend, secrets, persistence, processing API, or external font requests.

## Run

Use Node 22.12+ (Node 24 was used for verification).

```sh
npm ci
npm run dev
npm test
npm run build
npm run preview
```

Run from this checkout. If your environment has an unwritable npm cache, use
`npm --cache /tmp/npm-cache ci`. Production output is `dist/`; serve it with
any static HTTPS host. The PDF.js worker and PDF fonts are bundled locally.

## Office workflow

1. Choose the tender's requirements.json. Replacing a tender clears matches and
   expiry dates while retaining uploaded PDFs. Invalid JSON leaves the current
   tender unchanged.
2. Add PDFs, individually or together (30 files, 50 MiB total). Remove unwanted
   copies. Non-PDF, damaged and encrypted PDFs receive a readable error.
3. Select a PDF for each requirement. Choosing the empty option undoes a match.
   Changing a file resets its expiry, so an old file's date cannot silently carry
   over. For expiry-bearing documents, enter the date printed on the document.
4. Resolve every blocking status, then generate and download the package.
   Expiry dates are user-entered; the app does not read dates from document text.
   A reload clears the workspace.

## JSON format

The root object contains `tender` and `requirements`. Tender requires nonempty
string fields `tender_id`, `title`, `procuring_entity`, `bidder`, and
`submission_deadline` (valid YYYY-MM-DD). Tender IDs must be safe filenames.
Requirements are a nonempty array of objects with unique nonempty string `id`,
nonempty `title_en` and `title_bn`, unique positive integer `order`, and boolean
`mandatory` and `has_expiry`. Additional properties are ignored. JSON is limited
to 5 MiB. No production sample data is embedded or automatically loaded.

## Architecture

- `src/App.jsx`: local React state, pickers, matching, expiry inputs, feedback,
  download workflow, responsive bilingual UI.
- `src/model.js`: pure schema validation, numeric ordering, date validation,
  exact status engine, SHA-256 hashing and assignment constraints.
- `src/i18n.js`: English/Bangla labels, instructions, statuses and errors.
- `src/pdfReader.js`: ArrayBuffer reading and actual-byte Web Crypto hashing;
  local PDF.js worker counts pages, pdf-lib verifies merger compatibility.
  A copied buffer goes to PDF.js to prevent detaching the retained original.
- `src/packagePdf.js`: English cover, ordered merging, local embedded fonts,
  separate footer margins, browser Blob download.
- `src/styles.css`: responsive styles, keyboard focus and locally hosted fonts.

For each requirement, status evaluation runs on every render:

| Condition | Status | Blocking |
| --- | --- | --- |
| No match, mandatory | Missing | Yes |
| No match, optional | Not provided | No |
| Match, expiry required, no valid date | Expiry date needed | Yes |
| Match, expiry before deadline | Expired | Yes |
| Match, expiry on/after deadline or not required | OK | No |

Validated ISO dates compare lexicographically, without timezone conversion.
A SHA-256 hash identifies identical content regardless of filenames. Both the
select options and assignment handler enforce uniqueness by hash; generation
checks it again. Duplicate copies remain visible and removable in the file tray.

## Package rules

The cover is always page 1 and English. It includes all five tender fields,
the browser's local package date, and the included requirement names in numeric
order. Long text wraps; exceptionally long lists use a taller single cover.
Unmatched optional requirements are skipped. Every source page is embedded,
in original order and at its original visible size, with rotation normalized.
Filled form appearances are flattened before embedding. Each source page gets
an additional 36-point bottom strip rather than drawing over its contents.
The cover also reserves this strip. The footer on every page is exactly
`<tender_id> | Page X of Y`; the filename is exactly `<tender_id>_Package.pdf`.
Local Noto fonts support English and Bangla metadata without remote requests;
unsupported glyphs produce an error rather than silently changing text.

## Verification

`npm test` exercises all status branches, same-day expiry, schema and ordering,
content hashes, duplicate assignment, generator safeguards, cover metadata,
all original page order, exact per-page footers, source-bottom separation,
all four page rotations, and long cover lists.

A headless Chromium smoke test was also run against the supplied pack: ten
readable PDFs, PNG rejection, duplicate marks, one-to-one assignment, expiry
transitions, a 16-page download with the exact filename and footers,
English/Bangla controls, mobile layout, removal, invalid JSON and damaged PDFs.
The supplied pack is used only as an external test fixture, not application data.
No bonus features, automatic commits, pushes, or deployment are implemented.
