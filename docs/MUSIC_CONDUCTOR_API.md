# TLDRMusic Integration Guide

Complete guide for tldrmusic to integrate with music-conductor APIs.

## Production URL

```
https://music-conductor-401132033262.asia-south1.run.app
```

**Swagger Docs:** https://music-conductor-401132033262.asia-south1.run.app/docs

---

## Quick Start

```bash
# Get trending chart (India)
curl "https://music-conductor-401132033262.asia-south1.run.app/api/charts/aggregated?region=india&limit=20"

# Search songs
curl "https://music-conductor-401132033262.asia-south1.run.app/api/search/songs?q=arijit&has_youtube=true"

# Get a playlist
curl "https://music-conductor-401132033262.asia-south1.run.app/api/playlists/hip-hop-rap"
```

---

## API Overview

| Endpoint | Description | YouTube IDs |
|----------|-------------|-------------|
| `GET /api/charts/aggregated` | Trending chart from 4 platforms | ✅ 100% |
| `GET /api/charts/multi-platform` | Songs on 2+ platforms | ✅ 100% |
| `GET /api/search/songs` | Search with typo tolerance | ✅ 83% |
| `GET /api/search/suggest` | Autocomplete | ✅ Prioritized |
| `GET /api/playlists/{slug}` | Curated playlists | ✅ 100% |

---

## 1. Charts API (Trending Songs)

### Get Aggregated Chart

```
GET /api/charts/aggregated?region=india&limit=50
```

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `region` | string | `india` | `india`, `us`, `global` |
| `limit` | int | `50` | Max songs (1-200) |

**Response:**
```json
{
  "chart_id": "aggregated_india_2025-W51",
  "region": "india",
  "week": "2025-W51",
  "generated_at": "2025-12-22T11:40:33.942000",
  "sources": ["youtube_music", "apple_music", "spotify", "billboard"],
  "total_songs": 34,
  "songs": [
    {
      "rank": 1,
      "title": "Haseen",
      "artist": "Talwiinder, NDS & Rippy Grewal",
      "score": 3.912,
      "platforms_count": 3,
      "platform_ranks": {
        "youtube_music": null,
        "apple_music": 4,
        "spotify": 6,
        "billboard": 15
      },
      "isrc": "TCAJH2583153",
      "spotify_id": "08GYLNhKthS3arMdXsveRI",
      "youtube_id": "WSy0sjZiO8I",
      "apple_music_id": "1796740779",
      "song_id": "69492c985e8dac2d18b8ffaf"
    }
  ]
}
```

**Playing Songs:**
```typescript
const youtubeUrl = `https://music.youtube.com/watch?v=${song.youtube_id}`;
```

### Get Multi-Platform Songs

Songs appearing on 2+ platforms (most reliable trending indicators):

```
GET /api/charts/multi-platform?region=india&min_platforms=2
```

### Get Single Source Chart

```
GET /api/charts/source/spotify?region=india
GET /api/charts/source/apple_music?region=india
GET /api/charts/source/youtube_music?region=india
GET /api/charts/source/billboard?region=india
```

---

## 2. Search API

### Search Songs

```
GET /api/search/songs?q=arijit&has_youtube=true&per_page=20
```

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `q` | string | `""` | Search query |
| `language` | string | - | Filter: `hi`, `en`, `es`, etc. |
| `genre` | string | - | Filter: `Pop`, `Hip-Hop/Rap` |
| `has_youtube` | bool | - | Only songs with YouTube |
| `page` | int | `1` | Page number |
| `per_page` | int | `20` | Results per page (max 100) |

**Response:**
```json
{
  "query": "arijit",
  "found": 245,
  "songs": [
    {
      "id": "uuid",
      "title": "Tum Hi Ho",
      "artist_name": "Arijit Singh",
      "youtube_video_id": "Umqb9KENgmk",
      "language": "hi",
      "genres": ["Bollywood", "Music"]
    }
  ]
}
```

### Autocomplete

```
GET /api/search/suggest?q=sha&limit=5
```

**Response:**
```json
{
  "query": "sha",
  "suggestions": [
    {
      "id": "uuid",
      "title": "Shape of You",
      "artist_name": "Ed Sheeran",
      "display": "Shape of You - Ed Sheeran",
      "youtube_video_id": "JGwWNGJdvx8"
    }
  ]
}
```

---

## 3. Playlists API

### List All Playlists

```
GET /api/playlists
GET /api/playlists?type=genre
GET /api/playlists?type=language
GET /api/playlists?type=mood
```

### Get Playlist with Tracks

```
GET /api/playlists/hip-hop-rap
```

**Available Playlists:**

| Type | Playlists |
|------|-----------|
| Language (8) | `hindi-hits`, `english-hits`, `tamil-hits`, `telugu-hits`, `punjabi-hits`, `spanish-hits`, `korean-hits`, `japanese-hits` |
| Genre (10) | `hip-hop-rap`, `pop-hits`, `rock-classics`, `electronic-dance`, `rnb-soul`, `latin-vibes`, `jazz-classics`, `classical-music`, `world-music`, `alternative-indie` |
| Mood (4) | `chill-vibes`, `workout-energy`, `party-mode`, `focus-study` |

**Response:**
```json
{
  "id": "uuid",
  "slug": "hip-hop-rap",
  "name": "Hip-Hop & Rap",
  "type": "genre",
  "total_tracks": 50,
  "tracks": [
    {
      "position": 1,
      "song_id": "uuid",
      "title": "God's Plan",
      "artist": "Drake",
      "youtube_id": "xpVfcZ0ZcFM",
      "artwork_url": "https://...",
      "duration_ms": 198000
    }
  ]
}
```

---

## TypeScript Types

```typescript
// Charts
interface ChartSong {
  rank: number;
  title: string;
  artist: string;
  score: number;
  platforms_count: number;
  platform_ranks: {
    youtube_music: number | null;
    apple_music: number | null;
    spotify: number | null;
    billboard: number | null;
  };
  isrc: string | null;
  spotify_id: string | null;
  youtube_id: string | null;  // Use this for playback!
  apple_music_id: string | null;
  song_id: string | null;
}

