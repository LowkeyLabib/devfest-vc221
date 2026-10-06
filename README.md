# Tender Document Package Builder

A frontend-only web application developed for the **AI DevFest 2026 Vibe-Coding Contest**.

## Participant

- **Name:** Labib Hasan
- **Registration Number:** 252-35-627 (University)
- **Username:** VC221

## Live Website

**Live URL:** 

## About the Project

Tender Document Package Builder helps office staff prepare complete and correctly ordered tender submission packages.

Users can load tender requirements, upload PDF documents, match files to requirements, check expiry dates, detect duplicate documents, and generate a final combined PDF package.

All document processing happens locally inside the browser.

## Main Features

- Load and validate `requirements.json`
- Display tender information and ordered document requirements
- Upload multiple PDF files
- Display PDF filenames and page counts
- Reject non-PDF files
- Remove uploaded files
- Match PDFs to tender requirements
- Enter and validate document expiry dates
- Detect duplicate PDFs based on actual file content
- Automatically show document status:
  - Missing
  - Expiry date needed
  - Expired
  - Not provided
  - OK
- Prevent package generation when blocking problems exist
- Generate a correctly ordered combined PDF
- Generate an English cover page
- Add `Tender ID | Page X of Y` footer to every generated page
- Download the final package as `<tender_id>_Package.pdf`
- English and Bangla interface
- Responsive interface for non-technical users
- Fully frontend-only document processing

## Technology

- React
- Vite
- JavaScript
- pdf-lib
- pdfjs-dist
- Web Crypto API (SHA-256)
- HTML/CSS

## Run Locally

Install the dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Then open the local URL shown in the terminal.

To create a production build:

```bash
npm run build
```

## How to Use

1. Load the provided `requirements.json`.
2. Upload the tender PDF documents.
3. Match each PDF to the appropriate requirement.
4. Enter expiry dates where required.
5. Review the automatically calculated document statuses.
6. Resolve any blocking problems.
7. Generate and download the final tender package.

## Output

The generated sample package is included at:

```text
output/T-2026-0417_Package.pdf
```

Screenshots demonstrating the application and document statuses are available in:

```text
screenshots/
```

## Bonus Features

None. Development prioritized correctness and completion of all mandatory requirements.

## Known Problems

No known problems at the time of submission.

## AI Tools Used

- **ChatGPT** — requirements analysis, architecture planning, testing strategy, debugging guidance, and submission review.
- **OpenAI Codex** — implementation, code editing, build verification, and development assistance.

## Most Useful AI Prompt

> Build the mandatory Tender Document Package Builder as a frontend-only React + Vite application. Implement requirements JSON loading, PDF uploads and page counting, one-to-one document matching, expiry validation, exact document status rules, SHA-256 duplicate detection, bilingual English/Bangla UI, and browser-side PDF generation using pdf-lib. The generated package must contain an English cover, documents in requirement order, and a Tender ID / Page X of Y footer on every page. Do not use a backend or hardcode the sample dataset.

## Privacy

Tender documents are processed locally in the user's browser. The application does not upload tender files to a participant-controlled backend, database, or online storage service.

## License

This project is licensed under the **MIT License**.
