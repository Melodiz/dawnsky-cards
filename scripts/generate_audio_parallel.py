#!/usr/bin/env python3
"""Parallel TTS audio generation via edge-tts (network-bound -> high async concurrency).

Generates audio/{hanzi}_f.mp3 (zh-CN-XiaoxiaoNeural) + audio/{hanzi}_m.mp3 (zh-CN-YunxiNeural)
for every word in 5k_input/words.jsonl. SKIPS any file that already exists (never regenerates).
Verifies each saved file is non-empty; retries transient edge-tts failures with backoff.

Usage:
    python scripts/generate_audio_parallel.py [--concurrency 48] [--rate -15%]
"""
import asyncio, argparse, json, os, sys, time
from pathlib import Path
import edge_tts

ROOT = Path(__file__).resolve().parent.parent
AUDIO_DIR = ROOT / "audio"
WORDS_FILE = ROOT / "5k_input" / "words.jsonl"
VOICE_F = "zh-CN-XiaoxiaoNeural"
VOICE_M = "zh-CN-YunxiNeural"
RATE = "-15%"


async def gen_one(sem, text, voice, rate, out_path, stats, retries=4):
    async with sem:
        for attempt in range(retries):
            try:
                c = edge_tts.Communicate(text, voice, rate=rate)
                await c.save(str(out_path))
                if out_path.exists() and out_path.stat().st_size > 0:
                    stats['ok'] += 1
                    return
                raise RuntimeError("empty file")
            except Exception as e:
                if attempt == retries - 1:
                    stats['err'] += 1
                    if len(stats['errors']) < 40:
                        stats['errors'].append(f"{out_path.name}: {type(e).__name__}: {e}")
                    if out_path.exists() and out_path.stat().st_size == 0:
                        try: out_path.unlink()
                        except OSError: pass
                else:
                    await asyncio.sleep(0.6 * (attempt + 1))


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--concurrency", type=int, default=48)
    ap.add_argument("--rate", default=RATE)
    args = ap.parse_args()

    AUDIO_DIR.mkdir(exist_ok=True)
    words = [json.loads(l)['hanzi'] for l in open(WORDS_FILE, encoding='utf-8')]

    spec = []
    for hz in words:
        for suf, voice in (('f', VOICE_F), ('m', VOICE_M)):
            out = AUDIO_DIR / f"{hz}_{suf}.mp3"
            if not out.exists():
                spec.append((hz, voice, out))

    print(f"words: {len(words)} | to generate (skipping existing): {len(spec)} | concurrency {args.concurrency}", flush=True)
    if not spec:
        print("nothing to do.", flush=True)
        return

    sem = asyncio.Semaphore(args.concurrency)
    stats = {'ok': 0, 'err': 0, 'errors': []}
    t0 = time.time()

    coros = [gen_one(sem, hz, voice, args.rate, out, stats) for hz, voice, out in spec]
    done = 0
    for fut in asyncio.as_completed(coros):
        await fut
        done += 1
        if done % 250 == 0 or done == len(spec):
            rate = done / max(time.time() - t0, 1e-9)
            print(f"  {done}/{len(spec)}  ok={stats['ok']} err={stats['err']}  ({rate:.1f}/s)", flush=True)

    print(f"\nDone in {time.time()-t0:.0f}s. generated {stats['ok']}, errors {stats['err']}.", flush=True)
    for e in stats['errors'][:40]:
        print("  ✗", e, flush=True)
    if stats['err']:
        sys.exit(2)


if __name__ == "__main__":
    asyncio.run(main())
