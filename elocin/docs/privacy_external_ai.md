# Privacy pipeline for external AI

**Status:** implemented (Stage-0). This is the single, reusable privacy layer every external-AI
feature routes through. It exists because the architecture review found the offline lexicon proposer
could ship a teacher's raw note — potentially a child's name — to a third-party model. No feature
calls a provider directly anymore.

## Principle

Before any text leaves the tenant boundary: **consent → de-identify → validate (fail-closed) →
transmit the minimum → audit (no raw text).** Deterministic features never depend on external AI, and
external AI is **off by default**.

## Pipeline

```
record (lexicon_misses, …)
   │  [1] CONSENT   organizations.external_processing_allowed = TRUE  (default FALSE)
   ▼
lib/deidentify.js
   │  [2] roster redaction (names → role placeholders) + structural PII scrub
   │      → drop any record with residual structural PII (fail-closed)
   ▼
lib/externalAI.js  (the ONLY choke point)
   │  [3] global kill switch: EXTERNAL_AI_ENABLED=true AND a provider key
   │  [4] fail-closed residual scan on the OUTGOING prompt → refuse if structural PII remains
   │  [5] transmit minimum (de-identified, batched)
   ▼
provider (Anthropic)
   │  [6] audit row: decision + versions + token counts   (NEVER the raw prompt)
   ▼
structured response → human review
```

Any future AI feature that calls `externalAIRequest(...)` inherits [3]–[6] automatically, and should
call `deidentify(...)` for [2] with the relevant roster.

## Configuration (three independent gates, all required to send)

| Gate | Where | Default |
|---|---|---|
| `EXTERNAL_AI_ENABLED=true` | env (global kill switch) | **off** |
| provider key (`ANTHROPIC_API_KEY`) | env | unset |
| `external_processing_allowed = TRUE` | per organization (`organizations`) | **FALSE** |

Disable external AI entirely by leaving `EXTERNAL_AI_ENABLED` unset — deterministic features
(parsing, reports, tone) continue unchanged; AI features fall back to SAMPLE MODE.

## PII inventory (what we redact, and how)

| Category | Source fields | Handling |
|---|---|---|
| Student names | `people.display_name / full_name / last_name` | roster → `Student A/B/…` |
| Teacher names | `users.full_name` | roster → `the teacher` |
| Parent names | `parent_contacts.full_name` | roster → `a parent` |
| Classroom names | `teams.name` (e.g. "Room 4") | roster → `the classroom` |
| School / org names | `organizations.name / slug` | roster → `the school` |
| Non-roster names / nicknames | free text | mid-sentence capitalized backstop → `[name]` |
| Emails | free text | pattern → `[email]` |
| Phone numbers | free text | pattern (≥7 digits) → `[phone]` |
| URLs | free text | pattern → `[url]` |
| Dates / birthdays (numeric) | free text | pattern → `[date]` |
| Street addresses | free text | pattern → `[address]` |
| SSN-like / long numeric IDs | free text | pattern → `[id]` |

Roster redaction is the high-precision path (we *know* the org's names); structural scrubbing is the
universal, language-independent path; the capitalized backstop is the catch-all for names we don't
have on file. Distinct people keep distinct pseudonyms so relationships survive.

## Audit (`ai_request_audit`, migration 018)

Every attempt records: timestamp, feature, provider, model, organization (nullable for cross-org
batches), knowledge version, de-identify version, prompt-template version, **decision**
(`sent | blocked_global_disabled | blocked_no_key | blocked_residual_pii | provider_error |
transport_error`), input/output token counts, records processed, records dropped. **The raw prompt is
never stored** (and never logged).

## Threat model

| Threat | Mitigation |
|---|---|
| **Names to a third party** | roster redaction (precise) + capitalized backstop (catch-all); consent gate limits to opted-in orgs |
| **Structured PII (email/phone/…)** | pattern scrub + **gateway fail-closed refusal** on any residual — guaranteed regardless of caller diligence |
| **Uncommon names / nicknames** | mid-sentence capitalized backstop → `[name]`; residual (lowercase, sentence-initial, non-roster) mitigated by roster coverage |
| **Classroom nicknames** | classroom names are in the roster; free-text nicknames hit the backstop |
| **Copied parent emails** | email pattern + gateway fail-closed |
| **Prompt injection via a teacher note** | **de-id runs before the model sees anything**, so injection cannot exfiltrate PII (it's already gone); output is schema-constrained (`json_schema`), key-validated (`sanitize`), and human-reviewed; the model has no tools/data access |
| **Prompt leakage in logs** | audit stores counts/decisions only; no code path logs the raw prompt; SAMPLE MODE prints the *de-identified* prompt |
| **Metadata leakage** | the pipeline sends only the de-identified note text — no IDs, timestamps, or record metadata |
| **Caller forgets to de-identify** | gateway still blocks structural PII; **names are not pattern-detectable, so a roster-less caller could leak a name** — see Remaining risks |

## Remaining risks (future work)

- **Name coverage depends on the caller passing a roster.** The gateway guarantees *structural* PII
  safety universally, but cannot detect names by pattern. A future feature that skips `deidentify`
  could leak a name. *Enhancement:* a de-identification "receipt" the gateway requires, or a
  roster-aware default in the gateway.
- **Residual name cases:** a non-roster name that is lowercase, or capitalized at a sentence start,
  can survive. Mitigated by roster coverage (a teacher writes about their own class), not eliminated.
- **Textual/contextual dates** ("born last March") aren't caught by the numeric-date pattern.
- **Free-text re-identification:** a highly specific de-identified phrase (rare context) could be
  identifying even without a name. *Enhancement:* a k-threshold — only send clusters seen across ≥k
  orgs/occurrences (the `--min-orgs` flag already exists; consider raising the default once volume
  allows).
- **Multilingual:** the structural patterns are script-agnostic for emails/URLs/digits, but the
  capitalized-name backstop is Latin-script-specific; CJK/Arabic name detection needs per-language
  handling (tracked in the concept_lifecycle review, C3).
- **Non-text modalities** (future audio/image/video observations) need their own de-identification
  (EXIF stripping, face/voice) before any external processing — out of scope for this text pipeline.
- **Provider governance:** a signed DPA + zero-retention configuration with the provider, and a data
  residency decision, belong in the broader `data_governance.md` the review recommended.
