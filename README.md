# TLDR Music

**India's Musicscape Aggregator** - A consolidated music chart that aggregates trending songs from multiple streaming platforms to create the definitive Top 25 chart for India.

## Overview

TLDR Music scrapes weekly music charts from 12 platforms (including regional charts), applies a weighted ranking algorithm, and generates a unified chart. Songs are enriched with YouTube videos, album artwork, and lyrics for a complete listening experience in a sleek, modern web frontend.

## Supported Platforms

### Primary Platforms
| Platform | Songs | Method | Weight |
|----------|-------|--------|--------|
| Apple Music | ~50 | Web Scraping | 1.5 |
| Spotify Top 50 | ~50 | Web Scraping | 1.5 |
| Billboard India | 25 | Web Scraping | 1.2 |
| Shazam India | ~50 | Web Scraping | 1.1 |
| YouTube Music | ~30 | Web Scraping | 1.0 |
| JioSaavn | ~60 | Public API | 1.0 |
| Spotify Viral 50 | ~50 | Web Scraping | 0.9 |
| Gaana | ~10 | Web Scraping | 0.8 |

### Regional Charts
| Platform | Songs | Method | Weight |
|----------|-------|--------|--------|
| Hindi (Hot Hits) | ~30 | Web Scraping | 0.7 |
| Tamil Top 50 | ~30 | Web Scraping | 0.6 |
| Telugu Top 50 | ~30 | Web Scraping | 0.6 |
| Punjabi Top 50 | ~30 | Web Scraping | 0.6 |

> **Note:** Prime Music is disabled as Amazon Music requires authentication.
> Regional charts have lower weights to avoid skewing the main chart.

## Features

### Data Aggregation
- Scrapes 400+ songs from 12 platforms
- Weighted ranking algorithm with platform priority
- YouTube video matching for playback
- Album artwork from iTunes API
- Lyrics from LRCLIB (plain and synced)
- Caching to minimize API calls
- Static JSON output (no database required)

### Frontend
- Modern frosted glass UI design
- Hero spotlight for #1 song
- Floating player bar with progress tracking
- Click-to-seek on progress bar
- Lyrics panel with slide-out drawer
- Dynamic background gradient from album art
- Keyboard navigation
- Fully responsive design

## Tech Stack

- **Scraping:** Python 3, Playwright, aiohttp
- **APIs:** YouTube Data API, iTunes Search API, LRCLIB
- **Frontend:** Vanilla HTML/CSS/JS
- **Storage:** JSON files
- **Video Playback:** YouTube iframe embed

## Installation

### Prerequisites

- Python 3.8+
- Node.js (for Playwright browsers)

### Setup

```bash
# Clone the repository
cd tldrmusic

# Install Python dependencies
cd scraper
pip install playwright aiohttp

# Install Playwright browsers
playwright install chromium
```

### YouTube API Key

Set your YouTube Data API v3 key in `scraper/config.py`:

```python
YOUTUBE_API_KEY = "your-api-key-here"
```

## Usage

### Full Run (Scrape + Enrichment)

```bash
cd scraper
python main.py
```

This will:
1. Scrape all platforms (~3-5 minutes)
2. Consolidate and rank songs
3. Match songs with YouTube videos
4. Fetch album artwork from iTunes
5. Fetch lyrics from LRCLIB
6. Generate `data/current.json` and copy to `frontend/`

### Dry Run (Scrape Only, No API Calls)

```bash
python main.py --dry-run
```

### Skip Scraping (Use Cached Data)

```bash
python main.py --skip-scrape
```

### Show Browser During Scraping

```bash
python main.py --no-headless
```

### View the Chart

```bash
cd frontend
python -m http.server 8000
# Open http://localhost:8000
```

## Ranking Algorithm

Songs are scored using a weighted position-based formula:

```
Score = Σ (platform_weight × position_score)
```

Where:
- `position_score = (total_positions - position + 1) / total_positions`
- Higher weight platforms (Apple Music, Spotify) have more influence
- Songs appearing on multiple platforms rank higher

### Tiebreakers

1. Number of platforms the song appears on
2. YouTube view count (if available)

## Project Structure

```
tldrmusic/
├── scraper/
│   ├── main.py              # Entry point
│   ├── config.py            # Configuration & API keys
│   ├── ranking.py           # Consolidation algorithm
│   ├── youtube_api.py       # YouTube search & caching
│   ├── artwork_api.py       # iTunes artwork fetching
│   ├── lyrics_api.py        # LRCLIB lyrics fetching
│   └── scrapers/
│       ├── base.py          # Base scraper class
│       ├── billboard.py     # Billboard India Hot 100
│       ├── youtube_music.py # YouTube Music Charts
│       ├── gaana.py         # Gaana Top Songs
│       ├── jiosaavn.py      # JioSaavn Trending (API)
│       ├── spotify.py       # Spotify India Top 50
│       ├── spotify_viral.py # Spotify Viral 50 India
│       ├── apple_music.py   # Apple Music Top 100
│       ├── shazam.py        # Shazam India Top 200
│       ├── regional.py      # Regional charts (Tamil, Telugu, Punjabi, Hindi)
│       └── prime_music.py   # Amazon Music (disabled)
├── frontend/
│   ├── index.html           # Main page
│   ├── style.css            # Styling (frosted glass UI)
│   ├── app.js               # Frontend logic
│   └── current.json         # Chart data (generated)
└── data/
    ├── current.json         # Latest chart
    ├── scrape_cache.json    # Cached scrape data
    ├── youtube_cache.json   # Cached YouTube results
    ├── artwork_cache.json   # Cached artwork URLs
    ├── lyrics_cache.json    # Cached lyrics
    └── archive/             # Historical charts by week
        └── 2025/
            └── 2025-W50.json
```

## Output Format

`current.json` structure:

```json
{
  "generated_at": "2025-12-08T12:00:00Z",
  "week": "2025-W50",
  "total_songs": 25,
  "chart": [
    {
      "rank": 1,
      "title": "Song Title",
      "artist": "Artist Name",
      "score": 4.09,
      "platforms_count": 4,
      "youtube_video_id": "dQw4w9WgXcQ",
      "youtube_views": 1000000,
      "artwork_url": "https://is1-ssl.mzstatic.com/...",
      "lyrics_plain": "Lyrics text...",
      "lyrics_synced": "[00:00.00] Synced lyrics..."
    }
  ]
}
```

## Frontend Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `↓` or `j` | Next song |
| `↑` or `k` | Previous song |
| `Enter` or `Space` | Play first song |
| `L` | Toggle lyrics panel |
| `Escape` | Close lyrics panel |

## API Usage

### iTunes Search API
- Used for fetching album artwork
- Free, no authentication required
- Rate limited to avoid blocking

### LRCLIB API
- Used for fetching song lyrics (plain and synced)
- Free, no authentication required
- ~90% coverage for Indian music

### YouTube Data API
- Used for matching songs to videos
- Requires API key (free tier: ~10,000 requests/day)

## Known Limitations

- **Prime Music:** Requires Amazon login, currently disabled
- **JioSaavn:** Uses public API (may change without notice)
- **Rate Limiting:** Some platforms may block rapid requests
- **YouTube Quota:** ~10,000 requests/day limit on free tier
- **Lyrics Coverage:** ~90% for mainstream songs, may vary

## Scheduling (Optional)

To run weekly via cron:

```bash
# Every Sunday at 2 AM
0 2 * * 0 cd /path/to/tldrmusic/scraper && python main.py >> /var/log/tldrmusic.log 2>&1
```

## License

MIT
