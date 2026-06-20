export const meta = {
  name: 'sonnet-vs-opus-card-judge',
  description: 'Generate DawnSky cards for 50 words with Sonnet and Opus, then Opus blind-judges each A/B pair',
  phases: [
    { title: 'Generate', detail: 'One Sonnet + one Opus card per word (100 cards)' },
    { title: 'Judge', detail: 'Opus blind-judges each randomized A/B pair' },
  ],
}

// 50 word objects baked in (deterministic every-100th sample of 5k_input/words.jsonl)
const WORDS_RAW = Array.isArray(args) ? args : (args && Array.isArray(args.words) ? args.words : null)
const words = WORDS_RAW || [{"hanzi":"阿姨","pinyin":"ā yí","cedict_en":"maternal aunt/step-mother/childcare worker/nursemaid/woman of similar age to one's parents (term of address used by child)","source":"hsk2.0-L3","freq_rank":4941},{"hanzi":"离开","pinyin":"lí kāi","cedict_en":"to depart; to leave","source":"hsk2.0-L3","freq_rank":571},{"hanzi":"保证","pinyin":"bǎo zhèng","cedict_en":"guarantee/to guarantee/to ensure/to safeguard/to pledge","source":"hsk2.0-L4","freq_rank":704},{"hanzi":"复印","pinyin":"fù yìn","cedict_en":"to photocopy/to duplicate a document","source":"hsk2.0-L4","freq_rank":21462},{"hanzi":"竞争","pinyin":"jìng zhēng","cedict_en":"to compete/competition","source":"hsk2.0-L4","freq_rank":1506},{"hanzi":"人民币","pinyin":"rén mín bì","cedict_en":"Renminbi, the official currency of the PRC (currency codes: RMB or CNY)","source":"hsk2.0-L4","freq_rank":1938},{"hanzi":"香","pinyin":"xiāng","cedict_en":"fragrant/sweet smelling/aromatic/savory or appetizing/(to eat) with relish/(of sleep) sound/perfume or spice/joss or incense stick","source":"hsk2.0-L4","freq_rank":3642},{"hanzi":"至少","pinyin":"zhì shǎo","cedict_en":"at least/(to say the) least","source":"hsk2.0-L4","freq_rank":879},{"hanzi":"财产","pinyin":"cái chǎn","cedict_en":"property/assets/estate","source":"hsk2.0-L5","freq_rank":1384},{"hanzi":"打听","pinyin":"dǎ ting","cedict_en":"to ask about/to make some inquiries/to ask around","source":"hsk2.0-L5","freq_rank":14309},{"hanzi":"分别","pinyin":"fēn bié","cedict_en":"to part; to leave each other/to distinguish; to tell apart/difference; distinction/separately; individually; respectively","source":"hsk2.0-L5","freq_rank":646},{"hanzi":"规则","pinyin":"guī zé","cedict_en":"rule; regulation/regular; orderly; fixed","source":"hsk2.0-L5","freq_rank":1218},{"hanzi":"讲究","pinyin":"jiǎng jiu","cedict_en":"to pay particular attention to/carefully selected for quality/tastefully chosen","source":"hsk2.0-L5","freq_rank":8416},{"hanzi":"老实","pinyin":"lǎo shi","cedict_en":"honest; sincere/well-behaved/naive; gullible","source":"hsk2.0-L5","freq_rank":4049},{"hanzi":"年纪","pinyin":"nián jì","cedict_en":"age","source":"hsk2.0-L5","freq_rank":3480},{"hanzi":"人类","pinyin":"rén lèi","cedict_en":"humanity/human race/mankind","source":"hsk2.0-L5","freq_rank":477},{"hanzi":"摔","pinyin":"shuāi","cedict_en":"to throw down/to fall/to drop and break","source":"hsk2.0-L5","freq_rank":6063},{"hanzi":"文学","pinyin":"wén xué","cedict_en":"literature","source":"hsk2.0-L5","freq_rank":1166},{"hanzi":"咬","pinyin":"yǎo","cedict_en":"to bite/to nip","source":"hsk2.0-L5","freq_rank":3874},{"hanzi":"睁","pinyin":"zhēng","cedict_en":"to open (one's eyes)","source":"hsk2.0-L5","freq_rank":14567},{"hanzi":"案例","pinyin":"àn lì","cedict_en":"case (of fraud, hepatitis, international cooperation etc); instance; example","source":"hsk2.0-L6","freq_rank":3427},{"hanzi":"边缘","pinyin":"biān yuán","cedict_en":"edge; fringe; verge; brink; periphery/marginal; borderline","source":"hsk2.0-L6","freq_rank":3377},{"hanzi":"草率","pinyin":"cǎo shuài","cedict_en":"careless/negligent/sloppy/not serious","source":"hsk2.0-L6","freq_rank":25110},{"hanzi":"储蓄","pinyin":"chǔ xù","cedict_en":"to save money (in a bank)/savings","source":"hsk2.0-L6","freq_rank":10647},{"hanzi":"地质","pinyin":"dì zhì","cedict_en":"geology","source":"hsk2.0-L6","freq_rank":3809},{"hanzi":"二氧化碳","pinyin":"èr yǎng huà tàn","cedict_en":"carbon dioxide CO2","source":"hsk2.0-L6","freq_rank":9972},{"hanzi":"腐败","pinyin":"fǔ bài","cedict_en":"corruption/to corrupt/to rot/rotten","source":"hsk2.0-L6","freq_rank":2487},{"hanzi":"骨干","pinyin":"gǔ gàn","cedict_en":"diaphysis (long segment of a bone)/fig. backbone","source":"hsk2.0-L6","freq_rank":7845},{"hanzi":"化肥","pinyin":"huà féi","cedict_en":"chemical fertilizer","source":"hsk2.0-L6","freq_rank":12874},{"hanzi":"坚韧","pinyin":"jiān rèn","cedict_en":"tough and durable/tenacious","source":"hsk2.0-L6","freq_rank":20545},{"hanzi":"精心","pinyin":"jīng xīn","cedict_en":"with utmost care/fine/meticulous/detailed","source":"hsk2.0-L6","freq_rank":7179},{"hanzi":"款待","pinyin":"kuǎn dài","cedict_en":"to entertain/to be hospitable to","source":"hsk2.0-L6","freq_rank":19095},{"hanzi":"轮胎","pinyin":"lún tāi","cedict_en":"tire; pneumatic tire","source":"hsk2.0-L6","freq_rank":8131},{"hanzi":"内幕","pinyin":"nèi mù","cedict_en":"inside story/non-public information/behind the scenes/internal","source":"hsk2.0-L6","freq_rank":7746},{"hanzi":"歧视","pinyin":"qí shì","cedict_en":"to discriminate against/discrimination","source":"hsk2.0-L6","freq_rank":3305},{"hanzi":"缺席","pinyin":"quē xí","cedict_en":"to be absent","source":"hsk2.0-L6","freq_rank":7816},{"hanzi":"生存","pinyin":"shēng cún","cedict_en":"to exist/to survive","source":"hsk2.0-L6","freq_rank":2007},{"hanzi":"思念","pinyin":"sī niàn","cedict_en":"to think of/to long for/to miss","source":"hsk2.0-L6","freq_rank":10354},{"hanzi":"徒弟","pinyin":"tú dì","cedict_en":"apprentice/disciple","source":"hsk2.0-L6","freq_rank":10189},{"hanzi":"勿","pinyin":"wù","cedict_en":"do not","source":"hsk2.0-L6","freq_rank":8615},{"hanzi":"刑事","pinyin":"xíng shì","cedict_en":"criminal; penal","source":"hsk2.0-L6","freq_rank":3796},{"hanzi":"要点","pinyin":"yào diǎn","cedict_en":"main point/essential","source":"hsk2.0-L6","freq_rank":7181},{"hanzi":"预言","pinyin":"yù yán","cedict_en":"to predict/prophecy","source":"hsk2.0-L6","freq_rank":5414},{"hanzi":"阵容","pinyin":"zhèn róng","cedict_en":"troop arrangement/battle formation/lineup (of a sports team etc)","source":"hsk2.0-L6","freq_rank":8283},{"hanzi":"主办","pinyin":"zhǔ bàn","cedict_en":"to organize/to host (a conference or sports event)","source":"hsk2.0-L6","freq_rank":3213},{"hanzi":"不能","pinyin":"bù néng","cedict_en":"cannot/must not/should not","source":"freq","freq_rank":117},{"hanzi":"的话","pinyin":"de huà","cedict_en":"if (coming after a conditional clause)","source":"freq","freq_rank":570},{"hanzi":"人数","pinyin":"rén shù","cedict_en":"number of people","source":"freq","freq_rank":997},{"hanzi":"体制","pinyin":"tǐ zhì","cedict_en":"system/organization","source":"freq","freq_rank":1314},{"hanzi":"安","pinyin":"Ān","cedict_en":"surname An | (bound form) calm; peaceful/to calm; to set at ease/safe; secure; in good health/content; satisfied/to place (sb) in a suitable position (job)/to install; to fix; to fit/ampere (abbr.)","source":"freq","freq_rank":1573}]

