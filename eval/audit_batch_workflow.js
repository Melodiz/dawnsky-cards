export const meta = {
  name: 'dawnsky-audit-batch',
  description: 'Broad Opus audit of generated cards, ~10 per agent; flags hard-fact fails for regeneration',
  phases: [
    { title: 'Audit', detail: 'one Opus agent per audit-shard of ~10 cards; verify each vs CC-CEDICT ground truth' },
  ],
}

// args = { start, end, label, dir, model }
// Audit shards live in `dir` (default 5k_input/audit_shards/), shard_NNN.jsonl,
// one ground-truth record per line: {hanzi, pinyin, cedict_en, source, freq_rank}.

let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch (e) { A = {} } }
A = A || {}
const start = (typeof A.start === 'number') ? A.start : 0
const end = (typeof A.end === 'number') ? A.end : 1
const label = A.label ? A.label : 'audit'
const dir = A.dir ? A.dir : '5k_input/audit_shards/'
const model = A.model ? A.model : 'opus'

const PREFIX = [
  'You are a strict, blind QUALITY AUDITOR for DawnSky Chinese-vocabulary cards aimed at Russian-speaking learners. You did NOT write these cards. Be skeptical, specific, and give EACH card genuine scrutiny — do not rubber-stamp.',
  '',
  'Your shard file lists several words, one JSON ground-truth record per line: {hanzi, pinyin (authoritative CC-CEDICT pinyin), cedict_en (gloss seed), source}. For EACH word: read cards_json/{hanzi}.json and judge it on:',
  '',
  '1) ACCURACY (hard floor): card pinyin matches ground-truth pinyin incl. tones; meaning_ru/meaning_en correctly capture the core ground-truth sense. Wrong tone or wrong/invented meaning = FAIL.',
  '2) EXAMPLES (hard floor): every example is grammatical, natural Chinese, readable, target word wrapped in {hl}...{/hl}; each py matches its cn and ru. Ungrammatical example, invented collocation, or pinyin/character mismatch = FAIL. (Watch tone-changing polyphones, e.g. 晕 yūn vs 晕车 yùn.)',
  '3) COMPONENTRY: every radical/character claim must be correct for the SIMPLIFIED glyph (听 left 口 not 耳; 复 no 彳; 产 no 生; 实 no 土; 币 bottom 巾 not 贝). A flatly-asserted false componentry claim = FAIL. No claims => fine.',
  '4) FRAMING (hard floor for fabrication): any contested/invented etymology must be framed as legend ("говорят…", "есть легенда…"). An invented specific asserted as plain fact = FAIL. Common trap: conflating look-alike characters (e.g. 已 yǐ "already" vs 巳 sì the snake earthly-branch).',
  '5) HYGIENE (minor unless severe): deep_dive uses only <p>/<strong>; no stray Chinese characters glued inside Russian words (mojibake); no internal field names (freq_rank) in prose; emoji only ✦ ☁ ✧ 🏮; meaning_ru/en should complement, not echo.',
  '',
  'verdict=fail ONLY for a hard-fact error (wrong pinyin/meaning, ungrammatical/invented example, false componentry, or fabricated fact asserted flatly). verdict=minor for hygiene/complementarity/style issues. verdict=pass if clean.',
  'Set hardfix=true when the defect CANNOT be fixed by a mechanical script (i.e. needs regeneration): wrong tone/meaning, bad example, fabricated etymology. Set hardfix=false for pure hygiene (tags/freq_rank/spacing/echoey meaning).',
  'Return one verdict object per word.',
].join('\n')

const SCHEMA = {
  type: 'object',
  required: ['shard', 'verdicts'],
  properties: {
    shard: { type: 'string' },
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        required: ['hanzi', 'verdict', 'hardfix', 'defects'],
        properties: {
          hanzi: { type: 'string' },
          verdict: { type: 'string', enum: ['pass', 'minor', 'fail'] },
          hardfix: { type: 'boolean', description: 'true if it needs regeneration (not script-fixable)' },
          defects: {
            type: 'array',
            items: {
              type: 'object',
              required: ['kind', 'detail'],
              properties: {
                kind: { type: 'string', enum: ['pinyin', 'meaning', 'example', 'componentry', 'framing', 'hygiene', 'other'] },
                detail: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
}

phase('Audit')

const shardIdx = []
for (let i = start; i < end; i++) shardIdx.push(i)
log(`${label}: auditing shards ${start}..${end - 1} from ${dir} with model=${model}`)

const results = await parallel(shardIdx.map((i) => () => {
  const name = 'shard_' + String(i).padStart(3, '0') + '.jsonl'
  const prompt = PREFIX + '\n\n== YOUR SHARD ==\nRead ' + dir + name +
    ' (one ground-truth word per line). For EACH word, read cards_json/{hanzi}.json and audit it. Return one verdict per word.'
  return agent(prompt, { label: label + ':' + name, phase: 'Audit', agentType: 'claude', model, schema: SCHEMA })
}))

const ok = results.filter(Boolean)
const all = ok.flatMap((r) => r.verdicts || [])
const fails = all.filter((v) => v.verdict === 'fail')
const hardfix = all.filter((v) => v.hardfix)
log(`${label}: ${all.length} cards judged, ${fails.length} FAIL, ${hardfix.length} need regen`)

return { label, judged: all.length, fails, hardfix, all }
