// Regenerate the demo seed:  node scripts/gen_seed.mjs > migrations/002_seed.sql
// Also writes src/tests/fixtures/seed_parses.json (the committed regression
// snapshot locking how each seed note parses — see lexicon.test.js).
import { parseObservation } from '../src/core/rules/parseObservation.js'
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// ---- fixed IDs (8-4-4-4-12; 4th group = entity type, last group = seq) ----
const ORG = '00000000-0000-0000-0000-000000000001'
const LOC = '00000000-0000-0000-0001-000000000001'
const T = {
  room4: '00000000-0000-0000-0002-000000000001', // Kindergarten
  room6: '00000000-0000-0000-0002-000000000002', // Grade 1
  room2: '00000000-0000-0000-0002-000000000003', // Pre-K
  room7: '00000000-0000-0000-0002-000000000004', // Grade 1 (second section)
  room8: '00000000-0000-0000-0002-000000000005', // Grade 2
}
const U = {
  patel:  '00000000-0000-0000-0003-000000000001', // teacher, owner (all rooms — demo visibility)
  rivera: '00000000-0000-0000-0003-000000000002', // ta (Room 4)
  nguyen: '00000000-0000-0000-0003-000000000003', // teacher (Room 6)
  okafor: '00000000-0000-0000-0003-000000000004', // specialist (spans rooms)
  bello:  '00000000-0000-0000-0003-000000000005', // teacher (Room 2, Pre-K)
  chen:   '00000000-0000-0000-0003-000000000006', // teacher (Room 7, Grade 1)
  ford:   '00000000-0000-0000-0003-000000000007', // teacher (Room 8, Grade 2)
}
const P = {
  emma:   '00000000-0000-0000-0004-000000000001',
  noah:   '00000000-0000-0000-0004-000000000002',
  lily:   '00000000-0000-0000-0004-000000000003',
  marcus: '00000000-0000-0000-0004-000000000004',
  aisha:  '00000000-0000-0000-0004-000000000005',
  diego:  '00000000-0000-0000-0004-000000000006',
  sophia: '00000000-0000-0000-0004-000000000007',
  liam:   '00000000-0000-0000-0004-000000000008',
  // Room 2 (Pre-K)
  ava:'00000000-0000-0000-0004-000000000009', ethan:'00000000-0000-0000-0004-000000000010',
  mia:'00000000-0000-0000-0004-000000000011', jack:'00000000-0000-0000-0004-000000000012',
  zoe:'00000000-0000-0000-0004-000000000013', leo:'00000000-0000-0000-0004-000000000014',
  // Room 7 (Grade 1)
  maya:'00000000-0000-0000-0004-000000000015', owen:'00000000-0000-0000-0004-000000000016',
  ruby:'00000000-0000-0000-0004-000000000017', sam:'00000000-0000-0000-0004-000000000018',
  ella:'00000000-0000-0000-0004-000000000019', theo:'00000000-0000-0000-0004-000000000020',
  // Room 8 (Grade 2)
  nora:'00000000-0000-0000-0004-000000000021', felix:'00000000-0000-0000-0004-000000000022',
  iris:'00000000-0000-0000-0004-000000000023', gabe:'00000000-0000-0000-0004-000000000024',
  luna:'00000000-0000-0000-0004-000000000025', max:'00000000-0000-0000-0004-000000000026',
}
const NAME = { emma:'Emma', noah:'Noah', lily:'Lily', marcus:'Marcus', aisha:'Aisha', diego:'Diego', sophia:'Sophia', liam:'Liam',
  ava:'Ava', ethan:'Ethan', mia:'Mia', jack:'Jack', zoe:'Zoe', leo:'Leo',
  maya:'Maya', owen:'Owen', ruby:'Ruby', sam:'Sam', ella:'Ella', theo:'Theo',
  nora:'Nora', felix:'Felix', iris:'Iris', gabe:'Gabe', luna:'Luna', max:'Max' }
const PERSON_TEAM = { emma:'room4', noah:'room4', lily:'room4', marcus:'room4', aisha:'room6', diego:'room6', sophia:'room6', liam:'room6',
  ava:'room2', ethan:'room2', mia:'room2', jack:'room2', zoe:'room2', leo:'room2',
  maya:'room7', owen:'room7', ruby:'room7', sam:'room7', ella:'room7', theo:'room7',
  nora:'room8', felix:'room8', iris:'room8', gabe:'room8', luna:'room8', max:'room8' }
const ROSTER = {
  room4: ['Emma','Noah','Lily','Marcus'], room6: ['Aisha','Diego','Sophia','Liam'],
  room2: ['Ava','Ethan','Mia','Jack','Zoe','Leo'],
  room7: ['Maya','Owen','Ruby','Sam','Ella','Theo'],
  room8: ['Nora','Felix','Iris','Gabe','Luna','Max'],
}
const ROLE = { patel:'teacher', rivera:'ta', nguyen:'teacher', okafor:'specialist', bello:'teacher', chen:'teacher', ford:'teacher' }
const PW = '$2a$10$ehPyLHnPSO88f1WYxEGqjO/VfDAM7VIT3fi6ztyFytySSlVuUrwii' // demo1234