// ---- structured-output schema for a card (mirrors schema.json) ----
const CHAR = { type: 'object', properties: { hz: { type: 'string' }, py: { type: 'string' }, gloss: { type: 'string' }, role: { type: 'string' } }, required: ['hz', 'py', 'gloss'] }
const RAD = { type: 'object', properties: { hz: { type: 'string' }, name: { type: 'string' }, note: { type: 'string' } }, required: ['hz', 'name', 'note'] }
const SIT = { type: 'object', properties: { title: { type: 'string' }, setup: { type: 'string' }, line: { type: 'string' } }, required: ['title', 'setup', 'line'] }
const EX = { type: 'object', properties: { cn: { type: 'string' }, py: { type: 'string' }, ru: { type: 'string' }, note: { type: 'string' } }, required: ['cn', 'py', 'ru'] }
const CARD_SCHEMA = {
  type: 'object',
  properties: {
    hanzi: { type: 'string' },
    pinyin: { type: 'string' },
    meaning_ru: { type: 'string' },
    meaning_en: { type: 'string' },
    characters: { type: 'array', items: CHAR },
    radicals: { type: 'array', items: RAD },
    deep_dive: { type: 'string' },
    situations: { type: 'array', items: SIT },
    examples: { type: 'array', minItems: 2, maxItems: 5, items: EX },
    footer_note: { type: 'string' },
  },
  required: ['hanzi', 'pinyin', 'meaning_ru', 'meaning_en', 'examples'],
}

