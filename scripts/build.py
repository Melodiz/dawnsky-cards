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


def render_card(env, data):
    """Render a single card JSON through the Jinja2 template."""
    template = env.get_template(TEMPLATE_FILE)
    return template.render(**data)


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
        else:
            pinyin = ""
            meaning_ru = ""
            meaning_en = ""

        url = f"{CARDS_PATH}/{quote(hanzi)}.html"
        entries.append({
            "hanzi": hanzi,
            "pinyin": pinyin,
            "pinyin_search": strip_tones(pinyin),
            "meaning_ru": meaning_ru,
            "meaning_en": meaning_en,
            "url": url,
        })

    entries.sort(key=lambda e: e["pinyin_search"])
    words_json = json.dumps(entries, ensure_ascii=False)

    html = f"""<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#141024">
<title>DawnSky 霏昊 · vocabulary</title>
<meta property="og:title" content="DawnSky 霏昊 · vocabulary">
<meta property="og:description" content="{len(cards)} words">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;700;900&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap');

  :root {{
    --bg: #141024;
    --card: rgba(210,160,140,0.05);
    --ink: #ece2d8;
    --soft: #c4b8ac;
    --accent: #d2a08c;
    --muted: #7a7280;
    --divider: rgba(210,160,140,0.1);
    --serif: 'Cormorant Garamond', serif;
  }}

  * {{ margin: 0; padding: 0; box-sizing: border-box; }}

  body {{
    background: #141024;
    background-image: radial-gradient(ellipse at 30% 30%, rgba(210,160,140,0.06) 0%, transparent 50%);
    color: var(--ink);
    font-family: 'DM Sans', sans-serif;
    font-weight: 400;
    line-height: 1.75;
    min-height: 100vh;
    padding: 1.25rem;
    padding-top: 0;
    -webkit-font-smoothing: antialiased;
  }}

  .container {{ max-width: 560px; margin: 0 auto; }}

  .sticky-header {{
    position: sticky;
    top: 0;
    z-index: 10;
    background: rgba(20,16,36,0.85);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    padding: 1.25rem 0 0.75rem;
  }}

  .title {{
    font-family: 'Noto Serif SC', serif;
    font-size: 2rem;
    font-weight: 900;
    padding: 0.75rem 0 0.5rem;
  }}

  .search-row {{
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }}

  .search-input {{
    flex: 1;
    background: transparent;
    border: none;
    border-bottom: 1px solid var(--divider);
    color: var(--ink);
    font-family: 'DM Sans', sans-serif;
    font-size: 16px;
    padding: 0.5rem 0;
    outline: none;
    transition: border-color 0.2s;
  }}

  .search-input::placeholder {{ color: var(--muted); }}
  .search-input:focus {{ border-bottom-color: var(--accent); }}

  .word-count {{
    font-size: 0.75rem;
    color: var(--muted);
    white-space: nowrap;
  }}

  .word-list {{ padding-top: 0.25rem; }}

  .word-row {{
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    padding: 0.6rem 0;
    min-height: 44px;
    border-bottom: 1px solid var(--divider);
    text-decoration: none;
    color: inherit;
    transition: background 0.15s;
  }}

  .word-row:hover {{
    background: var(--card);
    margin: 0 -0.5rem;
    padding: 0.6rem 0.5rem;
    border-radius: 8px;
  }}

  .word-hz {{
    font-family: 'Noto Serif SC', serif;
    font-size: 1.3rem;
    font-weight: 700;
    color: var(--accent);
    min-width: 3rem;
  }}

  .word-py {{
    font-family: 'Cormorant Garamond', serif;
    font-style: italic;
    font-size: 0.9rem;
    color: var(--muted);
    min-width: 5rem;
  }}

  .word-ru {{
    font-size: 0.82rem;
    color: var(--soft);
  }}

  .footer {{
    text-align: center;
    font-size: 0.65rem;
    color: var(--muted);
    margin-top: 2.5rem;
    padding-top: 1rem;
    opacity: 0.7;
  }}
</style>
</head>
<body>
<div class="container">
  <div class="sticky-header">
    <div class="title">DawnSky 霏昊</div>
    <div class="search-row">
      <input type="text" class="search-input" id="search" placeholder="pinyin, meaning, hanzi..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
      <span class="word-count" id="count">{len(cards)} words</span>
    </div>
  </div>
  <div class="word-list" id="list"></div>
  <div class="footer">DawnSky 霏昊 · vocabulary</div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/fuse.js/7.0.0/fuse.min.js"></script>
<script>
(function() {{
  var WORDS = {words_json};

  var listEl = document.getElementById('list');
  var countEl = document.getElementById('count');
  var searchEl = document.getElementById('search');

  function renderRows(items) {{
    var html = '';
    for (var i = 0; i < items.length; i++) {{
      var w = items[i];
      html += '<a class="word-row" href="' + w.url + '">'
            + '<span class="word-hz">' + w.hanzi + '</span>'
            + '<span class="word-py">' + w.pinyin + '</span>'
            + '<span class="word-ru">' + w.meaning_ru + '</span>'
            + '</a>';
    }}
    listEl.innerHTML = html;
    countEl.textContent = items.length + ' word' + (items.length !== 1 ? 's' : '');
  }}

  var fuse = new Fuse(WORDS, {{
    keys: [
      {{ name: 'pinyin_search', weight: 0.4 }},
      {{ name: 'pinyin', weight: 0.2 }},
      {{ name: 'hanzi', weight: 0.2 }},
      {{ name: 'meaning_ru', weight: 0.15 }},
      {{ name: 'meaning_en', weight: 0.05 }}
    ],
    threshold: 0.4,
    distance: 100,
    includeScore: true,
    minMatchCharLength: 1
  }});

  function stripTones(s) {{
    return s.normalize('NFD').replace(/[\\u0300-\\u036f]/g, '')
            .replace(/ü/g, 'v').replace(/Ü/g, 'V').toLowerCase();
  }}

  function doSearch() {{
    var q = searchEl.value.trim();
    if (!q) {{
      renderRows(WORDS);
      return;
    }}
    var results = fuse.search(stripTones(q));
    var items = [];
    for (var i = 0; i < results.length; i++) {{
      items.push(results[i].item);
    }}
    renderRows(items);
  }}

  var timer = null;
  searchEl.addEventListener('input', function() {{
    clearTimeout(timer);
    timer = setTimeout(doSearch, 150);
  }});

  renderRows(WORDS);
}})();
</script>
</body>
</html>"""

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
