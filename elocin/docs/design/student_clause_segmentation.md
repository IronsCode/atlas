# Design Spec — Student-Clause Segmentation (NOT built)

**Status:** design only. Nothing here is implemented. This is improvement #10
from the pre-launch parser review — the one high-cost item, specced now so it's
a deliberate decision rather than a production surprise.

## The problem

`parseObservation` parses at the granularity of the **whole note**: one
`outcome`, one `skills[]`, one `students[]` per note. The real pedagogical unit
is **(student, skill, outcome)**. Teachers routinely write group notes:

> "Table 3: Emma and Noah worked on CVC — Emma got it, Noah struggled with blends."

Today this collapses to a single outcome and a single skill list smeared across
both children. Emma's record and Noah's record receive the same (wrong) signal.
At scale, group notes are the norm, so this silently mis-attributes outcomes
into individual children's longitudinal records — the exact thing the FERPA/IEP
determinism story is supposed to protect.

Related smaller defects that segmentation also fixes:
- **Teacher-action attribution** ("*the teacher* wrote the objective") tags the
  student with `writing`. A clause bound to its subject would see the subject is
  the teacher, not a roster student.
- **Cross-clause negation bleed** in punctuation-free run-ons, because the
  4-word negation window and outcome scan currently run over the whole note.

## Why it's deferred, not done now

- It is a genuine redesign of the core contract (`skills[]`/`outcome` become
  per-segment), touching `insights.js`, `conferenceReport.js`, tone, the
  dashboard aggregates, and the stored `parsed_json` shape.
- It must stay **deterministic and auditable** (no dependency parser / no ML —
  S23 constraint holds), which makes robust subject attribution hard.
- The current mitigations (idiom demotion #6, negation-aware outcomes #1) remove
  the highest-blast-radius errors *without* the redesign, buying time to gather
  real group-note data before committing to a segmentation model.

## Proposed approach (deterministic)

1. **Segment** the note into clauses on: sentence terminators, then
   coordinating conjunctions (`and`, `but`, `then`, `so`), semicolons, and
   newlines/bullets. Keep character offsets for provenance.
2. **Bind a subject** to each clause: the nearest preceding roster-name match,
   else a pronoun resolved to the last named roster student, else a
   teacher/`the class` cue → mark the clause **subject = non-student** (so its
   skills are dropped or attributed to the group, not a child).
3. **Run the existing matchers per clause** (methods, skills, outcome, negation
   window all already operate on a string — feed them a clause instead of the
   whole note). Negation and outcome stay local to the clause automatically.
4. **Assemble** a per-student result:
   `{ student, skills[], methods[], outcome, evidence, span }[]`, plus a
   note-level roll-up for backward compatibility.

## Locked-contract migration

- Keep the current note-level fields (`skills[]`, `methods[]`, `outcome`) as a
  **union roll-up** so every existing consumer keeps working unchanged.
- Add an **additive** `segments: [{ student, skills, methods, outcome, span,
  evidence }]`. Consumers migrate to `segments` when they want per-child
  precision; until then they read the roll-up exactly as today.
- Version-bump the lexicon/engine and stamp it; `parsed_json` stays locked on
  creation, so historical notes are unaffected.

## Acceptance criteria (write these as gold notes first)

- "Emma got it, Noah struggled" → two segments, Emma positive / Noah negative.
- "the teacher wrote the objective" → no student `writing` tag.
- A single-student single-clause note → identical roll-up to today (no
  regression on the existing corpora).
- Held-out precision does not drop; group-note recall is measured on a new
  multi-student section of the test corpus.

## Rough cost

Medium-to-high: ~1 focused session for the deterministic segmenter + subject
binder + per-segment assembly, plus a migration of `insights`/`conferenceReport`
to prefer `segments`, plus a multi-student gold section. Do it **after** beta
data confirms how often group notes actually occur and what they look like.
