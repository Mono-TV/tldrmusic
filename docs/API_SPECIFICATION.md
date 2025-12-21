# TLDR Music API Specification

> **Version:** 2.0
> **Last Updated:** 2025-12-21
> **Status:** Draft

This document defines the data structures and API contracts for TLDR Music. All services (scraper, backend, frontend) must adhere to these specifications.

---

## Table of Contents

1. [Design Principles](#design-principles)
2. [Core Entities](#core-entities)
   - [Artwork](#artwork)
   - [Artist](#artist)
   - [Album](#album)
   - [Song](#song)
   - [Chart](#chart)
   - [Playlist](#playlist)
3. [Playback Context](#playback-context)
4. [API Endpoints](#api-endpoints)
5. [Error Handling](#error-handling)
6. [Examples](#examples)

---

## Design Principles

### 1. Embedded Objects Over IDs

Responses should include embedded simplified objects rather than just IDs to minimize API calls.

```json
// AVOID: Requires additional lookups
{ "artist_ids": ["uuid1", "uuid2"] }

// PREFERRED: Self-contained response
{
  "artists": [
    { "id": "uuid1", "name": "Arijit Singh", "image_url": "..." }
  ]
}
```

### 2. Graceful Artwork Degradation

Every artwork field must support multiple fallbacks. Images fail frequently; the UI must never show broken images.

### 3. Context Preservation

Every playback action must track its source (chart, album, artist, playlist, search) to enable "now playing" highlighting.

### 4. Offline-First Data

Responses should be self-contained enough to function offline once cached.

---

## Core Entities

### Artwork

The `Artwork` object handles multiple image sources with fallback chain.

```typescript
interface Artwork {
  // Primary high-quality source (preferred)
  primary: string | null;

  // Template URL with {w} and {h} placeholders for dynamic sizing
  // Example: "https://cdn.example.com/img/{id}/{w}x{h}.jpg"
  url_template: string | null;

  // Available sizes when using url_template
  available_sizes: number[];  // e.g., [100, 300, 600, 1200]

  // Ordered fallback URLs (try in sequence if primary fails)
  fallbacks: string[];

  // YouTube video ID for thumbnail fallbacks
  youtube_id: string | null;

  // Dominant color for placeholder background (hex)
  color: string;  // e.g., "#1a1a2e"

  // BlurHash for instant placeholder (optional)
  blurhash: string | null;
}
```

#### Artwork Resolution Strategy

When displaying artwork, clients should attempt sources in this order:

1. **Primary URL** - Highest quality, custom uploaded
2. **Template URL** - CDN with size variants
3. **Fallbacks Array** - Alternative sources in order
4. **YouTube Thumbnails** (if `youtube_id` present):
   - `https://i.ytimg.com/vi/{youtube_id}/maxresdefault.jpg` (1280x720)
   - `https://i.ytimg.com/vi/{youtube_id}/sddefault.jpg` (640x480)
   - `https://i.ytimg.com/vi/{youtube_id}/hqdefault.jpg` (480x360)
   - `https://i.ytimg.com/vi/{youtube_id}/mqdefault.jpg` (320x180)
5. **Color Placeholder** - Solid color using `color` field
6. **BlurHash** - Decoded blurhash if available

#### Simplified Artwork (for embedded use)

```typescript
interface ArtworkSimple {
  url: string;           // Best available URL
  fallback: string;      // First fallback
  color: string;         // Placeholder color
}
```

---

### Artist

#### Full Artist Object

Returned by `/api/artists/{id}` and artist detail endpoints.

```typescript
interface Artist {
  id: string;                    // UUID
  name: string;
  name_normalized: string;       // Lowercase for search
  verified: boolean;

  // Images
  images: {
    thumbnail: string | null;    // 150x150 - for lists
    profile: string | null;      // 400x400 - for detail view
    banner: string | null;       // 1500x500 - for header
    fallbacks: string[];         // Alternative sources
    color: string;               // Dominant color
  };

  // Bio & Info
  bio: string | null;
  type: "solo" | "band" | "composer" | "dj" | "producer";

  // Classification
  genres: string[];              // e.g., ["Bollywood", "Romantic"]
  languages: string[];           // ISO 639-1 codes: ["hi", "bn", "en"]

  // Statistics
  stats: {
    monthly_listeners: number;
    total_plays: number;
    follower_count: number;
    total_songs: number;
    total_albums: number;
  };

  // Social Links
  social: {
    instagram: string | null;
    twitter: string | null;
    spotify: string | null;
    youtube: string | null;
    apple_music: string | null;
    website: string | null;
  };

  // Embedded Content (for single-call loading)
  top_tracks: SongSummary[];     // Top 5-10 songs
  albums: AlbumSummary[];        // All albums
  singles: AlbumSummary[];       // Singles & EPs

  // Timestamps
  created_at: string;            // ISO 8601
  updated_at: string;            // ISO 8601
}
```

#### Artist Summary (Embedded)

Used when artist is embedded in song/album objects.

```typescript
interface ArtistSummary {
  id: string;
  name: string;
  image_url: string | null;      // Thumbnail
  verified: boolean;
  role?: "primary" | "featured" | "composer" | "producer";
}
```

---

### Album

#### Full Album Object

Returned by `/api/albums/{id}`.

```typescript
interface Album {
  id: string;                    // UUID
  name: string;
  name_normalized: string;

  // Type
  type: "album" | "single" | "ep" | "compilation" | "soundtrack";

  // Artists
  artists: ArtistSummary[];      // Primary artists
  artist_name: string;           // Denormalized display string

  // Artwork
  artwork: Artwork;

  // Release Info
  release_date: string | null;   // ISO date or year "2023"
  release_year: number | null;   // Extracted year
  label: string | null;

  // Tracks
  tracks: SongSummary[];         // Ordered track list
  total_tracks: number;
  duration_ms: number;           // Total album duration

  // Classification
  genres: string[];
  language: string | null;       // Primary language

  // External IDs
  upc: string | null;            // Universal Product Code

  // Timestamps
  created_at: string;
  updated_at: string;
}
```

#### Album Summary (Embedded)

Used when album is embedded in song/artist objects.

```typescript
interface AlbumSummary {
  id: string;
  name: string;
  artwork: ArtworkSimple;
  type: "album" | "single" | "ep" | "compilation" | "soundtrack";
  release_date: string | null;
  release_year: number | null;
  total_tracks: number;
  artist_name: string;           // Denormalized
}
```

---

### Song

#### Full Song Object

Returned by `/api/songs/{id}` and embedded in charts/playlists.

```typescript
interface Song {
  id: string;                    // UUID
  title: string;
  title_normalized: string;

  // Duration
  duration_ms: number | null;
  duration_formatted: string | null;  // "3:45"

  // Artists (embedded, not just IDs)
  artists: ArtistSummary[];
  artist_name: string;           // Denormalized: "Artist 1, Artist 2"

  // Album (embedded)
  album: AlbumSummary | null;

  // Artwork (song-specific or inherited from album)
  artwork: Artwork;

  // Playback
  playback: {
    youtube_video_id: string | null;
    preview_url: string | null;        // 30-sec preview
    available: boolean;                 // Can be played
    restrictions: string[];             // e.g., ["geo_blocked"]
  };

  // Metadata
  metadata: {
    language: string | null;           // ISO 639-1
    genres: string[];
    moods: string[];                   // e.g., ["romantic", "sad"]
    explicit: boolean;
    release_date: string | null;
    isrc: string | null;               // International Standard Recording Code
  };

  // Statistics
  stats: {
    play_count: number;
    favorite_count: number;
    youtube_views: number | null;
    youtube_likes: number | null;
  };

  // Lyrics (optional, load separately for large content)
  has_lyrics: boolean;
  lyrics_synced: boolean;              // Has timestamped lyrics

  // Timestamps
  created_at: string;
  updated_at: string;
}
```

#### Song Summary (Embedded)

Used in lists, search results, playlists, charts.

```typescript
interface SongSummary {
  id: string;
  title: string;

  // Denormalized display fields
  artist_name: string;
  album_name: string | null;

  // Essential playback info
  duration_ms: number | null;
  youtube_video_id: string | null;

  // Artwork
  artwork: ArtworkSimple;

  // Quick stats
  play_count: number;

  // Flags
  explicit: boolean;
  available: boolean;
}
```

---

### Chart

#### Chart Object

Returned by `/api/charts/{id}` and `/api/charts/current`.

```typescript
interface Chart {
  id: string;                    // e.g., "india-top-25", "global-top-25"
  name: string;                  // "India Top 25"
  description: string | null;

  // Type & Region
  type: "weekly" | "daily" | "viral";
  region: "india" | "global" | string;  // ISO country code

  // Time Period
  week: string;                  // ISO week: "2025-W51"
  period_start: string;          // ISO date
  period_end: string;            // ISO date

  // Artwork/Branding
  artwork: Artwork;
  gradient: [string, string];    // Gradient colors for UI

  // Entries
  entries: ChartEntry[];
  total_entries: number;

  // Metadata
  updated_at: string;
  next_update: string;           // When chart refreshes
}

interface ChartEntry {
  position: number;              // Current rank (1-based)
  previous_position: number | null;  // Last week's rank
  peak_position: number;         // Best rank achieved
  weeks_on_chart: number;

  // Movement
  movement: "up" | "down" | "same" | "new" | "re-entry";
  position_change: number;       // +3, -2, 0
  is_new: boolean;

  // The song
  song: Song;                    // Full song object for display

  // Chart-specific stats
  chart_score: number;           // Aggregated ranking score
  platform_ranks: {              // Per-platform breakdown
    [platform: string]: number;  // e.g., {"spotify": 3, "apple_music": 5}
  };
}
```

---

### Playlist

#### User Playlist Object

Returned by `/api/playlists/{id}` and `/api/me/playlists`.

```typescript
interface Playlist {
  id: string;
  name: string;
  description: string | null;

  // Ownership & Visibility
  owner: {
    id: string;
    name: string;
    image_url: string | null;
  };
  is_public: boolean;
  is_collaborative: boolean;

  // Artwork
  artwork: {
    custom: string | null;       // User-uploaded artwork
    generated: string[];         // Auto-generated from first 4 tracks
    color: string;
  };

  // Tracks
  tracks: PlaylistTrack[];
  total_tracks: number;
  duration_ms: number;

  // Social
  followers: number;

  // Timestamps
  created_at: string;
  updated_at: string;
}

interface PlaylistTrack {
  added_at: string;              // When added to playlist
  added_by: string | null;       // User ID who added
  position: number;              // Order in playlist (0-based)
  song: Song;                    // Full song object
}
```

#### Curated Playlist (System)

For mood, era, language playlists.

```typescript
interface CuratedPlaylist {
  id: string;
  name: string;
  description: string | null;

  // Type
  type: "mood" | "era" | "language" | "genre" | "featured";
  key: string;                   // e.g., "chill", "90s", "hindi"

  // Display
  icon: string;                  // Emoji or icon name
  artwork: Artwork;
  gradient: [string, string];

  // Tracks
  tracks: SongSummary[];
  total_tracks: number;

  // Shuffle behavior
  shuffle_on_play: boolean;      // Auto-shuffle when played
}
```

---

## Playback Context

Every playback session must track its source for UI highlighting and queue management.

```typescript
interface PlaybackContext {
  // Source type
  type: "chart" | "album" | "artist" | "playlist" | "curated" | "search" | "queue" | "history" | "radio";

  // Source identifier
  id: string;                    // ID of chart/album/playlist/etc.
  name: string;                  // Display name

  // Position in source
  position: number;              // 0-based index in list
  total: number;                 // Total items in source

  // For display
  artwork: ArtworkSimple;        // Source artwork for mini-player context

  // Original list (for queue building)
  track_ids: string[];           // All track IDs in order
}
```

#### Now Playing State

```typescript
interface NowPlaying {
  // Current track
  song: Song;
  context: PlaybackContext;

  // Playback state
  progress_ms: number;
  duration_ms: number;
  is_playing: boolean;
  started_at: string;            // ISO timestamp

  // Queue
  queue: QueueItem[];
  history: QueueItem[];          // Recently played

  // Settings
  repeat_mode: "off" | "track" | "context";
  shuffle: boolean;

  // Device
  device_id: string;
  device_name: string;
}

interface QueueItem {
  song: SongSummary;
  context: {
    type: "auto" | "user_added";
    source: string | null;       // Where it came from
    added_at: string;
  };
}
```

---

## API Endpoints

### Charts

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/charts` | GET | List all available charts |
| `/api/charts/current` | GET | Get current week's India chart |
| `/api/charts/{id}` | GET | Get specific chart by ID |
| `/api/charts/{id}/history` | GET | Get chart history (past weeks) |

#### Response: `GET /api/charts/current`

```json
{
  "id": "india-top-25",
  "name": "India Top 25",
  "week": "2025-W51",
  "updated_at": "2025-12-16T00:00:00Z",
  "gradient": ["#ff6b35", "#f7c59f"],
  "entries": [
    {
      "position": 1,
      "previous_position": 2,
      "movement": "up",
      "position_change": 1,
      "is_new": false,
      "weeks_on_chart": 5,
      "song": { /* Full Song object */ }
    }
  ],
  "total_entries": 25
}
```

---

### Artists

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/artists` | GET | List artists (paginated) |
| `/api/artists/{id}` | GET | Get artist with top tracks & albums |
| `/api/artists/{id}/songs` | GET | Get all artist songs (paginated) |
| `/api/artists/{id}/albums` | GET | Get artist albums |
| `/api/artists/search?q={name}` | GET | Search artists by name |

#### Response: `GET /api/artists/{id}`

```json
{
  "id": "artist-uuid",
  "name": "Arijit Singh",
  "verified": true,
  "images": {
    "thumbnail": "https://...",
    "profile": "https://...",
    "banner": "https://...",
    "fallbacks": ["https://ytimg/..."],
    "color": "#2d1b4e"
  },
  "bio": "Indian playback singer...",
  "genres": ["Bollywood", "Romantic"],
  "languages": ["hi", "bn", "en"],
  "stats": {
    "monthly_listeners": 45000000,
    "total_songs": 350,
    "total_albums": 12
  },
  "top_tracks": [ /* SongSummary[] - top 10 */ ],
  "albums": [ /* AlbumSummary[] */ ],
  "singles": [ /* AlbumSummary[] */ ]
}
```

---

### Albums

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/albums/{id}` | GET | Get album with tracks |
| `/api/albums/search?q={name}` | GET | Search albums |

#### Response: `GET /api/albums/{id}`

```json
{
  "id": "album-uuid",
  "name": "Aashiqui 2",
  "type": "soundtrack",
  "artists": [
    { "id": "...", "name": "Various Artists", "image_url": "..." }
  ],
  "artist_name": "Various Artists",
  "artwork": {
    "primary": "https://...",
    "fallbacks": ["https://..."],
    "color": "#1a1a2e"
  },
  "release_date": "2013-04-16",
  "release_year": 2013,
  "label": "T-Series",
  "tracks": [ /* SongSummary[] in order */ ],
  "total_tracks": 10,
  "duration_ms": 2400000,
  "genres": ["Bollywood", "Soundtrack"],
  "language": "hi"
}
```

---

### Songs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/songs/{id}` | GET | Get full song details |
| `/api/songs/{id}/lyrics` | GET | Get song lyrics |
| `/api/songs/{id}/related` | GET | Get related songs |
| `/api/songs/search?q={query}` | GET | Search songs |

---

### Playlists

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/me/playlists` | GET | Get user's playlists |
| `/api/me/playlists` | POST | Create playlist |
| `/api/me/playlists/{id}` | GET | Get playlist details |
| `/api/me/playlists/{id}` | PATCH | Update playlist |
| `/api/me/playlists/{id}` | DELETE | Delete playlist |
| `/api/me/playlists/{id}/tracks` | POST | Add tracks |
| `/api/me/playlists/{id}/tracks` | DELETE | Remove tracks |
| `/api/playlists/{id}` | GET | Get public playlist (no auth) |

---

### Curated Content

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/curated/categories` | GET | List all categories |
| `/api/curated/mood/{mood}` | GET | Get mood playlist |
| `/api/curated/era/{era}` | GET | Get era playlist |
| `/api/curated/language/{lang}` | GET | Get language playlist |
| `/api/curated/featured` | GET | Get featured playlists |

---

### Search

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/search?q={query}` | GET | Universal search |
| `/api/search/songs?q={query}` | GET | Search songs only |
| `/api/search/artists?q={query}` | GET | Search artists only |
| `/api/search/albums?q={query}` | GET | Search albums only |
| `/api/search/suggestions?q={query}` | GET | Autocomplete suggestions |

#### Response: `GET /api/search?q={query}`

```json
{
  "query": "tum hi ho",
  "results": {
    "songs": {
      "items": [ /* SongSummary[] */ ],
      "total": 45
    },
    "artists": {
      "items": [ /* ArtistSummary[] */ ],
      "total": 3
    },
    "albums": {
      "items": [ /* AlbumSummary[] */ ],
      "total": 5
    }
  }
}
```

---

## Error Handling

### Error Response Format

```typescript
interface ErrorResponse {
  error: {
    code: string;           // Machine-readable code
    message: string;        // Human-readable message
    details?: object;       // Additional context
  };
  status: number;           // HTTP status code
  timestamp: string;        // ISO timestamp
  request_id: string;       // For debugging
}
```

### Standard Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `not_found` | 404 | Resource not found |
| `invalid_request` | 400 | Malformed request |
| `unauthorized` | 401 | Authentication required |
| `forbidden` | 403 | Insufficient permissions |
| `rate_limited` | 429 | Too many requests |
| `internal_error` | 500 | Server error |
| `service_unavailable` | 503 | Temporarily unavailable |

---

## Examples

### Example: Playing a Song from Chart

1. User clicks song #3 in India Top 25
2. Frontend creates playback context:

```json
{
  "song": { /* full song object */ },
  "context": {
    "type": "chart",
    "id": "india-top-25",
    "name": "India Top 25",
    "position": 2,
    "total": 25,
    "artwork": {
      "url": "https://...",
      "fallback": "https://...",
      "color": "#ff6b35"
    },
    "track_ids": ["song1", "song2", "song3", ...]
  }
}
```

3. Queue is populated with remaining songs from chart
4. "Now Playing" view shows chart context with position highlighted

---

### Example: Artwork Fallback Chain

```javascript
function getArtworkUrl(artwork, size = 300) {
  const urls = [];

  // 1. Primary
  if (artwork.primary) {
    urls.push(artwork.primary);
  }

  // 2. Template with size
  if (artwork.url_template) {
    urls.push(
      artwork.url_template
        .replace('{w}', size)
        .replace('{h}', size)
    );
  }

  // 3. Fallbacks
  urls.push(...(artwork.fallbacks || []));

  // 4. YouTube thumbnails
  if (artwork.youtube_id) {
    urls.push(
      `https://i.ytimg.com/vi/${artwork.youtube_id}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi/${artwork.youtube_id}/hqdefault.jpg`,
      `https://i.ytimg.com/vi/${artwork.youtube_id}/mqdefault.jpg`
    );
  }

  return urls.filter(Boolean);
}

// Usage in frontend
<img
  src={urls[0]}
  onError={(e) => {
    const next = urls[currentIndex + 1];
    if (next) e.target.src = next;
    else e.target.style.backgroundColor = artwork.color;
  }}
  style={{ backgroundColor: artwork.color }}
/>
```

---

### Example: Song with Full Embedded Data

```json
{
  "id": "song-uuid-123",
  "title": "Tum Hi Ho",
  "title_normalized": "tum hi ho",
  "duration_ms": 262000,
  "duration_formatted": "4:22",

  "artists": [
    {
      "id": "artist-uuid-1",
      "name": "Arijit Singh",
      "image_url": "https://...",
      "verified": true,
      "role": "primary"
    },
    {
      "id": "artist-uuid-2",
      "name": "Mithoon",
      "image_url": "https://...",
      "verified": false,
      "role": "composer"
    }
  ],
  "artist_name": "Arijit Singh",

  "album": {
    "id": "album-uuid-1",
    "name": "Aashiqui 2",
    "artwork": {
      "url": "https://is1-ssl.mzstatic.com/.../600x600bb.jpg",
      "fallback": "https://i.ytimg.com/vi/Umqb9KENgmk/hqdefault.jpg",
      "color": "#2d1b4e"
    },
    "type": "soundtrack",
    "release_date": "2013-04-16",
    "release_year": 2013,
    "total_tracks": 10,
    "artist_name": "Various Artists"
  },

  "artwork": {
    "primary": "https://is1-ssl.mzstatic.com/.../600x600bb.jpg",
    "url_template": null,
    "available_sizes": [],
    "fallbacks": [
      "https://i.ytimg.com/vi/Umqb9KENgmk/maxresdefault.jpg"
    ],
    "youtube_id": "Umqb9KENgmk",
    "color": "#2d1b4e",
    "blurhash": "LEHV6nWB2yk8pyo0adR*.7kCMdnj"
  },

  "playback": {
    "youtube_video_id": "Umqb9KENgmk",
    "preview_url": null,
    "available": true,
    "restrictions": []
  },

  "metadata": {
    "language": "hi",
    "genres": ["Bollywood", "Romantic"],
    "moods": ["romantic", "emotional"],
    "explicit": false,
    "release_date": "2013-04-16",
    "isrc": "INS171300019"
  },

  "stats": {
    "play_count": 1500000,
    "favorite_count": 85000,
    "youtube_views": 1500000000,
    "youtube_likes": 8000000
  },

  "has_lyrics": true,
  "lyrics_synced": true,

  "created_at": "2024-01-15T00:00:00Z",
  "updated_at": "2025-12-20T00:00:00Z"
}
```

---

## Implementation Checklist

### Backend Service

- [ ] Update Pydantic models to match this spec
- [ ] Implement artwork fallback chain in responses
- [ ] Add embedded objects (not just IDs) to all responses
- [ ] Add `artist_name` denormalized field to songs/albums
- [ ] Implement chart entries with full song objects
- [ ] Add playback context to queue endpoints

### Scraper Service

- [ ] Scrape album artwork from multiple sources
- [ ] Store YouTube video IDs for artwork fallbacks
- [ ] Extract dominant color from artwork
- [ ] Populate album relationships in songs
- [ ] Store ISRC codes when available

### Frontend

- [ ] Implement artwork fallback component
- [ ] Track playback context on every play action
- [ ] Highlight current song in source view
- [ ] Handle offline scenarios with cached data
- [ ] Progressive image loading with blurhash/color

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 2.0 | 2025-12-21 | Complete rewrite with embedded objects, artwork fallbacks, playback context |
| 1.0 | 2024-01-15 | Initial specification |
