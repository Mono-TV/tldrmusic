# TLDR Music

**TLDR of India's Musicscape** - A music chart aggregator that consolidates rankings from multiple platforms to create India's definitive Top 25 and Global Top 25.

## Project Overview

TLDR Music scrapes weekly music charts from Billboard, YouTube Music, Gaana, JioSaavn, Spotify, Apple Music, Shazam, and Prime Music, then uses a weighted ranking algorithm to produce consolidated charts. Songs are matched via YouTube search and played through an embedded YouTube player.

**Live Site**: https://mono-tv.github.io/tldrmusic/

## Architecture

### Dual-API Architecture

The frontend uses two separate APIs:

```
┌─────────────────────────────────────────────────────────────┐
│                    TLDR Music Frontend                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Music Conductor API                 TLDR Music API         │
│  (Charts, Search, Discover)          (Auth, Library)        │
│  ┌─────────────────────┐             ┌──────────────────┐   │
│  │ • India Top 25      │             │ • Google OAuth   │   │
│  │ • Global Top 25     │             │ • Favorites      │   │
│  │ • Search            │             │ • History        │   │
│  │ • Discover Playlists│             │ • Queue          │   │
│  │ • Curated Playlists │             │ • User Playlists │   │
│  └─────────────────────┘             │ • Preferences    │   │
│                                      └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Music Conductor API**: `https://music-conductor-401132033262.asia-south1.run.app`
- Charts (`/api/charts/aggregated?region=india`, `/api/charts/aggregated?region=global`)
- Search (`/api/search/songs`, `/api/search/suggest`)
- Playlists (`/api/playlists`, `/api/playlists/{slug}`)

**TLDR Music API**: `https://tldrmusic-api-401132033262.asia-south1.run.app`
- User Authentication (Google OAuth, JWT tokens)
- User Library (favorites, history, queue, user playlists)
- User preferences and recent searches

### Data Flow

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
FastAPI Backend (MongoDB Atlas)
    |
    v
