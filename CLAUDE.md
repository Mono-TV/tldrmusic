# TLDR Music

**TLDR of India's Musicscape** - A music chart aggregator that consolidates rankings from multiple platforms to create India's definitive Top 25 and Global Top 25.

## Project Overview

TLDR Music scrapes weekly music charts from Billboard, YouTube Music, Gaana, JioSaavn, Spotify, Apple Music, Shazam, and Prime Music, then uses a weighted ranking algorithm to produce consolidated charts. Songs are matched via YouTube search and played through an embedded YouTube player.

**Live Site**: https://mono-tv.github.io/tldrmusic/

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

### UI Components

- **Sidebar Navigation**: Charts, Library, Playlists
- **Detail Views**: Full-page views for playlists, favorites, history
- **Profile Panel**: User settings, logout
- **Modals**: Create playlist, add to playlist, share, export

## Backend API

**Base URL**: `https://tldrmusic-api-401132033262.asia-south1.run.app`

### Public Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/chart/current` | GET | Current India Top 25 chart |
| `/global/current` | GET | Current Global Top 25 chart |
| `/regional/{language}` | GET | Regional chart by language |
| `/rank-history/{song_id}` | GET | Rank history for a song |
| `/search?q={query}` | GET | Search songs |
| `/songs/{song_id}` | GET | Song details |
| `/artists/{artist_id}` | GET | Artist details |
| `/docs` | GET | API documentation |

### Auth Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/auth/google` | POST | Google OAuth login |
| `/auth/refresh` | POST | Refresh access token |
| `/auth/logout` | POST | Logout (invalidate refresh token) |

### Protected Endpoints (Require Auth)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/library/favorites` | GET/POST/DELETE | Manage favorites |
| `/library/history` | GET/POST | Manage listening history |
| `/library/playlists` | GET/POST | List/create playlists |
| `/library/playlists/{id}` | GET/PUT/DELETE | Manage specific playlist |
| `/library/playlists/{id}/songs` | POST/DELETE | Add/remove songs |
| `/library/playlists/{id}/share` | POST | Generate share link |

### Admin Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/admin/upload` | POST | Upload new chart (requires API key) |

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
