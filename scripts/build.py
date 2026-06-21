#!/usr/bin/env python3
"""
Build script for DawnSky word cards.

Reads JSON files from cards_json/, renders each through template.html,
outputs HTML to cards/, generates manifest.json and index.html.

Usage:
    python scripts/build.py                  # build all
    python scripts/build.py --only 新 算了吧   # build specific cards
    python scripts/build.py --manifest       # rebuild manifest + index only
"""

import json
import os
import re
import sys
import argparse
import unicodedata
from pathlib import Path
from urllib.parse import quote

# pip install jinja2
from jinja2 import Environment, FileSystemLoader


def strip_tones(s):
    """Strip tone marks from pinyin: ā→a, é→e, ǐ→i, ü→v etc."""
    nfkd = unicodedata.normalize('NFD', s)
    stripped = ''.join(c for c in nfkd if unicodedata.category(c) != 'Mn')
    return stripped.replace('ü', 'v').replace('Ü', 'V').lower()


HSK_LVL_RE = re.compile(r'hsk\s*2\.0-L([1-6])', re.I)
HSK_FALLBACK_RE = re.compile(r'\bHSK\s*([1-6])\b', re.I)


def extract_hsk(data):
    """Best-effort HSK level (1-6) from footer_note; 0 for frequency / unlevelled words."""
    fn = data.get("footer_note", "") or ""
    m = HSK_LVL_RE.search(fn) or HSK_FALLBACK_RE.search(fn)
    return int(m.group(1)) if m else 0


ROOT = Path(__file__).resolve().parent.parent
JSON_DIR = ROOT / "cards_json"
HTML_DIR = ROOT / "cards"
TEMPLATE_FILE = "template.html"
MANIFEST_FILE = ROOT / "manifest.json"
INDEX_FILE = ROOT / "index.html"

BASE_URL = "https://melodiz.github.io/dawnsky-cards"
CARDS_PATH = "cards"


def hl_markup(text):
    """Convert {hl}...{/hl} markers to <span class="hl">...</span>."""
    return text.replace("{hl}", '<span class="hl">').replace("{/hl}", "</span>")


def load_json(path):
    """Load and validate a card JSON file."""
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    required = ["hanzi", "pinyin", "meaning_ru", "examples"]
    for field in required:
        if field not in data:
            raise ValueError(f"{path.name}: missing required field '{field}'")

    if len(data["examples"]) < 2:
        raise ValueError(f"{path.name}: need at least 2 examples, got {len(data['examples'])}")

    return data


# === "Interesting card" heuristics — feed the word-of-the-day pool ===
#
# The discriminating signal is cultural-story markers in the prose (slang,
# taboo, etymology stories, sound-alike superstitions...) — length and section
# counts alone just select the most padded cards.

POOL_SIZE = 120
TEASER_CAP = 120

# Hand-curated word-of-the-day picks — slang, colloquial, vivid idioms, cultural
# gems. These are guaranteed into the pool (if a card exists) and placed first,
# so the daily word leans toward the genuinely interesting end of the lexicon.
# Non-existent entries are silently skipped.
CURATED_INTERESTING = [
    # slang / colloquial / vivid single chars
    "贼", "牛", "坑", "卷", "渣", "舔", "拽", "靠", "草", "跪", "滚", "骂", "撕", "揍", "掰",
    "帅", "笨", "穷", "醉", "臭", "傻", "火", "黄", "狼", "猪", "躺", "摸", "顶", "香",
    # colloquial / slang multi-char
    "他妈的", "啪啪啪", "受罪", "出息", "任性", "卑鄙", "啰唆",
    # advanced idioms (chengyu) — vivid imagery / a story behind them
    "画蛇添足", "拔苗助长", "莫名其妙", "恍然大悟", "滔滔不绝", "一丝不苟", "斩钉截铁",
    "理直气壮", "苦尽甘来", "雪上加霜", "津津有味", "小心翼翼", "咬牙切齿", "肆无忌惮",
    "优胜劣汰", "潜移默化", "络绎不绝", "热泪盈眶", "爱不释手", "任重道远", "微不足道",
    "无微不至", "岂有此理", "川流不息", "知足常乐", "自力更生", "见义勇为", "饱经沧桑",
    "无理取闹", "无精打采", "东张西望", "兴高采烈", "博大精深", "不择手段", "得不偿失",
    "恰到好处", "想方设法", "无可奈何",
    # cultural / vivid nouns
    "茉莉花茶", "糖醋里脊", "土豆", "俗话", "风土人情", "夜市", "红包", "饺子",
]

