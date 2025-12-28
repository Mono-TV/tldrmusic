# Backend Playlist API Authentication & Endpoints

**Date**: December 28, 2025
**Investigation**: Music Conductor vs TLDR Music API playlists

---

## 🎯 Executive Summary

**KEY DISCOVERY**: The TLDR Music API already has a **fully functional `/api/curated/*` endpoint** that provides dynamic playlists **WITHOUT requiring authentication**. The Discover page doesn't need Music Conductor API authentication—it can use the existing curated endpoints instead!

---

## 🏗️ Architecture Overview

### Two Separate APIs with Different Purposes

```
┌─────────────────────────────────────────────────────────┐
│                      Frontend                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Music Conductor API          TLDR Music API            │
│  (External Service)            (Our Backend)            │
│  ┌──────────────────┐          ┌──────────────────┐     │
│  │ • Search Songs   │          │ • Auth           │     │
│  │ • AI Generation  │          │ • Library        │     │
│  │ ❌ Auth Required │          │ • Curated ✅     │     │
│  └──────────────────┘          └──────────────────┘     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Music Conductor API
- **URL**: `https://music-conductor-401132033262.asia-south1.run.app`
- **Purpose**: Search, AI features (used by backend playlist generator)
- **Auth**: ✅ **Required** (HTTP Basic, API Key Header, or Query param)
- **Status**: External service, not directly accessible from frontend

### TLDR Music API
- **URL**: `https://tldrmusic-api-401132033262.asia-south1.run.app`
- **Purpose**: User auth, library, **curated playlists**
- **Auth**: ❌ **Not Required** for `/api/curated/*` endpoints
- **Status**: Our backend, ready to use!

---

## ✅ Available Curated Endpoints (No Auth Required!)

### Base URL
```
https://tldrmusic-api-401132033262.asia-south1.run.app/api/curated
```

### 1. Get All Categories

**Endpoint**: `GET /api/curated/categories`

**Response**:
```json
{
  "moods": [
    {
      "id": "mood-chill",
      "name": "Chill",
      "key": "chill",
      "songCount": 3215
    },
    // ... 10 more moods
  ],
  "languages": [
    {
      "id": "lang-hindi",
      "name": "Hindi",
      "key": "hindi",
      "songCount": 202
    },
    // ... 11 more languages
  ],
  "artists": [
    {
      "id": "artist-arijit",
      "name": "Arijit Singh",
      "key": "arijit"
    },
    // ... 19 more artists
  ],
  "eras": [
    {
      "id": "era-2025",
      "name": "2025 Fresh",
      "key": "2025"
    },
    // ... 5 more eras
  ]
}
```

**Real Song Counts** (from API as of Dec 28, 2025):

#### Moods (11 total)
| ID | Name | Songs |
|----|------|-------|
| mood-chill | Chill | 3,215 |
| mood-workout | Workout | 1,597 |
| mood-party | Party | 1,770 |
| mood-romance | Romance | 1,711 |
| mood-sad | Sad | 2,015 |
| mood-focus | Focus | 2,100 |
| mood-gaming | Gaming | 1,354 |
| mood-feel-good | Feel good | 2,165 |
| mood-sleep | Sleep | 1,735 |
| mood-commute | Commute | 2,924 |
| mood-energize | Energize | 2,866 |

#### Languages (12 total)
| ID | Name | Songs |
|----|------|-------|
| lang-hindi | Hindi | 202 |
| lang-tamil | Tamil | 32 |
| lang-telugu | Telugu | 35 |
| lang-punjabi | Punjabi | 493 |
| lang-english | English | 754 |
| lang-bengali | Bengali | 6 |
| lang-kannada | Kannada | 15 |
| lang-malayalam | Malayalam | 17 |
| lang-bhojpuri | Bhojpuri | 5 |
| lang-marathi | Marathi | 18 |
| lang-gujarati | Gujarati | 29 |
| lang-haryanvi | Haryanvi | 84 |

#### Artists (20 total)
- Arijit Singh
- Anirudh Ravichander
- Masoom Sharma
- Kishore Kumar
- Shreya Ghoshal
- Sonu Nigam
- Taylor Swift
- Lata Mangeshkar
- Mohammed Rafi
- Badshah
- Udit Narayan
- Diljit Dosanjh
- Ed Sheeran
- Karan Aujla
- Kumar Sanu
- Chris Brown
- Drake
- Khesari Lal Yadav
- The Weeknd
- Neha Kakkar

