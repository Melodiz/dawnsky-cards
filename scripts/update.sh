#!/usr/bin/env bash
# Update DawnSky cards: generate missing audio + rebuild all HTML.
#
# Usage:
#     bash scripts/update.sh

set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== Step 1/2: Generating audio for new words ==="
python3 scripts/generate_audio.py

echo ""
echo "=== Step 2/2: Building HTML cards ==="
python3 scripts/build.py

echo ""
echo "=== All done ==="
