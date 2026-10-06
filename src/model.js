export const MAX_FILES = 30
export const MAX_BYTES = 50_000_000

export function withinUploadLimits(files, size) {
  return files.length < MAX_FILES && files.reduce((total, file) => total + file.size, 0) + size <= MAX_BYTES
}

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function validateRequirements(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('schema')
  const { tender, requirements } = input
  const fields = ['tender_id', 'title', 'procuring_entity', 'bidder', 'submission_deadline']
  if (!tender || fields.some(key => typeof tender[key] !== 'string' || !tender[key].trim())) throw new Error('tenderFields')
  if (!validDate(tender.submission_deadline)) throw new Error('deadlineInvalid')
  // A tender ID is also the exact downloaded filename; disallow path/control characters.
  if (/[\\/\x00-\x1f<>:"|?*]/.test(tender.tender_id) || /[. ]$/.test(tender.tender_id)) throw new Error('tenderIdInvalid')
  if (!Array.isArray(requirements) || requirements.length === 0) throw new Error('requirementsInvalid')
  const ids = new Set(), orders = new Set()
  for (const r of requirements) {
    if (!r || ['id', 'title_en', 'title_bn'].some(key => typeof r[key] !== 'string' || !r[key].trim()) ||
      !Number.isSafeInteger(r.order) || r.order < 1 || typeof r.mandatory !== 'boolean' || typeof r.has_expiry !== 'boolean') throw new Error('requirementFields')
    if (ids.has(r.id) || orders.has(r.order)) throw new Error('uniqueRequirements')
    ids.add(r.id); orders.add(r.order)
  }
  return { tender: { ...tender }, requirements: [...requirements].sort((a, b) => a.order - b.order) }
}

export function requirementStatus(requirement, file, expiry, deadline) {
  if (!file) return requirement.mandatory ? 'missing' : 'notProvided'
  if (requirement.has_expiry) {
    if (!validDate(expiry)) return 'expiryNeeded'
    if (expiry < deadline) return 'expired'
  }
  return 'ok'
}
export const isBlocking = status => ['missing', 'expiryNeeded', 'expired'].includes(status)

export async function hashBytes(bytes) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
}

export function canAssign(requirementId, fileId, matches, files) {
  if (!fileId) return true
  const selected = files.find(file => file.id === fileId)
  return !!selected && !Object.entries(matches).some(([id, match]) => {
    const assigned = files.find(file => file.id === match.fileId)
    return id !== requirementId && assigned?.hash === selected.hash
  })
}

export function localDate(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