STORY_STEMS = [
    "несчастлив", "счастлив", "сленг", "ругатель", "грубо", "груб ", "мата",
    "эвфемизм", "смягч", "табу", "смешн", "шутк", "ирони", "пиктограмм",
    "древн", "легенд", "миф", "поэт", "созвучн", "звучит как", "суевер",
    "культур", "традици", "император", "династи", "интернет", "мем",
    "олимпиад", "этимолог", "буквально", "дословно", "рисунок", "рисует",
    "образ", "история", "на самом деле", "секрет", "лайфхак", "обидн",
    "вежлив", "неловк", "иностранц", "лаовай", "социальн", "феномен",
    "символ", "романти", "сказк", "волшебн", "примет", "плохой знак",
    "красив", "благородн", "негатив", "образн",
]


def _strip_tags(html):
    return re.sub(r"<[^>]+>", "", html or "").strip()


def _card_text(data):
    """All prose of a card, lowercased, for stem matching."""
    parts = [_strip_tags(data.get("deep_dive") or ""), data.get("footer_note") or ""]
    for r in data.get("radicals") or []:
        parts.append(r.get("note") or "")
    for s in data.get("situations") or []:
        parts.append((s.get("setup") or "") + " " + (s.get("line") or ""))
    return " ".join(parts).lower()


def card_teaser(data):
    """One-line hook: footer_note without the "hanzi —" prefix and HSK segments,
    fallback: first sentence of the last deep_dive paragraph."""
    footer = (data.get("footer_note") or "").strip()
    if footer:
        prefix = data["hanzi"] + " — "
        if footer.startswith(prefix):
            footer = footer[len(prefix):]
        parts = [p.strip() for p in footer.split("·")]
        parts = [p for p in parts if p and not re.match(r"^HSK\b", p, re.I)]
        if parts:
            t = " · ".join(parts)
            if len(t) > TEASER_CAP:
                t = t[:TEASER_CAP].rsplit(" ", 1)[0] + "…"
            return t

    paras = re.findall(r"<p>(.*?)</p>", data.get("deep_dive") or "", re.S)
    if paras:
        text = _strip_tags(paras[-1])
        sent = re.split(r"(?<=[.!?])\s+", text)[0]
        if len(sent) > TEASER_CAP:
            sent = sent[:TEASER_CAP].rsplit(" ", 1)[0] + "…"
        return sent
    return ""


def card_interest_score(data):
    text = _card_text(data)
    score = 1.5 * sum(1 for stem in STORY_STEMS if stem in text)
    # "X + Y = «Z»" literal-decomposition storytelling
    if " + " in text and " = " in text:
        score += 1.5
    score += min(len(text) / 200, 2.5)
    score += 0.6 * len(data.get("situations") or [])
    score += 0.4 * len(data.get("radicals") or [])
    if data.get("footer_note"):
        score += 0.3
    return score


def build_interesting_pool(cards):
    """Curated picks first, then top auto-scored cards, up to POOL_SIZE.

    -> [{hanzi, teaser}]. The curated list (CURATED_INTERESTING) is guaranteed in
    and placed at the front; the remaining slots are filled by interest score.
    """
    cardset = set(cards)
    scored = []
    teaser_by = {}
    for hanzi in cards:
        json_path = JSON_DIR / f"{hanzi}.json"
        if not json_path.exists():
            continue
        data = load_json(json_path)
        teaser = card_teaser(data)
        teaser_by[hanzi] = teaser
        scored.append((card_interest_score(data), hanzi, teaser))
    scored.sort(key=lambda x: -x[0])

    pool, seen = [], set()
    for hanzi in CURATED_INTERESTING:
        if hanzi in cardset and hanzi in teaser_by and hanzi not in seen:
            pool.append({"hanzi": hanzi, "teaser": teaser_by[hanzi]})
            seen.add(hanzi)
    for _, hanzi, teaser in scored:
        if len(pool) >= POOL_SIZE:
            break
        if hanzi in seen:
            continue
        pool.append({"hanzi": hanzi, "teaser": teaser})
        seen.add(hanzi)
    return pool


