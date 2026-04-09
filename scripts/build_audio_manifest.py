#!/usr/bin/env python3
"""Scan audio/ for *_f.mp3 files and write sorted hanzi list to audio_manifest.json."""

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT / "audio"
MANIFEST_FILE = ROOT / "audio_manifest.json"


def main():
    hanzi = sorted(p.name[:-len("_f.mp3")] for p in AUDIO_DIR.glob("*_f.mp3"))
    with open(MANIFEST_FILE, "w", encoding="utf-8") as f:
        json.dump(hanzi, f, ensure_ascii=False, indent=2)
    print(f"audio_manifest.json: {len(hanzi)} entries")


if __name__ == "__main__":
    main()