const uid = (grp, n) => `00000000-0000-0000-${grp}-${String(n).padStart(12,'0')}`

// ---- observations: [person, recorder, domain, daysAgo, raw] ----
const OBS = [
  // Emma (Room 4) — literacy/maths, improving; showcase
  ['emma','patel','literacy', 26, 'Emma struggled with CVC blending but got 3/5 with picture cards, up from 1/5 without.'],
  ['emma','patel','literacy', 19, 'Emma decoded 8 of 10 sounds independently today — big jump from last week.'],
  ['emma','rivera','maths',    12, 'Emma used counters for counting to 20 and got all correct, her first time independently.'],
  ['emma','patel','social',     8, 'Emma raised her hand to ask for help during small group reading.'],
  ['emma','okafor','behaviour', 5, 'Emma stayed calm through transitions and used her coping strategy independently this time.'],
  ['emma','patel','literacy',   2, 'Emma read the passage and answered comprehension questions correctly with one-on-one support.'],
  // Noah (Room 4) — mixed; intervention + goal
  ['noah','patel','literacy',  24, 'Noah blended 4 of 5 words but struggled to focus in group work.'],
  ['noah','patel','maths',     17, 'Noah struggled with number sense and could not complete the number line.'],
  ['noah','okafor','behaviour',10, 'Noah refused to share materials and had a meltdown during transition.'],
  ['noah','patel','literacy',   3, 'Noah tried again after a verbal prompt and figured out the problem.'],
  // Lily (Room 4) — recurring self-regulation + group-work pattern (drives a
  // "priority" tone + a flagged pattern + suggested intervention); one bright spot
  ['lily','patel','literacy',  21, 'Lily lost focus mid-lesson but completed the worksheet accurately one-on-one.'],
  ['lily','okafor','behaviour',15, 'Lily struggled to self-regulate and could not calm down in group work.'],
  ['lily','okafor','behaviour',10, 'Lily struggled to self-regulate during transitions and would not settle in group work.'],
  ['lily','patel','behaviour',  4, 'Lily struggled to self-regulate and refused to join group work again.'],
  // Marcus (Room 4) — motor/writing; parent pending; last note is stale (>14d)
  ['marcus','rivera','motor',  28, 'Marcus struggled with pencil grip during handwriting but improved with one-on-one support.'],
  ['marcus','patel','motor',   20, 'Marcus cut along the line with good control today — his grip has really improved.'],
  ['marcus','patel','literacy',16, 'Marcus wrote his name independently for the first time.'],

  // Aisha (Room 6) — showcase; goal achieved, report, parent opted-in
  ['aisha','nguyen','literacy',27, 'Aisha decoded CVC words using picture cards and got 4 of 5 correct.'],
  ['aisha','nguyen','literacy',20, 'Aisha struggled with blending sounds at first but improved with one-on-one support.'],
  ['aisha','nguyen','literacy',13, 'Aisha read the passage and answered comprehension questions independently.'],
  ['aisha','nguyen','social',   9, 'Aisha collaborated well and took turns with peers during small group work.'],
  ['aisha','okafor','maths',    6, 'Aisha mastered counting to 50 using manipulatives — so pleased with her.'],
  ['aisha','nguyen','literacy', 1, 'Aisha wrote a full sentence independently with correct spelling.'],
  // Diego (Room 6) — struggling; high-priority intervention, paused goal
  ['diego','nguyen','literacy',23, 'Diego struggled with phonics and could not decode simple sounds.'],
  ['diego','nguyen','maths',   18, 'Diego had difficulty counting and confused numbers on the number line.'],
  ['diego','okafor','behaviour',11,'Diego refused to participate in group work and had a meltdown.'],
  ['diego','okafor','literacy', 4, 'Diego could not sound out CVC words even with verbal prompting.'],
  // Sophia (Room 6) — social/collab positive; milestone achieved, active goal
  ['sophia','nguyen','social', 22, 'Sophia shared materials and took turns with peers all morning.'],
  ['sophia','nguyen','social', 15, 'Sophia collaborated in small group work and helped a peer — her teamwork has really improved.'],
  ['sophia','nguyen','social',  7, 'Sophia expressed her ideas clearly and raised her hand to contribute.'],
  ['sophia','nguyen','maths',   3, 'Sophia solved the puzzle using a new strategy and persisted when stuck.'],
  // Liam (Room 6) — low/medium confidence to show AI-fallback flag; parent pending
  ['liam','nguyen','other',    14, 'Struggled today.'],
  ['liam','nguyen','maths',     6, 'Liam practiced counting to ten with counters today.'],
  ['liam','nguyen','social',    2, 'Liam asked for help.'],

  // ===== Room 2 — Pre-K (Ms. Bello). Each new class spans the full range:
  //   2 thriving · 1 monitor · 1 needs-intervention · 1 needs-a-note (stale) · 1 low-signal
  ['ava','bello','literacy',  6, 'Ava named every letter in her name and matched three uppercase letters to lowercase — so proud of her.'],
  ['ava','bello','social',    2, 'Ava shared the blocks and took turns with a friend during free play.'],
  ['ethan','bello','maths',   7, 'Ethan counted ten bears one to one and got them all correct.'],
  ['ethan','bello','motor',   3, 'Ethan cut along the line with scissors with good control, improving well.'],
  ['mia','bello','literacy', 11, 'Mia recognized some letters but struggled to stay focused during circle time.'],
  ['mia','bello','behaviour', 4, 'Mia settled after a verbal prompt and joined the group.'],
  ['jack','okafor','behaviour',12,'Jack struggled to self-regulate and could not calm down during group work.'],
  ['jack','bello','behaviour', 7, 'Jack struggled to self-regulate and would not settle during group work.'],
  ['jack','bello','behaviour', 3, 'Jack struggled to self-regulate and refused to join group work again.'],
  ['zoe','bello','motor',     22, 'Zoe practiced her pencil grip with one-on-one support.'],
  ['leo','bello','other',      6, 'Tough morning.'],

  // ===== Room 7 — Grade 1 (Mr. Chen)
  ['maya','chen','literacy',  7, 'Maya read the passage and answered comprehension questions independently.'],
  ['maya','chen','maths',     3, 'Maya mastered counting to 50 using manipulatives, no help needed.'],
  ['owen','chen','social',    8, 'Owen collaborated well and helped a peer during small group work.'],
  ['owen','chen','literacy',  2, 'Owen decoded 9 of 10 sounds independently — really coming along.'],
  ['ruby','chen','maths',    10, 'Ruby completed the number line with support but struggled when working alone.'],
  ['ruby','chen','literacy',  4, 'Ruby figured out the tricky word after trying again.'],
  ['sam','chen','literacy',  13, 'Sam struggled to read and could not decode words during group work.'],
  ['sam','okafor','literacy', 7, 'Sam struggled to read and could not decode words during group work today.'],
  ['sam','chen','literacy',   3, 'Sam struggled to read and could not decode words during group work again.'],
  ['ella','chen','literacy', 20, 'Ella wrote a short sentence with one-on-one support.'],
  ['theo','chen','other',     6, 'Asked for help.'],

  // ===== Room 8 — Grade 2 (Ms. Ford)
  ['nora','ford','literacy',  7, 'Nora read a grade-2 passage fluently and summarized it accurately on her own.'],
  ['nora','ford','maths',     3, 'Nora solved two-digit addition problems independently and got them all correct.'],
  ['felix','ford','maths',    8, 'Felix mastered his addition facts to 20 — knows them cold now.'],
  ['felix','ford','social',   2, 'Felix expressed his ideas clearly and took turns during group discussion.'],
  ['iris','ford','literacy', 11, 'Iris read with good accuracy but struggled to stay focused during independent work.'],
  ['iris','ford','maths',     4, 'Iris persisted and solved the word problem after trying a new strategy.'],
  ['gabe','ford','maths',    12, 'Gabe struggled with counting and could not keep up during group work.'],
  ['gabe','okafor','maths',   7, 'Gabe struggled with counting and would not participate in group work.'],
  ['gabe','ford','maths',     3, 'Gabe struggled with counting and could not keep up during group work again.'],
  ['luna','ford','literacy', 22, 'Luna wrote two sentences with one-on-one support.'],
  ['max','ford','other',      6, 'Good day.'],
]

