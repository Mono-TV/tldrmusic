# Music Conductor API Documentation

Complete API for charts, search, and playlists - designed for tldrmusic integration.

**Production URL:** `https://music-conductor-401132033262.asia-south1.run.app`

**API Docs (Swagger):** https://music-conductor-401132033262.asia-south1.run.app/docs

---

## Quick Start

```bash
# Search for songs
curl "https://music-conductor-401132033262.asia-south1.run.app/api/search/songs?q=arijit&has_youtube=true"

# Get autocomplete suggestions
curl "https://music-conductor-401132033262.asia-south1.run.app/api/search/suggest?q=sha"

# Get trending chart
curl "https://music-conductor-401132033262.asia-south1.run.app/api/charts/aggregated?region=india"

# Get a playlist
curl "https://music-conductor-401132033262.asia-south1.run.app/api/playlists/hip-hop-rap"
```

---

## API Overview

| Category | Endpoint | Description |
|----------|----------|-------------|
| **Search** | `GET /api/search/songs` | Search songs with typo tolerance |
| **Search** | `GET /api/search/artists` | Search artists |
| **Search** | `GET /api/search/suggest` | Autocomplete suggestions |
| **Search** | `GET /api/search/facets` | Get filter options |
| **Charts** | `GET /api/charts/aggregated` | Multi-platform aggregated chart |
| **Charts** | `GET /api/charts/multi-platform` | Songs on 2+ platforms |
| **Charts** | `GET /api/charts/source/{source}` | Single platform chart |
| **Playlists** | `GET /api/playlists` | List all playlists |
| **Playlists** | `GET /api/playlists/{slug}` | Get playlist with tracks |

---

## Database Stats

| Metric | Value |
|--------|-------|
| Total Songs | 100,000 |
| Songs with YouTube | 80,213 (80.2%) |
| Unique Languages | 100+ |
| Unique Genres | 100+ |
| Playlists | 22 |

---

# Search API

Fast, typo-tolerant song and artist search powered by Typesense.

## Features
- **Typo Tolerance** - "arjit" finds "Arijit Singh"
- **Filters** - Language, genre, YouTube availability
- **Facets** - Get counts for filter UI
- **Autocomplete** - Fast prefix matching

---

## 1. Search Songs

**GET** `/api/search/songs`

### Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | `""` | Search query |
| `language` | string | - | Filter: `en`, `hi`, `es`, etc. |
| `genre` | string | - | Filter: `Pop`, `Hip-Hop/Rap`, etc. |
| `has_youtube` | bool | - | Only songs with YouTube video |
| `page` | int | `1` | Page number |
| `per_page` | int | `20` | Results per page (max 100) |
| `sort_by` | string | - | `title`, `artist`, `created_at` |

### Examples

```bash
# Basic search
curl "https://music-conductor-401132033262.asia-south1.run.app/api/search/songs?q=arijit"

# Hindi songs with YouTube
curl "https://music-conductor-401132033262.asia-south1.run.app/api/search/songs?q=love&language=hi&has_youtube=true"

# Browse Pop songs
curl "https://music-conductor-401132033262.asia-south1.run.app/api/search/songs?genre=Pop&per_page=50"
```

### Response

```json
{
  "query": "arijit",
  "found": 5,
  "page": 1,
  "per_page": 20,
  "songs": [
    {
      "id": "3c63cc16-a1c7-4fd8-b22b-59bf8168d1cb",
      "title": "Haan Main Galat",
      "artist_name": "Pritam, Arijit Singh, Shashwat Singh",
      "album_name": "",
      "language": "hi",
      "genres": ["Bollywood", "Music", "Indian"],
      "isrc": "INS172000242",
      "youtube_video_id": "aG2PQ8x9F4g",
      "duration_seconds": 218,
      "artwork_url": "https://music.apple.com/{country-code}/song/1499107791"
    }
  ],
  "facets": {
    "language": [{"value": "hi", "count": 2}, {"value": "en", "count": 2}],
    "genres": [{"value": "Music", "count": 5}, {"value": "Bollywood", "count": 2}],
    "has_youtube": [{"value": "true", "count": 4}, {"value": "false", "count": 1}]
  }
}
```