Static Frontend (GitHub Pages)
```

## File Structure

```
tldrmusic/
├── index.html                    # Main app HTML
├── app.js                        # Main app logic (charts, player, playlists, UI)
├── auth.js                       # Authentication (JWT, login/logout, profile)
├── style.css                     # All styles
├── about.html                    # About page
│
├── charts/                       # Charts page
│   ├── index.html                # Charts overview
│   ├── india.html                # India chart detail
│   └── global.html               # Global chart detail
│
├── discover/                     # Discover page (formerly AI Playlists)
│   └── index.html                # Discover playlists by mood, genre, language, artist
│
├── library/                      # User library page
│   └── index.html                # Playlists, favorites, history
│
├── search/                       # Search page
│   └── index.html                # Full search view
│
├── js/
│   └── router.js                 # Page router for multi-page navigation
│
├── docs/
│   └── MUSIC_HARVESTER_MIGRATION.md  # API migration documentation
│
├── scraper/
│   ├── run_job.py                # Cloud Run Job entry point (production)
│   ├── main.py                   # Local scraper entry point
│   ├── config.py                 # API keys, weights, URLs
│   ├── ranking.py                # Consolidation algorithm
│   ├── youtube_api.py            # YouTube search + enrichment
│   ├── mongo_cache.py            # MongoDB caching for scraper
│   └── scrapers/                 # Platform-specific scrapers
│       ├── apple_music.py
│       ├── billboard.py
│       ├── gaana.py
│       ├── jiosaavn.py
│       ├── prime_music.py
│       ├── shazam.py
│       ├── spotify.py
│       ├── spotify_viral.py
│       ├── youtube_music.py
│       ├── global_charts.py      # Global chart scraper
│       └── regional.py           # Regional chart scraper
│
├── backend/
│   └── src/
│       ├── main.py               # FastAPI app entry
│       ├── api/routes/           # API endpoints
│       │   ├── auth.py           # /auth/* endpoints
│       │   ├── charts.py         # /chart/* endpoints
│       │   ├── global_chart.py   # /global/* endpoints
│       │   ├── library.py        # /library/* (playlists, favorites, history)
│       │   ├── rank_history.py   # /rank-history/* endpoints
│       │   ├── regional.py       # /regional/* endpoints
│       │   ├── search.py         # /search/* endpoints
│       │   ├── songs.py          # /songs/* endpoints
│       │   └── artists.py        # /artists/* endpoints
│       ├── services/             # Business logic
│       │   ├── auth.py           # JWT, Google OAuth
│       │   ├── chart.py          # Chart data handling
│       │   ├── library.py        # Playlist/favorites/history logic
│       │   ├── rank_history.py   # Rank change calculations
│       │   ├── search.py         # Search functionality
│       │   └── song.py           # Song metadata
│       ├── models/               # Pydantic models
│       └── config/               # Backend configuration
│
├── scripts/
│   ├── run-tests.js              # CLI test runner
│   ├── precommit-check.js        # Pre-commit validation
│   └── feature.sh                # Feature branch helper
│
├── tests/                        # Test files
├── data/                         # Local cache files
│   └── archive/
│       ├── india/2025/           # India chart archives by week
│       └── global/2025/          # Global chart archives by week
│
└── package.json                  # Version management
```

## Frontend Features

### Authentication System

- **Google OAuth**: Sign in with Google
- **JWT Tokens**:
  - Access token: 30 minutes expiry
  - Refresh token: 30 days expiry
- **Auto-refresh**: `fetchWithAuth()` automatically refreshes expired tokens on 401 errors
- **Key files**: `auth.js` handles all auth logic

### Music Player

- **YouTube Embedded Player**: Songs play via YouTube iframe API
- **Queue Management**: Play queue with next/previous
- **Shuffle/Repeat**: Standard playback controls
- **Now Playing Bar**: Fixed bottom bar with controls

### Charts

- **India Top 25**: Aggregated from 9 Indian platforms
- **Global Top 25**: Aggregated from Spotify Global, Billboard Hot 100, Apple Music Global
- **Regional Charts**: Language-specific (Hindi, Tamil, Telugu, etc.)
- **Rank Changes**: Shows movement (↑/↓/NEW) compared to previous week

### User Library

- **Favorites (Liked Songs)**: Heart icon to save songs
- **Recently Played (History)**: Auto-tracked listening history
- **Playlists**: Create, edit, delete custom playlists
- **Sharing**: Share playlists via unique links
- **Export**: Export playlists to Spotify/Apple Music/YouTube Music

### Home Page

- **Chart Selector Cards**: Toggle between India Top 25 and Global Top 25
- **Quick Picks**: Shows top 10 songs from the selected chart
- **Hero Section**: Full-width spotlight for #1 song
- **Regional Charts** (India): Language selector (Hindi, Punjabi, Tamil, etc.) with grid of top 10 songs
- **Platform Charts** (Global): Platform selector (Spotify, Billboard, Apple Music) with grid of top 10 songs
- **Logo Navigation**: Clicking TLDRMusic logo returns to home

### Discover Page

The Discover page (`/discover/`) provides curated playlists from India's 68,000+ track catalog:
- **By Mood**: Chill, Workout, Party, Focus, Romantic
- **By Genre**: Bollywood, Pop, Hip-Hop, Electronic, Rock, Classical, Lo-Fi
- **By Language**: Hindi, Punjabi, Tamil, Telugu, Bengali, etc.
- **By Artist**: Popular artists grid with search
- **Discovery Mix**: Random tracks for exploration

### UI Components

- **Sidebar Navigation**: Home, Charts, Discover, Search, Library (Playlists)
- **Chart Selector**: Card-based toggle for India/Global charts on home page
- **Detail Views**: Full-page views for playlists, favorites, history, full charts
- **Profile Panel**: User settings, logout
- **Modals**: Create playlist, add to playlist, share, export
- **Max Content Width**: 1400px for optimal readability

## Backend APIs

### Music Conductor API (Charts, Search, Discover)

**Base URL**: `https://music-conductor-401132033262.asia-south1.run.app`
**Swagger Docs**: `https://music-conductor-401132033262.asia-south1.run.app/docs`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/charts/aggregated?region=india&limit=25` | GET | India Top 25 chart |
| `/api/charts/aggregated?region=global&limit=25` | GET | Global Top 25 chart |
| `/api/charts/multi-platform?region=india` | GET | Songs on 2+ platforms |
| `/api/charts/source/{platform}?region=india` | GET | Single platform chart |
| `/api/search/songs?q={query}&has_youtube=true&per_page=50` | GET | Full search |
| `/api/search/suggest?q={query}&limit=10` | GET | Autocomplete suggestions |
| `/api/search/facets` | GET | Available filter values |
| `/api/playlists` | GET | All curated playlists (22 total) |
| `/api/playlists/{slug}` | GET | Get specific playlist by slug |

**Available Playlist Slugs:**
- **Language**: `hindi-hits`, `english-hits`, `tamil-hits`, `telugu-hits`, `punjabi-hits`, `spanish-hits`, `korean-hits`, `japanese-hits`
- **Genre**: `hip-hop-rap`, `pop-hits`, `rock-classics`, `electronic-dance`, `rnb-soul`, `latin-vibes`, `jazz-classics`, `classical-music`, `world-music`, `alternative-indie`
- **Mood**: `chill-vibes`, `workout-energy`, `party-mode`, `focus-study`

### TLDR Music API (Auth, Library)

**Base URL**: `https://tldrmusic-api-401132033262.asia-south1.run.app`

