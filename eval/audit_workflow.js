export const meta = {
  name: 'dawnsky-audit',
  description: 'Blind-verify a random sample of generated DawnSky cards against CC-CEDICT ground truth; focus on componentry + tone accuracy',
  phases: [
    { title: 'Verify', detail: 'one Opus verifier per sampled card' },
  ],
}

// args = { samples: [ {hanzi, pinyin, cedict_en, source, freq_rank}, ... ] }
// I (the orchestrator) pick the random sample from the filesystem and pass the
// authoritative input record as accuracy ground truth.

const VERIFY_SCHEMA = {
  type: 'object',
  required: ['hanzi', 'verdict', 'scores', 'defects'],
  properties: {
    hanzi: { type: 'string' },
    verdict: { type: 'string', enum: ['pass', 'minor', 'fail'], description: 'pass = clean; minor = small issue not a hard-fact error; fail = a hard-fact error (wrong pinyin/meaning/ungrammatical example) OR a flatly-asserted false componentry/etymology claim' },
    scores: {
      type: 'object',
      required: ['accuracy', 'complementarity', 'examples', 'componentry', 'framing'],
      properties: {
        accuracy: { type: 'integer', minimum: 1, maximum: 5, description: 'pinyin tones + meaning correct vs ground truth' },
        complementarity: { type: 'integer', minimum: 1, maximum: 5, description: 'meaning_ru and meaning_en complement (not literal echoes)' },
        examples: { type: 'integer', minimum: 1, maximum: 5, description: 'examples grammatical, readable, {hl} present, pinyin matches' },
        componentry: { type: 'integer', minimum: 1, maximum: 5, description: 'radical/character claims correct for the SIMPLIFIED glyph (5 if no componentry claimed)' },
        framing: { type: 'integer', minimum: 1, maximum: 5, description: 'legends/etymology framed as legend, not asserted; emoji within ✦ ☁ ✧ 🏮' },
      },
    },
    defects: {
      type: 'array',
      items: {
        type: 'object',
        required: ['kind', 'detail'],
        properties: {
          kind: { type: 'string', enum: ['pinyin', 'meaning', 'example', 'componentry', 'framing', 'emoji', 'schema', 'other'] },
          detail: { type: 'string', description: 'specific, quotable description of the problem and the correct value' },
        },
      },
      description: 'empty if clean',
    },
  },
}

const PREFIX = [
  'You are a strict, blind QUALITY AUDITOR for DawnSky Chinese-vocabulary cards aimed at Russian-speaking learners. You did NOT write these cards. Be skeptical and specific. Default to flagging when unsure about a factual claim.',
  '',
  'You will be given (a) the authoritative input record for one word (its CC-CEDICT pinyin + gloss seed + HSK source — treat pinyin and the core gloss as GROUND TRUTH for accuracy), and (b) the path to the generated card JSON. Read the card file and judge it on these dimensions:',
  '',
  '1) ACCURACY (hard floor): Does the card pinyin match the ground-truth pinyin (tones included)? Does meaning_ru / meaning_en correctly capture the ground-truth sense? A wrong tone or a wrong/invented meaning is a FAIL.',
  '2) COMPLEMENTARITY: Do meaning_ru and meaning_en COMPLEMENT each other (each adds a nuance/register the other misses), rather than being literal echoes? Pure echo = low score, not a fail.',
  '3) EXAMPLES: Are all examples grammatical and natural Chinese, readable for a learner, with the target word wrapped in {hl}...{/hl}, and does each py (pinyin) actually match its cn sentence and ru translation? An ungrammatical example or a pinyin/character mismatch is a FAIL.',
  '4) COMPONENTRY (the #1 known defect): For every radical/character claim, mentally decompose the SIMPLIFIED glyph. Flag any component attributed that is only present in the TRADITIONAL form or is simply absent. Known traps: 听 left is 口 not 耳; simplified 复 has no 彳; simplified 产 has no 生; 实 has no 土 (it is 宀+头); 币 bottom is 巾 not 贝. A flatly-asserted false componentry claim is a FAIL. If the card claims NO componentry, score 5.',
  '5) FRAMING: Is any etymology/legend that is contested or invented FRAMED as a legend ("говорят…", "есть легенда…", "народная этимология") rather than asserted as plain fact? An invented specific asserted flatly is a FAIL. Also check emoji: situation titles may use ONLY ✦ ☁ ✧ 🏮; any other emoji is a defect.',
  '',
  'Also sanity-check schema basics: required fields present (hanzi, pinyin, meaning_ru, examples with 2-5 items), deep_dive uses only <p>/<strong>.',
  '',
  'Return the structured verdict. verdict=fail ONLY for a hard-fact error or a flatly-asserted falsehood; verdict=minor for smaller issues (weak complementarity, thin card, stylistic slip); verdict=pass if clean. Put every concrete problem in defects with the CORRECT value quoted.',
].join('\n')

phase('Verify')

let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch (e) { A = {} } }
A = A || {}
const samples = (A && A.samples) ? A.samples : []
log('auditing ' + samples.length + ' sampled cards')

const verdicts = await parallel(samples.map((w) => () => {
  const gt = 'GROUND-TRUTH INPUT RECORD:\n' + JSON.stringify(w) +
    '\n\nCARD TO AUDIT: read the file cards_json/' + w.hanzi + '.json and verify it.'
  return agent(PREFIX + '\n\n' + gt, { label: 'audit:' + w.hanzi, phase: 'Verify', agentType: 'claude', schema: VERIFY_SCHEMA })
}))

const ok = verdicts.filter(Boolean)
const fails = ok.filter((v) => v.verdict === 'fail')
const minors = ok.filter((v) => v.verdict === 'minor')
log('audit done: ' + ok.length + ' judged, ' + fails.length + ' FAIL, ' + minors.length + ' minor')

return { judged: ok.length, fails, minors, all: ok }
