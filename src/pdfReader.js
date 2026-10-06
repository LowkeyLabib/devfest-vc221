import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PDFDocument } from 'pdf-lib'
import { hashBytes } from './model'

GlobalWorkerOptions.workerSrc = workerUrl

export async function readPdf(file) {
  let bytes
  try { bytes = await file.arrayBuffer() } catch { throw new Error('unreadablePdf') }
  const signature = new TextDecoder('latin1').decode(new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 1024)))
  if (!signature.includes('%PDF-')) throw new Error('nonPdf')
  // pdf.js can transfer/detach its buffer. Retain the original for hashing and packaging.
  const hash = await hashBytes(bytes)
  const task = getDocument({ data: new Uint8Array(bytes.slice(0)), isEvalSupported: false })
  try {
    const document = await task.promise
    const pages = document.numPages
    if (pages < 1) throw new Error('noPages')
    // Check compatibility with the actual package writer, not only the reader.
    const mergeable = await PDFDocument.load(bytes)
    if (mergeable.getPageCount() !== pages) throw new Error('badPdf')
    return { id: crypto.randomUUID(), name: file.name, size: file.size, bytes, hash, pages }
  } catch (error) {
    if (error.name === 'PasswordException' || error.name === 'EncryptedPDFError' || /encrypted/i.test(error.message || '')) throw new Error('protectedPdf')
    throw new Error(['noPages', 'badPdf'].includes(error.message) ? error.message : 'badPdf')
  } finally {
    await task.destroy().catch(() => {})
  }
}
