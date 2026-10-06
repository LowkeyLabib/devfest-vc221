import { PDFDocument, PDFName, PDFNumber, rgb, degrees } from 'pdf-lib'
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
  const draw = (page, text, x, y, size, color = ink, rotation = 0) => {
    const angle = rotation * Math.PI / 180
    let run = '', current
    const flush = () => {
      if (!run) return
      page.drawText(run, { x, y, size, font: current, color, rotate: degrees(rotation) })
      const advance = current.widthOfTextAtSize(run, size)
      x += Math.cos(angle) * advance; y += Math.sin(angle) * advance; run = ''
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
    const copiedPages = await output.copyPages(source, source.getPageIndices())
    for (const page of copiedPages) {
      output.addPage(page)
      addFooterMargin(page, footerWidth)
    }
  }
  const pages = output.getPages()
  pages.forEach((page, index) => {
    const label = `${t.tender_id} | Page ${index + 1} of ${pages.length}`
    const { width, unit, rotation, point } = pageGeometry(page)
    page.drawLine({ start: point(16, 31), end: point(width - 16, 31), thickness: 0.5 / unit, color: rgb(0.78, 0.82, 0.85) })
    const origin = point((width - textWidth(label, 9)) / 2, 13)
    draw(page, label, origin.x, origin.y, 9 / unit, ink, rotation)
  })
  output.setTitle(`${t.tender_id} Tender Document Package`)
  output.setAuthor(t.bidder)
  return output.save()
}

// Work in displayed physical points, while retaining the source page coordinates,
// rotation, annotations and UserUnit. The point mapper undoes the viewer rotation.
function pageGeometry(page) {
  const box = page.getCropBox()
  const rotation = ((page.getRotation().angle % 360) + 360) % 360
  const unit = page.node.lookupMaybe(PDFName.of('UserUnit'), PDFNumber)?.asNumber() || 1
  const sideways = rotation === 90 || rotation === 270
  const width = (sideways ? box.height : box.width) * unit
  const point = (displayX, displayY) => {
    const x = displayX / unit, y = displayY / unit
    switch (rotation) {
      case 90: return { x: box.x + box.width - y, y: box.y + x }
      case 180: return { x: box.x + box.width - x, y: box.y + box.height - y }
      case 270: return { x: box.x + y, y: box.y + box.height - x }
      default: return { x: box.x + x, y: box.y + y }
    }
  }
  return { width, unit, rotation, point }
}

function addFooterMargin(page, minimumWidth) {
  const media = page.getMediaBox(), crop = page.getCropBox()
  // Only the intersection of crop/media boxes was originally visible.
  const x = Math.max(crop.x, media.x), y = Math.max(crop.y, media.y)
  const right = Math.min(crop.x + crop.width, media.x + media.width)
  const top = Math.min(crop.y + crop.height, media.y + media.height)
  if (right <= x || top <= y) throw new Error('badPdf')
  page.setCropBox(x, y, right - x, top - y)
  const { width, unit, rotation } = pageGeometry(page)
  const margin = FOOTER / unit
  const extra = Math.max(0, minimumWidth - width) / (2 * unit)
  const box = { x, y, width: right - x, height: top - y }
  // Keep cropped-out original content hidden when extending the visible page.
  page.node.normalize()
  const context = page.doc.context
  const clip = context.register(context.flateStream(`q\n${x} ${y} ${box.width} ${box.height} re W n\n`))
  const restore = context.register(context.flateStream('Q\n'))
  page.node.wrapContentStreams(clip, restore)
  switch (rotation) {
    case 90: box.width += margin; box.y -= extra; box.height += extra * 2; break
    case 180: box.height += margin; box.x -= extra; box.width += extra * 2; break
    case 270: box.x -= margin; box.width += margin; box.y -= extra; box.height += extra * 2; break
    default: box.y -= margin; box.height += margin; box.x -= extra; box.width += extra * 2
  }
  const mediaX = Math.min(media.x, box.x), mediaY = Math.min(media.y, box.y)
  page.setMediaBox(mediaX, mediaY, Math.max(media.x + media.width, box.x + box.width) - mediaX, Math.max(media.y + media.height, box.y + box.height) - mediaY)
  page.setCropBox(box.x, box.y, box.width, box.height)
}

export function downloadPackage(bytes, tenderId) {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }))
  const link = document.createElement('a')
  link.href = url; link.download = `${tenderId}_Package.pdf`
  document.body.append(link); link.click(); link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
