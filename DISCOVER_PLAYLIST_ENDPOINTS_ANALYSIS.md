# Discover Page Playlist Endpoints Analysis

**Date**: December 28, 2025
**Current API**: `https://tldr-music-401132033262.asia-south1.run.app`

---

## Executive Summary

The Discover page currently uses **hardcoded playlists** with static data. The Music Conductor API has several endpoints available that could enhance the Discover experience with dynamic, real-time playlist data.

---

## Current State

### API Being Used
```javascript
const MUSIC_CONDUCTOR_API = 'https://tldr-music-401132033262.asia-south1.run.app';
```

### Current Endpoints in Use

| Endpoint | Method | Status | Usage |
|----------|--------|--------|-------|
| `/api/playlists` | GET | ✅ Working | Fetch all available playlists |
| `/api/playlists/{slug}` | GET | ✅ Working | Get specific playlist by slug |

**Current API Response** (as of Dec 28, 2025):
```json
{
    "playlists": [
        {
            "id": "be349062-59c2-4c41-a080-663de687a283",
            "slug": "ai-2e63d308",
            "name": "popular arijit singh romantic songs",
            "description": "AI-generated playlist",
            "type": "curated",
            "category": "ai-generated",
            "total_tracks": 10
        },
        {
            "id": "d7dbcff7-4beb-4ddf-b6e5-0309d848a2d6",
            "slug": "ai-d5c99a10",
            "name": "upbeat bollywood songs",
            "description": "AI-generated playlist",
            "type": "curated",
            "category": "ai-generated",
            "total_tracks": 5
        }
    ],
    "total": 2
}
```

**Available Types**:
```json
{
    "types": {
        "curated": 2
    },
    "available": ["curated"]
}
```

---

## Available Music Conductor API Endpoints

According to the **OpenAPI specification** (`https://music-conductor-401132033262.asia-south1.run.app`):

### Playlist Endpoints

| Endpoint | Method | Auth Required | Description | Parameters |
|----------|--------|---------------|-------------|------------|
| `/api/playlists` | GET | ✅ Yes | List all available playlists | `type`: Filter by type (language, genre, mood) |
| `/api/playlists/types` | GET | ✅ Yes | Get available playlist types with counts | None |
| `/api/playlists/{slug}` | GET | ✅ Yes | Get a specific playlist | `slug`, `include_tracks`: Include full track details |
| `/api/playlists/by-type/{type}` | GET | ✅ Yes | Get all playlists of a specific type | `type`: language, genre, mood |
| `/api/playlists/refresh/{slug}` | POST | ✅ Yes | Refresh a playlist with latest songs | `slug` |

**Authentication Methods**:
- HTTP Basic Auth
- API Key in Header (`X-API-Key`)
- API Key in Query (`api_key`)

---

## Documentation vs Reality Gap

### Documented Playlists (from CLAUDE.md)

**22 Total Playlists** allegedly available:

#### Language-based (8):
- `hindi-hits`
- `english-hits`
- `tamil-hits`
- `telugu-hits`
- `punjabi-hits`
- `spanish-hits`
- `korean-hits`
- `japanese-hits`

#### Genre-based (10):
- `hip-hop-rap`
- `pop-hits`
- `rock-classics`
- `electronic-dance`
- `rnb-soul`
- `latin-vibes`
- `jazz-classics`
- `classical-music`
- `world-music`
- `alternative-indie`

#### Mood-based (4):
- `chill-vibes`
- `workout-energy`
- `party-mode`
- `focus-study`

### Actually Available (from API)
- **2 AI-generated playlists** (dynamic, not from documented slugs)
- No language/genre/mood playlists visible without authentication

**Status**: 🔴 **DISCREPANCY DETECTED**

---

## Current Discover Page Implementation

### Hardcoded Playlists in `app.js`

The Discover page uses **static playlist metadata** with hardcoded song counts:

#### Featured Playlists (lines 8383-8398)
```javascript
const featuredPlaylists = [
    { id: 'featured-indian-pop', name: 'Indian Pop', genre: 'Indian Pop', songCount: 8500 },
    { id: 'featured-bollywood', name: 'Bollywood', genre: 'Bollywood', songCount: 12000 },
    { id: 'featured-pop', name: 'Pop', genre: 'Pop', songCount: 6200 },
    { id: 'featured-hiphop', name: 'Hip-Hop', genre: 'Hip-Hop/Rap', songCount: 4800 },
    { id: 'featured-electronic', name: 'Electronic', genre: 'Electronic', songCount: 3500 },
    { id: 'featured-rock', name: 'Rock', genre: 'Rock', songCount: 2800 },
    { id: 'featured-punjabi', name: 'Punjabi', genre: 'Punjabi', songCount: 5200 },
    { id: 'featured-tamil', name: 'Tamil', genre: 'Tamil', songCount: 4800 },
    { id: 'featured-telugu', name: 'Telugu', genre: 'Telugu', songCount: 3900 },
    { id: 'featured-rnb', name: 'R&B/Soul', genre: 'R&B/Soul', songCount: 3000 },
    { id: 'featured-indie', name: 'Indie', genre: 'Indie', songCount: 2500 },
    { id: 'featured-kpop', name: 'K-Pop', genre: 'K-Pop', songCount: 3200 },
    { id: 'featured-jpop', name: 'J-Pop', genre: 'J-Pop', songCount: 2800 },
    { id: 'featured-latin', name: 'Latin', genre: 'Latin', songCount: 4200 },
    { id: 'featured-english', name: 'English Hits', genre: 'English', songCount: 5000 },
    { id: 'featured-discover', name: 'Discover', genre: 'Discover', songCount: 76000 }
];
```

#### Mood Playlists (lines 7751-7761)
```javascript
const moodPlaylists = [
    { id: 'mood-chill', name: 'Chill Vibes', mood: 'chill', songCount: 3215 },
    { id: 'mood-workout', name: 'Workout Beats', mood: 'workout', songCount: 1597 },
    { id: 'mood-party', name: 'Party Anthems', mood: 'party', songCount: 1770 },
    { id: 'mood-romance', name: 'Love Songs', mood: 'romance', songCount: 1711 },
    { id: 'mood-sad', name: 'Sad Songs', mood: 'sad', songCount: 2015 },
    { id: 'mood-focus', name: 'Deep Focus', mood: 'focus', songCount: 2100 },
    { id: 'mood-gaming', name: 'Gaming Mode', mood: 'gaming', songCount: 1354 },
    { id: 'mood-feel-good', name: 'Feel Good Hits', mood: 'feel-good', songCount: 2165 },
    { id: 'mood-sleep', name: 'Sleep Sounds', mood: 'sleep', songCount: 1735 },
    { id: 'mood-commute', name: 'Road Trip Mix', mood: 'commute', songCount: 2924 },
    { id: 'mood-energize', name: 'Energy Boost', mood: 'energize', songCount: 2866 }
];
```

#### Language Playlists (lines 7764-7775)
```javascript
const languagePlaylists = [
    { id: 'lang-hindi', name: 'Hindi Hits', lang: 'hindi', songCount: 13404 },
    { id: 'lang-tamil', name: 'Tamil Tracks', lang: 'tamil', songCount: 4858 },
    { id: 'lang-telugu', name: 'Telugu Tunes', lang: 'telugu', songCount: 3874 },
    { id: 'lang-punjabi', name: 'Punjabi Beats', lang: 'punjabi', songCount: 2491 },
    { id: 'lang-english', name: 'English Pop', lang: 'english', songCount: 2074 },
    { id: 'lang-bengali', name: 'Bengali Vibes', lang: 'bengali', songCount: 1495 },
    { id: 'lang-kannada', name: 'Kannada Hits', lang: 'kannada', songCount: 1438 },
    { id: 'lang-malayalam', name: 'Malayalam Melodies', lang: 'malayalam', songCount: 858 },
    { id: 'lang-bhojpuri', name: 'Bhojpuri Beats', lang: 'bhojpuri', songCount: 618 },
    { id: 'lang-marathi', name: 'Marathi Mix', lang: 'marathi', songCount: 268 },
    { id: 'lang-gujarati', name: 'Gujarati Grooves', lang: 'gujarati', songCount: 302 },
    { id: 'lang-haryanvi', name: 'Haryanvi Hits', lang: 'haryanvi', songCount: 157 }
];
```