---

## 2. Search Artists

**GET** `/api/search/artists`

### Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | `""` | Artist name query |
| `page` | int | `1` | Page number |
| `per_page` | int | `20` | Results per page |

### Example

```bash
curl "https://music-conductor-401132033262.asia-south1.run.app/api/search/artists?q=rahman"
```

### Response

```json
{
  "query": "rahman",
  "found": 16,
  "page": 1,
  "per_page": 20,
  "artists": [
    {
      "artist_name": "A.R. Rahman, The Pussycat Dolls",
      "song_count": 1,
      "sample_artwork": "https://..."
    }
  ]
}
```

---

## 3. Autocomplete

**GET** `/api/search/suggest`

Fast prefix matching for search-as-you-type UI.

### Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | (required) | Search prefix (min 2 chars) |
| `limit` | int | `5` | Max suggestions (max 10) |

### Example

```bash
curl "https://music-conductor-401132033262.asia-south1.run.app/api/search/suggest?q=sha&limit=5"
```

### Response

```json
{
  "query": "sha",
  "suggestions": [
    {
      "id": "268afaa0-c84d-4031-9728-4223cae26da9",
      "title": "22",
      "artist_name": "Sha",
      "display": "22 - Sha",
      "artwork_url": "https://...",
      "youtube_video_id": "wO6hntVmV2Q"
    }
  ]
}
```

---

## 4. Get Facets

**GET** `/api/search/facets`

Returns all available filter values with counts for building filter UI.

### Response

```json
{
  "language": [
    {"value": "en", "count": 45000},
    {"value": "hi", "count": 12000}
  ],
  "genres": [
    {"value": "Pop", "count": 25000},
    {"value": "Hip-Hop/Rap", "count": 18000}
  ],
  "has_youtube": [
    {"value": "true", "count": 80213},
    {"value": "false", "count": 19787}
  ]
}
```

---

## 5. Search Stats

**GET** `/api/search/stats`

```json
{
  "status": "healthy",
  "collection": "conductor_songs",
  "num_documents": 100000,
  "typesense_available": true
}
```

---

# Charts API

Aggregated rankings from YouTube Music, Apple Music, Spotify, and Billboard.

## Scoring Formula

```
score = sum(platform_weight * (100 - position + 1) / 100)
```

| Platform | Weight |
|----------|--------|
| Apple Music | 1.5x |
| Spotify | 1.5x |
| Billboard | 1.2x |
| YouTube Music | 1.0x |

---

## 1. Aggregated Chart

**GET** `/api/charts/aggregated`

### Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `region` | string | `india` | Region: `india`, `us`, `global` |
| `limit` | int | `50` | Max songs (1-200) |

### Example

```bash
curl "https://music-conductor-401132033262.asia-south1.run.app/api/charts/aggregated?region=india&limit=20"
```

### Response

```json
{
  "chart_id": "aggregated_india_2025-W52",
  "region": "india",
  "week": "2025-W52",
  "generated_at": "2025-12-22T12:17:12.000Z",
  "sources": ["youtube_music", "apple_music", "spotify", "billboard"],
  "total_songs": 50,
  "songs": [
    {
      "rank": 1,
      "title": "For A Reason",
      "artist": "Karan Aujla & Ikky",
      "score": 2.83,
      "platforms_count": 2,
      "platform_ranks": {
        "youtube_music": null,
        "apple_music": 6,
        "spotify": 7,
        "billboard": null
      },
      "isrc": "QT3F52579568",
      "spotify_id": "3ABC123...",
      "youtube_id": null,
      "apple_music_id": "1234567890",
      "song_id": "507f1f77bcf86cd799439011"
    }
  ]
}
```

---

