# Music Harvester Integration Plan

## Database Overview

**MongoDB**: `music_harvester` at `52.77.214.150:27017`

### Collections Summary

| Collection | Documents | Key Use |
|------------|-----------|---------|
| `songs` | 68,608 | Unified catalog with artwork |
| `youtube_music_songs` | 32,756 | Songs with video_id (playable!) |
| `artists` | 240 | Artist metadata |

### Key Schema Fields

**youtube_music_songs** (primary for playlists):
- `video_id` - YouTube video ID for playback
- `title`, `artist`, `album`
- `mood` - 11 mood categories
- `chart_name` - Regional/genre charts
- `thumbnails` - Artwork URLs
- `chart_position` - Ranking
- `duration_seconds`

**songs** (unified catalog):
- `title`, `artist`, `album`
- `language` - Hindi, Tamil, Telugu, etc.
- `year` - Release year
- `genre` - Bollywood, Hip-Hop, etc.
- `platforms.jiosaavn.image_url` - High-quality artwork

---

## Available Data for Playlists

### Mood Distribution (youtube_music_songs)

| Mood | Songs | Playlist Name |
|------|-------|---------------|
| Chill | 3,215 | Chill Vibes |
| Commute | 2,924 | Road Trip Mix |
| Energize | 2,866 | Energy Boost |
| Feel good | 2,165 | Feel Good Hits |
| Focus | 2,100 | Deep Focus |
| Sad | 2,015 | Sad Songs |
| Party | 1,770 | Party Anthems |
| Sleep | 1,735 | Sleep Sounds |
| Romance | 1,711 | Love Songs |
| Workout | 1,597 | Workout Beats |
| Gaming | 1,354 | Gaming Mode |

### Language Distribution (songs)

| Language | Songs | Coverage |
|----------|-------|----------|
| Hindi | 13,404 | Excellent |
| Tamil | 4,858 | Excellent |
| Telugu | 3,874 | Excellent |
| Punjabi | 2,491 | Good |
| English | 2,074 | Good |
| Bengali | 1,495 | Good |
| Kannada | 1,438 | Good |
| Malayalam | 858 | Moderate |
| Bhojpuri | 618 | Moderate |
| Gujarati | 302 | Basic |
| Marathi | 268 | Basic |
| Haryanvi | 157 | Basic |

### Chart Sources (youtube_music_songs)

- Top Weekly Videos Hindi
- Top Weekly Videos Tamil
- Top Weekly Videos Telugu
- Top Weekly Videos Punjabi
- Top Weekly Videos Bhojpuri
- Top Weekly Videos Haryanvi
- Top Weekly Videos US
- R&B Hotlist
- Daily Top Music Videos India

### Year Distribution (songs)

| Year | Songs |
|------|-------|
| 2025 | 3,187 |
| 2024 | 3,147 |
| 2023 | 2,459 |
| 2022 | 2,331 |
| 2020 | 1,399 |
| 2019 | 1,346 |
| 2021 | 1,345 |
| 2018 | 1,469 |
| 2017 | 1,239 |

### Top Artists (youtube_music_songs)

**Indian**: Arijit Singh (108), Anirudh Ravichander (99), Shreya Ghoshal (76), Sonu Nigam (75), Badshah (57), Diljit Dosanjh (55), Karan Aujla (51)

**Global**: Taylor Swift (74), Ed Sheeran (52), Chris Brown (48), Drake (47), The Weeknd (45)

**Classics**: Kishore Kumar (77), Lata Mangeshkar (70), Mohammed Rafi (57), Udit Narayan (56), Kumar Sanu (50)

---

## Proposed Playlist Categories

### 1. Mood-Based Playlists (11 playlists)
Leverage the mood data from `youtube_music_songs`:
- Chill Vibes
- Workout Beats
- Party Anthems
- Romance
- Sad Songs
- Deep Focus
- Gaming Mode
- Feel Good Hits
- Sleep Sounds
- Road Trip Mix
- Energy Boost

### 2. Language Playlists (Already have regional, but can expand)
- Hindi Superhits
- Tamil Trending
- Telugu Top Hits
- Punjabi Beats
- Bengali Vibes
- Kannada Hits
- Malayalam Melodies

### 3. Era/Decade Playlists
- 2025 Fresh Releases
- 2024 Top Picks
- 2023 Best Of
- 2020s Hits
- 2010s Throwback
- Retro Classics (pre-2010)

### 4. Artist Spotlight Playlists
- Arijit Singh Essentials
- Anirudh Hits
- Shreya Ghoshal Collection
- Kishore Kumar Classics
- Lata Mangeshkar Legends
- Taylor Swift Mix
- Ed Sheeran Favorites