#### Artist Playlists (lines 7778-7797)
```javascript
const artistPlaylists = [
    { id: 'artist-arijit', name: 'Arijit Singh', songCount: 108 },
    { id: 'artist-anirudh', name: 'Anirudh Ravichander', songCount: 99 },
    { id: 'artist-masoom', name: 'Masoom Sharma', songCount: 86 },
    { id: 'artist-kishore', name: 'Kishore Kumar', songCount: 77 },
    { id: 'artist-shreya', name: 'Shreya Ghoshal', songCount: 76 },
    { id: 'artist-sonu', name: 'Sonu Nigam', songCount: 75 },
    { id: 'artist-taylor', name: 'Taylor Swift', songCount: 74 },
    { id: 'artist-lata', name: 'Lata Mangeshkar', songCount: 70 },
    { id: 'artist-rafi', name: 'Mohammed Rafi', songCount: 57 },
    { id: 'artist-badshah', name: 'Badshah', songCount: 57 },
    { id: 'artist-udit', name: 'Udit Narayan', songCount: 56 },
    { id: 'artist-diljit', name: 'Diljit Dosanjh', songCount: 55 },
    { id: 'artist-ed', name: 'Ed Sheeran', songCount: 52 },
    { id: 'artist-karan', name: 'Karan Aujla', songCount: 51 },
    { id: 'artist-kumar', name: 'Kumar Sanu', songCount: 50 },
    { id: 'artist-chris', name: 'Chris Brown', songCount: 48 },
    { id: 'artist-drake', name: 'Drake', songCount: 47 },
    { id: 'artist-khesari', name: 'Khesari Lal Yadav', songCount: 47 },
    { id: 'artist-weeknd', name: 'The Weeknd', songCount: 45 },
    { id: 'artist-neha', name: 'Neha Kakkar', songCount: 40 }
];
```

#### Era Playlists (lines 7800-7805)
```javascript
const eraPlaylists = [
    { id: 'era-2025', name: '2025 Fresh', era: '2025', songCount: 3187 },
    { id: 'era-2024', name: '2024 Top Picks', era: '2024', songCount: 3147 },
    { id: 'era-2023', name: '2023 Best Of', era: '2023', songCount: 2459 },
    { id: 'era-2022', name: '2022 Favorites', era: '2022', songCount: 2331 },
    { id: 'era-2010s', name: '2010s Throwback', era: '2010s', songCount: 5000 },
    { id: 'era-retro', name: 'Retro Classics', era: 'retro', songCount: 3000 }
];
```

**Total**: 64 hardcoded playlists across 5 categories

---

## Slug Mapping System

The app uses `PLAYLIST_SLUG_MAP` (lines 7813-7859) to map local IDs to API slugs:

```javascript
const PLAYLIST_SLUG_MAP = {
    // Featured playlists
    'Indian Pop': 'pop-hits',
    'Bollywood': 'bollywood-hits',
    'Pop': 'pop-hits',
    'Hip-Hop/Rap': 'hip-hop-rap',
    'Electronic': 'electronic-dance',
    'Rock': 'rock-classics',
    // ... many more mappings
};
```

**Issue**: Mapping relies on slugs that may not exist on the actual API.

---

## Recommendations

### Option 1: Use Dynamic Playlist Fetching ✅ RECOMMENDED

**Implementation**:
1. Call `/api/playlists` or `/api/playlists/by-type/{type}` to get **real-time playlist data**
2. Replace hardcoded arrays with API responses
3. Show actual track counts from API
4. Auto-update when new playlists are added to backend

**Benefits**:
- Always up-to-date
- No maintenance of hardcoded data
- Accurate song counts
- Supports dynamic AI playlists

**Code Changes Needed**:
```javascript
// Instead of hardcoded arrays
async function fetchPlaylistsByType(type) {
    const response = await fetch(
        `${MUSIC_CONDUCTOR_API}/api/playlists/by-type/${type}`,
        { headers: { 'X-API-Key': API_KEY } } // If auth required
    );
    return await response.json();
}

// Then use in Discover page
const moodPlaylists = await fetchPlaylistsByType('mood');
const genrePlaylists = await fetchPlaylistsByType('genre');
const languagePlaylists = await fetchPlaylistsByType('language');
```