const SCORE = { type: 'object', properties: { accuracy: { type: 'number' }, legend_culture: { type: 'number' }, mnemonics: { type: 'number' }, usefulness: { type: 'number' }, richness: { type: 'number' } }, required: ['accuracy', 'usefulness', 'richness'] }
const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    winner: { type: 'string', enum: ['A', 'B', 'tie'] },
    reasoning: { type: 'string', description: '2-4 sentences on why this winner, grounded in the sections' },
    scores: { type: 'object', properties: { A: SCORE, B: SCORE }, required: ['A', 'B'] },
    A_accuracy_fail: { type: 'boolean', description: 'true if card A has a wrong tone / wrong meaning / garbled example' },
    B_accuracy_fail: { type: 'boolean' },
    A_dry: { type: 'boolean', description: 'true if card A is stripped/lifeless, losing the house character for no good reason' },
    B_dry: { type: 'boolean' },
    A_false: { type: 'array', items: { type: 'string' }, description: 'quotes of flatly-asserted UNFRAMED invented facts in A (empty if none)' },
    B_false: { type: 'array', items: { type: 'string' } },
  },
  required: ['winner', 'reasoning', 'scores', 'A_accuracy_fail', 'B_accuracy_fail', 'A_dry', 'B_dry', 'A_false', 'B_false'],
}

