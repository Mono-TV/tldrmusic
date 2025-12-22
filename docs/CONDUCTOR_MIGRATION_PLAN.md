# Music Conductor API Migration Plan

## Overview

Migrate frontend from **Music Harvester API** to **Music Conductor API** to fix broken genre/language playlists and improve data quality.

## API URLs

| API | Current | New |
|-----|---------|-----|
| Charts/Search/Playlists | `music-harvester-401132033262.asia-south1.run.app` | `music-conductor-401132033262.asia-south1.run.app` |
| Auth/Library | `tldrmusic-api-401132033262.asia-south1.run.app` | No change |

## Current Issues (Music Harvester)

| Feature | Status | Issue |
|---------|--------|-------|
| India Chart | OK | Working |
| Global Chart | OK | Working |
| Search | OK | Working |
| Genre Playlists | **BROKEN** | 404 - "No songs found" |
| Language Playlists | **BROKEN** | 404 - "No songs found" |
| Artist Playlists | **BROKEN** | 404 |
| Discover (random) | **BROKEN** | Returns empty array |
| Regional Charts | PARTIAL | Missing YouTube IDs |

## Endpoint Mapping

### Charts

| Feature | Harvester (Current) | Conductor (New) |
|---------|---------------------|-----------------|
| India Chart | `GET /api/chart/current?region=india` | `GET /api/charts/aggregated?region=india&limit=25` |
| Global Chart | `GET /api/chart/global/current` | `GET /api/charts/aggregated?region=global&limit=25` |

**Response format changes:**
- Both return `songs` array
- Conductor uses `youtube_id` (Harvester uses `youtube_video_id`)
- Conductor adds: `isrc`, `spotify_id`, `apple_music_id`, `song_id`
- Conductor provides `platform_ranks` object instead of `platform_positions`

### Search

| Feature | Harvester (Current) | Conductor (New) |
|---------|---------------------|-----------------|
| Quick Search | `GET /api/tldr/search?q={q}&limit=5` | `GET /api/search/songs?q={q}&has_youtube=true&per_page=5` |
| Full Search | `GET /api/tldr/search?q={q}&limit=50` | `GET /api/search/songs?q={q}&has_youtube=true&per_page=50` |
| Autocomplete | `GET /api/tldr/suggest?q={q}&limit=N` | `GET /api/search/suggest?q={q}&limit=N` |

**Response format changes:**
- Both use `songs` array with `youtube_video_id`
- Conductor adds `facets` for filtering
- Conductor returns `found` count (Harvester uses `total`)

### Playlists

| Feature | Harvester (Current) | Conductor (New) |
|---------|---------------------|-----------------|
| List All | `GET /api/playlists` | `GET /api/playlists` |
| Get Playlist | `GET /api/playlists/{slug}` | `GET /api/playlists/{slug}` |
| Genre (BROKEN) | `GET /api/india/playlist/genre/{genre}` | Use `/api/playlists/{slug}` |
| Language (BROKEN) | `GET /api/india/playlist/language/{lang}` | Use `/api/playlists/{slug}` |
| Discover (BROKEN) | `GET /api/india/playlist/discover` | Random from `/api/playlists` |
| Artist (BROKEN) | `GET /api/india/playlist/artist/{artist}` | Not available |

**Playlist slug mapping:**

```javascript
// Genre slugs
const GENRE_SLUGS = {
  'hip-hop': 'hip-hop-rap',
  'pop': 'pop-hits',
  'rock': 'rock-classics',
  'electronic': 'electronic-dance',
  'rnb': 'rnb-soul',
  'latin': 'latin-vibes',
  'jazz': 'jazz-classics',
  'classical': 'classical-music',
  'world': 'world-music',
  'alternative': 'alternative-indie'
};

// Language slugs
const LANGUAGE_SLUGS = {
  'hindi': 'hindi-hits',
  'english': 'english-hits',
  'tamil': 'tamil-hits',
  'telugu': 'telugu-hits',
  'punjabi': 'punjabi-hits',
  'spanish': 'spanish-hits',
  'korean': 'korean-hits',
  'japanese': 'japanese-hits'
};

// Mood slugs
const MOOD_SLUGS = {
  'chill': 'chill-vibes',
  'workout': 'workout-energy',
  'party': 'party-mode',
  'focus': 'focus-study'
};
```

---

## Code Changes Required

### 1. Update API Constants (app.js:6)

```javascript
// Before
const MUSIC_HARVESTER_API = 'https://music-harvester-401132033262.asia-south1.run.app';

// After
const MUSIC_CONDUCTOR_API = 'https://music-conductor-401132033262.asia-south1.run.app';
```

### 2. Update mapHarvesterSong() (app.js:25-43)

Already handles both `youtube_id` and `youtube_video_id` - no changes needed.

### 3. Update Chart Fetching (app.js:884-896)

```javascript
// Before
const [indiaResponse, globalResponse] = await Promise.all([
    fetch(`${MUSIC_HARVESTER_API}/api/chart/current?region=india`),
    fetch(`${MUSIC_HARVESTER_API}/api/chart/global/current`)
]);

// After
const [indiaResponse, globalResponse] = await Promise.all([
    fetch(`${MUSIC_CONDUCTOR_API}/api/charts/aggregated?region=india&limit=25`),
    fetch(`${MUSIC_CONDUCTOR_API}/api/charts/aggregated?region=global&limit=25`)
]);
```

