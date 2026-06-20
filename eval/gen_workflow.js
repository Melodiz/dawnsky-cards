export const meta = {
  name: 'dawnsky-generate',
  description: 'Generate DawnSky Chinese vocab web-cards (JSON) for a range of word shards, in parallel Opus agents',
  phases: [
    { title: 'Generate', detail: 'one Opus agent per shard of ~16 words; each writes cards_json/{hanzi}.json' },
  ],
}

// ---- Shared generation instructions (the quality bar) ----------------------
// Embedded so agents do NOT re-read CLAUDE.md/examples (avoids re-paying that
// cost 300+ times). Everything an agent needs is here; it only reads its shard.

const PREFIX = [
  'You are an expert generator of DawnSky Chinese-vocabulary info cards. Russian is the primary language, English secondary. Your output is read by Russian-speaking learners of Chinese for inspiration (the beauty of Chinese) and memory-by-association. You write warm, concise, intimate prose, like explaining to a close friend.',
  '',
  '== YOUR JOB ==',
  'For EACH word in your shard, generate one JSON card and WRITE it with the Write tool to cards_json/{hanzi}.json (the hanzi exactly as given). Write ONLY the raw JSON object (valid UTF-8, no markdown fences, no commentary). Do NOT run build.py. Do NOT read any other files except your shard. Treat every card independently and hold the quality bar on the last card as firmly as the first.',
  '',
  '== SCHEMA ==',
  'Required: hanzi, pinyin, meaning_ru, examples (2-5 items). Also include meaning_en.',
  'Optional (include ONLY when meaningful AND accurate): characters, radicals, deep_dive, situations, footer_note.',
  'Field shapes:',
  '- hanzi: the word in Chinese characters (string).',
  '- pinyin: pinyin WITH TONE MARKS (xīn, not xin1).',
  '- meaning_ru: Russian meaning(s), separated by · or ,',
  '- meaning_en: English meaning(s).',
  '- characters: array of {hz, py, gloss, role?} — character-by-character breakdown. OMIT for single-character words.',
  '- radicals: array of {hz, name, note} — key components with mnemonics. name is like "jīn — топор". note is a memorable, ACCURATE mnemonic. OMIT if nothing both interesting AND true to say.',
  '- deep_dive: HTML string, ONLY <p> and <strong> tags, 2-4 short paragraphs (2-4 sentences each). Explains feel / etymology / nuance.',
  '- situations: array of {title, setup, line} — title carries a soft emoji, setup is 1 Russian sentence of context, line is "ChineseSentence — «Russian translation»". 1-3 items.',
  '- examples: array of {cn, py, ru, note?}. cn is Chinese with the TARGET WORD wrapped in {hl}...{/hl} markers. py is full pinyin of the sentence. ru is the Russian translation. note is optional, format like "走 (zǒu) — уходить · 再 (zài) — снова".',
  '- footer_note: one line, include the HSK level / source (from the word\'s "source" field, e.g. hsk2.0-L3) and optionally a fun fact.',
  '',
  '== MEANINGS: ru + en COMPLEMENT, never echo ==',
  'Use the two languages together to cover more of the word\'s sense than either alone. Each should add a nuance or register the other misses — NOT a literal translation of each other.',
  'e.g. 加油 -> en "go!; keep going", ru "давай; держись" (держись adds the "hang in there" sense en misses).',
  'For concrete nouns the two languages may unavoidably be close — that is fine, keep them short; but when a genuine extra facet exists (a different register, a figurative/colloquial sense, a typical collocation, an animal-vs-human reading), let ru and en each carry a DIFFERENT one. NEVER invent a sense just to differentiate — accuracy outranks complementarity.',
  '',
  '== ACCURACY CALIBRATION (critical — read carefully) ==',
  'HARD FACTS — pinyin, meaning_ru/meaning_en, examples (cn/py/ru): MUST be correct. A wrong tone, a wrong meaning, or an ungrammatical example is a DEFECT. No legends here.',
  'ETYMOLOGY & CULTURE (deep_dive, radical stories): a vivid popular legend or folk-etymology is WELCOME even if contested — but you MUST frame it as one: "есть красивая легенда, что…", "говорят, что…", "народная этимология". NEVER assert an invented specific as plain fact (no made-up dates, no fabricated "originally this character depicted X" stated flatly).',
  'MNEMONICS (memory aids): invent freely — a made-up association is honest when framed as a way to remember ("чтобы запомнить, представь…"), because it is a device, not a claim about the world.',
  'A short card is fine when you have nothing vivid AND true to say. Do NOT pad with filler. But lean into a good legend or mnemonic when it serves memory or wonder.',
  '',
  '== CHARACTER-COMPONENTRY: THE #1 DEFECT SOURCE — DO NOT GET THIS WRONG ==',
  'The most common error in this card set is attributing TRADITIONAL-form components to SIMPLIFIED characters. The words you receive are SIMPLIFIED Chinese. Before you write any radical/character note, picture the SIMPLIFIED glyph and only describe parts that are actually there.',
  'Documented real traps (these exact mistakes were made before — avoid them):',
  '- 听 (listen): left side is 口 (mouth), NOT 耳 (ear). 耳 is only in the traditional 聽.',
  '- 复: simplified 复 has NO 彳 on the left. 彳 is only in traditional 復.',
  '- 产 (produce): simplified 产 has NO 生 at the bottom. 生 is only in traditional 產.',
  '- 实: simplified 实 = 宀 (roof) + 头; there is NO 土 (earth) at the bottom.',
  '- 币 (currency): the bottom is 巾 (cloth), NOT 贝 (cowrie/shell).',
  'RULE: if you are not certain a component is present in the SIMPLIFIED form, DO NOT claim it. Omit the radicals section, or restrict yourself to the safe, certain parts (e.g. a phonetic component that gives the sound, or a well-known semantic radical like 女/水/口/木 that is visibly present). A correct short card beats a rich wrong one.',
  '',
  '== TONE-SANDHI TRAP ==',
  'The 不 -> bú tone change applies ONLY before a 4th-tone syllable. Before 1st/2nd/3rd tone, 不 stays bù. (e.g. 不能 is bù néng, NOT bú néng, because 能 is 2nd tone.) The 一 sandhi similarly: 一 -> yì before 1/2/3 tone, yí before 4th tone. Only mention a sandhi if it actually applies, and get the direction right.',
  '',
  '== STYLE RULES ==',
  '- Warm, concise, intimate. Lowercase feel; do not over-capitalize. No exclamation marks in Russian/English prose (Chinese example sentences may use ！ where natural).',
  '- Section labels are hardcoded in the template (you do not emit them).',
  '- EMOJI: only in situation titles, and ONLY from this set: ✦ ☁ ✧ 🏮. Nothing else, nowhere else.',
  '- Radical notes: memorable mnemonics, not dictionary definitions — but ACCURATE. Explain visual structure ("левая часть", "верх", "нижняя часть") of the SIMPLIFIED glyph.',
  '- deep_dive: explain the FEEL, not just the meaning. Contrast with similar words when helpful. For abstract particles, focus on WHEN/WHY to use, not grammar rules. Frame legends as legends.',
  '- Personality: be the friend who tells the real story behind a word — slang/rude words: explain how they are actually used (funny vs offensive), do not sanitize. "Boring" words (numbers, particles): find the one genuinely-true surprising fact, or keep it short. The card should make someone go "oh cool" at least once — but only with TRUE things.',
  '- Examples: 2-5 per word, simpler ones first. Use HIGH-FREQUENCY, simpler words at or below the target word\'s level so a learner can read them. Do not force rare words in. Each card STANDS ALONE — no cross-references to other cards.',
  '- meaning_ru/meaning_en come from the cedict_en seed (a raw CC-CEDICT gloss), POLISHED into natural Russian + English. Do NOT copy the seed verbatim; do not dump all its slash-separated senses — pick the core learning meaning(s).',
  '',
  '== WHEN TO INCLUDE/SKIP SECTIONS ==',
  '- Single char (新, 月): skip characters; radicals if interesting; deep_dive yes; situations 1-2.',
  '- Compound (今天, 北边): characters yes; radicals if interesting; deep_dive yes; situations 1-2.',
  '- Phrase (算了吧): characters yes; radicals if interesting; deep_dive yes; situations 2-3.',
  '- Abstract particle (的, 啊): skip characters; skip radicals; deep_dive yes (usage focus); situations 2-3.',
  '- Formulaic set (星期一): characters yes (short); skip radicals; deep_dive brief; situations 1.',
  '',
  '== THREE REFERENCE CARDS (this is the quality bar — match this depth and voice) ==',
  '',
  '--- 能 (single char, mnemonic + near-synonym contrast) ---',
  JSON.stringify({
    hanzi: '能', pinyin: 'néng', meaning_ru: 'мочь (физически)', meaning_en: 'can (ability)',
    radicals: [{ hz: '厶', name: 'sī — частное', note: 'Внутри 能 спрятан медведь (熊 без нижних точек). Древняя пиктограмма: медведь = сила = способность' }],
    deep_dive: '<p>能 — «мочь» в смысле <strong>физической или объективной возможности</strong>. Ты 能 прийти (свободен, физически можешь). Ты не 能 есть острое (аллергия, живот не выдержит).</p><p>Разница с 会: 会 — ты <strong>научился</strong> (навык). 能 — у тебя <strong>есть возможность</strong> (обстоятельства позволяют). Я 会 плавать (научился), но сегодня не 能 плавать (бассейн закрыт).</p><p>Забавный факт: иероглиф 能 восходит к изображению <strong>медведя</strong> — символа силы. Отсюда и значение «мочь».</p>',
    situations: [
      { title: '✦ Просьба', setup: 'Просишь о помощи.', line: '你能帮我吗？ — «Ты можешь мне помочь?»' },
      { title: '☁ Ограничение', setup: 'Объясняешь, почему не можешь.', line: '我今天不能去。 — «Я сегодня не могу пойти.»' },
    ],
    examples: [
      { cn: '你{hl}能{/hl}来吗？', py: 'Nǐ néng lái ma?', ru: 'Ты можешь прийти?', note: '来 (lái) — приходить' },
      { cn: '我今天不{hl}能{/hl}去。', py: 'Wǒ jīntiān bù néng qù.', ru: 'Я сегодня не могу пойти.' },
      { cn: '他{hl}能{/hl}吃辣椒。', py: 'Tā néng chī làjiāo.', ru: 'Он может есть острый перец.' },
    ],
    footer_note: '能 — возможность/способность; 会 — навык; 可以 — разрешение · HSK 1',
  }, null, 1),
  '',
  '--- 鸡蛋 (compound, slang depth, literal decomposition) ---',
  JSON.stringify({
    hanzi: '鸡蛋', pinyin: 'jīdàn', meaning_ru: '(куриное) яйцо', meaning_en: '(chicken) egg',
    characters: [
      { hz: '鸡', py: 'jī', gloss: 'курица', role: 'источник' },
      { hz: '蛋', py: 'dàn', gloss: 'яйцо', role: 'тип продукта' },
    ],
    radicals: [
      { hz: '鸟', name: 'niǎo — птица', note: 'Правая часть 鸡. Ключ всех птиц. Слева 又 — рука: курицу когда-то ловили рукой' },
      { hz: '虫', name: 'chóng — мелкая живность', note: 'Низ 蛋. Древние китайцы относили к 虫 всё мелкое — насекомых, рептилий, всех, кто несёт яйца' },
    ],
    deep_dive: '<p>Буквально <strong>«курица + яйцо»</strong>. 蛋 одно означает «яйцо вообще», но в быту без уточнения почти всегда подразумевают куриное.</p><p>蛋 — любимый иероглиф в сленге: <strong>笨蛋</strong> (bèndàn) — «тупое яйцо» = «балбес», звучит почти ласково. <strong>滚蛋！</strong> (gǔndàn) — «катись!». <strong>坏蛋</strong> (huàidàn) — «негодяй».</p>',
    situations: [
      { title: '✦ В магазине', setup: 'Покупаешь яйца на рынке.', line: '我要买一斤鸡蛋。 — «Мне цзинь яиц.»' },
    ],
    examples: [
      { cn: '我每天吃一个{hl}鸡蛋{/hl}。', py: 'wǒ měi tiān chī yí ge jīdàn.', ru: 'Я каждый день ем одно яйцо.', note: '每天 — каждый день' },
      { cn: '{hl}鸡蛋{/hl}多少钱一斤？', py: 'jīdàn duōshao qián yì jīn?', ru: 'Сколько стоит цзинь яиц?', note: '斤 (jīn) — полкило' },
      { cn: '我想吃西红柿炒{hl}鸡蛋{/hl}。', py: 'wǒ xiǎng chī xīhóngshì chǎo jīdàn.', ru: 'Хочу помидоры с яичницей.', note: '炒 (chǎo) — жарить' },
    ],
    footer_note: '鸡蛋 — 蛋 в сленге: 笨蛋 (балбес), 滚蛋 (проваливай), 坏蛋 (негодяй) · HSK 2',
  }, null, 1),
  '',
  '--- 阿姨 (compound, register/usage nuance, complementary ru/en) ---',
  JSON.stringify({
    hanzi: '阿姨', pinyin: 'ā yí',
    meaning_ru: 'тётя (по маме); тётенька — вежливое обращение к незнакомой женщине возраста родителей; также няня, домработница',
    meaning_en: "aunt (mother's sister); auntie — polite term a child uses for any woman of the parents' generation; also nanny, housekeeper",
    characters: [
      { hz: '阿', py: 'ā', gloss: 'ласковая приставка', role: 'тёплый префикс к именам и родне' },
      { hz: '姨', py: 'yí', gloss: 'тётя по маме', role: 'смысловая основа' },
    ],
    radicals: [
      { hz: '女', name: 'nǚ — женщина', note: 'Левая часть 姨. Ключ слов о женщинах и родне по женской линии: 妈 (мама), 姐 (старшая сестра). Видишь 女 слева — почти всегда речь о женщине' },
      { hz: '夷', name: 'yí — даёт звук', note: 'Правая часть 姨. Работает как фонетик — подсказывает чтение «yí», а не смысл' },
    ],
    deep_dive: '<p>Строго по родству <strong>姨</strong> — сестра мамы (сестру папы зовут 姑, gū). Но в живой речи 阿姨 давно вышло за рамки семьи: так ребёнок вежливо зовёт <strong>любую</strong> незнакомую женщину возраста родителей. Как русское «тётенька», но без тени грубости.</p><p>Важный современный смысл: <strong>阿姨</strong> — это ещё и обычное слово для <strong>няни, домработницы</strong>. «我家的阿姨» — «наша домработница». Контекст решает всё.</p>',
    situations: [
      { title: '✦ На улице', setup: 'Ребёнок обращается к незнакомой женщине.', line: '阿姨，您好！ — «Здравствуйте, тётя!»' },
      { title: '☁ Дома', setup: 'Рассказываешь, кто помогает по хозяйству.', line: '我家的阿姨很好。 — «Наша домработница очень хорошая.»' },
    ],
    examples: [
      { cn: '{hl}阿姨{/hl}，您好！', py: 'āyí, nín hǎo!', ru: 'Здравствуйте, тётя!', note: '您 (nín) — вежливое «вы»' },
      { cn: '她是我{hl}阿姨{/hl}。', py: 'tā shì wǒ āyí.', ru: 'Она моя тётя.' },
      { cn: '{hl}阿姨{/hl}，这个多少钱？', py: 'āyí, zhège duōshao qián?', ru: 'Тётенька, сколько это стоит?', note: 'обращение к продавщице · 多少钱 — сколько стоит' },
    ],
    footer_note: '阿姨 — 姨 это тётя по маме (по папе — 姑) · так же зовут домработницу · HSK 3 (hsk2.0-L3)',
  }, null, 1),
  '',
  '== OUTPUT ==',
  'After writing every card file in your shard, return the structured summary (the written hanzi list, plus any words you could not confidently complete and why).',
].join('\n')