#### Eras (6 total)
- 2025 Fresh
- 2024 Top Picks
- 2023 Best Of
- 2022 Favorites
- 2010s Throwback
- Retro Classics

---

### 2. Get Mood Playlist

**Endpoint**: `GET /api/curated/mood/{mood}?limit=50&offset=0`

**Parameters**:
- `mood`: chill, workout, party, romance, sad, focus, gaming, feel-good, sleep, commute, energize
- `limit`: 1-100 (default: 50)
- `offset`: pagination offset (default: 0)

**Response**:
```json
{
  "id": "mood-chill",
  "name": "Chill Vibes",
  "type": "mood",
  "mood": "chill",
  "songs": [
    {
      "title": "The Dress",
      "artist": "Dijon",
      "album": "Absolutely",
      "youtube_video_id": "ws5K_5G_xvI",
      "artwork_url": "https://lh3.googleusercontent.com/...",
      "duration_seconds": 185,
      "mood": "Chill",
      "chart_name": null
    }
    // ... more songs
  ],
  "total": 3215,
  "limit": 50,
  "offset": 0
}
```

---

### 3. Get Language Playlist

**Endpoint**: `GET /api/curated/language/{language}?limit=50&offset=0`

**Parameters**:
- `language`: hindi, tamil, telugu, punjabi, english, bengali, kannada, malayalam, bhojpuri, marathi, gujarati, haryanvi
- `limit`: 1-100 (default: 50)
- `offset`: pagination offset

**Response**: Same format as mood playlist

---

### 4. Get Artist Playlist

**Endpoint**: `GET /api/curated/artist/{artist}?limit=50&offset=0`

**Parameters**:
- `artist`: arijit, anirudh, masoom, kishore, shreya, sonu, taylor, lata, rafi, badshah, udit, diljit, ed, karan, kumar, chris, drake, khesari, weeknd, neha
- `limit`: 1-100 (default: 50)
- `offset`: pagination offset

**Response**: Same format as mood playlist

---

### 5. Get Era Playlist

**Endpoint**: `GET /api/curated/era/{era}?limit=50&offset=0`

**Parameters**:
- `era`: 2025, 2024, 2023, 2022, 2010s, retro
- `limit`: 1-100 (default: 50)
- `offset`: pagination offset

**Response**: Same format as mood playlist (but songs may not have `youtube_video_id`)

---

### 6. Search Curated Songs

**Endpoint**: `GET /api/curated/search?q={query}&limit=20`

**Parameters**:
- `q`: search query (required)
- `limit`: 1-50 (default: 20)

**Response**:
```json
{
  "query": "arijit",
  "songs": [ /* array of songs */ ],
  "count": 15
}
```

---

## 🔍 Backend Implementation Details

### Database Connection

The curated endpoints connect to a **separate MongoDB database** called `music_harvester`:

```python
# From backend/src/api/routes/curated.py
MUSIC_HARVESTER_URL = "mongodb://circuit-house:ch998812%403@52.77.214.150:27017/music_harvester?authSource=admin"
```

**Collections Used**:
- `youtube_music_songs` - Songs with YouTube video IDs (for moods, artists)
- `songs` - Extended song catalog (for languages, eras)

### No Authentication Required

The curated router is registered **without auth middleware**:

```python
# From backend/src/main.py
app.include_router(curated_router, prefix=settings.API_PREFIX)  # /api prefix
```

**Result**: All `/api/curated/*` endpoints are **publicly accessible**.

---

## 🔐 Music Conductor API Authentication (For Reference)

While the frontend doesn't need it, here's how the backend authenticates with Music Conductor:

### Service-to-Service Usage

The backend's `PlaylistGeneratorService` uses Music Conductor API for AI playlist generation:

```python
# From backend/src/services/playlist_generator.py
MUSIC_CONDUCTOR_API = "https://music-conductor-401132033262.asia-south1.run.app"

# Calls /api/search/songs without auth (might be public or use backend credentials)
response = await client.get(
    f"{MUSIC_CONDUCTOR_API}/api/search/songs",
    params={"q": query, "has_youtube": "true"}
)
```

