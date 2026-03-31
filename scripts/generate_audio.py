#!/usr/bin/env python3
"""
Generate TTS audio files for DawnSky word cards using edge-tts.

For each hanzi in manifest.json, produces two MP3 files:
  audio/{hanzi}_f.mp3  — female voice (zh-CN-XiaoxiaoNeural)
  audio/{hanzi}_m.mp3  — male voice (zh-CN-YunxiNeural)

Usage:
    pip install edge-tts
    python scripts/generate_audio.py
    python scripts/generate_audio.py --only 新 算了吧
    python scripts/generate_audio.py --rate -20%
"""

import asyncio
import argparse
import json
import sys
from pathlib import Path

import edge_tts

ROOT = Path(__file__).resolve().parent.parent
MANIFEST_FILE = ROOT / "manifest.json"
AUDIO_DIR = ROOT / "audio"

DEFAULT_VOICE_F = "zh-CN-XiaoxiaoNeural"
DEFAULT_VOICE_M = "zh-CN-YunxiNeural"
DEFAULT_RATE = "-15%"


async def generate_one(text: str, voice: str, rate: str, output_path: Path) -> None:
    """Generate a single MP3 file via edge-tts."""
    communicate = edge_tts.Communicate(text, voice, rate=rate)
    await communicate.save(str(output_path))


async def main():
    parser = argparse.ArgumentParser(description="Generate TTS audio for DawnSky cards")
    parser.add_argument("--only", nargs="*", help="Generate only specific words (by hanzi)")
    parser.add_argument("--voice-f", default=DEFAULT_VOICE_F, help=f"Female voice (default: {DEFAULT_VOICE_F})")
    parser.add_argument("--voice-m", default=DEFAULT_VOICE_M, help=f"Male voice (default: {DEFAULT_VOICE_M})")
    parser.add_argument("--rate", default=DEFAULT_RATE, help=f"Speaking rate (default: {DEFAULT_RATE})")
    args = parser.parse_args()

    # Load manifest
    with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
        all_words = json.load(f)

    # Filter words
    if args.only:
        missing = [w for w in args.only if w not in all_words]
        if missing:
            print(f"ERROR: words not in manifest: {missing}")
            sys.exit(1)
        words = args.only
    else:
        words = all_words

    AUDIO_DIR.mkdir(exist_ok=True)

    total = len(words)
    generated = 0
    skipped = 0
    errors = 0

    voices = [
        ("f", args.voice_f),
        ("m", args.voice_m),
    ]

    for i, hanzi in enumerate(words, 1):
        for suffix, voice in voices:
            out_path = AUDIO_DIR / f"{hanzi}_{suffix}.mp3"
            if out_path.exists():
                skipped += 1
                continue
            try:
                await generate_one(hanzi, voice, args.rate, out_path)
                generated += 1
            except Exception as e:
                errors += 1
                print(f"  ✗ {hanzi} ({suffix}): {e}")
                continue
        # Progress (print after both voices attempted)
        f_ok = (AUDIO_DIR / f"{hanzi}_f.mp3").exists()
        m_ok = (AUDIO_DIR / f"{hanzi}_m.mp3").exists()
        if f_ok and m_ok:
            print(f"  ✓ {hanzi} ({i}/{total})")
        # errors already printed above

    print(f"\nDone. {generated} generated, {skipped} skipped, {errors} errors.")
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
