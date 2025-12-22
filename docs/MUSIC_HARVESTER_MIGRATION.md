# Music Harvester API Migration

## New API Base URL
```
https://music-harvester-401132033262.asia-south1.run.app
```

---

## Existing Endpoints (To Be Removed)

### Old TLDR Music API (`tldrmusic-api-401132033262.asia-south1.run.app`)
| Endpoint | Usage | Line |
|----------|-------|------|
| `/songs/{videoId}` | Get song details | 330 |
| `/playlists/{playlistId}` | Get playlist | 377 |
| `/user/{username}` | Get user profile | 676 |
| `/user/{username}/playlists` | Get user playlists | 677 |
| `/global/current` | Get global chart | 877, 939, 7419 |

### Music Conductor API (`music-conductor-401132033262.asia-south1.run.app`)
| Endpoint | Usage | Line |
|----------|-------|------|
| `/api/charts/aggregated?region=india` | India Top 25 | 876, 938 |
| `/api/search/songs?language={lang}` | Search by language | 1325, 1329, 7804, 7807 |
| `/api/search/songs?genre={genre}` | Search by genre | 1332, 7809 |
| `/api/search/songs?q={query}` | Search songs | 1553, 6531, 6781, 9020, 9046 |
| `/api/playlists` | List all playlists | 8465 |
| `/api/playlists/{slug}` | Get specific playlist | 7963, 8611 |

---

## New Music Harvester Endpoints

### For Home Page
| Feature | Endpoint | Method |
|---------|----------|--------|
| India Top 25 | `/api/chart/current?region=india` | GET |
| Global Top 25 | `/api/chart/global/current` | GET |

### For Charts Page
| Feature | Endpoint | Method |
|---------|----------|--------|
| Current Chart | `/api/chart/current?region={india\|global}` | GET |
| Regional Charts List | `/api/chart/regional` | GET |
| Regional Chart | `/api/chart/regional/{region}` | GET |
| Chart History | `/api/chart/history?limit=52` | GET |
| Historical Chart | `/api/chart/{week}` | GET |

### For Discover Page
| Feature | Endpoint | Method |
|---------|----------|--------|
| All Playlists | `/api/playlists?page=1&per_page=50` | GET |
| Playlist Presets | `/api/playlists/presets` | GET |
| Get Playlist | `/api/playlists/{name}` | GET |
| Available Filters | `/api/playlists/filters` | GET |
| Artist Playlist | `/api/india/playlist/artist/{artist}` | GET |
| Genre Playlist | `/api/india/playlist/genre/{genre}` | GET |
| Language Playlist | `/api/india/playlist/language/{language}` | GET |
| Top Songs | `/api/india/playlist/top?genre={g}&language={l}` | GET |
| Discover Random | `/api/india/playlist/discover?limit=50` | GET |
| All Genres | `/api/india/genres?limit=100` | GET |
| Catalog Stats | `/api/india/stats` | GET |

### For Search
| Feature | Endpoint | Method |
|---------|----------|--------|
| Quick Search | `/api/tldr/search?q={query}&limit=5` | GET |
| Full Search | `/api/tldr/search?q={query}&limit=50` | GET |
| Autocomplete | `/api/tldr/suggest?q={query}&limit=10` | GET |
| Exact Lookup | `/api/tldr/lookup?title={t}&artist={a}` | GET |

---

## Response Format Mapping

### Chart Song (Music Harvester)
```json
{
  "rank": 1,
  "title": "Song Title",
  "artist": "Artist Name",
  "score": 8.5,
  "platforms_count": 7,
  "platform_positions": {"spotify": 1, "apple_music": 2},
  "artwork_url": "https://...",
  "genre": "Pop",
  "duration_ms": 210000,
  "lyrics": "...",
  "rank_change": 2,
  "is_new": false,
  "youtube_video_id": "abc123"
}
```

### Search Result (Music Harvester /api/tldr/search)
```json
{
  "title": "Song Title",
  "artist": "Artist Name",
  "artwork_url": "https://...",
  "youtube_video_id": "abc123",
  "genre": "Pop",
  "mood": "Happy",
  "language": "Hindi",
  "album": "Album Name",
  "duration_seconds": 210,
  "year": 2024
}
```

### Playlist (Music Harvester)
```json
{
  "name": "chill_vibes",
  "display_name": "Chill Vibes",
  "description": "Relaxing tracks",
  "track_count": 50,
  "tracks": [
    {
      "title": "Song",
      "artist": "Artist",
      "artwork_url": "...",
      "youtube_video_id": "...",
      "duration_ms": 210000
    }
  ]
}
```

---

## Final Architecture (Dual-API)

**Music Harvester API** (`https://music-harvester-401132033262.asia-south1.run.app`)
- Charts (India Top 25, Global Top 25, Regional)
- Search (`/api/tldr/search`, `/api/tldr/suggest`)
- Discover/Playlists catalog (`/api/playlists`, `/api/india/playlist/*`)

**TLDR Music API** (`https://tldrmusic-api-401132033262.asia-south1.run.app`)
- User Authentication (Google OAuth, JWT tokens)
- User Library (favorites, history, queue, user playlists)
- User preferences and recent searches

---

## Migration Status: COMPLETE

### Phase 1: API Configuration ✅
- Added `MUSIC_HARVESTER_API` constant
- Kept `API_BASE` for auth/library endpoints
- Created mapper functions for Music Harvester responses

### Phase 2: Home Page ✅
- Updated `loadChartData()` to use `/api/chart/current` and `/api/chart/global/current`
- Updated hero section and Quick Picks rendering

### Phase 3: Charts Page ✅
- Updated `openChartFromChartsView()` for new endpoints
- Added regional chart support

### Phase 4: Discover Page ✅
- Renamed `/ai/` to `/discover/`
- Updated all sidebars across HTML files
- Updated view headers and meta tags

### Phase 5: Search ✅
- Updated to use `/api/tldr/search`
- Updated autocomplete to use `/api/tldr/suggest`

### Phase 6: Library (Dual-API Architecture) ✅
- Auth/Library endpoints remain on TLDR Music API
- Both APIs documented in app.js and auth.js

### Phase 7: Cleanup ✅
- Removed `MUSIC_CONDUCTOR_API` alias
- Removed all `mapConductor*` and `getConductorArtwork` aliases
- Updated all "AI Playlists" references to "Discover"
- Updated router.js routes from `/ai/` to `/discover/`
