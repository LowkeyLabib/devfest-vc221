import { canAssign, requirementStatus } from './model.js'
import { messages } from './i18n.js'

export function normalizeName(text) {
  return text.normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{M}\p{N}]/gu, '')
}

function filenameMatches(name, requirement) {
  const stem = name.replace(/\.pdf$/i, '').trim()
  // Recognize formatting, leading ordering numbers, and explicit version/copy
  // suffixes. Do not infer synonyms or dates from a document's contents.
  const withoutOrder = stem.replace(/^\d+[\s._-]+/, '')
  const variants = [stem, withoutOrder].flatMap(value => [value,
    value.replace(/[\s._-]+(?:\d{4}(?:[._-]\d{2}){0,2}|v\d+|final|signed)$/i, ''),
    value.replace(/\s*\(\d+\)$/, ''),
  ]).map(normalizeName)
  const id = normalizeName(requirement.id)
  const titles = [requirement.title_en, requirement.title_bn].map(normalizeName)
  const aliases = [id, ...titles, ...titles.flatMap(title => [id + title, title + id])]
  return aliases.some(alias => alias && variants.includes(alias))
}

export function autoMatch(requirements, files, currentMatches) {
  let result = { ...currentMatches }
  const proposals = []
  for (const requirement of [...requirements].sort((a, b) => a.order - b.order)) {
    if (currentMatches[requirement.id]?.fileId) continue
    const candidates = files.filter(file => canAssign(requirement.id, file.id, currentMatches, files) && filenameMatches(file.name, requirement))
    const hashes = new Set(candidates.map(file => file.hash))
    // Two different versions are ambiguous, even if one filename looks newer.
    if (hashes.size !== 1) continue
    const file = candidates[0]
    // A name shared by multiple requirements is also ambiguous.
    if (requirements.filter(r => filenameMatches(file.name, r)).length !== 1) continue
    proposals.push({ requirement, file })
  }
  let count = 0
  for (const { requirement, file } of proposals) {
    // Different filenames containing the same bytes cannot serve different rows.
    if (proposals.filter(proposal => proposal.file.hash === file.hash).length !== 1) continue
    if (!canAssign(requirement.id, file.id, result, files)) continue
    result = { ...result, [requirement.id]: { fileId: file.id, expiry: '' } }
    count++
  }
  return { matches: result, count }
}

export function csvCell(value) {
  let text = String(value ?? '')
  // Quote CSV syntax and neutralize spreadsheet formulas in user-supplied text.
  if (/^\s*[=+@-]/.test(text) || /^[\t\r]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

export function checklistCsv(dataset, files, matches, language = 'en') {
  const t = messages[language] || messages.en
  const header = ['Document', 'File Name', 'Pages', 'Expiry Date', 'Status']
  const rows = [...dataset.requirements].sort((a, b) => a.order - b.order).map(r => {
    const match = matches[r.id], file = files.find(f => f.id === match?.fileId)
    return [language === 'bn' ? r.title_bn : r.title_en, file?.name || '', file?.pages ?? '',
      file && r.has_expiry ? match?.expiry || '' : '',
      t[requirementStatus(r, file, match?.expiry, dataset.tender.submission_deadline)]]
  })
  // BOM helps office spreadsheet programs open Bangla as UTF-8.
  return '\uFEFF' + [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export function packageIndex(requirements, files, matches, includeIndex = true) {
  let page = includeIndex ? 3 : 2
  return [...requirements].sort((a, b) => a.order - b.order).flatMap(requirement => {
    const file = files.find(f => f.id === matches[requirement.id]?.fileId)
    if (!file) return []
    const entry = { requirement, file, startPage: page }
    page += file.pages
    return [entry]
  })
}