**Same change needed at:** lines 945-947

### 4. Update Search Functions

**Quick Search (app.js:6534-6535):**
```javascript
// Before
`${MUSIC_HARVESTER_API}/api/tldr/search?q=${encodeURIComponent(query)}&limit=5`

// After
`${MUSIC_CONDUCTOR_API}/api/search/songs?q=${encodeURIComponent(query)}&has_youtube=true&per_page=5`
```

**Full Search (app.js:6784-6785):**
```javascript
// Before
`${MUSIC_HARVESTER_API}/api/tldr/search?q=${encodeURIComponent(query)}&limit=50`

// After
`${MUSIC_CONDUCTOR_API}/api/search/songs?q=${encodeURIComponent(query)}&has_youtube=true&per_page=50`
```

### 5. Update Discover India Section (app.js:1328-1340)

Replace broken `/api/india/playlist/*` with Conductor playlists:

```javascript
// Before
if (genreKey === 'Discover') {
    url = `${MUSIC_HARVESTER_API}/api/india/playlist/discover?limit=10`;
} else if (['Punjabi', 'Tamil', 'Telugu'].includes(genreKey)) {
    const langCode = genreKey.toLowerCase();
    url = `${MUSIC_HARVESTER_API}/api/india/playlist/language/${langCode}`;
} else {
    url = `${MUSIC_HARVESTER_API}/api/india/playlist/genre/${encodeURIComponent(genreKey.toLowerCase())}`;
}

// After
const DISCOVER_SLUG_MAP = {
    'Indian Pop': 'pop-hits',
    'Bollywood': 'hindi-hits',
    'Hip-Hop': 'hip-hop-rap',
    'Lo-Fi': 'chill-vibes',
    'Punjabi': 'punjabi-hits',
    'Tamil': 'tamil-hits',
    'Telugu': 'telugu-hits',
    'Discover': 'pop-hits'  // Default to pop for random
};

const slug = DISCOVER_SLUG_MAP[genreKey] || 'pop-hits';
url = `${MUSIC_CONDUCTOR_API}/api/playlists/${slug}`;
```

**Same change needed at:** lines 7806-7813

### 6. Update Playlist Fetching (app.js:7968, 8470, 8616)

```javascript
// Before
fetch(`${MUSIC_HARVESTER_API}/api/playlists/${slug}`)
fetch(`${MUSIC_HARVESTER_API}/api/playlists`)

// After
fetch(`${MUSIC_CONDUCTOR_API}/api/playlists/${slug}`)
fetch(`${MUSIC_CONDUCTOR_API}/api/playlists`)
```

### 7. Update Artist Playlist (app.js:1560)

Artist playlists are not available in Conductor API. Options:
1. Remove artist playlist feature
2. Show "Coming soon" message
3. Fall back to search results

```javascript
// Before
const response = await fetch(`${MUSIC_HARVESTER_API}/api/india/playlist/artist/${encodeURIComponent(artistName)}`);

// After - Use search instead
const response = await fetch(`${MUSIC_CONDUCTOR_API}/api/search/songs?q=${encodeURIComponent(artistName)}&has_youtube=true&per_page=50`);
```

### 8. Remove/Update Regional Charts

Regional charts in Conductor are different. Options:
1. Use aggregated chart with language filter
2. Keep using Harvester for regional (hybrid approach)
3. Remove regional charts temporarily

---

## Migration Steps

### Phase 1: API Constant Change
1. Rename `MUSIC_HARVESTER_API` to `MUSIC_CONDUCTOR_API`
2. Update URL to `https://music-conductor-401132033262.asia-south1.run.app`

### Phase 2: Chart Endpoints
1. Update India chart endpoint
2. Update Global chart endpoint
3. Update chart refresh function
4. Test chart loading

### Phase 3: Search Endpoints
1. Update quick search
2. Update full search
3. Update autocomplete (if used)
4. Test search functionality

### Phase 4: Playlist Endpoints
1. Update playlist list endpoint
2. Update playlist detail endpoint
3. Update Discover India mapping
4. Update Featured Playlists mapping
5. Test all playlist features

### Phase 5: Cleanup
1. Remove broken `/api/india/playlist/*` calls
2. Update or remove artist playlist feature
3. Update DISCOVER_GENRES mapping
4. Test end-to-end

---

## Testing Checklist

- [ ] Home page loads with India Top 25
- [ ] Global Top 25 loads correctly
- [ ] Songs play via YouTube
- [ ] Quick search works
- [ ] Full search returns results
- [ ] Discover page shows playlists
- [ ] Mood playlists load
- [ ] Language playlists load
- [ ] Genre playlists load
- [ ] Playlist detail view works
- [ ] Songs from playlists play

---

## Rollback Plan

If issues occur, revert to Harvester API by changing the constant back:

```javascript
const MUSIC_CONDUCTOR_API = 'https://music-harvester-401132033262.asia-south1.run.app';
```

Note: This will restore broken genre/language playlists issue.
