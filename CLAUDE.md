# TLDR Music

**TLDR of India's Musicscape** - A music chart aggregator that consolidates rankings from 7 major platforms to create India's definitive Top 25.

## Project Overview

TLDR Music scrapes weekly music charts from Billboard, YouTube Music, Gaana, JioSaavn, Spotify, Apple Music, and Prime Music, then uses a weighted ranking algorithm to produce a consolidated chart. Songs are matched via YouTube search and played through an embedded YouTube player.

## Architecture

```
Scraper (Python + Playwright)
    |
    v
Ranking Engine (weighted scoring)
    |
    v
YouTube API (search + video IDs)
    |
    v
Cloud Run Job → API Upload
    |
    v
FastAPI Backend (MongoDB)
    |
    v
Static Frontend (GitHub Pages)
```

## File Structure

```
tldrmusic/
├── index.html, app.js, auth.js, style.css  # Frontend (GitHub Pages serves from root)
├── scraper/
│   ├── run_job.py           # Cloud Run Job entry point
│   ├── main.py              # Local scraper entry point
│   ├── config.py            # API keys, weights, URLs
│   ├── ranking.py           # Consolidation algorithm
│   ├── youtube_api.py       # YouTube search + enrichment
│   ├── mongo_cache.py       # MongoDB caching
│   └── scrapers/            # Platform-specific scrapers
├── backend/
│   └── src/                 # FastAPI backend
├── scripts/
│   ├── run-tests.js         # CLI test runner
│   ├── precommit-check.js   # Pre-commit validation
│   └── feature.sh           # Feature branch helper
├── tests/                   # Test files
├── data/                    # Cache files (local dev)
└── package.json             # Version management
```

## Development Workflow

### Running Tests

```bash
# Run all tests
npm test
# or
node scripts/run-tests.js
```

### Feature Branch Workflow

The project enforces a strict branching strategy:

1. **Main branch is protected** - Tests must pass before committing to main
2. **Feature branches** - Use for work-in-progress code

```bash
# Start a new feature
./scripts/feature.sh start my-feature-name

# Run tests
./scripts/feature.sh test

# Commit your changes (on feature branch, tests are optional)
git add . && git commit -m "Add new feature"

# Merge back to main (tests run automatically)
./scripts/feature.sh finish
```

### Pre-commit Checks

The pre-commit hook automatically runs:
1. **Localhost URL check** - Blocks commits with localhost API URLs
2. **JavaScript syntax check** - Validates all staged .js files
3. **Python syntax check** - Validates all staged .py files
4. **Full test suite** (main branch only) - Must pass to commit

If tests fail on main branch:
```bash
# Option 1: Fix issues and retry
# Option 2: Create feature branch
git stash
git checkout -b feature/my-fix
git stash pop
git add . && git commit -m "WIP: fixing issue"

# Option 3: Skip tests (not recommended)
git commit --no-verify
```

### Version Management

```bash
# Check current version
./scripts/feature.sh version

# Bump version
./scripts/feature.sh version patch  # 1.0.0 -> 1.0.1
./scripts/feature.sh version minor  # 1.0.0 -> 1.1.0
./scripts/feature.sh version major  # 1.0.0 -> 2.0.0
```

## Quick Start

### 1. Install Dependencies

```bash
# Python dependencies
cd scraper
pip install -r requirements.txt
playwright install chromium

# Node.js (for testing)
# No npm install needed - uses built-in Node.js modules
```

### 2. Run the Scraper (Local)

```bash
python scraper/main.py

# Options:
python scraper/main.py --dry-run      # Scrape only, no API calls
python scraper/main.py --skip-scrape  # Use cached data
python scraper/main.py --no-headless  # Show browser
```

### 3. Run Cloud Job (Production)

```bash
gcloud run jobs execute tldrmusic-scraper --region asia-south1
```

### 4. View the Site

- **Production**: https://mono-tv.github.io/tldrmusic/
- **Local**: Open `index.html` in browser

## Platform Weights

| Platform | Weight | Notes |
|----------|--------|-------|
| Apple Music | 1.5 | Primary |
| Spotify | 1.5 | Primary |
| Billboard | 1.2 | Industry standard |
| Shazam | 1.1 | Discovery signal |
| YouTube Music | 1.0 | Base |
| JioSaavn | 1.0 | India-specific |
| Spotify Viral | 0.9 | Emerging songs |
| Gaana | 0.8 | India-specific |
| Prime Music | 0.7 | Lower weight |

### Global Chart Weights
| Platform | Weight |
|----------|--------|
| Spotify Global | 1.5 |
| Billboard Hot 100 | 1.5 |
| Apple Music Global | 1.3 |

## API Endpoints

**Base URL**: `https://tldrmusic-api-401132033262.asia-south1.run.app`

- `GET /chart/current` - Current chart data
- `GET /docs` - API documentation
- `POST /admin/upload` - Upload new chart (requires API key)

## Configuration

Edit `scraper/config.py`:
- `YOUTUBE_API_KEY` - YouTube Data API key
- `PLATFORM_WEIGHTS` - Ranking weights
- `FINAL_CHART_SIZE` - Songs in output (default: 25)
- `CHART_URLS` - Source chart URLs

## Testing

Tests include:
- JavaScript syntax validation
- Python syntax validation
- API endpoint consistency (no localhost)
- Required files check
- HTML structure validation
- Version consistency

Run tests before every commit to main to ensure code quality.