**Note**: No API key is shown in the code. Either:
1. Music Conductor's `/api/search/songs` is public
2. Authentication happens at network/infrastructure level
3. API key is in environment variables (not found in `.env` files)

---

## 🚀 Implementation Recommendations

### Option 1: Replace Hardcoded Playlists ✅ RECOMMENDED

**Current**: 64 hardcoded playlists in `app.js` (lines 7751-7805)

**New Approach**:
```javascript
// Fetch dynamic playlists from curated API
async function loadDiscoverCategories() {
    const response = await fetch(
        'https://tldrmusic-api-401132033262.asia-south1.run.app/api/curated/categories'
    );
    const data = await response.json();

    // Use real song counts
    const moodPlaylists = data.moods;       // 11 moods with real counts
    const languagePlaylists = data.languages; // 12 languages with real counts
    const artistPlaylists = data.artists;    // 20 artists
    const eraPlaylists = data.eras;          // 6 eras

    renderDiscoverPage(moodPlaylists, languagePlaylists, artistPlaylists, eraPlaylists);
}

// Fetch actual playlist songs
async function openCuratedPlaylist(type, key) {
    const response = await fetch(
        `https://tldrmusic-api-401132033262.asia-south1.run.app/api/curated/${type}/${key}?limit=50`
    );
    const playlist = await response.json();

    // playlist.songs is ready to play!
    showPlaylistDetailView(playlist);
}
```

**Benefits**:
- ✅ Always up-to-date song counts
- ✅ No hardcoded data maintenance
- ✅ Supports pagination (load more songs)
- ✅ No authentication required
- ✅ Real YouTube video IDs ready to play

---

### Option 2: Hybrid Approach

Keep hardcoded data as **UI scaffolding**, fetch real counts on load:

```javascript
// Show UI immediately with placeholders
const moodPlaylists = [
    { id: 'mood-chill', name: 'Chill Vibes', songCount: 0 }, // Placeholder
    // ...
];

renderDiscoverPage(moodPlaylists); // Fast initial render

