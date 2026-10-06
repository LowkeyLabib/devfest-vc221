# Problem statement recheck

Reviewed against the uploaded AI DevFest “Tender Document Package Builder”
problem statement. This report distinguishes application requirements from
competition submission and timing requirements. No bonus scope was added.

## Mandatory application checks

| Statement | Implementation and verification | Result |
| --- | --- | --- |
| 4.1 Load tender / numerical requirement order | Validated JSON picker; all five tender fields displayed; unseen dataset supplied in order 10, 2, 3, 1 displayed as 1, 2, 3, 10 | Pass |
| 4.2 Multiple PDFs / names / page counts / removal | Browser PDF.js worker counts pages; pdf-lib checks readability; PNG, damaged and encrypted inputs produce messages; removing a matched PDF clears its match | Pass |
| 4.3 One-to-one matching / change / undo | Assignment checks file SHA-256 identity; changes reset expiry; empty selection undoes match; exercised in production browser | Pass |
| 4.4 Expiry input | Shown only when a matched requirement has has_expiry=true; exercised for mandatory and optional requirements | Pass |
| 4.5 Exact statuses / immediate updates | All five statuses and blocking flags tested; same-day expiry and leap-day equality pass; optional matched expired/missing-date documents also block | Pass |
| 4.6 Identical-content duplicates | SHA-256 of original ArrayBuffer; different filenames marked; duplicate assignments disabled and rechecked by handler and generator | Pass |
| 4.7 Generation gating / reasons | Button disabled for any blocker; named blocking requirement list; optional unmatched documents do not block | Pass |
| 4.8 Exact download filename | Sample and unseen browser downloads have exact tender_id_Package.pdf filenames | Pass |
| 4.9 Entire principal UI in two languages | English/Bangla labels, statuses, buttons, instructions, errors and requirement titles; dictionary parity test and mobile browser test | Pass |
| 6.1 Cover first / English / fields / date / included list | Cover contains five tender fields, local package date, English included requirement names in numerical order; long lists remain on the single cover | Pass |
| 6.2 Source order / all pages / optional omissions | Sample contains cover plus all 15 original included pages; each original source page is pixel-identical at 144 DPI; unseen blank page also retained | Pass |
| 6.3 Exact footer on every page | All 16 sample footers and all four unseen-package footers checked; exact Page X of Y string also tested automatically | Pass |
| 6.4 Readable footer without obscuring content | New 36-physical-point bottom margin; upright 9-point text; crop origins, 0/90/180/270 rotations and UserUnit scaling tested | Pass |
| 8 Browser-only / latest Chrome workflow | Production Chromium smoke tests; all observed requests are local static GETs; no document bytes sent over the network | Pass |
| 8 Upload limits | Maximum 30 files and strict 50,000,000 total bytes; exact and cumulative boundaries unit-tested; 31st file and 50,000,001-byte file rejected in browser | Pass |

## Defects found and repaired

- The original page embedding failed for valid pages without a Contents stream.
  It also omitted annotations. Direct page copying now retains blank pages,
  annotation-only pages, source content and annotations. Filled forms are
  flattened to keep their visible values.
- Source-page footers are positioned in displayed coordinates, preserving original
  rotation and physical UserUnit rather than changing the source orientation.
  Original page contents stay clipped to their original visible bounds.
- The previous cap was 50 MiB (52,428,800 bytes). It is now a strict 50 MB
  (50,000,000 bytes), and displayed MB/KB totals use decimal units consistently.

## Verification evidence

- `npm test`: 12 tests passed, none failed, skipped or disabled.
- `npm run build`: passed. Vite reports a bundle-size warning for the PDF libraries;
  this is not a compilation or runtime failure.
- Production browser tests: sample and unseen JSON datasets, numeric order, all
  status transitions, optional expiry, leap day, matches changed/undone, renamed
  duplicates, original blank page, PNG rejection, encrypted/damaged PDFs, file
  removal, invalid JSON preserving current state, both languages and mobile fit.
- Actual source/output image comparison: every included sample page is
  pixel-identical to its original above the added footer margin at 144 DPI.
- Exact sequential footers checked on every page of sample and unseen packages.
- Original README and LICENSE remain unchanged.

## Sample resolution and local submission artifacts

`output/T-2026-0417_Package.pdf` was downloaded from the production browser app.
It contains 16 pages. The entered dates are those actually printed in the PDFs:
trade license 2027-06-30; bank solvency 2026-12-31. The expired 2025 trade license
is not included. One experience certificate is included; its identical copy is
not merged twice. Optional financial statement and manufacturer's authorization
are absent and omitted. `scan_0042.pdf` is the signed declaration. The PNG is rejected.

Screenshots show the document statuses:

- `screenshots/statuses-en.png`
- `screenshots/statuses-bn-mobile.png`

These files and the repairs are local changes, not yet committed or pushed.

## Outstanding competition submission work

The application requirements above pass the checks performed. The overall
competition submission is not yet complete:

- Commit/push the reviewed repairs, report and required artifacts. The existing
  history has the initial repository commit and one competition implementation
  commit; it does not yet establish the required three competition commits or
  compliance with the every-30-minute schedule.
- Deploy the updated `dist/` to a public HTTPS static host and verify access
  without login. No deployment was made or verified during this recheck.
- Submit the public repository URL and deployed HTTPS URL through the competition
  portal, before the actual contest deadline. Timing eligibility cannot be
  established from repository functionality alone.
- The separate Official Rulebook referenced in the statement was not supplied;
  its additional submission requirements cannot be verified here.

No commits, pushes, deployment or portal submissions were performed during this
recheck. The attached contest reminders were treated as requirements to report,
not authorization to perform those external actions automatically.