## 2. Multi-Platform Songs

**GET** `/api/charts/multi-platform`

Returns songs appearing on 2+ platforms (most reliable trending indicators).

### Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `region` | string | `india` | Region code |
| `min_platforms` | int | `2` | Minimum platforms (2-4) |

---

## 3. Single Source Chart

**GET** `/api/charts/source/{source}`

Get raw chart from one platform.

| Source | Description |
|--------|-------------|
| `youtube_music` | YouTube Music India Top 50 |
| `apple_music` | Apple Music India Charts |
| `spotify` | Spotify India Daily |
| `billboard` | Billboard India Songs |

---

# Playlists API

22 curated playlists by language, genre, and mood.

## 1. List Playlists

**GET** `/api/playlists`

### Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | string | (all) | Filter: `language`, `genre`, `mood` |

---

## 2. Get Playlist

**GET** `/api/playlists/{slug}`

### Available Playlists

**Language (8):**
- `hindi-hits`, `english-hits`, `tamil-hits`, `telugu-hits`
- `punjabi-hits`, `spanish-hits`, `korean-hits`, `japanese-hits`

**Genre (10):**
- `hip-hop-rap`, `pop-hits`, `rock-classics`, `electronic-dance`
- `rnb-soul`, `latin-vibes`, `jazz-classics`, `classical-music`
- `world-music`, `alternative-indie`

**Mood (4):**
- `chill-vibes`, `workout-energy`, `party-mode`, `focus-study`

### Example

```bash
curl "https://music-conductor-401132033262.asia-south1.run.app/api/playlists/hip-hop-rap"
```

### Response

```json
{
  "id": "uuid",
  "slug": "hip-hop-rap",
  "name": "Hip-Hop & Rap",
  "description": "The best Hip-Hop & Rap tracks",
  "type": "genre",
  "category": "hip-hop",
  "artwork": {
    "primary": "https://...",
    "fallback": "https://i.ytimg.com/vi/.../hqdefault.jpg",
    "color": "#1a1a2e"
  },
  "tracks": [
    {
      "position": 1,
      "song_id": "uuid",
      "title": "Song Title",
      "artist": "Artist Name",
      "youtube_id": "dQw4w9WgXcQ",
      "artwork_url": "https://...",
      "duration_ms": 213000
    }
  ],
  "total_tracks": 50,
  "total_duration_ms": 10650000
}
```

---

# Integration Guide for tldrmusic

## Python Client

