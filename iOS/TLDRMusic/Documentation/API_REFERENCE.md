# Music Conductor API Reference

Complete API documentation for iOS app integration.

**Base URL**: `https://tldr-music-ncrhtdqoiq-el.a.run.app`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Charts](#charts)
3. [Search](#search)
4. [Playlists](#playlists)
5. [Library](#library)
6. [Behavior Tracking](#behavior-tracking)
7. [Discovery](#discovery)
8. [Error Handling](#error-handling)

---

## Authentication

All authenticated endpoints require a Bearer token in the `Authorization` header:

```
Authorization: Bearer {access_token}
```

### POST /api/auth/google

Authenticate with Google OAuth.

**Request:**
```json
{
  "id_token": "eyJhbGciOiJSUzI1NiIsImtpZCI6..."
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "refresh_token": "def502004a7c...",
  "user": {
    "user_id": "google_123456789",
    "display_name": "John Doe",
    "email": "john@example.com",
    "photo_url": "https://lh3.googleusercontent.com/...",
    "preferences": {
      "languages": ["hi", "en"],
      "genres": ["Bollywood", "Pop"]
    }
  }
}
```

**Swift:**
```swift
let authResponse = try await MusicConductorAPI.shared.signInWithGoogle(idToken: idToken)
```

---

### POST /api/auth/guest

Create anonymous guest session.

**Request:**
```json
{
  "device_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "refresh_token": "def502004a7c...",
  "user": {
    "user_id": "guest_550e8400",
    "display_name": "Guest User",
    "email": null,
    "photo_url": null,
    "preferences": null
  }
}
```

**Swift:**
```swift
let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
let authResponse = try await MusicConductorAPI.shared.signInAsGuest(deviceId: deviceId)
```

---

### POST /api/auth/token/refresh

Refresh access token.

**Request:**
```json
{
  "refresh_token": "def502004a7c..."
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
  "refresh_token": "ghi603005b8d...",
  "user": { ... }
}
```

**Swift:**
```swift
let authResponse = try await MusicConductorAPI.shared.refreshAccessToken()
```

---

### GET /api/auth/me

Get current user profile.

**Auth Required**: ✅

**Response:**
```json
{
  "user_id": "google_123456789",
  "display_name": "John Doe",
  "email": "john@example.com",
  "photo_url": "https://lh3.googleusercontent.com/...",
  "preferences": {
    "languages": ["hi", "en"],
    "genres": ["Bollywood", "Pop"]
  }
}
```

**Swift:**
```swift
let user = try await MusicConductorAPI.shared.getCurrentUser()
```

---

### POST /api/auth/logout

Logout and invalidate session.

**Auth Required**: ✅

**Headers:**
```
Authorization: Bearer {refresh_token}
```

**Response:**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

**Swift:**
```swift
try await MusicConductorAPI.shared.logout()
```

---

## Charts

### GET /api/charts/aggregated

Get aggregated chart for a region.

**Query Parameters:**
- `region` (required): Region code (e.g., `india`)

**Example:**
```
GET /api/charts/aggregated?region=india
```

**Response:**
```json
{
  "chart_id": "bollywood_top_25",
  "region": "india",
  "week": "2026-W01",
  "generated_at": "2026-01-02T04:30:00Z",
  "sources": ["youtube_music", "spotify", "apple_music", "billboard", "shazam"],
  "total_songs": 25,
  "songs": [
    {
      "rank": 1,
      "title": "Kahani Suno 2.0",
      "artist": "Kaifi Khalil",
      "score": 97.5,
      "platforms_count": 5,
      "platform_ranks": {
        "youtube_music": 1,
        "spotify": 1,
        "apple_music": 2,
        "billboard": null,
        "shazam": 1
      },
      "youtube_id": "xyz123",
      "artwork_url": "https://i.ytimg.com/vi/xyz123/maxresdefault.jpg",
      "isrc": "INZ012300001",
      "spotify_id": "6KImCVD70vtIoJWnq6nGn3",
      "apple_music_id": "1234567890"
    }
  ]
}
```

**Swift:**
```swift
let chart = try await MusicConductorAPI.shared.fetchBollywoodTop25()

for song in chart.songs {
    print("#\(song.rank): \(song.title) by \(song.artist)")
}
```

---

## Search

### GET /api/search/songs

Search for songs.

**Query Parameters:**
- `q` (optional): Search query
- `language` (optional): Language filter (e.g., `hi`, `en`)
- `genre` (optional): Genre filter (e.g., `Bollywood`, `Pop`)
- `has_youtube` (optional): Filter by YouTube availability (boolean)
- `year_from` (optional): Release year start (e.g., `1990`)
- `year_to` (optional): Release year end (e.g., `2025`)
- `page` (optional): Page number (default: `1`)
- `per_page` (optional): Results per page (default: `20`, max: `100`)
- `personalize` (optional): Enable personalized ranking (requires auth)

**Example:**
```
GET /api/search/songs?q=arijit&language=hi&page=1&per_page=20
```

**Response:**
```json
{
  "query": "arijit",
  "found": 1234,
  "page": 1,
  "per_page": 20,
  "songs": [
    {
      "id": "60d5ec49f1b2c8a9e8b4e123",
      "title": "Tum Hi Ho",
      "artist_name": "Arijit Singh",
      "album_name": "Aashiqui 2",
      "language": "hi",
      "genres": ["Bollywood", "Romance"],
      "youtube_video_id": "xyz123",
      "artwork_url": "https://...",
      "duration_seconds": 262,
      "isrc": "INZ012300001"
    }
  ],
  "facets": {
    "language": [
      {"value": "hi", "count": 800},
      {"value": "en", "count": 200}
    ],
    "genres": [
      {"value": "Bollywood", "count": 600},
      {"value": "Pop", "count": 400}
    ],
    "has_youtube": [
      {"value": "true", "count": 1000},
      {"value": "false", "count": 234}
    ]
  },
  "personalization_applied": false
}
```

**Swift:**
```swift
let results = try await MusicConductorAPI.shared.searchSongs(
    query: "arijit",
    language: "hi",
    page: 1,
    perPage: 20
)
```

---

### GET /api/search/suggest

Get autocomplete suggestions.

**Query Parameters:**
- `q` (required): Search prefix (min 2 chars)
- `limit` (optional): Number of suggestions (default: `5`, max: `10`)

**Example:**
```
GET /api/search/suggest?q=ari&limit=5
```

**Response:**
```json
{
  "query": "ari",
  "suggestions": [
    {
      "id": "60d5ec49f1b2c8a9e8b4e123",
      "title": "Tum Hi Ho",
      "artist_name": "Arijit Singh",
      "display": "Tum Hi Ho - Arijit Singh",
      "youtube_video_id": "xyz123",
      "artwork_url": "https://..."
    }
  ]
}
```

**Swift:**
```swift
let suggestions = try await MusicConductorAPI.shared.getSearchSuggestions(query: "ari", limit: 5)
```

---

### GET /api/search

Unified search across songs, albums, and artists.

**Query Parameters:**
- `q` (required): Search query (min 2 chars)
- `songs_limit` (optional): Max songs (default: `5`, max: `20`)
- `albums_limit` (optional): Max albums (default: `5`, max: `20`)
- `artists_limit` (optional): Max artists (default: `5`, max: `20`)

**Example:**
```
GET /api/search?q=arijit&songs_limit=10
```

**Response:**
```json
{
  "query": "arijit",
  "songs": [ ... ],
  "albums": [ ... ],
  "artists": [
    {
      "artist_name": "Arijit Singh",
      "song_count": 450,
      "sample_artwork": "https://..."
    }
  ],
  "songs_total": 1234,
  "albums_total": 56,
  "artists_total": 1
}
```

**Swift:**
```swift
let results = try await MusicConductorAPI.shared.unifiedSearch(query: "arijit")
```

---

## Playlists

### GET /api/playlists

Get all playlists.

**Query Parameters:**
- `category` (optional): Filter by category (`mood`, `genre`, `language`)
- `homepage_featured` (optional): Filter featured playlists (boolean)

**Example:**
```
GET /api/playlists?category=mood&homepage_featured=true
```

**Response:**
```json
{
  "playlists": [
    {
      "id": "60d5ec49f1b2c8a9e8b4e123",
      "slug": "chill-vibes",
      "name": "Chill Vibes",
      "description": "Relax and unwind with these smooth tracks",
      "type": "mood",
      "category": "mood",
      "total_tracks": 50,
      "artwork": {
        "primary": "https://...",
        "fallback": "https://...",
        "color": "#1a1a2e"
      },
      "homepage_featured": true
    }
  ],
  "total": 15
}
```

**Swift:**
```swift
let playlists = try await MusicConductorAPI.shared.fetchPlaylists(homepageFeatured: true)
```

---

### GET /api/playlists/{id}

Get a specific playlist with tracks.

**Example:**
```
GET /api/playlists/60d5ec49f1b2c8a9e8b4e123
```

**Response:**
```json
{
  "id": "60d5ec49f1b2c8a9e8b4e123",
  "slug": "chill-vibes",
  "name": "Chill Vibes",
  "description": "Relax and unwind with these smooth tracks",
  "type": "mood",
  "category": "mood",
  "artwork": { ... },
  "tracks": [
    {
      "position": 1,
      "song_id": "60d5ec49f1b2c8a9e8b4e456",
      "title": "Tum Hi Ho",
      "artist": "Arijit Singh",
      "youtube_id": "xyz123",
      "artwork_url": "https://...",
      "duration_ms": 262000
    }
  ],
  "total_tracks": 50,
  "total_duration_ms": 12000000,
  "created_at": "2025-01-01T00:00:00Z",
  "updated_at": "2025-01-02T00:00:00Z"
}
```

**Swift:**
```swift
let playlist = try await MusicConductorAPI.shared.fetchPlaylist(id: "60d5ec49f1b2c8a9e8b4e123")
```

---

### GET /api/playlists/by-type/{type}

Get playlists by type.

**Path Parameters:**
- `type`: Playlist type (`mood`, `genre`, `language`)

**Example:**
```
GET /api/playlists/by-type/mood
```

**Response:**
```json
{
  "playlists": [ ... ],
  "total": 8
}
```

**Swift:**
```swift
let playlists = try await MusicConductorAPI.shared.fetchPlaylistsByType(type: "mood")
```

---

## Library

**All library endpoints require authentication.**

### GET /api/library/favorites

Get user's favorite songs.

**Auth Required**: ✅

**Response:**
```json
{
  "songs": [
    {
      "id": "60d5ec49f1b2c8a9e8b4e123",
      "title": "Tum Hi Ho",
      "artist_name": "Arijit Singh",
      ...
    }
  ]
}
```

**Swift:**
```swift
let favorites = try await MusicConductorAPI.shared.getFavorites()
```

---

### POST /api/library/favorites

Add song to favorites.

**Auth Required**: ✅

**Request:**
```json
{
  "song_id": "60d5ec49f1b2c8a9e8b4e123"
}
```

**Response:**
```json
{
  "success": true
}
```

**Swift:**
```swift
try await MusicConductorAPI.shared.addToFavorites(songId: "60d5ec49f1b2c8a9e8b4e123")
```

---

### DELETE /api/library/favorites/{song_id}

Remove song from favorites.

**Auth Required**: ✅

**Response:**
```json
{
  "success": true
}
```

**Swift:**
```swift
try await MusicConductorAPI.shared.removeFromFavorites(songId: "60d5ec49f1b2c8a9e8b4e123")
```

---

### GET /api/library/history

Get play history.

**Auth Required**: ✅

**Query Parameters:**
- `limit` (optional): Number of items (default: `50`, max: `100`)

**Response:**
```json
{
  "history": [
    {
      "id": "60d5ec49f1b2c8a9e8b4e999",
      "song_id": "60d5ec49f1b2c8a9e8b4e123",
      "played_at": "2026-01-02T10:30:00Z",
      "song": {
        "id": "60d5ec49f1b2c8a9e8b4e123",
        "title": "Tum Hi Ho",
        "artist_name": "Arijit Singh",
        ...
      }
    }
  ]
}
```

**Swift:**
```swift
let history = try await MusicConductorAPI.shared.getPlayHistory(limit: 50)
```

---

## Behavior Tracking

**All behavior tracking endpoints require authentication.**

### POST /api/behavior/play

Track a song play.

**Auth Required**: ✅

**Request:**
```json
{
  "song_id": "60d5ec49f1b2c8a9e8b4e123",
  "youtube_id": "xyz123",
  "duration_ms": 262000,
  "source": "ios_app"
}
```

**Response:**
```json
{
  "success": true
}
```

**Swift:**
```swift
try await MusicConductorAPI.shared.trackPlay(
    songId: "60d5ec49f1b2c8a9e8b4e123",
    youtubeId: "xyz123",
    durationMs: 262000,
    source: "ios_app"
)
```

---

### POST /api/behavior/search

Track a search query.

**Auth Required**: ✅

**Request:**
```json
{
  "query": "arijit singh"
}
```

**Response:**
```json
{
  "success": true
}
```

**Swift:**
```swift
try await MusicConductorAPI.shared.trackSearch(query: "arijit singh")
```

---

### POST /api/behavior/favorite

Track adding to favorites.

**Auth Required**: ✅

**Request:**
```json
{
  "song_id": "60d5ec49f1b2c8a9e8b4e123"
}
```

**Response:**
```json
{
  "success": true
}
```

**Swift:**
```swift
try await MusicConductorAPI.shared.trackFavorite(songId: "60d5ec49f1b2c8a9e8b4e123")
```

---

## Discovery

### GET /api/discovery/trending

Get trending songs.

**Auth Required**: ✅

**Query Parameters:**
- `time_window` (optional): Time window (`1h`, `24h`, `7d`) (default: `24h`)
- `limit` (optional): Number of songs (default: `20`, max: `50`)

**Response:**
```json
{
  "songs": [
    {
      "id": "60d5ec49f1b2c8a9e8b4e123",
      "title": "Tum Hi Ho",
      "artist_name": "Arijit Singh",
      "youtube_video_id": "xyz123",
      "artwork_url": "https://...",
      "play_count": 1523,
      "velocity": 234.5
    }
  ],
  "time_window": "24h"
}
```

**Swift:**
```swift
let trending = try await MusicConductorAPI.shared.getTrendingSongs(timeWindow: "24h", limit: 20)
```

---

### GET /api/discovery/radio/{song_id}

Get personalized radio based on a seed song.

**Auth Required**: ✅

**Query Parameters:**
- `limit` (optional): Number of songs (default: `20`, max: `50`)

**Response:**
```json
{
  "seed_song_id": "60d5ec49f1b2c8a9e8b4e123",
  "songs": [ ... ],
  "total": 20
}
```

**Swift:**
```swift
let radio = try await MusicConductorAPI.shared.getRadio(songId: "60d5ec49f1b2c8a9e8b4e123", limit: 20)
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Authentication required or token expired |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Service temporarily unavailable |

### Error Response Format

```json
{
  "detail": "Error message here"
}
```

### Swift Error Handling

```swift
do {
    let chart = try await MusicConductorAPI.shared.fetchBollywoodTop25()
    // Success
} catch APIError.unauthorized {
    // Show login screen
    print("Please sign in")
} catch APIError.httpError(let statusCode) {
    // Handle HTTP errors
    print("HTTP error: \(statusCode)")
} catch {
    // Generic error
    print("Error: \(error.localizedDescription)")
}
```

### Rate Limiting

The API implements rate limiting:
- **Anonymous users**: 60 requests per minute (IP-based)
- **Authenticated users**: 300 requests per minute (user-based)

**Response Headers:**
```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 295
X-RateLimit-Reset: 1641024000
```

---

## Best Practices

### 1. Token Management

- Store tokens securely in Keychain
- Automatically refresh expired access tokens
- Handle 401 errors gracefully

### 2. Caching

- Cache chart data locally (valid for 24 hours)
- Cache artwork images
- Implement offline mode

### 3. Error Handling

- Always handle network errors
- Show user-friendly error messages
- Implement retry logic for failed requests

### 4. Performance

- Use pagination for large result sets
- Debounce search queries (wait 300ms after user stops typing)
- Lazy load images in lists

### 5. Analytics

- Track all plays for personalization
- Track search queries for improvement
- Monitor API errors

---

**Questions?** Check the [Integration Guide](INTEGRATION_GUIDE.md) for more details.
