#!/usr/bin/env python3
"""Scriptable cleanup of DawnSky cards (the non-judgment defects the audit found).

Fixes, in order:
  1. deep_dive HTML: <em>/<i>/<b>/<u> -> <strong>; strip other disallowed tags (keep text).
  2. freq_rank leaked into user-facing prose/footer -> removed + separators cleaned.
  3. CJK glued to Cyrillic with no space (e.g. "扌слева") -> insert a space.
     (True garbage like "眼神ом" is only de-glued here; those cards are left for the
      Opus audit/regen tail.)

Usage:
  python eval/fix_cards.py            # DRY RUN (report only)
  python eval/fix_cards.py --apply    # write changes
Only touches cards for the 5000 input words.
"""
import json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APPLY = '--apply' in sys.argv

CJK = r'一-鿿'
CYR = r'Ѐ-ӿ'

# --- fix 1: deep_dive tags ---
def fix_tags(html):
    if not html:
        return html, 0
    before = html
    html = re.sub(r'<\s*(em|i|b|u)\s*>', '<strong>', html, flags=re.I)
    html = re.sub(r'<\s*/\s*(em|i|b|u)\s*>', '</strong>', html, flags=re.I)
    # strip any remaining tag that isn't <p>/<strong> (keep inner text)
    html = re.sub(r'<\s*/?\s*(?!p\b|strong\b)[a-zA-Z][^>]*>', '', html)
    return html, (1 if html != before else 0)

# --- fix 2: freq_rank leak ---
def fix_freq(text):
    if not text or 'freq_rank' not in text:
        return text, 0
    before = text
    text = re.sub(r'[（(]\s*freq[_ ]?rank\s*[:#]?\s*\d+\s*[)）]', '', text)   # ( freq_rank 1604 )
    text = re.sub(r'[·,;]?\s*freq[_ ]?rank\s*[:#]?\s*\d+', '', text)          # · freq_rank 1604
    text = re.sub(r'freq[_ ]?rank', '', text)                                  # residual token
    text = re.sub(r'[（(]\s*[)）]', '', text)                                  # empty ()
    text = re.sub(r'\s+([)）.,;])', r'\1', text)   # space before closing punct (not ·)
    text = re.sub(r'·\s*·', '·', text)
    text = re.sub(r'(?:\s*·\s*)+$', '', text)
    text = re.sub(r'^\s*·\s*', '', text)
    text = re.sub(r'\s*·\s*', ' · ', text)         # normalize separator spacing
    text = re.sub(r'\s{2,}', ' ', text).strip()
    return text, (1 if text != before else 0)

# --- fix 3: CJK glued to Cyrillic ---
glue = re.compile(f'([{CJK}])([{CYR}])|([{CYR}])([{CJK}])')
def fix_glue(text):
    if not text:
        return text, 0
    before = text
    prev = None
    while prev != text:
        prev = text
        text = glue.sub(lambda m: (m.group(1) or m.group(3)) + ' ' + (m.group(2) or m.group(4)), text)
    return text, (1 if text != before else 0)

RU_FIELDS_TOP = ['meaning_ru', 'meaning_en', 'footer_note']

def process(d):
    changed = {'tags': 0, 'freq': 0, 'glue': 0}
    # deep_dive: tags + freq + glue
    if d.get('deep_dive'):
        v, c = fix_tags(d['deep_dive']); changed['tags'] += c
        v, c = fix_freq(v);              changed['freq'] += c
        v, c = fix_glue(v);              changed['glue'] += c
        d['deep_dive'] = v
    # top text fields: freq + glue
    for f in RU_FIELDS_TOP:
        if d.get(f):
            v, c = fix_freq(d[f]); changed['freq'] += c
            v, c = fix_glue(v);    changed['glue'] += c
            d[f] = v
    # nested russian-text fields: freq + glue (never cn/py/hanzi/pinyin)
    for s in d.get('situations', []):
        for k in ('title', 'setup', 'line'):
            if s.get(k):
                v, c = fix_freq(s[k]); changed['freq'] += c
                v, c = fix_glue(v);    changed['glue'] += c
                s[k] = v
    for e in d.get('examples', []):
        for k in ('ru', 'note'):
            if e.get(k):
                v, c = fix_freq(e[k]); changed['freq'] += c
                v, c = fix_glue(v);    changed['glue'] += c
                e[k] = v
    for r in d.get('radicals', []):
        for k in ('name', 'note'):
            if r.get(k):
                v, c = fix_freq(r[k]); changed['freq'] += c
                v, c = fix_glue(v);    changed['glue'] += c
                r[k] = v
    for c0 in d.get('characters', []):
        for k in ('gloss', 'role'):
            if c0.get(k):
                v, c = fix_freq(c0[k]); changed['freq'] += c
                v, c = fix_glue(v);     changed['glue'] += c
                c0[k] = v
    return changed

def main():
    words = [json.loads(l)['hanzi'] for l in open(os.path.join(ROOT, '5k_input/words.jsonl'), encoding='utf-8')]
    tot = {'tags': 0, 'freq': 0, 'glue': 0}
    cards_changed = 0
    samples = {'tags': [], 'freq': [], 'glue': []}
    for hz in words:
        p = os.path.join(ROOT, 'cards_json', f'{hz}.json')
        if not os.path.exists(p):
            continue
        try:
            raw = open(p, encoding='utf-8').read()
            d = json.loads(raw)
        except Exception:
            continue
        orig = json.dumps(d, ensure_ascii=False, sort_keys=True)
        ch = process(d)
        new = json.dumps(d, ensure_ascii=False, sort_keys=True)
        if new != orig:
            cards_changed += 1
            for k in tot:
                tot[k] += ch[k]
                if ch[k] and len(samples[k]) < 6:
                    samples[k].append(hz)
            if APPLY:
                with open(p, 'w', encoding='utf-8') as f:
                    json.dump(d, f, ensure_ascii=False, indent=2)
    mode = 'APPLIED' if APPLY else 'DRY RUN'
    print(f"[{mode}] cards changed: {cards_changed}")
    print(f"  tag fixes (em->strong / strip):  {tot['tags']} cards   e.g. {' '.join(samples['tags'])}")
    print(f"  freq_rank leak removed:          {tot['freq']} fields  e.g. {' '.join(samples['freq'])}")
    print(f"  CJK/Cyrillic de-glued:           {tot['glue']} fields  e.g. {' '.join(samples['glue'])}")

if __name__ == '__main__':
    main()