// assign observation IDs and parse
let seq = 0
const rows = OBS.map(([person, recorder, domain, daysAgo, raw]) => {
  seq += 1
  const team = PERSON_TEAM[person]
  // In the real capture flow the teacher selects the student first, so the note
  // is already attached to that person — a teacher doesn't restate the name.
  // The OBS source keeps the name (readability); strip it from the stored text
  // so the seed reads like an authentic single-student observation. Verified to
  // leave the parse (skills/methods/outcome/confidence) unchanged.
  const stripped = raw.replace(new RegExp(`^${NAME[person]} `), '')
  const text = stripped.charAt(0).toUpperCase() + stripped.slice(1) // read like a written note, not a fragment
  const parsed = parseObservation(text, { context: domain, roster: ROSTER[team] })
  return {
    id: uid('0005', seq), person, team, recorder, domain, daysAgo, raw: text, parsed,
  }
})

// ---- helpers ----
const q = (s) => s === null || s === undefined ? 'NULL' : `'${String(s).replace(/'/g, "''")}'`
const jstr = (o) => `'${JSON.stringify(o).replace(/'/g, "''")}'`
const ago = (d) => `NOW() - INTERVAL '${d} days'`
const dago = (d) => `CURRENT_DATE - ${d}`

let out = ''
const w = (s='') => { out += s + '\n' }