### Option 2: Hybrid Approach

Keep hardcoded data as **fallback**, fetch from API as **primary source**:
```javascript
async function loadPlaylists() {
    try {
        const apiPlaylists = await fetchPlaylistData();
        return apiPlaylists.length > 0 ? apiPlaylists : FALLBACK_PLAYLISTS;
    } catch (error) {
        console.warn('Using fallback playlists:', error);
        return FALLBACK_PLAYLISTS;
    }
}
```

### Option 3: Add Authentication to Frontend

If endpoints require auth:
1. Store API key in environment variable
2. Include in requests to Music Conductor API
3. Use JWT tokens for user-specific playlists

---

## Missing Features That Could Be Added

### 1. Playlist Type Filter
```javascript
// New endpoint: /api/playlists/types
// Returns: { "types": { "mood": 4, "genre": 10, "language": 8 }, "available": [...] }
```

**UI Addition**:
```html
<select id="playlistTypeFilter" onchange="filterPlaylists()">
    <option value="all">All Playlists</option>
    <option value="mood">By Mood</option>
    <option value="genre">By Genre</option>
    <option value="language">By Language</option>
</select>
```

### 2. Playlist Refresh Button
```javascript
// New endpoint: POST /api/playlists/refresh/{slug}
async function refreshPlaylist(slug) {
    const response = await fetch(
        `${MUSIC_CONDUCTOR_API}/api/playlists/refresh/${slug}`,
        { method: 'POST', headers: { 'X-API-Key': API_KEY } }
    );
    // Re-fetch and update UI
}
```

**UI Addition**:
```html
<button onclick="refreshPlaylist('chill-vibes')" title="Refresh with latest songs">
    🔄 Refresh
</button>
```

### 3. Search/Filter Playlists
```javascript
// Filter playlists by name/description
function searchPlaylists(query) {
    const filtered = allPlaylists.filter(p =>
        p.name.toLowerCase().includes(query.toLowerCase()) ||
        p.description.toLowerCase().includes(query.toLowerCase())
    );
    renderFilteredPlaylists(filtered);
}
```

### 4. Playlist Stats Dashboard
```javascript
// Show aggregate stats
async function showPlaylistStats() {
    const types = await fetch(`${MUSIC_CONDUCTOR_API}/api/playlists/types`).then(r => r.json());
    // Display: "4 Mood Playlists • 10 Genre Playlists • 8 Language Playlists"
}
```

---

## Action Items

### Immediate (High Priority)
- [ ] **Investigate authentication** - Determine why API requires auth and how to access
- [ ] **Test documented slugs** - Verify if `chill-vibes`, `pop-hits`, etc. actually exist
- [ ] **Check music-conductor project** - See if it's a separate service with those playlists

### Short Term
- [ ] **Replace hardcoded playlists** with dynamic API calls
- [ ] **Add playlist type filter** UI
- [ ] **Implement error handling** for missing playlists
- [ ] **Update CLAUDE.md** with accurate playlist list

### Long Term
- [ ] **Add playlist refresh** functionality
- [ ] **Implement playlist search**
- [ ] **Create playlist stats** dashboard
- [ ] **Support user-generated playlists** in Discover section

---

## API Access Questions

Before implementing, clarify:

1. ✅ **Is authentication required for all endpoints?**
   - Answer: Yes, according to OpenAPI spec

2. ❓ **How do we get an API key?**
   - Check backend configuration
   - Environment variables?
   - Public vs authenticated endpoints?

3. ❓ **Do the documented 22 playlists actually exist?**
   - Test each slug individually
   - Or are they planned but not implemented?

4. ❓ **Is `music-conductor-401132033262.asia-south1.run.app` a different service?**
   - Current API: `tldr-music-401132033262.asia-south1.run.app`
   - Documented API: `music-conductor-401132033262.asia-south1.run.app`
   - Are these the same backend with different domains?

---

## Conclusion

**Current State**: Discover page uses **hardcoded static data** (64 playlists)
**API Availability**: **2 dynamic playlists** + several unauthenticated endpoints
**Opportunity**: Integrate dynamic playlist fetching for better UX and easier maintenance

**Next Step**: Determine authentication method and test if documented playlists exist on the real API.