def render_card(env, data):
    """Render a single card JSON through the Jinja2 template."""
    template = env.get_template(TEMPLATE_FILE)

    hanzi = data["hanzi"]
    audio_f = (ROOT / "audio" / f"{hanzi}_f.mp3").exists()
    audio_m = (ROOT / "audio" / f"{hanzi}_m.mp3").exists()

    ctx = {
        **data,
        "has_audio_f": audio_f,
        "has_audio_m": audio_m,
    }
    if audio_f:
        ctx["audio_url_f"] = f"../audio/{hanzi}_f.mp3"
    if audio_m:
        ctx["audio_url_m"] = f"../audio/{hanzi}_m.mp3"

    return template.render(**ctx)


def build_manifest():
    """Scan cards/ for HTML files and write manifest.json."""
    cards = []
    for f in sorted(HTML_DIR.glob("*.html")):
        hanzi = f.stem
        cards.append(hanzi)

    with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
        json.dump(cards, f, ensure_ascii=False, indent=2)

    print(f"  manifest.json: {len(cards)} cards")
    return cards


def build_index(cards):
    """Generate index.html — master page with sticky search bar and fuzzy search."""
    entries = []
    for hanzi in cards:
        json_path = JSON_DIR / f"{hanzi}.json"
        if json_path.exists():
            data = load_json(json_path)
            pinyin = data["pinyin"]
            meaning_ru = data["meaning_ru"]
            meaning_en = data.get("meaning_en", "")
            hsk = extract_hsk(data)
        else:
            pinyin = ""
            meaning_ru = ""
            meaning_en = ""
            hsk = 0

        url = f"{CARDS_PATH}/{quote(hanzi)}.html"
        entries.append({
            "hanzi": hanzi,
            "pinyin": pinyin,
            "pinyin_search": strip_tones(pinyin),
            "meaning_ru": meaning_ru,
            "meaning_en": meaning_en,
            "hsk": hsk,
            "url": url,
        })

    entries.sort(key=lambda e: e["pinyin_search"])
    words_json = json.dumps(entries, ensure_ascii=False)

    pool = build_interesting_pool(cards)
    interesting_json = json.dumps(pool, ensure_ascii=False)

    template = (ROOT / "templates" / "index.html").read_text(encoding="utf-8")
    html = (template
            .replace("__COUNT__", str(len(cards)))
            .replace("__WORDS_JSON__", words_json)
            .replace("__INTERESTING_JSON__", interesting_json))

    with open(INDEX_FILE, "w", encoding="utf-8") as f:
        f.write(html)

    print(f"  index.html: {len(cards)} entries")


def main():
    parser = argparse.ArgumentParser(description="Build DawnSky word cards")
    parser.add_argument("--only", nargs="*", help="Build only specific cards (by hanzi)")
    parser.add_argument("--manifest", action="store_true", help="Rebuild manifest + index only")
    args = parser.parse_args()

    HTML_DIR.mkdir(exist_ok=True)

    if args.manifest:
        cards = build_manifest()
        build_index(cards)
        return

    # Set up Jinja2
    env = Environment(
        loader=FileSystemLoader(str(ROOT / "templates")),
        autoescape=False,  # we control the HTML
    )
    env.filters["hl_markup"] = hl_markup

    # Find JSON files to process
    if args.only:
        json_files = [JSON_DIR / f"{h}.json" for h in args.only]
        missing = [f for f in json_files if not f.exists()]
        if missing:
            print(f"ERROR: missing JSON files: {[f.name for f in missing]}")
            sys.exit(1)
    else:
        json_files = sorted(JSON_DIR.glob("*.json"))

    if not json_files:
        print("No JSON files found in cards_json/")
        sys.exit(1)

    # Render cards
    print(f"Building {len(json_files)} cards...")
    errors = []
    for json_path in json_files:
        try:
            data = load_json(json_path)
            html = render_card(env, data)
            out_path = HTML_DIR / f"{data['hanzi']}.html"
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(html)
            print(f"  ✓ {data['hanzi']}")
        except Exception as e:
            errors.append(f"  ✗ {json_path.name}: {e}")
            print(errors[-1])

    # Rebuild manifest + index
    print("\nRebuilding manifest + index...")
    cards = build_manifest()
    build_index(cards)

    if errors:
        print(f"\n{len(errors)} error(s):")
        for e in errors:
            print(e)
        sys.exit(1)
    else:
        print(f"\nDone. {len(json_files)} cards built.")


if __name__ == "__main__":
    main()