w('-- =============================================================')
w('-- Elocin Seed Data — development / demo only')
w('-- Run AFTER 001_core.sql (and 003/004/006 for the columns/tables it uses).')
w('--')
w('-- GENERATED, do not hand-edit. Regenerate with:')
w('--     node scripts/gen_seed.mjs > migrations/002_seed.sql')
w('-- The generator runs every observation through the real deterministic')
w('-- engine (core/rules/parseObservation.js), so every parsed_json /')
w('-- confidence / confidence_score below is exactly what the engine produces')
w('-- for that raw_text — not hand-authored (the prior seed had parsed_json')
w('-- that no longer matched the engine). Edit scripts/gen_seed.mjs, not this.')
w('--')
w('-- Five classrooms spanning Pre-K–Grade 2 (Room 2 = Pre-K, Room 4 = K,')
w('-- Room 6 & 7 = Grade 1, Room 8 = Grade 2). Every student carries a tone across')
w('-- the range (thriving / monitor / needs-intervention / needs-a-note), and the')
w('-- roster exercises every feature: multi-role observations (teacher/TA/specialist),')
w('-- all outcome types + negated methods + behavioral skills + LOW-confidence')
w('-- AI-fallback notes, goals (active/achieved/paused) with status history and')
w('-- evidence links, interventions (high/medium/low, active + resolved),')
w('-- org milestones with per-student status, conference reports, and parent')
w('-- contacts (opted-in + invite-pending).')
w('--')
w('-- Demo login: any seeded staff email, password "demo1234".')
w('--   patel@westfield.edu  (owner/teacher, sees all 5 rooms)')
w('--   nguyen@westfield.edu (teacher, Room 6) · bello/chen/ford@westfield.edu (Rooms 2/7/8)')
w('-- =============================================================')
w()
w('-- Organization')
w(`INSERT INTO organizations (id, name, slug, plan) VALUES`)
w(`  (${q(ORG)}, 'Westfield Elementary', 'westfield', 'professional');`)
w()
w('-- Location')
w(`INSERT INTO locations (id, organization_id, name) VALUES`)
w(`  (${q(LOC)}, ${q(ORG)}, 'Main Building');`)
w()
w('-- Teams (Classrooms)')
w(`INSERT INTO teams (id, organization_id, location_id, name, grade_level, academic_year) VALUES`)
w(`  (${q(T.room4)}, ${q(ORG)}, ${q(LOC)}, 'Room 4', 'K', '2024-25'),`)
w(`  (${q(T.room6)}, ${q(ORG)}, ${q(LOC)}, 'Room 6', '1', '2024-25'),`)
w(`  (${q(T.room2)}, ${q(ORG)}, ${q(LOC)}, 'Room 2', 'Pre-K', '2024-25'),`)
w(`  (${q(T.room7)}, ${q(ORG)}, ${q(LOC)}, 'Room 7', '1', '2024-25'),`)
w(`  (${q(T.room8)}, ${q(ORG)}, ${q(LOC)}, 'Room 8', '2', '2024-25');`)
w()
w('-- Users (password for all seeded staff is "demo1234")')
w(`INSERT INTO users (id, organization_id, email, full_name, auth_uid, password_hash, org_role) VALUES`)
w(`  (${q(U.patel)},  ${q(ORG)}, 'patel@westfield.edu',  'Ms. Patel',  'auth_patel',  ${q(PW)}, 'owner'),`)
w(`  (${q(U.rivera)}, ${q(ORG)}, 'rivera@westfield.edu', 'J. Rivera',  'auth_rivera', ${q(PW)}, NULL),`)
w(`  (${q(U.nguyen)}, ${q(ORG)}, 'nguyen@westfield.edu', 'Ms. Nguyen', 'auth_nguyen', ${q(PW)}, 'admin'),`)
w(`  (${q(U.okafor)}, ${q(ORG)}, 'okafor@westfield.edu', 'D. Okafor',  'auth_okafor', ${q(PW)}, NULL),`)
w(`  (${q(U.bello)},  ${q(ORG)}, 'bello@westfield.edu',  'Ms. Bello',  'auth_bello',  ${q(PW)}, NULL),`)
w(`  (${q(U.chen)},   ${q(ORG)}, 'chen@westfield.edu',   'Mr. Chen',   'auth_chen',   ${q(PW)}, NULL),`)
w(`  (${q(U.ford)},   ${q(ORG)}, 'ford@westfield.edu',   'Ms. Ford',   'auth_ford',   ${q(PW)}, NULL);`)
w()
w('-- Team memberships. Patel (owner) leads Room 4 and also sits in Room 6 so')
w('-- the owner demo account can see BOTH classrooms (and exercise the sidebar')
w('-- classroom-scope filter). Okafor is a specialist across both rooms.')
w(`INSERT INTO team_memberships (team_id, user_id, role) VALUES`)
w(`  (${q(T.room4)}, ${q(U.patel)},  'teacher'),`)
w(`  (${q(T.room4)}, ${q(U.rivera)}, 'ta'),`)
w(`  (${q(T.room4)}, ${q(U.okafor)}, 'specialist'),`)
w(`  (${q(T.room6)}, ${q(U.patel)},  'teacher'),`)
w(`  (${q(T.room6)}, ${q(U.nguyen)}, 'teacher'),`)
w(`  (${q(T.room6)}, ${q(U.okafor)}, 'specialist'),`)
w(`  (${q(T.room2)}, ${q(U.bello)},  'teacher'),`)
w(`  (${q(T.room2)}, ${q(U.patel)},  'teacher'),`)
w(`  (${q(T.room2)}, ${q(U.okafor)}, 'specialist'),`)
w(`  (${q(T.room7)}, ${q(U.chen)},   'teacher'),`)
w(`  (${q(T.room7)}, ${q(U.patel)},  'teacher'),`)
w(`  (${q(T.room8)}, ${q(U.ford)},   'teacher'),`)
w(`  (${q(T.room8)}, ${q(U.patel)},  'teacher'),`)
w(`  (${q(T.room8)}, ${q(U.okafor)}, 'specialist');`)
w()
w('-- People (students)')
w(`INSERT INTO people (id, organization_id, display_name, date_of_birth, grade_level) VALUES`)
w(`  (${q(P.emma)},   ${q(ORG)}, 'Emma',   '2018-03-12', 'K'),`)
w(`  (${q(P.noah)},   ${q(ORG)}, 'Noah',   '2018-07-24', 'K'),`)
w(`  (${q(P.lily)},   ${q(ORG)}, 'Lily',   '2018-01-09', 'K'),`)
w(`  (${q(P.marcus)}, ${q(ORG)}, 'Marcus', '2018-05-30', 'K'),`)
w(`  (${q(P.aisha)},  ${q(ORG)}, 'Aisha',  '2017-04-18', '1'),`)
w(`  (${q(P.diego)},  ${q(ORG)}, 'Diego',  '2017-09-02', '1'),`)
w(`  (${q(P.sophia)}, ${q(ORG)}, 'Sophia', '2017-06-11', '1'),`)
w(`  (${q(P.liam)},   ${q(ORG)}, 'Liam',   '2017-11-27', '1'),`)
w(`  (${q(P.ava)},    ${q(ORG)}, 'Ava',    '2020-02-14', 'Pre-K'),`)
w(`  (${q(P.ethan)},  ${q(ORG)}, 'Ethan',  '2020-05-08', 'Pre-K'),`)
w(`  (${q(P.mia)},    ${q(ORG)}, 'Mia',    '2020-09-21', 'Pre-K'),`)
w(`  (${q(P.jack)},   ${q(ORG)}, 'Jack',   '2020-01-30', 'Pre-K'),`)
w(`  (${q(P.zoe)},    ${q(ORG)}, 'Zoe',    '2020-07-03', 'Pre-K'),`)
w(`  (${q(P.leo)},    ${q(ORG)}, 'Leo',    '2020-11-16', 'Pre-K'),`)
w(`  (${q(P.maya)},   ${q(ORG)}, 'Maya',   '2017-03-05', '1'),`)
w(`  (${q(P.owen)},   ${q(ORG)}, 'Owen',   '2017-08-19', '1'),`)
w(`  (${q(P.ruby)},   ${q(ORG)}, 'Ruby',   '2017-05-27', '1'),`)
w(`  (${q(P.sam)},    ${q(ORG)}, 'Sam',    '2017-10-12', '1'),`)
w(`  (${q(P.ella)},   ${q(ORG)}, 'Ella',   '2017-02-08', '1'),`)
w(`  (${q(P.theo)},   ${q(ORG)}, 'Theo',   '2017-12-01', '1'),`)
w(`  (${q(P.nora)},   ${q(ORG)}, 'Nora',   '2016-04-22', '2'),`)
w(`  (${q(P.felix)},  ${q(ORG)}, 'Felix',  '2016-09-14', '2'),`)
w(`  (${q(P.iris)},   ${q(ORG)}, 'Iris',   '2016-06-30', '2'),`)
w(`  (${q(P.gabe)},   ${q(ORG)}, 'Gabe',   '2016-11-05', '2'),`)
w(`  (${q(P.luna)},   ${q(ORG)}, 'Luna',   '2016-01-19', '2'),`)
w(`  (${q(P.max)},    ${q(ORG)}, 'Max',    '2016-08-25', '2');`)
w()
w('-- Enrollments')
w(`INSERT INTO enrollments (team_id, person_id) VALUES`)
w(Object.keys(P).map(k => `  (${q(T[PERSON_TEAM[k]])}, ${q(P[k])})`).join(',\n') + ';')
w()
w('-- Observations (parsed_json is real engine output, generated)')
w(`INSERT INTO observations (id, team_id, person_id, recorded_by, raw_text, domain, observed_at, recorder_role, confidence, confidence_score, parsed_json) VALUES`)
w(rows.map(r =>
  `  (${q(r.id)}, ${q(T[r.team])}, ${q(P[r.person])}, ${q(U[r.recorder])}, ${q(r.raw)}, ${q(r.domain)}, ${ago(r.daysAgo)}, ${q(ROLE[r.recorder])}, ${q(r.parsed.confidence)}, ${r.parsed.confidenceScore}, ${jstr(r.parsed)})`
).join(',\n') + ';')
w()
w('-- Observation audit — one create row per observation (append-only, FERPA)')
w(`INSERT INTO observation_audit (observation_id, changed_by, change_type, new_text) VALUES`)
w(rows.map(r => `  (${q(r.id)}, ${q(U[r.recorder])}, 'create', ${q(r.raw)})`).join(',\n') + ';')
w()

