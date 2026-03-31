# DawnSky 霏昊 · cards

Vocabulary info cards for a private Chinese learning Telegram bot.
This is a personal project for two users — not maintained as a public tool.

Each word gets a standalone HTML page with character breakdown,
radicals, etymology, usage situations, and example sentences.

## How it works
```
cards_json/新.json  →  scripts/build.py  →  cards/新.html
                                          →  index.html (searchable catalog)
                                          →  manifest.json
```

Hosted on GitHub Pages · built with Jinja2 · search via Fuse.js

## Docs

| File | Read when |
|------|-----------|
| [docs/architecture.md](docs/architecture.md) | First time in repo, or modifying build pipeline / template |
| [docs/build.md](docs/build.md) | Running builds, deploying, adding make targets |
| [docs/schema-guide.md](docs/schema-guide.md) | Creating or editing card JSONs |
| [CLAUDE.md](CLAUDE.md) | Generating new cards via AI (style guide + prompt) |
| [examples/](examples/) | 4 gold-standard reference JSONs |

## Browse

[melodiz.github.io/dawnsky-cards](https://melodiz.github.io/dawnsky-cards)