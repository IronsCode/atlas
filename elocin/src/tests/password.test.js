/**
 * password.test.js — unit tests for the shared password policy (lib/password.js).
 * Pure function, no DB. Run: node --test src/tests/password.test.js
 */
import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { validatePassword, PASSWORD_POLICY_MESSAGE } from '../lib/password.js'

describe('validatePassword', () => {
  test('accepts a password meeting every rule', () => {
    assert.equal(validatePassword('Str0ng-Pass!').ok, true)
  })

  test('rejects and reports each missing rule', () => {
    const cases = [
      ['Sh0rt!a', 'length'],             // 7 chars, otherwise valid
      ['alllower1!', 'upper'],           // no uppercase
      ['ALLUPPER1!', 'lower'],           // no lowercase
      ['NoNumbers!', 'number'],          // no digit
      ['NoSpecial1', 'special']          // no special char
    ]
    for (const [pw, expected] of cases) {
      const r = validatePassword(pw)
      assert.equal(r.ok, false, `${pw} should fail`)
      assert.ok(r.failed.includes(expected), `${pw} should flag "${expected}"`)
      assert.equal(r.error, PASSWORD_POLICY_MESSAGE)
    }
  })

  test('rejects empty / non-string input', () => {
    assert.equal(validatePassword('').ok, false)
    assert.equal(validatePassword(undefined).ok, false)
    assert.equal(validatePassword(null).ok, false)
  })
})