// ---- Goals ----
const G = {
  emma:   uid('0006', 1),
  noah:   uid('0006', 2),
  lily:   uid('0006', 3),
  aisha:  uid('0006', 4),
  diego:  uid('0006', 5),
  sophia: uid('0006', 6),
  ava:    uid('0006', 7),
  maya:   uid('0006', 8),
  sam:    uid('0006', 9),
  nora:   uid('0006', 10),
}
w('-- Goals')
w(`INSERT INTO goals (id, person_id, team_id, created_by, title, description, domain, start_date, target_date, status, progress_pct) VALUES`)
w([
  `  (${q(G.emma)},   ${q(P.emma)},   ${q(T.room4)}, ${q(U.patel)},  'Blend CVC words independently', 'Decode and blend consonant-vowel-consonant words without prompting.', 'literacy', ${dago(30)}, ${dago(-30)}, 'active', 60)`,
  `  (${q(G.noah)},   ${q(P.noah)},   ${q(T.room4)}, ${q(U.patel)},  'Sustain focus during group work', 'Stay engaged and on-task through a full small-group activity.', 'behaviour', ${dago(25)}, ${dago(-35)}, 'active', 30)`,
  `  (${q(G.lily)},   ${q(P.lily)},   ${q(T.room4)}, ${q(U.okafor)}, 'Use a self-regulation strategy', 'Independently choose and use a calming strategy during transitions.', 'behaviour', ${dago(22)}, ${dago(-40)}, 'active', 25)`,
  `  (${q(G.aisha)},  ${q(P.aisha)},  ${q(T.room6)}, ${q(U.nguyen)}, 'Decode grade-1 texts fluently', 'Read grade-1 leveled texts with accurate decoding.', 'literacy', ${dago(28)}, ${dago(-10)}, 'achieved', 100)`,
  `  (${q(G.diego)},  ${q(P.diego)},  ${q(T.room6)}, ${q(U.nguyen)}, 'Build number sense to 20', 'Count, order, and compare numbers to 20.', 'maths', ${dago(23)}, ${dago(-25)}, 'paused', 20)`,
  `  (${q(G.sophia)}, ${q(P.sophia)}, ${q(T.room6)}, ${q(U.nguyen)}, 'Collaborate and share in groups', 'Take turns and share materials during group work.', 'social', ${dago(22)}, ${dago(-20)}, 'active', 70)`,
  `  (${q(G.ava)},    ${q(P.ava)},    ${q(T.room2)}, ${q(U.bello)}, 'Recognize all letters', 'Name upper- and lowercase letters and their sounds.', 'literacy', ${dago(20)}, ${dago(-30)}, 'active', 65)`,
  `  (${q(G.maya)},   ${q(P.maya)},   ${q(T.room7)}, ${q(U.chen)},  'Read grade-1 texts fluently', 'Read grade-1 leveled texts with accurate decoding.', 'literacy', ${dago(25)}, ${dago(-8)}, 'achieved', 100)`,
  `  (${q(G.sam)},    ${q(P.sam)},    ${q(T.room7)}, ${q(U.chen)},  'Decode CVC words with support', 'Blend simple consonant-vowel-consonant words with prompting.', 'literacy', ${dago(18)}, ${dago(-35)}, 'active', 20)`,
  `  (${q(G.nora)},   ${q(P.nora)},   ${q(T.room8)}, ${q(U.ford)},  'Solve two-digit addition', 'Add two-digit numbers with and without regrouping.', 'maths', ${dago(20)}, ${dago(-15)}, 'active', 55)`,
].join(',\n') + ';')
w()
w('-- Goal status history (append-only; create row + transitions)')
let gsh = 0
const gshId = () => uid('000c', ++gsh)
const gshRows = [
  [G.emma, U.patel, null, 'active', 30], [G.noah, U.patel, null, 'active', 25],
  [G.lily, U.okafor, null, 'active', 22],
  [G.aisha, U.nguyen, null, 'active', 28], [G.aisha, U.nguyen, 'active', 'achieved', 8],
  [G.diego, U.nguyen, null, 'active', 23], [G.diego, U.nguyen, 'active', 'paused', 9],
  [G.sophia, U.nguyen, null, 'active', 22],
  [G.ava, U.bello, null, 'active', 20],
  [G.maya, U.chen, null, 'active', 25], [G.maya, U.chen, 'active', 'achieved', 5],
  [G.sam, U.chen, null, 'active', 18],
  [G.nora, U.ford, null, 'active', 20],
]
w(`INSERT INTO goal_status_history (id, goal_id, changed_by, from_status, to_status, changed_at) VALUES`)
w(gshRows.map(([g,u,f,t,d]) => `  (${q(gshId())}, ${q(g)}, ${q(u)}, ${f===null?'NULL':q(f)}, ${q(t)}, ${ago(d)})`).join(',\n') + ';')
w()
w('-- Goal evidence (link goals to supporting observations)')
// Look observations up by person + ordinal so evidence links stay correct
// even when observations are added/reordered above.
const obsOf = (p, n) => rows.filter((r) => r.person === p)[n].id
const ev = [
  [G.emma, obsOf('emma', 0), U.patel], [G.emma, obsOf('emma', 1), U.patel],
  [G.aisha, obsOf('aisha', 0), U.nguyen], [G.aisha, obsOf('aisha', 4), U.okafor],
  [G.sophia, obsOf('sophia', 1), U.nguyen],
  [G.ava, obsOf('ava', 0), U.bello],
  [G.maya, obsOf('maya', 0), U.chen],
  [G.nora, obsOf('nora', 0), U.ford],
]
let evc = 0
w(`INSERT INTO goal_evidence (id, goal_id, observation_id, linked_by) VALUES`)
w(ev.map(([g,o,u]) => `  (${q(uid('000d', ++evc))}, ${q(g)}, ${q(o)}, ${q(u)})`).join(',\n') + ';')
w()

