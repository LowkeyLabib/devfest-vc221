import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate'
import { MAX_FILES, MAX_BYTES, validateRequirements, validDate, canAssign } from './model.js'

const MAX_MANIFEST_BYTES = 6_000_000
export const MAX_PROJECT_BYTES = MAX_BYTES + MAX_MANIFEST_BYTES + 100_000
const FORMAT = 'tender-desk-project'

export function exportProject({ dataset, files, matches, language, includeIndex }) {
  validateRequirements(dataset)
  if (files.length > MAX_FILES || files.reduce((sum, file) => sum + file.bytes.byteLength, 0) > MAX_BYTES) throw new Error('projectInvalid')
  const descriptors = files.map((file, i) => ({ id: file.id, name: file.name, path: `pdfs/${String(i).padStart(3, '0')}.pdf` }))
  const manifest = strToU8(JSON.stringify({ format: FORMAT, version: 1, dataset, files: descriptors, matches, language, includeIndex }))
  if (manifest.byteLength > MAX_MANIFEST_BYTES) throw new Error('projectTooLarge')
  const archive = Object.fromEntries(descriptors.map((file, i) => [file.path, new Uint8Array(files[i].bytes)]))
  // PDFs are usually already compressed; stored ZIP avoids costly recompression.
  archive['project.json'] = manifest
  return zipSync(archive, { level: 0 })
}

// Import is transactional: do not replace current UI state until every embedded
// PDF has been read and all relationships/limits have been checked.
export async function importProject(bytes, readPdf) {
  if (bytes.byteLength > MAX_PROJECT_BYTES) throw new Error('projectTooLarge')
  let archive, manifest
  try {
    let total = 0, count = 0, manifests = 0
    archive = unzipSync(new Uint8Array(bytes), { filter: entry => {
      if (entry.name === 'project.json') {
        if (++manifests !== 1) throw new Error('projectInvalid')
        if (entry.originalSize > MAX_MANIFEST_BYTES) throw new Error('projectTooLarge')
      } else {
        if (!/^pdfs\/\d{3}\.pdf$/.test(entry.name)) throw new Error('projectInvalid')
        total += entry.originalSize; count++
        if (total > MAX_BYTES || count > MAX_FILES) throw new Error('projectTooLarge')
      }
      return true
    } })
    if (!archive['project.json']) throw new Error('projectInvalid')
    manifest = JSON.parse(strFromU8(archive['project.json']))
  } catch (error) {
    throw new Error(error.message === 'projectTooLarge' ? 'projectTooLarge' : 'projectInvalid')
  }
  if (manifest?.format !== FORMAT || manifest.version !== 1 ||
    !Array.isArray(manifest.files) || manifest.files.length > MAX_FILES ||
    !['en', 'bn'].includes(manifest.language) || typeof manifest.includeIndex !== 'boolean' ||
    !manifest.matches || typeof manifest.matches !== 'object' || Array.isArray(manifest.matches)) throw new Error('projectInvalid')
  let dataset
  try { dataset = validateRequirements(manifest.dataset) } catch { throw new Error('projectInvalid') }
  const ids = new Set(), paths = new Set()
  for (const entry of manifest.files) {
    if (!entry || typeof entry.id !== 'string' || !entry.id || entry.id.length > 100 || ids.has(entry.id) ||
      typeof entry.name !== 'string' || !entry.name || !/\.pdf$/i.test(entry.name) ||
      typeof entry.path !== 'string' || !/^pdfs\/\d{3}\.pdf$/.test(entry.path) || paths.has(entry.path) || !archive[entry.path]) throw new Error('projectInvalid')
    ids.add(entry.id); paths.add(entry.path)
  }
  if (Object.keys(archive).length !== paths.size + 1) throw new Error('projectInvalid')
  const files = []; let total = 0
  for (const entry of manifest.files) {
    const content = archive[entry.path].slice()
    total += content.byteLength
    if (total > MAX_BYTES) throw new Error('projectTooLarge')
    try {
      const file = await readPdf({ name: entry.name, size: content.byteLength, type: 'application/pdf', arrayBuffer: async () => content.buffer })
      files.push({ ...file, id: entry.id })
    } catch { throw new Error('projectPdfError') }
  }
  const requirements = new Set(dataset.requirements.map(r => r.id))
  let matches = {}
  for (const [id, match] of Object.entries(manifest.matches)) {
    if (!requirements.has(id) || !match || typeof match.fileId !== 'string' || typeof match.expiry !== 'string' ||
      (match.expiry && !validDate(match.expiry)) || (match.fileId && !ids.has(match.fileId)) ||
      !canAssign(id, match.fileId, matches, files)) throw new Error('projectInvalid')
    matches = { ...matches, [id]: { fileId: match.fileId, expiry: match.expiry } }
  }
  return { dataset, files, matches, language: manifest.language, includeIndex: manifest.includeIndex }
}