#### Auth Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/google` | POST | Google OAuth login |
| `/api/auth/refresh` | POST | Refresh access token |

#### Library Endpoints (Require Auth)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/me/library` | GET | Get full user library |
| `/api/me/library/sync` | POST | Sync library changes |
| `/api/me/favorites` | GET/POST/PUT/DELETE | Manage favorites |
| `/api/me/history` | GET/POST/PUT/DELETE | Manage listening history |
| `/api/me/queue` | GET/PUT/DELETE | Manage playback queue |
| `/api/me/playlists` | GET/POST/PUT | List/create/sync playlists |
| `/api/me/playlists/{id}` | GET/PATCH/DELETE | Manage specific playlist |
| `/api/me/playlists/{id}/songs/{song_id}` | POST/DELETE | Add/remove songs |
| `/api/me/preferences` | GET/PUT | User preferences (shuffle, repeat) |
| `/api/me/recent-searches` | GET/PUT | Recent search history |
| `/api/me/session/ping` | POST | Session detection for multi-device |

## Scraper System

### Platform Weights (India)

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

### Platform Weights (Global)

| Platform | Weight |
|----------|--------|
| Spotify Global | 1.5 |
| Billboard Hot 100 | 1.5 |
| Apple Music Global | 1.3 |

### Rank Change Calculation

The scraper calculates rank changes by comparing current chart to previous week:

1. **Load Previous Data**: From MongoDB (`chart_history` or `global_chart_history` collection)
2. **Fallback**: Local archive files in `data/archive/`
3. **Calculate Changes**:
   - Song moved up: positive `rank_change`
   - Song moved down: negative `rank_change`
   - New entry: `is_new: true`
4. **Save Current**: Store in MongoDB for next week's comparison

### Running the Scraper

```bash
# Local development
python scraper/main.py
python scraper/main.py --dry-run      # Scrape only, no API calls
python scraper/main.py --skip-scrape  # Use cached data
python scraper/main.py --no-headless  # Show browser

# Production (Cloud Run Job)
gcloud run jobs execute tldrmusic-scraper --region asia-south1
```

### Production Schedule

- **Cloud Scheduler**: Runs every Monday at 10:00 PM IST
- **Job Name**: `tldrmusic-scraper`
- **Region**: `asia-south1`

## MongoDB Collections

| Collection | Purpose |
|------------|---------|
| `users` | User accounts (Google OAuth) |
| `songs` | Song metadata |
| `charts` | Current chart data |
| `chart_history` | India chart history (for rank changes) |
| `global_chart_history` | Global chart history (for rank changes) |
| `playlists` | User playlists |
| `favorites` | User liked songs |
| `history` | User listening history |
| `youtube_cache` | Cached YouTube video IDs |

## Development Workflow

### Running Tests

```bash
npm test
# or
node scripts/run-tests.js
```

### Feature Branch Workflow

```bash
# Start a new feature
./scripts/feature.sh start my-feature-name

# Run tests
./scripts/feature.sh test

# Commit (on feature branch, tests are optional)
git add . && git commit -m "Add new feature"

# Merge back to main (tests run automatically)
./scripts/feature.sh finish
```