// Update with real counts in background
loadDiscoverCategories().then(data => {
    updatePlaylistCounts(data); // Update UI with real counts
});
```

---

## 📊 Current vs Real Data Comparison

### Hardcoded (app.js) vs Actual (API)

| Category | Hardcoded Count | Actual Count | Difference |
|----------|----------------|--------------|------------|
| Hindi | 13,404 | 202 | 📉 -98.5% |
| Chill | 3,215 | 3,215 | ✅ Match |
| Workout | 1,597 | 1,597 | ✅ Match |
| English | 2,074 | 754 | 📉 -63.6% |
| Punjabi | 2,491 | 493 | 📉 -80.2% |

**Note**: Language counts differ significantly. Mood counts match exactly, suggesting hardcoded values were taken from a previous API snapshot.

---

## 🎨 Frontend Integration Plan

### Step 1: Update API Constants

```javascript
// Add to app.js
const CURATED_API = 'https://tldrmusic-api-401132033262.asia-south1.run.app/api/curated';
```

### Step 2: Replace `renderDiscoverPlaylists()`

```javascript
async function renderDiscoverPlaylists() {
    showLoadingState();

    try {
        const response = await fetch(`${CURATED_API}/categories`);
        const data = await response.json();

        // Use real data instead of hardcoded arrays
        renderMoodPlaylists(data.moods);
        renderLanguagePlaylists(data.languages);
        renderArtistPlaylists(data.artists);
        renderEraPlaylists(data.eras);

    } catch (error) {
        console.error('Failed to load curated playlists:', error);
        // Fallback to hardcoded data
        renderWithFallbackData();
    }
}
```

### Step 3: Update Playlist Click Handlers

```javascript
async function openMoodPlaylist(moodKey) {
    const response = await fetch(`${CURATED_API}/mood/${moodKey}?limit=50`);
    const playlist = await response.json();

    // Convert to app format if needed
    const songs = playlist.songs.map(song => ({
        title: song.title,
        artist: song.artist,
        video_id: song.youtube_video_id,
        thumbnail_url: song.artwork_url,
        duration_seconds: song.duration_seconds
    }));

    showPlaylistDetailView({
        name: playlist.name,
        type: playlist.type,
        songs: songs,
        total: playlist.total
    });
}
```

### Step 4: Add Pagination Support

```javascript
async function loadMorePlaylistSongs(playlistType, playlistKey, offset) {
    const response = await fetch(
        `${CURATED_API}/${playlistType}/${playlistKey}?limit=50&offset=${offset}`
    );
    const data = await response.json();

    appendSongsToPlaylist(data.songs);
}
```

---

## 🔧 Code Changes Summary

### Files to Modify

1. **app.js**
   - Add `CURATED_API` constant
   - Replace `renderDiscoverPlaylists()` with API call
   - Update playlist click handlers (mood, language, artist, era)
   - Remove hardcoded arrays (lines 7751-7805) or keep as fallback

2. **index.html**
   - No changes needed (UI already supports dynamic data)

### Lines of Code Impact

- **Remove**: ~54 lines (hardcoded playlist arrays)
- **Add**: ~80 lines (API integration functions)
- **Net**: +26 lines (but dynamic and maintainable)

---

## ✅ Benefits of Using Curated API

### 1. Data Accuracy
- **Real-time counts** from database
- No manual updates needed
- Consistent with backend state

### 2. Maintainability
- Single source of truth (database)
- Add new playlists in backend → auto-appear in frontend
- No hardcoded data to sync

### 3. Performance
- Pagination support (load 50 songs at a time)
- Faster initial page load (categories only)
- Songs loaded on-demand

### 4. User Experience
- Always up-to-date
- Supports "Load More" for large playlists
- Search within curated catalog

### 5. No Authentication
- Public endpoints
- No API keys to manage
- Works immediately

---

## 🚨 Potential Issues & Solutions

### Issue 1: Some Songs Missing `youtube_video_id`

**Problem**: Era playlists may have songs without YouTube IDs (from `songs` collection)

**Solution**:
```javascript
// Filter out songs without video IDs
const playableSongs = playlist.songs.filter(s => s.youtube_video_id);

// Or show placeholder with "Play on YouTube" search link
if (!song.youtube_video_id) {
    showYouTubeSearchButton(song.title, song.artist);
}
```

### Issue 2: Language Counts Lower Than Expected

**Problem**: Hindi has only 202 songs (expected 13,404)

**Reason**: Different database collection (regional charts vs full catalog)

**Solution**:
- Accept current counts (they're real)
- Or enhance backend to query multiple collections
- Or add note "From regional charts"

### Issue 3: Artwork URLs from Different Sources

**Problem**: Some use `lh3.googleusercontent.com`, others use `i.ytimg.com`

**Solution**: Already handled by `getYouTubeThumbnail()` function

---

## 📝 Action Items

### Immediate (High Priority)
- [x] ✅ **Verify curated endpoints work** (TESTED & CONFIRMED)
- [ ] **Update frontend to use `/api/curated/categories`**
- [ ] **Replace hardcoded playlists with API data**
- [ ] **Test all playlist types** (mood, language, artist, era)

### Short Term
- [ ] **Add pagination** for large playlists
- [ ] **Add loading states** for API calls
- [ ] **Handle songs without video IDs**
- [ ] **Update CLAUDE.md** with curated endpoint docs

### Long Term
- [ ] **Add curated search** to Discover page
- [ ] **Add "Load More"** button for playlists
- [ ] **Cache categories** in localStorage
- [ ] **Add playlist sorting** (popularity, alphabetical, recent)

---

## 🎉 Conclusion

**Discovery**: The frontend doesn't need Music Conductor API authentication. The TLDR Music API already provides:

✅ **49 Curated Playlists** (11 moods + 12 languages + 20 artists + 6 eras)
✅ **Public Access** (no auth required)
✅ **Real-Time Data** (dynamic song counts)
✅ **Ready to Use** (deployed and working)

**Next Step**: Replace hardcoded playlists in `app.js` with `/api/curated/*` endpoints for a fully dynamic Discover page.

**Estimated Implementation Time**: 2-4 hours

**Impact**: Dynamic playlists, easier maintenance, accurate song counts, no authentication complexity.