// ---- Interventions ----
w('-- Interventions (high/medium/low priority; active + one resolved)')
let ic = 0
const iid = () => uid('0007', ++ic)
w(`INSERT INTO interventions (id, person_id, team_id, created_by, title, description, priority, status, started_at, resolved_at) VALUES`)
w([
  `  (${q(iid())}, ${q(P.noah)},   ${q(T.room4)}, ${q(U.patel)},  'Structured small-group seating', 'Seat Noah near the teacher with a visual task checklist during group work.', 'medium', 'active', ${dago(20)}, NULL)`,
  `  (${q(iid())}, ${q(P.lily)},   ${q(T.room4)}, ${q(U.okafor)}, 'Daily calm-corner check-in',     'Brief check-in and a pre-taught calming strategy before each transition.',   'high',   'active', ${dago(15)}, NULL)`,
  `  (${q(iid())}, ${q(P.marcus)}, ${q(T.room4)}, ${q(U.patel)},  'Pencil-grip support',            'Triangular grips and short handwriting warm-ups; review after 3 weeks.',      'low',    'resolved', ${dago(26)}, ${dago(5)})`,
  `  (${q(iid())}, ${q(P.diego)},  ${q(T.room6)}, ${q(U.nguyen)}, '1:1 phonics intervention block',  'Ten-minute daily 1:1 decoding block with the specialist.',                   'high',   'active', ${dago(16)}, NULL)`,
  `  (${q(iid())}, ${q(P.jack)},   ${q(T.room2)}, ${q(U.okafor)}, 'Calm-corner check-in',            'Pre-taught calming routine and a visual schedule before each transition.',    'high',   'active', ${dago(11)}, NULL)`,
  `  (${q(iid())}, ${q(P.sam)},    ${q(T.room7)}, ${q(U.okafor)}, '1:1 phonics decoding block',      'Daily ten-minute 1:1 decoding practice with the specialist.',                'high',   'active', ${dago(12)}, NULL)`,
  `  (${q(iid())}, ${q(P.gabe)},   ${q(T.room8)}, ${q(U.ford)},   'Regrouping with base-ten blocks', 'Small-group subtraction with manipulatives; review after 3 weeks.',           'medium', 'active', ${dago(10)}, NULL)`,
].join(',\n') + ';')
w()