```python
"""
Music Conductor API Client for tldrmusic
"""
import requests
from typing import Optional, List, Dict, Any

BASE_URL = "https://music-conductor-401132033262.asia-south1.run.app"


class MusicConductorClient:
    """Client for Music Conductor API."""

    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url.rstrip("/")

    def _get(self, endpoint: str, params: dict = None) -> dict:
        """Make GET request."""
        resp = requests.get(f"{self.base_url}{endpoint}", params=params)
        resp.raise_for_status()
        return resp.json()

    # ===== SEARCH =====

    def search_songs(
        self,
        query: str = "",
        language: str = None,
        genre: str = None,
        has_youtube: bool = None,
        page: int = 1,
        per_page: int = 20,
    ) -> dict:
        """
        Search songs with typo tolerance.

        Args:
            query: Search query (empty for all songs)
            language: Filter by language code (e.g., 'hi', 'en')
            genre: Filter by genre (e.g., 'Pop', 'Hip-Hop/Rap')
            has_youtube: Only return songs with YouTube videos
            page: Page number (starts at 1)
            per_page: Results per page (max 100)

        Returns:
            {
                "query": str,
                "found": int,
                "songs": [...],
                "facets": {...}
            }
        """
        params = {"q": query, "page": page, "per_page": per_page}
        if language:
            params["language"] = language
        if genre:
            params["genre"] = genre
        if has_youtube is not None:
            params["has_youtube"] = has_youtube
        return self._get("/api/search/songs", params)

    def search_artists(self, query: str = "", page: int = 1, per_page: int = 20) -> dict:
        """Search for artists."""
        return self._get("/api/search/artists", {"q": query, "page": page, "per_page": per_page})

    def suggest(self, prefix: str, limit: int = 5) -> List[dict]:
        """
        Get autocomplete suggestions.

        Args:
            prefix: Search prefix (min 2 chars)
            limit: Max suggestions (max 10)

        Returns:
            List of suggestions with title, artist_name, display, artwork_url, youtube_video_id
        """
        result = self._get("/api/search/suggest", {"q": prefix, "limit": limit})
        return result.get("suggestions", [])

    def get_facets(self) -> dict:
        """Get available filter values with counts."""
        return self._get("/api/search/facets")

    # ===== CHARTS =====

    def get_chart(self, region: str = "india", limit: int = 50) -> dict:
        """
        Get aggregated chart.

        Args:
            region: Region code ('india', 'us', 'global')
            limit: Max songs (1-200)

        Returns:
            Chart with songs ranked by aggregate score across platforms
        """
        return self._get("/api/charts/aggregated", {"region": region, "limit": limit})

    def get_multi_platform_songs(self, region: str = "india", min_platforms: int = 2) -> List[dict]:
        """Get songs appearing on multiple platforms."""
        result = self._get(
            "/api/charts/multi-platform",
            {"region": region, "min_platforms": min_platforms}
        )
        return result.get("songs", [])

    # ===== PLAYLISTS =====

    def get_playlists(self, playlist_type: str = None) -> List[dict]:
        """
        Get all playlists.

        Args:
            playlist_type: Filter by type ('language', 'genre', 'mood')
        """
        params = {"type": playlist_type} if playlist_type else {}
        result = self._get("/api/playlists", params)
        return result.get("playlists", [])

    def get_playlist(self, slug: str) -> dict:
        """
        Get playlist with tracks.

        Args:
            slug: Playlist slug (e.g., 'hip-hop-rap', 'hindi-hits')
        """
        return self._get(f"/api/playlists/{slug}")


# ===== USAGE EXAMPLES =====

if __name__ == "__main__":
    client = MusicConductorClient()

    # Search for songs
    print("=== Search Songs ===")
    results = client.search_songs("arijit", has_youtube=True, per_page=5)
    print(f"Found {results['found']} songs")
    for song in results["songs"]:
        print(f"  {song['title']} - {song['artist_name']}")
        if song.get("youtube_video_id"):
            print(f"    https://music.youtube.com/watch?v={song['youtube_video_id']}")

    # Autocomplete
    print("\n=== Autocomplete ===")
    suggestions = client.suggest("sha", limit=3)
    for s in suggestions:
        print(f"  {s['display']}")

    # Get chart
    print("\n=== Top Chart ===")
    chart = client.get_chart(region="india", limit=5)
    print(f"Week: {chart['week']}")
    for song in chart["songs"]:
        print(f"  #{song['rank']} {song['title']} - {song['artist']}")

    # Get playlist
    print("\n=== Hip-Hop Playlist ===")
    playlist = client.get_playlist("hip-hop-rap")
    print(f"{playlist['name']}: {playlist['total_tracks']} tracks")
    for track in playlist["tracks"][:3]:
        print(f"  {track['position']}. {track['title']} - {track['artist']}")
```

---

## TypeScript/JavaScript Client

