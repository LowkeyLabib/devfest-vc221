import test from 'node:test'
import assert from 'node:assert/strict'
import { messages } from '../src/i18n.js'

test('all principal UI strings, errors and statuses have both languages', () => {
  assert.deepEqual(Object.keys(messages.en).sort(), Object.keys(messages.bn).sort())
  for (const language of ['en', 'bn']) {
    for (const [key, value] of Object.entries(messages[language])) {
      assert.equal(typeof value, 'string', `${language}.${key}`)
      assert.ok(value.trim(), `${language}.${key} is not blank`)
    }
  }
})
