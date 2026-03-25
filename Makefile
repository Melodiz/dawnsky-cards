# DawnSky Cards — build & deploy

.PHONY: build upload clean

# Build all cards from JSON → HTML, rebuild manifest + index
build:
	python scripts/build.py

# Build specific cards
# Usage: make build-only CARDS="新 算了吧"
build-only:
	python scripts/build.py --only $(CARDS)

# Rebuild manifest + index without re-rendering cards
manifest:
	python scripts/build.py --manifest

# Build + commit + push to GitHub Pages
upload: build
	git add -A
	git commit -m "update cards $$(date +%Y-%m-%d)" || true
	git push origin main

# Clean generated HTML (keeps JSON source files)
clean:
	rm -f cards/*.html manifest.json index.html
