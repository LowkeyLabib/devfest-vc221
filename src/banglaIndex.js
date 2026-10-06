// Native browser text layout handles Bangla conjuncts and combining-mark
// positioning. Small, transparent PNGs preserve that layout in the PDF index.
// Both fonts come from bytes already loaded locally by the PDF generator.
export async function banglaIndexImages(entries, fontBytes, width) {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined') throw new Error('banglaIndexUnavailable')
  const face = new FontFace('TenderIndexBangla', fontBytes)
  await face.load()
  document.fonts.add(face)
  try {
    const scale = 3, size = 12, lineHeight = 21, padding = 4
    const images = []
    const segmenter = new Intl.Segmenter('bn', { granularity: 'grapheme' })
    for (const { requirement } of entries) {
      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')
      context.font = `${size}px TenderIndexBangla, Noto, sans-serif`
      const text = `${requirement.order}. ${requirement.title_bn}`.replace(/\s+/g, ' ').trim()
      const lines = []; let line = ''
      for (const word of text.split(' ')) {
        const candidate = line ? `${line} ${word}` : word
        if (context.measureText(candidate).width <= width - padding * 2) { line = candidate; continue }
        if (line) lines.push(line)
        line = ''
        for (const { segment } of segmenter.segment(word)) {
          if (line && context.measureText(line + segment).width > width - padding * 2) { lines.push(line); line = '' }
          line += segment
        }
      }
      if (line) lines.push(line)
      const height = lines.length * lineHeight + padding * 2
      canvas.width = Math.ceil(width * scale); canvas.height = Math.ceil(height * scale)
      context.scale(scale, scale)
      context.font = `${size}px TenderIndexBangla, Noto, sans-serif`
      context.fillStyle = '#1f2e40'
      lines.forEach((text, i) => context.fillText(text, padding, padding + size * 1.25 + i * lineHeight))
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('banglaIndexUnavailable')
      images.push({ bytes: await blob.arrayBuffer(), width, height, baseline: padding + size * 1.25 })
    }
    return images
  } finally { document.fonts.delete(face) }
}