### 5. Genre Playlists
- Bollywood Blockbusters
- Hip-Hop India
- Devotional & Spiritual
- Indian Folk
- Dance/Electronic

### 6. Activity-Based Playlists
- Morning Motivation
- Coffee Break
- Late Night Drives
- Study Session
- House Party

---

## Implementation Plan

### Phase 1: Backend API Endpoints

Create new API endpoints in the TLDR Music backend:

```
GET /curated/moods                    # List all mood playlists
GET /curated/moods/{mood}             # Get songs for a mood
GET /curated/languages/{language}     # Get songs by language
GET /curated/artists/{artist}         # Get songs by artist
GET /curated/years/{year}             # Get songs by year
GET /curated/decades/{decade}         # Get songs by decade
```

### Phase 2: Data Pipeline

1. **Create curated_playlists collection** in MongoDB:
   ```javascript
   {
     id: "mood-chill",
     name: "Chill Vibes",
     category: "mood",
     description: "Relaxing tracks for unwinding",
     cover_color: "#4A90D9",
     cover_icon: "chill",
     query: { mood: "Chill" },  // MongoDB query
     sort: { chart_position: 1 },
     limit: 50,
     refresh_interval: "weekly"
   }
   ```

2. **Build aggregation pipeline** to fetch songs from both:
   - `youtube_music_songs` (has video_id)
   - Cross-reference with `songs` for better artwork

3. **Generate playlist data** with:
   - video_id (for playback)
   - title, artist
   - artwork_url (prefer JioSaavn high-quality)
   - duration

### Phase 3: Frontend Integration

1. **New Section: "Discover"** on Home Page
   - Mood cards (horizontal scroll)
   - Era cards
   - Artist spotlights

2. **Curated Playlist Detail View**
   - Similar to user playlist view
   - "Follow" button to add to library
   - Shuffle/Play All

3. **Browse Page** (new)
   - All curated playlists organized by category
   - Search/filter curated playlists

### Phase 4: Smart Features

1. **Auto-refresh** curated playlists weekly
2. **Personalized recommendations** based on listening history
3. **"Similar to"** playlist suggestions
4. **Time-based playlists** (Morning, Afternoon, Evening, Night)

---

## Technical Implementation Details

### MongoDB Aggregation Query Example

```javascript
// Get Chill mood playlist
db.youtube_music_songs.aggregate([
  { $match: { mood: "Chill", video_id: { $ne: null } } },
  { $sort: { chart_position: 1 } },
  { $limit: 50 },
  { $project: {
      video_id: 1,
      title: 1,
      artist: 1,
      artwork_url: { $arrayElemAt: ["$thumbnails.url", 0] },
      duration_seconds: 1
  }}
])
```

### Joining with songs collection for better artwork

```javascript
db.youtube_music_songs.aggregate([
  { $match: { mood: "Chill", video_id: { $ne: null } } },
  { $lookup: {
      from: "songs",
      let: { title: "$title", artist: "$artist" },
      pipeline: [
        { $match: {
            $expr: {
              $and: [
                { $eq: [{ $toLower: "$title" }, { $toLower: "$$title" }] },
                { $regexMatch: { input: { $toLower: "$artist" }, regex: { $toLower: "$$artist" } } }
              ]
            }
        }},
        { $limit: 1 }
      ],
      as: "matched_song"
  }},
  { $addFields: {
      artwork_url: {
        $ifNull: [
          { $arrayElemAt: ["$matched_song.platforms.jiosaavn.image_url", 0] },
          { $arrayElemAt: ["$thumbnails.url", 0] }
        ]
      }
  }}
])
```

---

## Priority Order

1. **High Priority** (Quick wins with mood data):
   - Mood playlists (Chill, Workout, Party, Romance, Sad)
   - These have clean categorization and video_ids ready

2. **Medium Priority**:
   - Artist spotlight playlists
   - Era playlists (2024, 2023, etc.)
   - Extended language playlists

3. **Lower Priority** (Requires more curation):
   - Genre playlists
   - Activity-based playlists
   - Cross-platform merged playlists

---

## Estimated Effort

| Task | Effort |
|------|--------|
| Backend API endpoints | 2-3 hours |
| MongoDB aggregation queries | 1-2 hours |
| Frontend Discover section | 3-4 hours |
| Browse page | 2-3 hours |
| Curated playlist detail view | 2 hours |
| Testing & Polish | 2 hours |
| **Total** | **12-16 hours** |

---

## Questions to Decide

1. Should curated playlists be stored as static snapshots or dynamically generated?
2. How often should playlists refresh (daily, weekly)?
3. Should users be able to "follow" curated playlists?
4. Maximum songs per curated playlist (25, 50, 100)?
5. Should we show "source" badge (e.g., "From YouTube Music")?