### Pre-commit Checks

The pre-commit hook runs:
1. **Localhost URL check** - Blocks commits with localhost API URLs
2. **JavaScript syntax check** - Validates .js files
3. **Python syntax check** - Validates .py files
4. **Full test suite** (main branch only)

### Version Management

```bash
./scripts/feature.sh version          # Check version
./scripts/feature.sh version patch    # 1.0.0 -> 1.0.1
./scripts/feature.sh version minor    # 1.0.0 -> 1.1.0
./scripts/feature.sh version major    # 1.0.0 -> 2.0.0
```

## Configuration

### Scraper Config (`scraper/config.py`)

- `YOUTUBE_API_KEY` - YouTube Data API key
- `PLATFORM_WEIGHTS` - Ranking weights
- `FINAL_CHART_SIZE` - Songs in output (default: 25)
- `CHART_URLS` - Source chart URLs
- `MONGODB_URI` - MongoDB connection string

### Backend Config

- Environment variables set in Cloud Run
- MongoDB Atlas connection
- JWT secret keys

## Common Issues & Fixes

### Token Expiration

**Issue**: "Token expired" errors after page open for extended time

**Fix**: Use `fetchWithAuth()` instead of direct `fetch()` for all authenticated API calls. It automatically handles token refresh on 401 errors.

```javascript
// Wrong
const response = await fetch(url, { headers: getAuthHeaders() });

// Correct
const response = await fetchWithAuth(url);
```

### Logout UI State

**Issue**: UI elements remain visible after logout

**Fix**: The `logout()` function in `auth.js` should hide all views, modals, and panels:
- Detail views: `favoritesDetailView`, `historyDetailView`, `playlistDetailView`
- Modals: `createPlaylistModal`, `addToPlaylistModal`, `sharePlaylistModal`, etc.
- Panels: `profilePanel`, `publicProfileView`

### Rank Changes Not Showing

**Issue**: Chart doesn't show rank change indicators

**Cause**: No previous week data available for comparison

**Fix**:
- Ensure `chart_history` / `global_chart_history` collection has previous data
- Or add archive files to `data/archive/{india|global}/{year}/`

## Deployment

### Frontend (GitHub Pages)

- Auto-deploys from `main` branch
- Served from repository root
- URL: https://mono-tv.github.io/tldrmusic/

### Backend (Cloud Run)

```bash
# Deploy backend
gcloud run deploy tldrmusic-api \
  --source backend/ \
  --region asia-south1
```

### Scraper Job (Cloud Run Jobs)

```bash
# Deploy job
gcloud run jobs deploy tldrmusic-scraper \
  --source scraper/ \
  --region asia-south1

# Execute manually
gcloud run jobs execute tldrmusic-scraper --region asia-south1

# View logs
gcloud logging read "resource.type=cloud_run_job AND resource.labels.job_name=tldrmusic-scraper" --limit 100
```

## Key Code Patterns

### Authenticated API Calls (Frontend)

```javascript
// Always use fetchWithAuth for protected endpoints
const response = await fetchWithAuth('/library/favorites', {
    method: 'POST',
    body: JSON.stringify({ song_id: songId })
});
```

### Adding Songs to Library

```javascript
// Favorites
await toggleFavorite(songId);

// History (auto-tracked on play)
await addToHistory(songId);

// Playlist
await addSongToPlaylist(playlistId, songId);
```

### Playing Songs

```javascript
// Single song
playSong(song, source);

// Play from chart/playlist
playFromChart(chartData, startIndex);
playFromPlaylist(playlistId, startIndex);
```

## API Migration Reference

The frontend was migrated to use Music Harvester API for charts, search, and discover functionality while keeping TLDR Music API for authentication and user library.

**Migration Documentation**: See `docs/MUSIC_HARVESTER_MIGRATION.md` for:
- Complete endpoint mapping (old → new)
- Response format examples
- Migration phases and status

**Key Changes**:
- Charts: `/api/chart/current` and `/api/chart/global/current`
- Search: `/api/tldr/search` and `/api/tldr/suggest`
- Discover: `/api/playlists/*` and `/api/india/playlist/*`
- "AI Playlists" renamed to "Discover" throughout the UI