```typescript
/**
 * Music Conductor API Client for tldrmusic
 */

const BASE_URL = "https://music-conductor-401132033262.asia-south1.run.app";

interface Song {
  id: string;
  title: string;
  artist_name: string;
  album_name?: string;
  language?: string;
  genres?: string[];
  isrc?: string;
  youtube_video_id?: string;
  duration_seconds?: number;
  artwork_url?: string;
}

interface SearchResult {
  query: string;
  found: number;
  page: number;
  per_page: number;
  songs: Song[];
  facets?: {
    language: { value: string; count: number }[];
    genres: { value: string; count: number }[];
    has_youtube: { value: string; count: number }[];
  };
}

interface Suggestion {
  id: string;
  title: string;
  artist_name: string;
  display: string;
  artwork_url?: string;
  youtube_video_id?: string;
}

interface PlaylistTrack {
  position: number;
  song_id: string;
  title: string;
  artist: string;
  youtube_id?: string;
  artwork_url?: string;
  duration_ms?: number;
}

interface Playlist {
  id: string;
  slug: string;
  name: string;
  description: string;
  type: string;
  category: string;
  tracks: PlaylistTrack[];
  total_tracks: number;
  artwork: {
    primary?: string;
    fallback?: string;
    color: string;
  };
}

class MusicConductorClient {
  private baseUrl: string;

  constructor(baseUrl: string = BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(`${this.baseUrl}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });
    }
    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return resp.json();
  }

  // ===== SEARCH =====

  async searchSongs(options: {
    query?: string;
    language?: string;
    genre?: string;
    hasYoutube?: boolean;
    page?: number;
    perPage?: number;
  } = {}): Promise<SearchResult> {
    return this.get("/api/search/songs", {
      q: options.query || "",
      language: options.language,
      genre: options.genre,
      has_youtube: options.hasYoutube,
      page: options.page || 1,
      per_page: options.perPage || 20,
    });
  }

  async suggest(prefix: string, limit: number = 5): Promise<Suggestion[]> {
    const result = await this.get<{ suggestions: Suggestion[] }>("/api/search/suggest", {
      q: prefix,
      limit,
    });
    return result.suggestions;
  }

  // ===== PLAYLISTS =====

  async getPlaylist(slug: string): Promise<Playlist> {
    return this.get(`/api/playlists/${slug}`);
  }

  async getPlaylists(type?: "language" | "genre" | "mood"): Promise<Playlist[]> {
    const result = await this.get<{ playlists: Playlist[] }>("/api/playlists", { type });
    return result.playlists;
  }
}

// Usage
const client = new MusicConductorClient();

// Search
const results = await client.searchSongs({ query: "arijit", hasYoutube: true });
console.log(`Found ${results.found} songs`);
results.songs.forEach(song => {
  console.log(`${song.title} - ${song.artist_name}`);
  if (song.youtube_video_id) {
    console.log(`  https://music.youtube.com/watch?v=${song.youtube_video_id}`);
  }
});

// Autocomplete
const suggestions = await client.suggest("sha");
suggestions.forEach(s => console.log(s.display));

// Playlist
const playlist = await client.getPlaylist("hip-hop-rap");
console.log(`${playlist.name}: ${playlist.total_tracks} tracks`);
```

---

## Playing Songs

All songs with YouTube availability can be played using the `youtube_video_id` field:

```python
# Get playable URL
def get_youtube_url(song: dict) -> str | None:
    video_id = song.get("youtube_video_id")
    if video_id:
        return f"https://music.youtube.com/watch?v={video_id}"
    return None

# Example
results = client.search_songs("arijit", has_youtube=True)
for song in results["songs"]:
    url = get_youtube_url(song)
    if url:
        print(f"{song['title']}: {url}")
```

---

## Error Handling

```python
import requests

try:
    results = client.search_songs("test")
except requests.exceptions.HTTPError as e:
    if e.response.status_code == 404:
        print("Not found")
    elif e.response.status_code == 422:
        print("Validation error:", e.response.json())
    else:
        print("API error:", e)
```

---

## Rate Limits

No rate limits currently. Be reasonable with requests (~1 req/sec max).

---

## Changelog

### 2025-W52
- Search API deployed to Cloud Run
- 100,000 songs indexed with 80.2% YouTube coverage
- Typo-tolerant search with Typesense

### 2025-W51
- Initial release
- Charts API: YouTube Music, Apple Music, Spotify, Billboard
- Playlists API: 22 playlists (8 language, 10 genre, 4 mood)