function genPrompt(w) {
  return [
    'You are generating exactly ONE vocabulary info card for the DawnSky project (Chinese words explained for a Russian-speaking learner). Russian is primary, English secondary.',
    '',
    'STEP 1 - Read these on-disk project files to absorb the exact house style and schema; they are the authoritative spec and the quality bar:',
    '  - CLAUDE.md  (full style guide)',
    '  - schema.json  (field definitions)',
    '  - every file in examples/  (the four sample cards) - match their tone, warmth, and depth.',
    'If you cannot read them, follow the condensed rules below, which restate the same spec.',
    '',
    'STEP 2 - Generate the card for THIS WORD ONLY:',
    '  ' + JSON.stringify(w),
    'cedict_en is only a raw seed - polish it into natural Russian + English, do not copy it verbatim.',
    '',
    'HARD RULES (defects if broken):',
    '  - hanzi, pinyin (with tone marks), meaning_ru, meaning_en, and every example must be CORRECT. No wrong tones, no wrong meanings.',
    '  - 2-5 examples, simpler ones first; wrap the target word in {hl}...{/hl}; give full sentence pinyin and natural Russian; use high-frequency words at or below the target level.',
    '  - meaning_ru / meaning_en must read as natural language, not translationese.',
    '',
    'STYLE:',
    '  - Warm, concise, intimate - like explaining to a close friend. Lowercase feel. No exclamation marks in Russian/English prose (Chinese example sentences may use them where natural).',
    '  - deep_dive: HTML using only <p> and <strong>; 2-4 short paragraphs; explain the FEEL, not just the meaning.',
    '  - Etymology & legends: a vivid popular/folk story is welcome but MUST be framed as one (for example "есть легенда...", "говорят...", "народная этимология"). Never assert invented history or dates as plain fact.',
    '  - Mnemonics: invented associations are good when framed as memory aids (for example "чтобы запомнить, представь...").',
    '  - radicals: memorable AND accurate mnemonics; describe visual position (левая часть / верх / низ).',
    '  - situations: the title may use ONLY these emoji: the four-pointed star, the cloud, the sparkle, the red lantern; 1-3 items.',
    '',
    'WHICH SECTIONS TO INCLUDE (omit anything not genuinely interesting AND accurate - a correct short card beats padding):',
    '  - single char: skip characters; radicals only if interesting; deep_dive yes; 1-2 situations.',
    '  - compound (2+ chars): characters yes; radicals if interesting; deep_dive yes; 1-2 situations.',
    '  - abstract particle / grammar word: skip characters & radicals; deep_dive focused on WHEN/WHY to use; 2-3 situations.',
    '  - footer_note: one line including the HSK level / source from the input.',
    '',
    'OUTPUT: return the card ONLY through the structured-output tool, matching the schema. Do NOT write any files, do NOT run build.py, do NOT modify cards_json/.',
  ].join('\n')
}

function judgePrompt(w, cardA, cardB) {
  return [
    'You are the OPUS JUDGE for the DawnSky card project. Two cards (A and B) were generated for the SAME word from the SAME CLAUDE.md style guide by two different models. The order is randomized; you do NOT know which model wrote which. Judge BLIND - never guess or mention the model.',
    '',
    'WORD + GROUND TRUTH for the accuracy floor:',
    '  hanzi: ' + w.hanzi,
    '  reference pinyin (CC-CEDICT): ' + w.pinyin,
    '  reference gloss (CC-CEDICT raw seed): ' + w.cedict_en,
    '  source: ' + w.source,
    '',
    'Apply the CLAUDE.md criteria, scoring EACH card 1-5 per section:',
    '  - ACCURACY (HARD FLOOR): pinyin tones, meaning_ru/meaning_en, and examples must be CORRECT. A wrong tone, a wrong meaning, or a garbled / ungrammatical / unreadable Chinese example is an AUTOMATIC loss for that card - set its accuracy_fail=true. Check the Chinese is well-formed and that the pinyin and Russian match it. Use the reference gloss and your own Mandarin knowledge.',
    '  - LEGEND & CULTURE: a vivid popular legend / folk-etymology FRAMED as one ("говорят...", "есть легенда...", "народная этимология") is FINE and a PLUS. Only a flatly-asserted, UNFRAMED invented fact (made-up history or dates stated as plain truth) counts AGAINST a card - list each such sentence in the *_false array (quote it). Do NOT put framed legends or framed mnemonics in *_false.',
    '  - MNEMONICS: an invented association framed as a memory aid is GOOD, not a fault.',
    '  - USEFULNESS: meanings natural (not translationese); examples use simpler/common words and read cleanly.',
    '  - RICHNESS WHERE WARRANTED: reward a real, vivid deep_dive; do NOT reward padding/filler; do NOT penalize a correctly-short card. Mark *_dry=true ONLY if a card is stripped/lifeless and lost the house character for no good reason.',
    '',
    'CARD A:',
    JSON.stringify(cardA, null, 2),
    '',
    'CARD B:',
    JSON.stringify(cardB, null, 2),
    '',
    'Pick a winner (A, B, or tie). If exactly one card fails the accuracy floor, the other wins. Give 2-4 sentences of reasoning grounded in the sections. Return ONLY via the structured tool.',
  ].join('\n')
}

