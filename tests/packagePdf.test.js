import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PDFDocument, StandardFonts, degrees } from 'pdf-lib'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { buildPackage } from '../src/packagePdf.js'

const fontBytes = await Promise.all(['NotoSans-Regular.ttf', 'NotoSansBengali-Regular.ttf'].map(name => readFile(new URL(`../public/fonts/${name}`, import.meta.url))))
const tender = { tender_id: 'TEST-UNSEEN-55', title: 'Test procurement', procuring_entity: 'Test entity', bidder: 'Test bidder', submission_deadline: '2026-10-20' }
const requirement = (id, order, mandatory = true) => ({ id, order, title_en: `Document ${id}`, title_bn: `নথি ${id}`, mandatory, has_expiry: false })
async function source(markers, rotation = 0) {
  const document = await PDFDocument.create()
  const font = await document.embedFont(StandardFonts.Helvetica)
  for (const marker of markers) {
    const page = document.addPage([240, 320])
    page.drawText(marker, { x: 15, y: 10, size: 12, font }) // deliberately at original bottom
    page.drawText(`TOP-${marker}`, { x: 15, y: 295, size: 12, font })
    page.setRotation(degrees(rotation))
  }
  return document.save()
}
async function textPages(bytes) {
  const task = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true })
  try {
    const pdf = await task.promise; const result = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i)
      result.push((await page.getTextContent()).items)
    }
    return result
  } finally { await task.destroy() }
}

test('cover first, numerical document order, all original pages, optional omitted, exact footer on EVERY page', async () => {
  const files = [
    { id: 'a', hash: 'a', pages: 2, bytes: await source(['A-FIRST', 'A-SECOND']) },
    { id: 'b', hash: 'b', pages: 1, bytes: await source(['B-FIRST']) },
  ]
  const dataset = { tender, requirements: [requirement('B', 10), requirement('omitted', 3, false), requirement('A', 2)] }
  const bytes = await buildPackage(dataset, files, { A: { fileId: 'a' }, B: { fileId: 'b' } }, { fontBytes, madeOn: '2026-10-06' })
  const pages = await textPages(bytes)
  assert.equal(pages.length, 4)
  const cover = pages[0].map(item => item.str).join(' ')
  for (const text of Object.values(tender)) assert.ok(cover.includes(text), text)
  assert.ok(cover.includes('2026-10-06'))
  assert.ok(cover.indexOf('Document A') < cover.indexOf('Document B'))
  assert.ok(!cover.includes('Document omitted'))
  for (const [index, marker] of [[1, 'A-FIRST'], [2, 'A-SECOND'], [3, 'B-FIRST']]) {
    assert.ok(pages[index].some(item => item.str === marker))
    assert.ok(pages[index].some(item => item.str === `TOP-${marker}`))
    const bottomSource = pages[index].find(item => item.str === marker)
    const footer = pages[index].find(item => item.str === `${tender.tender_id} | Page ${index + 1} of 4`)
    assert.ok(bottomSource.transform[5] > footer.transform[5] + 20, 'source content stays above footer strip')
  }
  pages.forEach((items, index) => assert.ok(items.some(item => item.str === `${tender.tender_id} | Page ${index + 1} of 4`)))
})

test('rotated source pages preserve content and get upright independent footers', async () => {
  for (const rotation of [0, 90, 180, 270]) {
    const bytes = await buildPackage({ tender, requirements: [requirement('R', 1)] }, [{ id: 'f', hash: 'f', pages: 1, bytes: await source(['ROTATED'], rotation) }], { R: { fileId: 'f' } }, { fontBytes })
    const pdf = await PDFDocument.load(bytes)
    const page = pdf.getPage(1)
    assert.equal(page.getRotation().angle, 0)
    assert.equal(page.getHeight(), (rotation % 180 ? 240 : 320) + 36)
    const items = (await textPages(bytes))[1]
    assert.ok(items.some(item => item.str === 'ROTATED'))
    assert.ok(items.some(item => item.str === `${tender.tender_id} | Page 2 of 2`))
  }
})

test('generator rejects blocking states and duplicate content even if called directly', async () => {
  await assert.rejects(() => buildPackage({ tender, requirements: [requirement('A', 1)] }, [], {}, { fontBytes }), /generationError/)
  await assert.rejects(() => buildPackage({ tender, requirements: [requirement('A', 1), requirement('B', 2)] }, [{ id: 'a', hash: 'same' }, { id: 'b', hash: 'same' }], { A: { fileId: 'a' }, B: { fileId: 'b' } }, { fontBytes }), /duplicateMatch/)
})

test('long requirement lists remain complete on the single first cover page', async () => {
  const bytes = await source(['SOURCE'])
  const requirements = Array.from({ length: 55 }, (_, i) => requirement(`R${i}`, i + 1))
  const files = requirements.map((r, i) => ({ id: r.id, hash: String(i), pages: 1, bytes }))
  const matches = Object.fromEntries(files.map(file => [file.id, { fileId: file.id }]))
  const pages = await textPages(await buildPackage({ tender, requirements }, files, matches, { fontBytes }))
  assert.equal(pages.length, 56)
  assert.ok(pages[0].some(item => item.str.includes('Document R54')))
  assert.ok(pages[0].some(item => item.str === `${tender.tender_id} | Page 1 of 56`))
})