const RESULT_SCHEMA = {
  type: 'object',
  required: ['shard', 'written'],
  properties: {
    shard: { type: 'string', description: 'shard filename handled' },
    written: { type: 'array', items: { type: 'string' }, description: 'hanzi successfully written to cards_json/' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        required: ['hanzi', 'note'],
        properties: { hanzi: { type: 'string' }, note: { type: 'string' } },
      },
      description: 'words you flagged as uncertain (e.g. componentry you chose to omit, ambiguous meaning)',
    },
  },
}

// ---- Run -------------------------------------------------------------------
phase('Generate')

let A = args
if (typeof A === 'string') { try { A = JSON.parse(A) } catch (e) { A = {} } }
A = A || {}
const start = (typeof A.start === 'number') ? A.start : 0
const end = (typeof A.end === 'number') ? A.end : 1
const label = A.label ? A.label : 'gen'
const dir = A.dir ? A.dir : '5k_input/shards/'
const model = A.model  // e.g. 'sonnet'; if unset, agent inherits the session model

const shardIdx = []
for (let i = start; i < end; i++) shardIdx.push(i)
log(`${label}: generating shards ${start}..${end - 1} from ${dir} (${shardIdx.length} shards, ~${shardIdx.length * 16} cards)${model ? ', model=' + model : ''}`)

const results = await parallel(shardIdx.map((i) => () => {
  const name = 'shard_' + String(i).padStart(3, '0') + '.jsonl'
  const prompt = PREFIX + '\n\n== YOUR SHARD ==\nRead ' + dir + name +
    ' — it contains one JSON word per line (hanzi, pinyin, cedict_en seed, source, freq_rank). For EACH word, generate and Write cards_json/{hanzi}.json following all rules above. Then return your summary.'
  const opts = { label: label + ':' + name, phase: 'Generate', agentType: 'claude', schema: RESULT_SCHEMA }
  if (model) opts.model = model
  return agent(prompt, opts)
}))

const ok = results.filter(Boolean)
const totalWritten = ok.reduce((s, r) => s + (r.written ? r.written.length : 0), 0)
const allIssues = ok.flatMap((r) => (r.issues || []).map((x) => ({ shard: r.shard, ...x })))
log(`${label}: ${ok.length}/${shardIdx.length} shards returned, ${totalWritten} cards reported written, ${allIssues.length} flagged`)

return { label, shardsRequested: shardIdx.length, shardsReturned: ok.length, totalWritten, issues: allIssues }
