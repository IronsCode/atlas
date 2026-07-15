/**
 * architecture.test.js — dependency-direction guard (Stage 0).
 *
 * Locks the determinism boundary that the Observation Intelligence Platform
 * architecture depends on (see docs/design/observation_intelligence_platform.md):
 *
 *   RULE 1 — The record path is model-free. No file under src/core or src/api
 *            may import the LLM/reasoning layer (externalAI / deidentify / a
 *            future reasoning/ module). If every model is deleted, the record
 *            path must still compile and run. This test makes that an ENFORCED
 *            invariant, not a convention.
 *
 *   RULE 2 — core/ is pure. Every import under src/core must be a node builtin
 *            or a path that stays inside src/core. No db, no http, no npm
 *            packages, no reaching into lib/data/api. This is what lets the
 *            parser stay a pure, versioned function (seed_parses.json is only a
 *            valid lock while this holds).
 *
 * Pure static analysis — no DB, no env needed:
 *   node --test src/tests/architecture.test.js
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..') // .../src

// Recursively collect every .js file under a directory (skip node_modules).
function collectJs(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) out.push(...collectJs(full))
    else if (entry.endsWith('.js')) out.push(full)
  }
  return out
}

// Extract every import/export/dynamic-import specifier's string.
const SPEC_RE = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|(?:^|[^.\w])import\s+['"]([^'"]+)['"]/gm
function importsOf(file) {
  const src = readFileSync(file, 'utf8')
  const specs = []
  let m
  while ((m = SPEC_RE.exec(src))) specs.push(m[1] || m[2] || m[3])
  return specs
}

const rel = (f) => relative(SRC, f)

// The LLM / reasoning layer — banned from the record path (RULE 1).
const REASONING_LAYER = /(^|\/)externalAI(\.js)?$|(^|\/)deidentify(\.js)?$|(^|\/)reasoning\//

test('RULE 1 — the record path (core/ + api/) never imports the LLM/reasoning layer', () => {
  const recordPath = collectJs(join(SRC, 'core')).concat(collectJs(join(SRC, 'api')))
  assert.ok(recordPath.length >= 6, `expected to scan the record path, found ${recordPath.length} files`)

  const violations = []
  for (const file of recordPath) {
    for (const spec of importsOf(file)) {
      if (REASONING_LAYER.test(spec)) violations.push(`${rel(file)}  imports  '${spec}'`)
    }
  }
  assert.deepEqual(
    violations,
    [],
    `Record path must be model-free. Route reasoning through the advisory plane, never the record path:\n  ${violations.join('\n  ')}`
  )
})

// External model-provider signatures. Only the gateway (lib/externalAI.js) may
// contain any of these; anywhere else in production code is a bypass of the
// single de-identified, fail-closed, audited egress. Literal `includes` (not a
// generic "any AI" scanner) — the smallest reliable invariant.
const PROVIDER_SIGNATURES = [
  'api.anthropic.com',   // Anthropic REST endpoint
  'api.openai.com',      // OpenAI REST endpoint
  '@anthropic-ai',       // provider SDK dependency
  '.messages.create(',   // Anthropic SDK client call
  'chat.completions'     // OpenAI SDK client call
]

test('RULE 3 — only lib/externalAI.js may reach an external model provider', () => {
  const GATEWAY = join(SRC, 'lib', 'externalAI.js')
  const TESTS = join(SRC, 'tests')
  // Scan production code only: tests may reference provider strings to mock/detect
  // them (this file included), and the gateway is the one allowed egress.
  const prod = collectJs(SRC).filter((f) => f !== GATEWAY && !f.startsWith(TESTS + '/'))
  assert.ok(prod.length >= 10, `expected to scan production code, found ${prod.length} files`)

  const violations = []
  for (const file of prod) {
    const src = readFileSync(file, 'utf8')
    for (const sig of PROVIDER_SIGNATURES) {
      if (src.includes(sig)) violations.push(`${rel(file)}  contains provider signature  '${sig}'`)
    }
  }
  assert.deepEqual(
    violations,
    [],
    `Every external model call must route through lib/externalAI.js — the single egress that enforces the kill switch, de-identification, the fail-closed PII scan, and the audit. A direct provider path here bypasses all of it:\n  ${violations.join('\n  ')}`
  )
})

test('RULE 2 — core/ is pure (node builtins + intra-core paths only)', () => {
  const coreFiles = collectJs(join(SRC, 'core'))
  assert.ok(coreFiles.length >= 5, `expected core/ files, found ${coreFiles.length}`)

  const violations = []
  for (const file of coreFiles) {
    for (const spec of importsOf(file)) {
      const isRelative = spec.startsWith('.')
      const isBuiltin = spec.startsWith('node:')
      if (isBuiltin) continue
      if (!isRelative) {
        violations.push(`${rel(file)}  imports bare module  '${spec}'  (core takes no npm deps)`)
        continue
      }
      // relative, but must not escape core into lib/data/api or the reasoning layer
      if (/(^|\/)(lib|data|api)\//.test(spec) || REASONING_LAYER.test(spec)) {
        violations.push(`${rel(file)}  reaches outside core  '${spec}'`)
      }
    }
  }
  assert.deepEqual(
    violations,
    [],
    `core/ must stay pure (this is what keeps the parser deterministic + seed_parses.json a valid lock):\n  ${violations.join('\n  ')}`
  )
})