// deterministic, content-derived A/B order flip so position bias is spread across words
function flipFor(hanzi) {
  let s = 0
  for (const ch of hanzi) s += ch.codePointAt(0)
  return s % 2 === 1
}

phase('Generate')
const results = await pipeline(
  words,
  // stage 1: generate both cards concurrently (same prompt, different model)
  async (w) => {
    const [sonnet, opus] = await Promise.all([
      agent(genPrompt(w), { model: 'sonnet', schema: CARD_SCHEMA, phase: 'Generate', label: 'gen S ' + w.hanzi }),
      agent(genPrompt(w), { model: 'opus', schema: CARD_SCHEMA, phase: 'Generate', label: 'gen O ' + w.hanzi }),
    ])
    return { w, sonnet, opus }
  },
  // stage 2: blind judge
  async (g) => {
    if (!g) return null
    if (!g.sonnet || !g.opus) return { hanzi: g.w.hanzi, source: g.w.source, error: 'generation_failed', sonnet: g.sonnet || null, opus: g.opus || null }
    const flip = flipFor(g.w.hanzi)
    const cardA = flip ? g.opus : g.sonnet
    const cardB = flip ? g.sonnet : g.opus
    const aModel = flip ? 'opus' : 'sonnet'
    const bModel = flip ? 'sonnet' : 'opus'
    const v = await agent(judgePrompt(g.w, cardA, cardB), { model: 'opus', effort: 'high', schema: VERDICT_SCHEMA, phase: 'Judge', label: 'judge ' + g.w.hanzi })
    if (!v) return { hanzi: g.w.hanzi, source: g.w.source, error: 'judge_failed', sonnet: g.sonnet, opus: g.opus }
    const pick = (slotA, slotB) => ({ sonnet: aModel === 'sonnet' ? slotA : slotB, opus: aModel === 'opus' ? slotA : slotB })
    const winnerModel = v.winner === 'tie' ? 'tie' : (v.winner === 'A' ? aModel : bModel)
    return {
      hanzi: g.w.hanzi,
      source: g.w.source,
      aModel, bModel, flip,
      winner: v.winner,
      winnerModel,
      reasoning: v.reasoning,
      scores: pick(v.scores.A, v.scores.B),
      accuracy_fail: pick(v.A_accuracy_fail, v.B_accuracy_fail),
      dry: pick(v.A_dry, v.B_dry),
      false_facts: pick(v.A_false, v.B_false),
      sonnet: g.sonnet,
      opus: g.opus,
    }
  },
)

const clean = results.filter(Boolean)
let sWins = 0, oWins = 0, ties = 0, errors = 0
for (const r of clean) {
  if (r.error) { errors++; continue }
  if (r.winnerModel === 'sonnet') sWins++
  else if (r.winnerModel === 'opus') oWins++
  else ties++
}
log('Done: sonnet ' + sWins + ' | opus ' + oWins + ' | tie ' + ties + ' | errors ' + errors)
return { sWins, oWins, ties, errors, count: clean.length, results: clean }