// ---- Milestones (org-scoped definitions) ----
const M = {
  cvc:   uid('000a', 1),
  count: uid('000a', 2),
  selfreg: uid('000a', 3),
  read1: uid('000a', 4),
  collab: uid('000a', 5),
  letters: uid('000a', 6),
  add20:   uid('000a', 7),
}
w('-- Milestones (org-scoped normative definitions)')
w(`INSERT INTO milestones (id, organization_id, name, description, domain, grade_level, sort_order, created_by) VALUES`)
w([
  `  (${q(M.cvc)},     ${q(ORG)}, 'Blends CVC words',                 'Decodes and blends simple CVC words.',        'literacy',  'K', 1, ${q(U.patel)})`,
  `  (${q(M.count)},   ${q(ORG)}, 'Counts to 20',                     'Counts objects accurately to 20.',            'maths',     'K', 2, ${q(U.patel)})`,
  `  (${q(M.selfreg)}, ${q(ORG)}, 'Self-regulates in transitions',   'Uses a calming strategy during transitions.', 'behaviour', 'K', 3, ${q(U.patel)})`,
  `  (${q(M.read1)},   ${q(ORG)}, 'Reads grade-1 text',               'Reads grade-1 leveled text accurately.',      'literacy',  '1', 4, ${q(U.nguyen)})`,
  `  (${q(M.collab)},  ${q(ORG)}, 'Collaborates in group work',       'Takes turns and shares during group work.',   'social',    '1', 5, ${q(U.nguyen)})`,
  `  (${q(M.letters)}, ${q(ORG)}, 'Recognizes letters',               'Names upper- and lowercase letters.',         'literacy',  'Pre-K', 6, ${q(U.bello)})`,
  `  (${q(M.add20)},   ${q(ORG)}, 'Adds within 20',                   'Adds and subtracts fluently within 20.',      'maths',     '2', 7, ${q(U.ford)})`,
].join(',\n') + ';')
w()
w('-- Per-student milestone status')
let msc = 0
const msid = () => uid('000b', ++msc)
const ms = [
  [M.cvc, P.emma, 'in_progress', null, U.patel],
  [M.count, P.emma, 'achieved', dago(10), U.rivera],
  [M.selfreg, P.lily, 'in_progress', null, U.okafor],
  [M.cvc, P.marcus, 'not_started', null, U.patel],
  [M.read1, P.aisha, 'achieved', dago(6), U.nguyen],
  [M.cvc, P.aisha, 'achieved', dago(20), U.nguyen],
  [M.collab, P.sophia, 'achieved', dago(9), U.nguyen],
  [M.read1, P.diego, 'not_started', null, U.nguyen],
  [M.count, P.diego, 'in_progress', null, U.okafor],
  [M.letters, P.ava, 'achieved', dago(4), U.bello],
  [M.letters, P.jack, 'in_progress', null, U.bello],
  [M.add20, P.nora, 'achieved', dago(3), U.ford],
  [M.add20, P.felix, 'achieved', dago(6), U.ford],
  [M.add20, P.gabe, 'not_started', null, U.ford],
]
w(`INSERT INTO milestone_status (id, milestone_id, person_id, status, achieved_at, updated_by) VALUES`)
w(ms.map(([m,p,s,a,u]) => `  (${q(msid())}, ${q(m)}, ${q(p)}, ${q(s)}, ${a===null?'NULL':a}, ${q(u)})`).join(',\n') + ';')
w()

