import test from 'node:test'
import assert from 'node:assert/strict'
import { autoMatch, normalizeName, csvCell, checklistCsv, packageIndex } from '../src/bonuses.js'

const tender = { tender_id: 'BONUS-1', title: 'Tender', bidder: 'Bidder', procuring_entity: 'Office', submission_deadline: '2026-10-20' }
const req = (id, order, title_en, other = {}) => ({ id, order, title_en, title_bn: `নথি ${id}`, mandatory: true, has_expiry: false, ...other })
const file = (id, name, hash = id, pages = 1) => ({ id, name, hash, pages })

test('auto-match normalizes formatting, title+ID, Bangla names and file prefixes', () => {
  const requirements = [req('R01', 1, 'Trade License'), req('R02', 2, 'Financial Proposal'), req('R03', 3, 'Unknown', { title_bn: 'অভিজ্ঞতার সনদ' })]
  const files = [file('a', 'r-01_TRADE-license.PDF'), file('b', '02 financial_proposal.pdf'), file('c', 'অভিজ্ঞতার_সনদ.pdf')]
  const result = autoMatch(requirements, files, {})
  assert.equal(normalizeName(' TRADE_License- '), 'tradelicense')
  assert.equal(result.count, 3)
  assert.equal(result.matches.R01.fileId, 'a')
  assert.equal(result.matches.R02.fileId, 'b')
  assert.equal(result.matches.R03.fileId, 'c')
})

test('auto-match preserves manual matches and dates; never guesses partial or competing versions', () => {
  const requirements = [req('R01', 1, 'Trade License'), req('R02', 2, 'Financial Proposal'), req('R03', 3, 'Technical Proposal')]
  const files = [file('a', 'trade_license_2025.pdf'), file('b', 'trade_license_2026.pdf'), file('c', 'financial_proposal.pdf'), file('d', 'technical.pdf')]
  const current = { R02: { fileId: 'c', expiry: '2026-12-31' } }
  const before = structuredClone(current)
  const result = autoMatch(requirements, files, current)
  assert.equal(result.count, 0)
  assert.deepEqual(result.matches, before)
  assert.deepEqual(current, before)
})

test('auto-match respects duplicate hashes, shared names and existing assignments', () => {
  const requirements = [req('a', 1, 'License'), req('b', 2, 'Invoice')]
  const files = [file('f1', 'license.pdf', 'same'), file('f2', 'invoice.pdf', 'same')]
  assert.equal(autoMatch(requirements, files, {}).count, 0)
  assert.equal(autoMatch(requirements, files, { a: { fileId: 'f1', expiry: '' } }).count, 0)
  assert.equal(autoMatch([req('a', 1, 'License'), req('b', 2, 'License')], [file('f', 'license.pdf')], {}).count, 0)
  const copies = [file('f1', 'license.pdf', 'same'), file('f2', 'license (1).pdf', 'same')]
  const result = autoMatch(requirements, copies, {})
  assert.equal(result.count, 1)
  assert.equal(Object.values(result.matches).length, 1)
})

test('CSV quotes commas, quotes and newlines and prevents spreadsheet formulas', () => {
  assert.equal(csvCell('A, "quoted"\nline'), '"A, ""quoted""\nline"')
  assert.equal(csvCell('=HYPERLINK("bad")'), '"\'=HYPERLINK(""bad"")"')
  assert.equal(csvCell(null), '""')
  const dataset = { tender, requirements: [req('b', 2, 'Optional', { mandatory: false }), req('a', 1, 'A, "quoted"\nline', { has_expiry: true })] }
  const csv = checklistCsv(dataset, [file('f', 'name, "file".pdf', 'f', 3)], { a: { fileId: 'f', expiry: '2026-10-19' } })
  assert.ok(csv.startsWith('\uFEFF"Document","File Name","Pages","Expiry Date","Status"\r\n'))
  assert.ok(csv.includes('"A, ""quoted""\nline","name, ""file"".pdf","3","2026-10-19","Expired"'))
  assert.ok(csv.includes('"Optional","","","","Not provided"'))
  assert.ok(csv.indexOf('A,') < csv.indexOf('Optional'))
  assert.ok(checklistCsv(dataset, [], {}, 'bn').includes('দেওয়া হয়নি'))
})

test('index starts account for cover, optional index, multipage documents and omitted optionals', () => {
  const requirements = [req('b', 10, 'B'), req('optional', 3, 'Optional', { mandatory: false }), req('a', 2, 'A'), req('c', 12, 'C')]
  const files = [file('fa', 'a.pdf', 'a', 3), file('fb', 'b.pdf', 'b', 2), file('fc', 'c.pdf', 'c', 1)]
  const matches = { a: { fileId: 'fa' }, b: { fileId: 'fb' }, c: { fileId: 'fc' } }
  const entries = packageIndex(requirements, files, matches)
  assert.deepEqual(entries.map(row => row.requirement.id), ['a', 'b', 'c'])
  assert.deepEqual(entries.map(row => row.startPage), [3, 6, 8])
  assert.deepEqual(packageIndex(requirements, files, matches, false).map(row => row.startPage), [2, 5, 7])
})

test('auto-match safely supports unusual requirement IDs without changing object prototypes', () => {
  const result = autoMatch([req('__proto__', 1, 'License')], [file('f', 'license.pdf')], {})
  assert.ok(Object.hasOwn(result.matches, '__proto__'))
  assert.equal(result.matches.__proto__.fileId, 'f')
  assert.equal(Object.getPrototypeOf(result.matches), Object.prototype)
})
