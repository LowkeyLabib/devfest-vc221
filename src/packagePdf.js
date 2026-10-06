import { PDFDocument, rgb, degrees } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { requirementStatus, isBlocking, canAssign, localDate } from './model.js'

const MARGIN = 40
const FOOTER = 36
const ink = rgb(0.12, 0.18, 0.25)

async function loadFonts() {
  const paths = ['NotoSans-Regular.ttf', 'NotoSansBengali-Regular.ttf']
  return Promise.all(paths.map(async name => {
    const response = await fetch(`${import.meta.env.BASE_URL}fonts/${name}`)
    if (!response.ok) throw new Error('fontError')
    return response.arrayBuffer()
  }))
}

// Optional font bytes let the same browser generation code be tested without a server.
export async function buildPackage(dataset, files, matches, { madeOn = localDate(), fontBytes } = {}) {
  const included = dataset.requirements.filter(r => matches[r.id]?.fileId).sort((a, b) => a.order - b.order)
  for (const r of dataset.requirements) {
    const match = matches[r.id]
    const file = files.find(f => f.id === match?.fileId)
    if (isBlocking(requirementStatus(r, file, match?.expiry, dataset.tender.submission_deadline))) throw new Error('generationError')
    if (match?.fileId && !canAssign(r.id, match.fileId, matches, files)) throw new Error('duplicateMatch')
    if (match?.fileId && !file) throw new Error('generationError')
  }
  const output = await PDFDocument.create()
  output.registerFontkit(fontkit)
  const fonts = await Promise.all((fontBytes || await loadFonts()).map(bytes => output.embedFont(bytes, { subset: true })))
  const charsets = fonts.map(font => new Set(font.getCharacterSet()))
  const fontFor = char => {
    const index = charsets.findIndex(set => set.has(char.codePointAt(0)))
    if (index === -1) throw new Error('unsupportedText')
    return fonts[index]
  }
  const textWidth = (text, size) => [...text].reduce((sum, char) => sum + fontFor(char).widthOfTextAtSize(char, size), 0)
  const draw = (page, text, x, y, size, color = ink) => {
    let run = '', current
    const flush = () => {
      if (!run) return
      page.drawText(run, { x, y, size, font: current, color })
      x += current.widthOfTextAtSize(run, size); run = ''
    }
    for (const char of text) {
      const font = fontFor(char)
      if (current && font !== current) flush()
      current = font; run += char
    }
    flush()
  }
  const clean = value => String(value).replace(/\s+/g, ' ').trim()
  const wrap = (text, size, width) => {
    const lines = []; let line = ''
    for (const word of clean(text).split(' ')) {
      const candidate = line ? `${line} ${word}` : word
      if (textWidth(candidate, size) <= width) { line = candidate; continue }
      if (line) lines.push(line)
      line = ''
      // Split very long IDs/words without losing text.
      for (const char of word) {
        if (line && textWidth(line + char, size) > width) { lines.push(line); line = '' }
        line += char
      }
    }
    if (line) lines.push(line)
    return lines
  }

  const t = dataset.tender
  // Reserve enough width for a readable exact footer even for long tender IDs.
  const totalPages = 1 + included.reduce((sum, r) => sum + files.find(f => f.id === matches[r.id].fileId).pages, 0)
  const footerWidth = textWidth(`${t.tender_id} | Page ${totalPages} of ${totalPages}`, 9) + 48
  const coverWidth = Math.max(595.28, footerWidth)
  const lines = []
  const add = (text, size = 11, gap = 8) => {
    const wrapped = wrap(text, size, coverWidth - MARGIN * 2)
    wrapped.forEach((line, i) => lines.push({ text: line, size, after: i === wrapped.length - 1 ? gap : 3 }))
  }
  add('TENDER DOCUMENT PACKAGE', 21, 20)
  add(`Tender ID: ${t.tender_id}`, 12)
  add(`Tender title: ${t.title}`, 12)
  add(`Procuring entity: ${t.procuring_entity}`)
  add(`Bidder: ${t.bidder}`)
  add(`Submission deadline: ${t.submission_deadline}`)
  add(`Package made on: ${madeOn}`, 11, 22)
  add('Included documents (in requirement order)', 14, 12)
  for (const r of included) add(`${r.order}. ${r.title_en}`, 11, 6)
  if (!included.length) add('No documents included (all requirements are optional).')
  // Keep the complete ordered list on page 1 even for unusually long datasets.
  const coverHeight = Math.max(841.89, lines.reduce((sum, line) => sum + line.size * 1.5 + line.after, 0) + MARGIN * 2 + FOOTER)
  const cover = output.addPage([coverWidth, coverHeight])
  let y = coverHeight - MARGIN
  for (const line of lines) { y -= line.size * 1.5; draw(cover, line.text, MARGIN, y, line.size); y -= line.after }

  for (const r of included) {
    const file = files.find(f => f.id === matches[r.id].fileId)
    const source = await PDFDocument.load(file.bytes)
    // Preserve visible filled form values before embedding page content.
    const form = source.getForm()
    if (form.getFields().length) form.flatten()
    for (const original of source.getPages()) {
      const box = original.getCropBox()
      const rotation = ((original.getRotation().angle % 360) + 360) % 360
      const sideways = rotation === 90 || rotation === 270
      const width = sideways ? box.height : box.width
      const height = sideways ? box.width : box.height
      const embedded = await output.embedPage(original, { left: box.x, bottom: box.y, right: box.x + box.width, top: box.y + box.height })
      const pageWidth = Math.max(width, footerWidth)
      const page = output.addPage([pageWidth, height + FOOTER])
      const offset = (pageWidth - width) / 2
      const positions = {
        0: [offset, FOOTER],
        90: [offset, FOOTER + height],
        180: [offset + width, FOOTER + height],
        270: [offset + width, FOOTER],
      }
      const [x, pageY] = positions[rotation] || positions[0]
      page.drawPage(embedded, { x, y: pageY, rotate: degrees(-rotation), width: box.width, height: box.height })
    }
  }
  const pages = output.getPages()
  pages.forEach((page, index) => {
    const label = `${t.tender_id} | Page ${index + 1} of ${pages.length}`
    page.drawLine({ start: { x: 16, y: 31 }, end: { x: page.getWidth() - 16, y: 31 }, thickness: 0.5, color: rgb(0.78, 0.82, 0.85) })
    draw(page, label, (page.getWidth() - textWidth(label, 9)) / 2, 13, 9)
  })
  output.setTitle(`${t.tender_id} Tender Document Package`)
  output.setAuthor(t.bidder)
  return output.save()
}

export function downloadPackage(bytes, tenderId) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url; link.download = `${tenderId}_Package.pdf`
  document.body.append(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
