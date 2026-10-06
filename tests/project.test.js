import test from 'node:test'
import assert from 'node:assert/strict'
import { PDFDocument } from 'pdf-lib'
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import { exportProject, importProject } from '../src/project.js'
import { hashBytes, requirementStatus } from '../src/model.js'

const dataset = { tender: { tender_id: 'PROJECT-1', title: 'Tender', bidder: 'Bidder', procuring_entity: 'Office', submission_deadline: '2026-10-20' }, requirements: [
  { id: 'r1', order: 1, title_en: 'License', title_bn: 'লাইসেন্স', mandatory: true, has_expiry: true },
  { id: 'r2', order: 2, title_en: 'Optional', title_bn: 'ঐচ্ছিক', mandatory: false, has_expiry: false },
] }
async function reader(input) {
  const bytes = await input.arrayBuffer(), doc = await PDFDocument.load(bytes)
  return { id: 'new-id', name: input.name, size: input.size, bytes, hash: await hashBytes(bytes), pages: doc.getPageCount() }
}
async function fixture() {
  const pdf = await PDFDocument.create(); pdf.addPage([240, 320])
  const bytes = (await pdf.save()).buffer
  return { dataset, files: [{ id: 'f', name: 'license.pdf', bytes, size: bytes.byteLength, hash: await hashBytes(bytes), pages: 1 }], matches: { r1: { fileId: 'f', expiry: '2026-10-19' } }, language: 'bn', includeIndex: true }
}
function tamper(bytes, mutate) {
  const archive = unzipSync(bytes)
  const manifest = JSON.parse(strFromU8(archive['project.json']))
  mutate(manifest, archive)
  archive['project.json'] = strToU8(JSON.stringify(manifest))
  return zipSync(archive, { level: 0 })
}

test('self-contained project roundtrip keeps actual PDFs, tender, matches, expiry and preferences', async () => {
  const work = await fixture()
  const restored = await importProject(exportProject(work), reader)
  assert.deepEqual(restored.dataset, work.dataset)
  assert.deepEqual(restored.matches, work.matches)
  assert.equal(restored.language, 'bn')
  assert.equal(restored.includeIndex, true)
  assert.equal(restored.files[0].hash, work.files[0].hash)
  assert.deepEqual(new Uint8Array(restored.files[0].bytes), new Uint8Array(work.files[0].bytes))
  assert.equal(restored.files[0].pages, 1)
  assert.equal(requirementStatus(dataset.requirements[0], restored.files[0], restored.matches.r1.expiry, dataset.tender.submission_deadline), 'expired')
})

test('incomplete project with no PDFs also roundtrips and remains incomplete', async () => {
  const work = { dataset, files: [], matches: {}, language: 'en', includeIndex: false }
  const restored = await importProject(exportProject(work), reader)
  assert.equal(restored.files.length, 0)
  assert.deepEqual(restored.matches, {})
  assert.equal(restored.includeIndex, false)
})

test('import rejects malformed ZIPs, versions, unknown files and broken PDF bytes', async () => {
  const bytes = exportProject(await fixture())
  await assert.rejects(() => importProject(new Uint8Array([1, 2, 3]), reader), /projectInvalid/)
  await assert.rejects(() => importProject(tamper(bytes, manifest => { manifest.version = 99 }), reader), /projectInvalid/)
  await assert.rejects(() => importProject(tamper(bytes, (manifest, archive) => { delete archive[manifest.files[0].path] }), reader), /projectInvalid/)
  await assert.rejects(() => importProject(tamper(bytes, (manifest, archive) => { archive[manifest.files[0].path] = strToU8('bad PDF') }), reader), /projectPdfError/)
  await assert.rejects(() => importProject(tamper(bytes, (manifest, archive) => { archive['other.txt'] = strToU8('extra') }), reader), /projectInvalid/)
})

test('import refuses forged matches, duplicate-content assignments and invalid dates', async () => {
  const work = await fixture(), bytes = exportProject(work)
  await assert.rejects(() => importProject(tamper(bytes, manifest => { manifest.matches.r1.fileId = 'unknown' }), reader), /projectInvalid/)
  await assert.rejects(() => importProject(tamper(bytes, manifest => { manifest.matches.r1.expiry = '2026-02-30' }), reader), /projectInvalid/)
  await assert.rejects(() => importProject(tamper(bytes, manifest => { manifest.matches.r2 = { fileId: 'f', expiry: '' } }), reader), /projectInvalid/)
  const copied = { ...work, files: [...work.files, { ...work.files[0], id: 'copy', name: 'copy.pdf' }], matches: { ...work.matches, r2: { fileId: 'copy', expiry: '' } } }
  await assert.rejects(() => importProject(exportProject(copied), reader), /projectInvalid/)
})

test('import bounds archive entry count and declared uncompressed sizes before reading PDFs', async () => {
  const bytes = exportProject(await fixture())
  const archive = unzipSync(bytes)
  for (let i = 1; i <= 30; i++) archive[`pdfs/${String(i).padStart(3, '0')}.pdf`] = new Uint8Array()
  await assert.rejects(() => importProject(zipSync(archive, { level: 0 }), reader), /projectTooLarge/)
  // Alter the PDF's declared uncompressed central-directory size; the importer
  // must reject it before a decompressor or PDF reader can allocate that amount.
  const oversized = bytes.slice()
  const view = new DataView(oversized.buffer, oversized.byteOffset, oversized.byteLength)
  for (let i = 0; i < oversized.length - 46; i++) {
    if (view.getUint32(i, true) === 0x02014b50) {
      const nameLength = view.getUint16(i + 28, true)
      const name = new TextDecoder().decode(oversized.slice(i + 46, i + 46 + nameLength))
      if (name.startsWith('pdfs/')) { view.setUint32(i + 24, 50_000_001, true); break }
    }
  }
  await assert.rejects(() => importProject(oversized, reader), /projectTooLarge/)
})
