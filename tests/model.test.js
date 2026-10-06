import test from 'node:test'
import assert from 'node:assert/strict'
import { validateRequirements, requirementStatus, isBlocking, hashBytes, canAssign, validDate } from '../src/model.js'
const req = { id: 'r1', order: 1, title_en: 'License', title_bn: 'লাইসেন্স', mandatory: true, has_expiry: true }
const tender = { tender_id: 'UNSEEN-9', title: 'New tender', procuring_entity: 'Office', bidder: 'Company', submission_deadline: '2026-10-20' }

test('all exact status branches, including optional expiry and same-day expiry', () => {
  const file = {}
  for (const [r, matched, expiry, status] of [
    [req, null, '', 'missing'], [{ ...req, mandatory: false }, null, '', 'notProvided'],
    [req, file, '', 'expiryNeeded'], [req, file, '2026-10-19', 'expired'],
    [req, file, '2026-10-20', 'ok'], [req, file, '2026-10-21', 'ok'],
    [{ ...req, has_expiry: false }, file, '', 'ok'],
    [{ ...req, mandatory: false }, file, '', 'expiryNeeded'],
    [{ ...req, mandatory: false }, file, '2026-10-19', 'expired'],
  ]) assert.equal(requirementStatus(r, matched, expiry, tender.submission_deadline), status)
  assert.equal(isBlocking('missing'), true)
  assert.equal(isBlocking('expiryNeeded'), true)
  assert.equal(isBlocking('expired'), true)
  assert.equal(isBlocking('notProvided'), false)
  assert.equal(isBlocking('ok'), false)
})
test('schema validation and numerical order do not depend on sample data', () => {
  const data = validateRequirements({ tender, requirements: [{ ...req, order: 10, id: 'ten' }, { ...req, order: 2, id: 'two' }] })
  assert.deepEqual(data.requirements.map(r => r.order), [2, 10])
  assert.throws(() => validateRequirements({ tender, requirements: [{ ...req, mandatory: 'true' }] }))
  assert.throws(() => validateRequirements({ tender, requirements: [req, req] }))
  assert.throws(() => validateRequirements({ tender: { ...tender, submission_deadline: '2026-02-30' }, requirements: [req] }))
  assert.equal(validDate('2024-02-29'), true)
  assert.equal(validDate('2026-02-29'), false)
})
test('hash actual bytes and prevent cross-requirement duplicate assignment', async () => {
  const bytes = new TextEncoder().encode('actual document bytes').buffer
  const hash = await hashBytes(bytes)
  assert.equal(hash, await hashBytes(bytes.slice(0)))
  assert.notEqual(hash, await hashBytes(new TextEncoder().encode('different bytes')))
  const files = [{ id: 'a', hash }, { id: 'b', hash }, { id: 'c', hash: 'different' }]
  const matches = { r1: { fileId: 'a' } }
  assert.equal(canAssign('r2', 'a', matches, files), false)
  assert.equal(canAssign('r2', 'b', matches, files), false)
  assert.equal(canAssign('r1', 'b', matches, files), true)
  assert.equal(canAssign('r2', 'c', matches, files), true)
  assert.equal(canAssign('r2', '', matches, files), true)
  assert.equal(canAssign('r2', 'b', {}, files), true)
})