// ---- Reports (unlocked, empty content_json — the app populates on first visit) ----
w('-- Conference reports (content_json left empty; the Conference page')
w('-- regenerates the server-computed payload on first visit — kept unlocked')
w('-- so it self-populates rather than shipping a hand-authored payload).')
let rc = 0
const rid = () => uid('0008', ++rc)
w(`INSERT INTO reports (id, person_id, team_id, generated_by, report_type, period_start, period_end, content_json, is_locked) VALUES`)
w([
  `  (${q(rid())}, ${q(P.emma)},  ${q(T.room4)}, ${q(U.patel)},  'conference', ${dago(90)}, ${dago(0)}, '{}', FALSE)`,
  `  (${q(rid())}, ${q(P.aisha)}, ${q(T.room6)}, ${q(U.nguyen)}, 'conference', ${dago(90)}, ${dago(0)}, '{}', FALSE)`,
  `  (${q(rid())}, ${q(P.maya)},  ${q(T.room7)}, ${q(U.chen)},   'conference', ${dago(90)}, ${dago(0)}, '{}', FALSE)`,
  `  (${q(rid())}, ${q(P.nora)},  ${q(T.room8)}, ${q(U.ford)},   'conference', ${dago(90)}, ${dago(0)}, '{}', FALSE)`,
].join(',\n') + ';')
w()

// ---- Parent contacts ----
w('-- Parent contacts (opted-in + invite-pending)')
let pc = 0
const pcid = () => uid('0009', ++pc)
w(`INSERT INTO parent_contacts (id, person_id, full_name, email, phone, preferred_channel, opted_in, opted_in_at, invited_email, invited_phone, invite_sent_at) VALUES`)
w([
  `  (${q(pcid())}, ${q(P.emma)},   'Sarah Chen', 'sarah.chen@example.com', NULL, 'email', TRUE, ${ago(12)}, 'sarah.chen@example.com', NULL, ${ago(20)})`,
  `  (${q(pcid())}, ${q(P.aisha)},  'Omar Ali',   NULL, '+15551234567', 'sms',  TRUE, ${ago(9)},  NULL, '+15551234567', ${ago(15)})`,
  `  (${q(pcid())}, ${q(P.marcus)}, NULL, NULL, NULL, NULL, FALSE, NULL, 'marcus.parent@example.com', NULL, ${ago(6)})`,
  `  (${q(pcid())}, ${q(P.liam)},   NULL, NULL, NULL, NULL, FALSE, NULL, 'liam.parent@example.com', NULL, NULL)`,
  `  (${q(pcid())}, ${q(P.ava)},    'Grace Okoro', 'grace.okoro@example.com', NULL, 'email', TRUE, ${ago(10)}, 'grace.okoro@example.com', NULL, ${ago(16)})`,
  `  (${q(pcid())}, ${q(P.sam)},    NULL, NULL, NULL, NULL, FALSE, NULL, 'sam.parent@example.com', NULL, ${ago(4)})`,
].join(',\n') + ';')
w()

process.stdout.write(out)

// Committed regression snapshot: how each seed note parses under the current
// lexicon. lexicon.test.js re-parses each raw_text and asserts it still matches.
const fixtureDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'tests', 'fixtures')
writeFileSync(
  join(fixtureDir, 'seed_parses.json'),
  JSON.stringify({ lexicon: rows[0]?.parsed.lexicon, notes: rows.map((r) => ({ raw: r.raw, parsed: r.parsed })) }, null, 2) + '\n'
)

// diagnostic to stderr
const dist = {}
for (const r of rows) dist[r.parsed.confidence] = (dist[r.parsed.confidence]||0)+1
console.error('OBS:', rows.length, 'confidence dist:', JSON.stringify(dist))
console.error('outcomes:', JSON.stringify(rows.reduce((a,r)=>{a[r.parsed.outcome]=(a[r.parsed.outcome]||0)+1;return a},{})))
console.error('negated methods:', rows.filter(r=>r.parsed.methods.some(m=>m.negated)).map(r=>r.person).join(','))
console.error('LOW/fallback:', rows.filter(r=>r.parsed.llmFallbackSuggested).map(r=>`${r.person}:"${r.raw}"`).join(' | '))