interface AggregatedChart {
  chart_id: string;
  region: string;
  week: string;
  generated_at: string;
  sources: string[];
  total_songs: number;
  songs: ChartSong[];
}

// Search
interface Song {
  id: string;
  title: string;
  artist_name: string;
  youtube_video_id: string | null;  // Use this for playback!
  language: string | null;
  genres: string[] | null;
  isrc: string | null;
}

// Playlists
interface PlaylistTrack {
  position: number;
  song_id: string;
  title: string;
  artist: string;
  youtube_id: string | null;  // Use this for playback!
  artwork_url: string | null;
  duration_ms: number | null;
}

interface Playlist {
  id: string;
  slug: string;
  name: string;
  type: 'language' | 'genre' | 'mood';
  total_tracks: number;
  tracks: PlaylistTrack[];
}
```

---

## React Integration Example

```typescript
// hooks/useChart.ts
import useSWR from 'swr';

const API_BASE = 'https://music-conductor-401132033262.asia-south1.run.app';
const fetcher = (url: string) => fetch(url).then(res => res.json());

export function useChart(region: string = 'india', limit: number = 20) {
  const { data, error, isLoading } = useSWR<AggregatedChart>(
    `${API_BASE}/api/charts/aggregated?region=${region}&limit=${limit}`,
    fetcher,
    { revalidateOnFocus: false, dedupingInterval: 60000 }
  );

  return { chart: data, isLoading, error };
}

// components/TrendingChart.tsx
export function TrendingChart({ region = 'india' }) {
  const { chart, isLoading, error } = useChart(region, 20);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Failed to load</div>;

  return (
    <div>
      <h2>Trending in {region}</h2>
      <p>Week: {chart.week} | Sources: {chart.sources.join(', ')}</p>

      {chart.songs.map((song) => (
        <div key={song.rank}>
          <span>#{song.rank}</span>
          <strong>{song.title}</strong>
          <span> - {song.artist}</span>
          {song.youtube_id && (
            <a href={`https://music.youtube.com/watch?v=${song.youtube_id}`}>
              Play
            </a>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## Important Notes

### YouTube Field Names

Different endpoints use different field names for YouTube IDs:

| Endpoint | Field Name |
|----------|------------|
| `/api/charts/*` | `youtube_id` |
| `/api/search/songs` | `youtube_video_id` |
| `/api/playlists/{slug}` | `youtube_id` |

### YouTube Coverage

| Source | Coverage |
|--------|----------|
| Charts | 100% (all chart songs have YouTube IDs) |
| Playlists | 100% (only songs with YouTube IDs included) |
| Search | 83% (83,021 of 100,030 songs) |

### Scoring Formula (Charts)

Songs are ranked by aggregate score across platforms:

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

## Caching Recommendations

- **Charts**: Cache for 1 hour (updated daily)
- **Playlists**: Cache for 1 hour
- **Search**: No caching needed (fast enough)

```typescript
// Next.js fetch with caching
const chart = await fetch(
  'https://music-conductor-401132033262.asia-south1.run.app/api/charts/aggregated',
  { next: { revalidate: 3600 } }
);
```

---

## Error Handling

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 404 | Chart/playlist not found |
| 422 | Validation error (check params) |
| 500 | Server error |

```typescript
try {
  const res = await fetch(`${API_BASE}/api/charts/aggregated?region=${region}`);
  if (!res.ok) {
    if (res.status === 404) {
      // Chart not yet generated for this region
      return null;
    }
    throw new Error(`HTTP ${res.status}`);
  }
  return res.json();
} catch (error) {
  console.error('Failed to fetch chart:', error);
  return null;
}
```

---

## Integration Checklist

- [ ] Fetch `/api/charts/aggregated?region=india` for trending page
- [ ] Use `youtube_id` field to build YouTube Music URLs
- [ ] Implement search with `/api/search/songs?has_youtube=true`
- [ ] Add autocomplete with `/api/search/suggest`
- [ ] Display playlists from `/api/playlists`
- [ ] Handle 404 gracefully (show "Coming soon")
- [ ] Cache chart requests (1 hour TTL)
- [ ] Show data freshness from `generated_at`

---

## Support

- API Docs: https://music-conductor-401132033262.asia-south1.run.app/docs
- Issues: Contact the music-conductor team
