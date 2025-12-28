# Homepage Implementation Plan - TLDR Music

**Document Version:** 1.0
**Created:** December 28, 2025
**Target Completion:** January 15, 2026 (Phase 1)

---

## Executive Summary

This document provides **exact technical requirements** for implementing the new homepage structure with 10 content rows for authenticated users and 8 rows for non-authenticated users.

**Scope:** Phase 1 implementation (MVP)
**Estimated Effort:** 40-50 development hours
**Dependencies:** Existing Chart API, Curated Playlists API, User Library API

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [API Requirements](#api-requirements)
3. [Data Structures](#data-structures)
4. [UI Components](#ui-components)
5. [Row-by-Row Implementation](#row-by-row-implementation)
6. [State Management](#state-management)
7. [Performance Optimization](#performance-optimization)
8. [Testing Requirements](#testing-requirements)
9. [Implementation Timeline](#implementation-timeline)

---

## Architecture Overview

### Current Homepage (Before)

```
index.html
  └── <main-view>
      ├── Chart Selector Cards (India/Global)
      ├── Quick Picks (Top 10)
      └── Regional Charts Grid
```

### New Homepage (After - Phase 1)

```
index.html
  └── <main-view id="homeView">
      ├── Hero Section (if authenticated) OR Quick Access Grid
      ├── Recently Played Row (if authenticated)
      ├── Your Favorites Row (if authenticated)
      ├── India Top 25 Row
      ├── Trending Now Row
      ├── Regional Charts Section
      ├── Discover Playlists Row
      ├── New This Week Row
      ├── Top Artists Row
      └── Global Top 25 Row
```

### File Structure Changes

```
tldrmusic/
├── app.js                          # Main app logic
│   ├── NEW: renderHomepage()       # Main homepage orchestrator
│   ├── NEW: renderHeroSection()
│   ├── NEW: renderContentRow()     # Generic row renderer
│   ├── NEW: renderTrendingRow()
│   ├── NEW: renderNewThisWeekRow()
│   ├── NEW: renderTopArtistsRow()
│   └── UPDATE: showMainView()      # Call renderHomepage()
│
├── style.css
│   ├── NEW: .content-row
│   ├── NEW: .hero-section
│   ├── NEW: .horizontal-scroll
│   ├── NEW: .artist-carousel
│   └── NEW: .row-header
│
└── index.html
    └── UPDATE: <main-view> structure
```

---

## API Requirements

### Existing APIs (No Changes Needed)

#### 1. Charts API
**Endpoint:** `GET /api/charts/aggregated?region={india|global}&limit=25`

**Response:**
```json
{
  "chart_date": "2025-01-06",
  "region": "india",
  "songs": [
    {
      "rank": 1,
      "title": "Song Title",
      "artist": "Artist Name",
      "youtube_id": "abc123",
      "thumbnail_url": "https://...",
      "rank_change": 2,
      "is_new": false,
      "platforms": ["spotify", "apple_music", "youtube_music"],
      "platform_count": 3
    }
  ]
}
```

**Usage:**
- India Top 25 Row
- Global Top 25 Row
- Trending Now (filter: rank_change >= 10 OR is_new === true)
- New This Week (filter: is_new === true)

---

#### 2. Curated Playlists API
**Endpoint:** `GET /api/playlists`

**Response:**
```json
{
  "playlists": [
    {
      "id": "chill-vibes",
      "name": "Chill Vibes",
      "description": "Laid-back tracks for relaxation",
      "category": "mood",
      "song_count": 50,
      "thumbnail_url": "https://...",
      "songs": [...]
    }
  ]
}
```

**Usage:**
- Discover Playlists Row (show first 8-12)

---

#### 3. User Library API (Authenticated)
**Endpoints:**
- `GET /api/me/history` - Recently played songs
- `GET /api/me/favorites` - Liked songs
- `GET /api/me/playlists` - User playlists

**Response Format:**
```json
{
  "items": [
    {
      "song_id": "abc123",
      "title": "Song Title",
      "artist": "Artist Name",
      "youtube_id": "xyz789",
      "thumbnail_url": "https://...",
      "played_at": "2025-01-06T12:34:56Z", // for history
      "created_at": "2025-01-01T00:00:00Z"  // for favorites
    }
  ],
  "total": 150
}
```

**Usage:**
- Recently Played Row (last 15 items)
- Your Favorites Row (all items, scrollable)

---

### NEW API Endpoints Needed

#### 1. Top Artists Endpoint
**Endpoint:** `GET /api/charts/top-artists?region={india|global}&limit=20`

**Purpose:** Extract top artists from chart data

**Response:**
```json
{
  "region": "india",
  "artists": [
    {
      "name": "Arijit Singh",
      "song_count": 8,
      "avatar_url": "https://...",
      "top_song": {
        "title": "Song Name",
        "rank": 1
      }
    }
  ]
}
```

**Implementation:**
- Backend: Aggregate artists from current chart
- Count songs per artist
- Use YouTube thumbnail from top song as avatar
- Sort by song_count DESC

**Backend Changes Required:**
```python
# backend/src/api/routes/charts.py

@router.get("/top-artists")
async def get_top_artists(
    region: str = "india",
    limit: int = 20
):
    # Get current chart
    chart = await get_aggregated_chart(region)

    # Aggregate by artist
    artist_counts = {}
    for song in chart['songs']:
        artist = song['artist']
        if artist not in artist_counts:
            artist_counts[artist] = {
                'name': artist,
                'song_count': 0,
                'songs': []
            }
        artist_counts[artist]['song_count'] += 1
        artist_counts[artist]['songs'].append(song)

    # Sort and format
    top_artists = sorted(
        artist_counts.values(),
        key=lambda x: x['song_count'],
        reverse=True
    )[:limit]

    # Add avatar from top song
    for artist in top_artists:
        artist['avatar_url'] = artist['songs'][0]['thumbnail_url']
        artist['top_song'] = {
            'title': artist['songs'][0]['title'],
            'rank': artist['songs'][0]['rank']
        }
        del artist['songs']  # Remove songs array

    return {'region': region, 'artists': top_artists}
```

**Estimated Effort:** 2 hours (backend + testing)

---

## Data Structures

### Row Configuration Object

```javascript
const RowConfig = {
  id: string,              // Unique row identifier
  type: string,            // 'hero' | 'horizontal-scroll' | 'grid' | 'carousel'
  title: string | null,    // Row header title (null for hero)
  subtitle: string | null, // Optional subtitle
  authenticated: boolean,  // Show only if logged in
  fallback: string | null, // Alternative row ID if not authenticated
  dataSource: string,      // API endpoint or local function
  layout: LayoutConfig,    // Layout-specific configuration
  cta: CTAConfig | null,   // Optional "See All" button
  badge: string | null     // Optional emoji badge (🔥, ✨, etc.)
}

const LayoutConfig = {
  type: 'horizontal-scroll' | 'grid' | 'hero' | 'avatar-carousel',
  itemsVisible: number,     // Items visible without scrolling
  itemsTotal: number,       // Total items to load
  gap: string,              // CSS gap value (e.g., '1rem')
  itemWidth: string         // Fixed or 'auto'
}

const CTAConfig = {
  text: string,            // Button text
  link: string,            // Destination URL
  action: function | null  // Optional click handler
}
```

### Example Row Configurations

```javascript
// app.js

const ROW_CONFIGS = {
  hero: {
    id: 'hero',
    type: 'hero',
    title: null,
    subtitle: null,
    authenticated: false,
    fallback: null,
    dataSource: 'getHeroSong', // Function that returns chart[0]
    layout: {
      type: 'hero',
      itemsVisible: 1,
      itemsTotal: 1
    },
    cta: {
      text: 'View Full Chart',
      link: '#/charts/india'
    },
    badge: null
  },

  recentlyPlayed: {
    id: 'recently-played',
    type: 'horizontal-scroll',
    title: 'Listen Again',
    subtitle: 'Pick up where you left off',
    authenticated: true,
    fallback: 'trending',
    dataSource: '/api/me/history?limit=15',
    layout: {
      type: 'horizontal-scroll',
      itemsVisible: 6,
      itemsTotal: 15,
      gap: '1rem',
      itemWidth: '180px'
    },
    cta: null,
    badge: null
  },

  trending: {
    id: 'trending',
    type: 'horizontal-scroll',
    title: 'Trending Now',
    subtitle: 'Biggest movers this week',
    authenticated: false,
    fallback: null,
    dataSource: 'getTrendingSongs', // Local filter function
    layout: {
      type: 'horizontal-scroll',
      itemsVisible: 6,
      itemsTotal: 20,
      gap: '1rem',
      itemWidth: '180px'
    },
    cta: null,
    badge: '🔥'
  },

  topArtists: {
    id: 'top-artists',
    type: 'carousel',
    title: 'Popular Artists',
    subtitle: null,
    authenticated: false,
    fallback: null,
    dataSource: '/api/charts/top-artists?region=india&limit=20',
    layout: {
      type: 'avatar-carousel',
      itemsVisible: 8,
      itemsTotal: 20,
      gap: '1.5rem',
      itemWidth: '120px'
    },
    cta: null,
    badge: null
  }
};
```

---

## UI Components

### 1. Generic Content Row Component

**HTML Structure:**
```html
<section class="content-row" data-row-id="{rowId}">
  <div class="row-header">
    <div class="row-title-group">
      <h2 class="row-title">
        <span class="row-badge" *ngIf="badge">🔥</span>
        {title}
      </h2>
      <p class="row-subtitle" *ngIf="subtitle">{subtitle}</p>
    </div>
    <button class="row-cta" *ngIf="cta">
      {cta.text}
      <svg><!-- arrow icon --></svg>
    </button>
  </div>

  <div class="row-content horizontal-scroll">
    <!-- Dynamic content based on row type -->
  </div>
</section>
```

**CSS:**
```css
.content-row {
  margin: 2rem 0;
  padding: 0 2rem;
}

.row-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.row-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: #fff;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.row-badge {
  font-size: 1.25rem;
}

.row-subtitle {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
  margin-top: 0.25rem;
}

.row-cta {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.row-cta:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
}

.horizontal-scroll {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  overflow-y: hidden;
  scroll-behavior: smooth;
  padding-bottom: 1rem;

  /* Hide scrollbar but keep functionality */
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.horizontal-scroll::-webkit-scrollbar {
  display: none;
}

.horizontal-scroll .song-card {
  flex: 0 0 180px;
  width: 180px;
}
```

**JavaScript Function:**
```javascript
// app.js

function renderContentRow(config, data) {
  const row = document.createElement('section');
  row.className = 'content-row';
  row.dataset.rowId = config.id;

  // Header
  const header = document.createElement('div');
  header.className = 'row-header';
  header.innerHTML = `
    <div class="row-title-group">
      <h2 class="row-title">
        ${config.badge ? `<span class="row-badge">${config.badge}</span>` : ''}
        ${config.title}
      </h2>
      ${config.subtitle ? `<p class="row-subtitle">${config.subtitle}</p>` : ''}
    </div>
    ${config.cta ? `
      <button class="row-cta" onclick="navigateTo('${config.cta.link}')">
        ${config.cta.text}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M6 12L10 8L6 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </button>
    ` : ''}
  `;

  // Content container
  const content = document.createElement('div');
  content.className = `row-content ${config.layout.type}`;

  // Render items based on layout type
  switch (config.layout.type) {
    case 'horizontal-scroll':
      content.innerHTML = data.map(song => createSongCard(song)).join('');
      break;
    case 'avatar-carousel':
      content.innerHTML = data.map(artist => createArtistCard(artist)).join('');
      break;
    case 'hero':
      content.innerHTML = createHeroCard(data[0]);
      break;
  }

  row.appendChild(header);
  row.appendChild(content);

  return row;
}
```

---

### 2. Hero Section Component

**HTML:**
```html
<section class="hero-section">
  <div class="hero-background" style="background-image: url({thumbnailUrl})">
    <div class="hero-overlay"></div>
  </div>

  <div class="hero-content">
    <div class="hero-badge">#1 on India Top 25</div>
    <h1 class="hero-title">{songTitle}</h1>
    <p class="hero-artist">{artist}</p>

    <div class="hero-actions">
      <button class="hero-play-btn" onclick="playSong({song})">
        <svg class="play-icon"><!-- play icon --></svg>
        Play Now
      </button>
      <button class="hero-favorite-btn" onclick="toggleFavorite('{songId}')">
        <svg class="heart-icon"><!-- heart icon --></svg>
      </button>
      <button class="hero-share-btn" onclick="shareSong({song})">
        <svg class="share-icon"><!-- share icon --></svg>
      </button>
    </div>

    <div class="hero-metadata">
      <span class="hero-rank-change">
        ${rankChange > 0 ? `↑ ${rankChange}` : rankChange < 0 ? `↓ ${Math.abs(rankChange)}` : '—'}
      </span>
      <span class="hero-platforms">
        On ${platformCount} platforms
      </span>
    </div>
  </div>
</section>
```

**CSS:**
```css
.hero-section {
  position: relative;
  height: 400px;
  margin: 0 0 2rem 0;
  border-radius: 12px;
  overflow: hidden;
}

.hero-background {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  filter: blur(20px);
  transform: scale(1.1);
}

.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.3) 0%,
    rgba(0, 0, 0, 0.8) 100%
  );
}

.hero-content {
  position: relative;
  z-index: 1;
  padding: 3rem;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.hero-badge {
  background: rgba(245, 158, 11, 0.2);
  border: 1px solid #f59e0b;
  color: #fcd34d;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.875rem;
  font-weight: 600;
  align-self: flex-start;
  margin-bottom: 1rem;
}

.hero-title {
  font-size: 3rem;
  font-weight: 900;
  color: #fff;
  margin: 0 0 0.5rem 0;
  text-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
}

.hero-artist {
  font-size: 1.5rem;
  color: rgba(255, 255, 255, 0.9);
  margin: 0 0 2rem 0;
}

.hero-actions {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.hero-play-btn {
  background: #f59e0b;
  color: #000;
  border: none;
  padding: 1rem 2rem;
  border-radius: 50px;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  transition: all 0.2s;
}

.hero-play-btn:hover {
  background: #fcd34d;
  transform: scale(1.05);
}

.hero-favorite-btn,
.hero-share-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.hero-favorite-btn:hover,
.hero-share-btn:hover {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.4);
}

.hero-metadata {
  display: flex;
  gap: 1.5rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.7);
}

.hero-rank-change {
  padding: 0.25rem 0.75rem;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 12px;
}

@media (max-width: 768px) {
  .hero-section {
    height: 300px;
  }

  .hero-title {
    font-size: 2rem;
  }

  .hero-artist {
    font-size: 1.25rem;
  }
}
```

---

### 3. Artist Carousel Component

**HTML:**
```html
<div class="artist-carousel">
  <div class="artist-card" onclick="searchArtistSongs('{artistName}')">
    <div class="artist-avatar">
      <img src="{avatarUrl}" alt="{artistName}">
      <div class="artist-play-overlay">
        <svg class="play-icon"><!-- play icon --></svg>
      </div>
    </div>
    <p class="artist-name">{artistName}</p>
    <p class="artist-meta">{songCount} songs in charts</p>
  </div>
</div>
```

**CSS:**
```css
.artist-carousel {
  display: flex;
  gap: 1.5rem;
  overflow-x: auto;
  scroll-behavior: smooth;
  padding-bottom: 1rem;
}

.artist-card {
  flex: 0 0 120px;
  cursor: pointer;
  text-align: center;
  transition: transform 0.2s;
}

.artist-card:hover {
  transform: translateY(-4px);
}

.artist-avatar {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 50%;
  overflow: hidden;
  margin-bottom: 0.75rem;
  border: 2px solid rgba(255, 255, 255, 0.1);
}

.artist-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.artist-play-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.artist-card:hover .artist-play-overlay {
  opacity: 1;
}

.artist-name {
  font-weight: 600;
  color: #fff;
  margin: 0 0 0.25rem 0;
  font-size: 0.875rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.artist-meta {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  margin: 0;
}
```

---

## Row-by-Row Implementation

### Row 1: Hero Section (Authenticated Users)

**Requirements:**
- Display #1 song from India Top 25 chart
- Large background image with blur effect
- Prominent play button
- Show rank change indicator
- Show platform count

**Data Source:**
```javascript
async function getHeroSong() {
  const response = await fetch(`${MUSIC_CONDUCTOR_API}/api/charts/aggregated?region=india&limit=1`);
  const data = await response.json();
  return data.songs[0];
}
```

**Render Function:**
```javascript
async function renderHeroSection() {
  const song = await getHeroSong();

  const html = `
    <section class="hero-section">
      <div class="hero-background" style="background-image: url(${song.thumbnail_url})">
        <div class="hero-overlay"></div>
      </div>

      <div class="hero-content">
        <div class="hero-badge">#1 on India Top 25</div>
        <h1 class="hero-title">${song.title}</h1>
        <p class="hero-artist">${song.artist}</p>

        <div class="hero-actions">
          <button class="hero-play-btn" onclick='playSong(${JSON.stringify(song)})'>
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.3 2.84A1 1 0 0 0 5 3.67v12.66a1 1 0 0 0 1.3.83l10-5.33a1 1 0 0 0 0-1.66l-10-5.33z"/>
            </svg>
            Play Now
          </button>
          <button class="hero-favorite-btn" onclick="toggleFavorite('${song.youtube_id}')">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M10 17.55l-1.45-1.32C4.4 12.36 2 10.28 2 7.5 2 5.42 3.42 4 5.5 4c1.04 0 2.04.52 2.78 1.32L10 6.5l1.72-1.18C12.46 4.52 13.46 4 14.5 4 16.58 4 18 5.42 18 7.5c0 2.78-2.4 4.86-6.55 8.73L10 17.55z"/>
            </svg>
          </button>
        </div>

        <div class="hero-metadata">
          <span class="hero-rank-change">
            ${song.rank_change > 0 ? `↑ ${song.rank_change}` : song.rank_change < 0 ? `↓ ${Math.abs(song.rank_change)}` : 'No change'}
          </span>
          <span class="hero-platforms">
            On ${song.platform_count} platforms
          </span>
        </div>
      </div>
    </section>
  `;

  return html;
}
```

**Acceptance Criteria:**
- [ ] Hero section renders correctly with #1 song data
- [ ] Background image shows with blur effect
- [ ] Play button works and starts playback
- [ ] Favorite button toggles correctly (if authenticated)
- [ ] Rank change indicator shows correct direction (↑/↓)
- [ ] Responsive on mobile (height adjusts, text sizes reduce)
- [ ] Hero section only shows for authenticated users

**Testing:**
```javascript
// Test: Hero section renders
const heroSection = document.querySelector('.hero-section');
assert(heroSection !== null, 'Hero section should exist');

// Test: Play button triggers playback
const playBtn = document.querySelector('.hero-play-btn');
playBtn.click();
// Verify player state changed to playing

// Test: Non-authenticated users don't see hero
logout();
const heroAfterLogout = document.querySelector('.hero-section');
assert(heroAfterLogout === null, 'Hero should not show when logged out');
```

---

### Row 2: Recently Played (Authenticated Only)

**Requirements:**
- Show last 15 played songs
- Horizontal scroll
- Only visible when authenticated
- Fallback to "Trending Now" when logged out

**Data Source:**
```javascript
async function getRecentlyPlayed() {
  const response = await fetchWithAuth(`${TLDR_MUSIC_API}/api/me/history?limit=15`);
  const data = await response.json();
  return data.items;
}
```

**Render Function:**
```javascript
async function renderRecentlyPlayedRow() {
  if (!isAuthenticated()) {
    return renderTrendingRow(); // Fallback
  }

  const songs = await getRecentlyPlayed();

  if (songs.length === 0) {
    return ''; // Don't show empty row
  }

  const config = ROW_CONFIGS.recentlyPlayed;
  const html = `
    <section class="content-row" data-row-id="recently-played">
      <div class="row-header">
        <div class="row-title-group">
          <h2 class="row-title">Listen Again</h2>
          <p class="row-subtitle">Pick up where you left off</p>
        </div>
      </div>

      <div class="row-content horizontal-scroll">
        ${songs.map(song => createSongCard(song)).join('')}
      </div>
    </section>
  `;

  return html;
}
```

**Acceptance Criteria:**
- [ ] Shows last 15 played songs
- [ ] Songs ordered by most recent first
- [ ] Only visible when user is logged in
- [ ] Falls back to Trending Now when logged out
- [ ] Horizontal scroll works smoothly
- [ ] Each song card is clickable and plays

---

### Row 3: Your Favorites (Authenticated Only)

**Requirements:**
- Show all favorited songs
- Horizontal scroll (unlimited)
- Show count in subtitle
- Link to full favorites page

**Data Source:**
```javascript
async function getFavorites() {
  const response = await fetchWithAuth(`${TLDR_MUSIC_API}/api/me/favorites`);
  const data = await response.json();
  return data.items;
}
```

**Render Function:**
```javascript
async function renderFavoritesRow() {
  if (!isAuthenticated()) {
    return ''; // Don't show if not logged in
  }

  const songs = await getFavorites();

  if (songs.length === 0) {
    return ''; // Don't show empty row
  }

  const html = `
    <section class="content-row" data-row-id="favorites">
      <div class="row-header">
        <div class="row-title-group">
          <h2 class="row-title">
            <span class="row-badge">❤️</span>
            Your Favorites
          </h2>
          <p class="row-subtitle">${songs.length} liked songs</p>
        </div>
        <button class="row-cta" onclick="navigateTo('#/library/favorites')">
          See All
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 12L10 8L6 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="row-content horizontal-scroll">
        ${songs.map(song => createSongCard(song)).join('')}
      </div>
    </section>
  `;

  return html;
}
```

**Acceptance Criteria:**
- [ ] Shows all favorited songs
- [ ] Count is accurate in subtitle
- [ ] "See All" button navigates to /library/favorites
- [ ] Only shows when authenticated
- [ ] Horizontal scroll supports many items

---

### Row 4: India Top 25

**Requirements:**
- Show all 25 songs from India chart
- Horizontal scroll
- Show rank numbers on cards
- Show rank change indicators (↑/↓/NEW)
- Toggle to switch to Global Top 25

**Data Source:**
```javascript
async function getIndiaChart() {
  const response = await fetch(`${MUSIC_CONDUCTOR_API}/api/charts/aggregated?region=india&limit=25`);
  const data = await response.json();
  return data.songs;
}
```

**Render Function:**
```javascript
async function renderIndiaChartRow() {
  const songs = await getIndiaChart();

  const html = `
    <section class="content-row" data-row-id="india-chart">
      <div class="row-header">
        <div class="row-title-group">
          <h2 class="row-title">India Top 25</h2>
          <p class="row-subtitle">Updated weekly • Last updated: ${formatDate(new Date())}</p>
        </div>
        <button class="row-cta" onclick="navigateTo('#/charts/india')">
          View Full Chart
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 12L10 8L6 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="row-content horizontal-scroll">
        ${songs.map((song, index) => createRankedSongCard(song, index + 1)).join('')}
      </div>
    </section>
  `;

  return html;
}

function createRankedSongCard(song, rank) {
  const rankChange = song.rank_change;
  const rankIndicator = song.is_new ? 'NEW' :
                        rankChange > 0 ? `↑ ${rankChange}` :
                        rankChange < 0 ? `↓ ${Math.abs(rankChange)}` : '—';

  return `
    <div class="song-card ranked" onclick='playSong(${JSON.stringify(song)})'>
      <div class="song-rank">${rank}</div>
      <div class="song-thumbnail">
        <img src="${song.thumbnail_url}" alt="${song.title}">
        <div class="song-play-overlay">
          <svg class="play-icon" width="40" height="40" viewBox="0 0 40 40" fill="white">
            <circle cx="20" cy="20" r="20" fill="rgba(0,0,0,0.6)"/>
            <path d="M15 12l12 8-12 8V12z" fill="white"/>
          </svg>
        </div>
      </div>
      <div class="song-info">
        <p class="song-title">${song.title}</p>
        <p class="song-artist">${song.artist}</p>
        <p class="song-rank-change ${song.is_new ? 'new' : rankChange > 0 ? 'up' : rankChange < 0 ? 'down' : ''}">
          ${rankIndicator}
        </p>
      </div>
    </div>
  `;
}
```

**CSS for Ranked Cards:**
```css
.song-card.ranked {
  position: relative;
}

.song-rank {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  font-weight: 700;
  font-size: 1.25rem;
  width: 32px;
  height: 32px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1;
}

.song-rank-change {
  font-size: 0.75rem;
  font-weight: 600;
  margin-top: 0.25rem;
}

.song-rank-change.new {
  color: #10b981; /* Green */
}

.song-rank-change.up {
  color: #10b981; /* Green */
}

.song-rank-change.down {
  color: #ef4444; /* Red */
}
```

**Acceptance Criteria:**
- [ ] Shows all 25 songs from India chart
- [ ] Rank numbers display correctly (1-25)
- [ ] Rank change indicators show (↑/↓/NEW)
- [ ] Colors match direction (green up, red down)
- [ ] "View Full Chart" button works
- [ ] Horizontal scroll is smooth

---

### Row 5: Trending Now

**Requirements:**
- Show songs with rank_change >= 10 OR is_new === true
- Maximum 20 songs
- Badge: 🔥
- Horizontal scroll

**Data Source:**
```javascript
async function getTrendingSongs() {
  const response = await fetch(`${MUSIC_CONDUCTOR_API}/api/charts/aggregated?region=india&limit=25`);
  const data = await response.json();

  // Filter for trending: big movers or new entries
  const trending = data.songs.filter(song =>
    song.rank_change >= 10 || song.is_new
  ).slice(0, 20);

  return trending;
}
```

**Render Function:**
```javascript
async function renderTrendingRow() {
  const songs = await getTrendingSongs();

  if (songs.length === 0) {
    return ''; // No trending songs this week
  }

  const html = `
    <section class="content-row" data-row-id="trending">
      <div class="row-header">
        <div class="row-title-group">
          <h2 class="row-title">
            <span class="row-badge">🔥</span>
            Trending Now
          </h2>
          <p class="row-subtitle">Biggest movers this week</p>
        </div>
      </div>

      <div class="row-content horizontal-scroll">
        ${songs.map(song => createSongCard(song)).join('')}
      </div>
    </section>
  `;

  return html;
}
```

**Acceptance Criteria:**
- [ ] Shows songs with rank_change >= 10 or is_new
- [ ] Maximum 20 songs displayed
- [ ] Fire emoji badge displays
- [ ] Songs are sorted by rank_change DESC

---

### Row 6: Regional Charts Section

**Requirements:**
- Tab-based or carousel layout
- Show top 10 from each language
- 11 languages: Hindi, Punjabi, Tamil, Telugu, Bengali, Marathi, Gujarati, Kannada, Malayalam, Odia, Assamese
- Default to Hindi

**Data Source:**
```javascript
async function getRegionalChart(language) {
  const response = await fetch(`${MUSIC_CONDUCTOR_API}/api/regional/${language}?limit=10`);
  const data = await response.json();
  return data.songs;
}
```

**Render Function (Tabs Version):**
```javascript
async function renderRegionalChartsSection() {
  const languages = ['hindi', 'punjabi', 'tamil', 'telugu', 'bengali', 'marathi',
                     'gujarati', 'kannada', 'malayalam', 'odia', 'assamese'];

  // Load first language (Hindi) initially
  const initialSongs = await getRegionalChart('hindi');

  const html = `
    <section class="content-row regional-charts-section" data-row-id="regional-charts">
      <div class="row-header">
        <div class="row-title-group">
          <h2 class="row-title">Regional Charts</h2>
          <p class="row-subtitle">Top songs by language</p>
        </div>
      </div>

      <div class="regional-tabs">
        ${languages.map((lang, i) => `
          <button class="regional-tab ${i === 0 ? 'active' : ''}"
                  data-language="${lang}"
                  onclick="switchRegionalChart('${lang}')">
            ${capitalizeFirst(lang)}
          </button>
        `).join('')}
      </div>

      <div class="regional-content horizontal-scroll" id="regionalChartContent">
        ${initialSongs.map(song => createSongCard(song)).join('')}
      </div>
    </section>
  `;

  return html;
}

async function switchRegionalChart(language) {
  // Update active tab
  document.querySelectorAll('.regional-tab').forEach(tab => {
    tab.classList.toggle('active', tab.dataset.language === language);
  });

  // Load and render songs
  const songs = await getRegionalChart(language);
  const container = document.getElementById('regionalChartContent');
  container.innerHTML = songs.map(song => createSongCard(song)).join('');
}
```

**CSS for Tabs:**
```css
.regional-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  overflow-x: auto;
  padding-bottom: 0.5rem;
}

.regional-tab {
  background: transparent;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: rgba(255, 255, 255, 0.7);
  padding: 0.5rem 1rem;
  border-radius: 20px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.regional-tab:hover {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.3);
}

.regional-tab.active {
  background: #f59e0b;
  border-color: #f59e0b;
  color: #000;
  font-weight: 600;
}
```

**Acceptance Criteria:**
- [ ] Shows 11 language tabs
- [ ] Default to Hindi on load
- [ ] Clicking tab loads that language's chart
- [ ] Shows top 10 songs per language
- [ ] Tabs scroll horizontally on mobile
- [ ] Active tab is highlighted

---

### Row 7: Discover Playlists

**Requirements:**
- Show first 8-12 curated playlists
- Grid layout (4 columns on desktop, 2 on mobile)
- "Browse All Playlists" CTA
- Click playlist to navigate to /discover

**Data Source:**
```javascript
async function getDiscoverPlaylists() {
  const response = await fetch(`${MUSIC_CONDUCTOR_API}/api/playlists`);
  const data = await response.json();

  // Get first 12 playlists
  return data.playlists.slice(0, 12);
}
```

**Render Function:**
```javascript
async function renderDiscoverPlaylistsRow() {
  const playlists = await getDiscoverPlaylists();

  const html = `
    <section class="content-row" data-row-id="discover-playlists">
      <div class="row-header">
        <div class="row-title-group">
          <h2 class="row-title">Curated Playlists</h2>
          <p class="row-subtitle">Handpicked for every mood</p>
        </div>
        <button class="row-cta" onclick="navigateTo('#/discover')">
          Browse All Playlists
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 12L10 8L6 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="row-content playlist-grid">
        ${playlists.map(playlist => createPlaylistCard(playlist)).join('')}
      </div>
    </section>
  `;

  return html;
}

function createPlaylistCard(playlist) {
  return `
    <div class="playlist-card" onclick="navigateTo('#/discover?playlist=${playlist.id}')">
      <div class="playlist-thumbnail">
        <img src="${playlist.thumbnail_url || 'default-playlist.png'}" alt="${playlist.name}">
        <div class="playlist-play-overlay">
          <svg class="play-icon" width="40" height="40" viewBox="0 0 40 40" fill="white">
            <circle cx="20" cy="20" r="20" fill="rgba(0,0,0,0.6)"/>
            <path d="M15 12l12 8-12 8V12z" fill="white"/>
          </svg>
        </div>
      </div>
      <div class="playlist-info">
        <p class="playlist-name">${playlist.name}</p>
        <p class="playlist-description">${playlist.description}</p>
        <p class="playlist-meta">${playlist.song_count} songs</p>
      </div>
    </div>
  `;
}
```

**CSS for Playlist Grid:**
```css
.playlist-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.5rem;
}

@media (max-width: 1024px) {
  .playlist-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .playlist-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.playlist-card {
  cursor: pointer;
  transition: transform 0.2s;
}

.playlist-card:hover {
  transform: translateY(-4px);
}

.playlist-thumbnail {
  position: relative;
  aspect-ratio: 1;
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 0.75rem;
}

.playlist-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.playlist-name {
  font-weight: 600;
  color: #fff;
  margin: 0 0 0.25rem 0;
  font-size: 0.875rem;
}

.playlist-description {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.6);
  margin: 0 0 0.5rem 0;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.playlist-meta {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  margin: 0;
}
```

**Acceptance Criteria:**
- [ ] Shows 12 playlists in 4-column grid
- [ ] Responsive (3 cols on tablet, 2 on mobile)
- [ ] Clicking card navigates to playlist
- [ ] "Browse All" button goes to /discover
- [ ] Hover effects work on desktop

---

### Row 8: New This Week

**Requirements:**
- Show songs with is_new === true
- Maximum 20 songs
- Badge: ✨
- Horizontal scroll

**Data Source:**
```javascript
async function getNewSongs() {
  const response = await fetch(`${MUSIC_CONDUCTOR_API}/api/charts/aggregated?region=india&limit=25`);
  const data = await response.json();

  // Filter for new entries
  const newSongs = data.songs.filter(song => song.is_new).slice(0, 20);

  return newSongs;
}
```

**Render Function:**
```javascript
async function renderNewThisWeekRow() {
  const songs = await getNewSongs();

  if (songs.length === 0) {
    return ''; // No new songs this week
  }

  const html = `
    <section class="content-row" data-row-id="new-this-week">
      <div class="row-header">
        <div class="row-title-group">
          <h2 class="row-title">
            <span class="row-badge">✨</span>
            New This Week
          </h2>
          <p class="row-subtitle">Fresh entries to the charts</p>
        </div>
      </div>

      <div class="row-content horizontal-scroll">
        ${songs.map(song => createSongCard(song)).join('')}
      </div>
    </section>
  `;

  return html;
}
```

**Acceptance Criteria:**
- [ ] Shows only songs with is_new flag
- [ ] Maximum 20 songs
- [ ] Sparkle emoji badge displays
- [ ] Empty row hidden if no new songs

---

### Row 9: Top Artists

**Requirements:**
- Show top 20 artists by song count in charts
- Circular avatar carousel
- Click artist to search their songs
- Show song count under name

**Data Source:**
```javascript
async function getTopArtists() {
  const response = await fetch(`${MUSIC_CONDUCTOR_API}/api/charts/top-artists?region=india&limit=20`);
  const data = await response.json();
  return data.artists;
}
```

**Render Function:**
```javascript
async function renderTopArtistsRow() {
  const artists = await getTopArtists();

  const html = `
    <section class="content-row" data-row-id="top-artists">
      <div class="row-header">
        <div class="row-title-group">
          <h2 class="row-title">Popular Artists</h2>
          <p class="row-subtitle">Top artists in India charts</p>
        </div>
      </div>

      <div class="row-content artist-carousel">
        ${artists.map(artist => createArtistCard(artist)).join('')}
      </div>
    </section>
  `;

  return html;
}

function createArtistCard(artist) {
  return `
    <div class="artist-card" onclick="searchArtistSongs('${artist.name}')">
      <div class="artist-avatar">
        <img src="${artist.avatar_url}" alt="${artist.name}">
        <div class="artist-play-overlay">
          <svg class="play-icon" width="40" height="40" viewBox="0 0 40 40" fill="white">
            <circle cx="20" cy="20" r="20" fill="rgba(0,0,0,0.6)"/>
            <path d="M15 12l12 8-12 8V12z" fill="white"/>
          </svg>
        </div>
      </div>
      <p class="artist-name">${artist.name}</p>
      <p class="artist-meta">${artist.song_count} ${artist.song_count === 1 ? 'song' : 'songs'}</p>
    </div>
  `;
}

async function searchArtistSongs(artistName) {
  navigateTo(`#/search?q=${encodeURIComponent(artistName)}`);
}
```

**Acceptance Criteria:**
- [ ] Shows top 20 artists
- [ ] Circular avatars render correctly
- [ ] Click artist navigates to search with artist name
- [ ] Song count displays accurately
- [ ] Horizontal scroll works smoothly

---

### Row 10: Global Top 25

**Requirements:**
- Show all 25 songs from Global chart
- Horizontal scroll
- Show rank numbers
- Show rank change indicators
- Similar to India Top 25 row

**Data Source:**
```javascript
async function getGlobalChart() {
  const response = await fetch(`${MUSIC_CONDUCTOR_API}/api/charts/aggregated?region=global&limit=25`);
  const data = await response.json();
  return data.songs;
}
```

**Render Function:**
```javascript
async function renderGlobalChartRow() {
  const songs = await getGlobalChart();

  const html = `
    <section class="content-row" data-row-id="global-chart">
      <div class="row-header">
        <div class="row-title-group">
          <h2 class="row-title">Global Top 25</h2>
          <p class="row-subtitle">Worldwide hits • Updated weekly</p>
        </div>
        <button class="row-cta" onclick="navigateTo('#/charts/global')">
          View Full Chart
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 12L10 8L6 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="row-content horizontal-scroll">
        ${songs.map((song, index) => createRankedSongCard(song, index + 1)).join('')}
      </div>
    </section>
  `;

  return html;
}
```

**Acceptance Criteria:**
- [ ] Shows all 25 songs from Global chart
- [ ] Identical functionality to India chart row
- [ ] "View Full Chart" navigates to /charts/global

---

## State Management

### Homepage State Object

```javascript
const homepageState = {
  loading: false,
  error: null,
  isAuthenticated: false,
  rows: {
    hero: { loaded: false, data: null, error: null },
    recentlyPlayed: { loaded: false, data: null, error: null },
    favorites: { loaded: false, data: null, error: null },
    indiaChart: { loaded: false, data: null, error: null },
    trending: { loaded: false, data: null, error: null },
    regional: { loaded: false, data: null, activeLanguage: 'hindi', error: null },
    discoverPlaylists: { loaded: false, data: null, error: null },
    newThisWeek: { loaded: false, data: null, error: null },
    topArtists: { loaded: false, data: null, error: null },
    globalChart: { loaded: false, data: null, error: null }
  }
};
```

### Main Rendering Orchestrator

```javascript
async function renderHomepage() {
  const homeView = document.getElementById('homeView');

  if (!homeView) {
    console.error('Home view element not found');
    return;
  }

  // Show loading state
  homeView.innerHTML = '<div class="loading-spinner">Loading...</div>';

  try {
    // Check authentication
    homepageState.isAuthenticated = isAuthenticated();

    // Render rows in parallel (non-blocking)
    const rowPromises = [
      homepageState.isAuthenticated ? renderHeroSection() : Promise.resolve(''),
      homepageState.isAuthenticated ? renderRecentlyPlayedRow() : Promise.resolve(''),
      homepageState.isAuthenticated ? renderFavoritesRow() : Promise.resolve(''),
      renderIndiaChartRow(),
      renderTrendingRow(),
      renderRegionalChartsSection(),
      renderDiscoverPlaylistsRow(),
      renderNewThisWeekRow(),
      renderTopArtistsRow(),
      renderGlobalChartRow()
    ];

    const rows = await Promise.all(rowPromises);

    // Combine all rows
    const html = rows.filter(row => row !== '').join('');

    // Render to DOM
    homeView.innerHTML = html;

    // Update state
    homepageState.loading = false;

  } catch (error) {
    console.error('Error rendering homepage:', error);
    homepageState.error = error;
    homeView.innerHTML = '<div class="error-message">Failed to load homepage. Please try again.</div>';
  }
}

// Call on app load and when returning to home
function showMainView() {
  // ... existing code ...

  renderHomepage();
}
```

---

## Performance Optimization

### 1. Lazy Loading

**Strategy:** Load rows below the fold only when scrolled into view

```javascript
// Implement Intersection Observer for lazy loading
const rowObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const row = entry.target;
      const rowId = row.dataset.rowId;

      if (!homepageState.rows[rowId].loaded) {
        loadRow(rowId);
      }

      rowObserver.unobserve(row);
    }
  });
}, {
  rootMargin: '200px' // Load 200px before entering viewport
});

// Observe all rows below fold (rows 4+)
document.querySelectorAll('.content-row:nth-child(n+4)').forEach(row => {
  rowObserver.observe(row);
});
```

### 2. Caching

**Strategy:** Cache chart data for 24 hours

```javascript
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

async function getCachedChartData(region) {
  const cacheKey = `chart_${region}`;
  const cached = localStorage.getItem(cacheKey);

  if (cached) {
    const { data, timestamp } = JSON.parse(cached);

    if (Date.now() - timestamp < CACHE_DURATION) {
      console.log(`Using cached ${region} chart data`);
      return data;
    }
  }

  // Fetch fresh data
  const response = await fetch(`${MUSIC_CONDUCTOR_API}/api/charts/aggregated?region=${region}&limit=25`);
  const data = await response.json();

  // Cache it
  localStorage.setItem(cacheKey, JSON.stringify({
    data,
    timestamp: Date.now()
  }));

  return data;
}
```

### 3. Image Optimization

**Strategy:** Use srcset for responsive images and lazy loading

```javascript
function createSongCard(song) {
  return `
    <div class="song-card" onclick='playSong(${JSON.stringify(song)})'>
      <div class="song-thumbnail">
        <img
          src="${song.thumbnail_url}"
          alt="${song.title}"
          loading="lazy"
          decoding="async"
        >
        ...
      </div>
    </div>
  `;
}
```

### 4. Debouncing Scroll Events

```javascript
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Use for horizontal scroll navigation
const debouncedScrollHandler = debounce((event) => {
  // Handle scroll
}, 100);

scrollContainer.addEventListener('scroll', debouncedScrollHandler);
```

---

## Testing Requirements

### Unit Tests

```javascript
// Test: Homepage renders all rows
describe('Homepage Rendering', () => {
  it('should render all 10 rows for authenticated users', async () => {
    mockAuthenticated(true);
    await renderHomepage();

    const rows = document.querySelectorAll('.content-row');
    expect(rows.length).toBe(10);
  });

  it('should render 8 rows for non-authenticated users', async () => {
    mockAuthenticated(false);
    await renderHomepage();

    const rows = document.querySelectorAll('.content-row');
    expect(rows.length).toBe(8);
  });
});

// Test: Row data fetching
describe('Data Fetching', () => {
  it('should fetch India chart data', async () => {
    const songs = await getIndiaChart();
    expect(songs).toBeDefined();
    expect(songs.length).toBe(25);
  });

  it('should filter trending songs correctly', async () => {
    const trending = await getTrendingSongs();
    trending.forEach(song => {
      expect(song.rank_change >= 10 || song.is_new).toBe(true);
    });
  });
});

// Test: Row visibility based on auth
describe('Authentication-based Rows', () => {
  it('should show hero section when authenticated', async () => {
    mockAuthenticated(true);
    await renderHomepage();

    const hero = document.querySelector('.hero-section');
    expect(hero).toBeTruthy();
  });

  it('should hide hero section when not authenticated', async () => {
    mockAuthenticated(false);
    await renderHomepage();

    const hero = document.querySelector('.hero-section');
    expect(hero).toBeFalsy();
  });
});
```

### Integration Tests

```javascript
// Test: Full homepage flow
describe('Homepage Integration', () => {
  it('should load homepage and allow song playback', async () => {
    await renderHomepage();

    // Click first song card
    const firstSong = document.querySelector('.song-card');
    firstSong.click();

    // Verify player started
    expect(currentlyPlayingSong).toBeDefined();
    expect(playerState.playing).toBe(true);
  });

  it('should navigate between regional charts', async () => {
    await renderHomepage();

    // Click Tamil tab
    const tamilTab = document.querySelector('[data-language="tamil"]');
    tamilTab.click();

    await waitFor(500);

    // Verify Tamil songs loaded
    const activeTab = document.querySelector('.regional-tab.active');
    expect(activeTab.dataset.language).toBe('tamil');
  });
});
```

### Visual Regression Tests

- Screenshot hero section and compare
- Screenshot horizontal scroll rows
- Screenshot on mobile viewport
- Screenshot with long song titles

---

## Implementation Timeline

### Week 1 (Jan 1-7)

**Day 1-2: Setup & Infrastructure**
- [ ] Create `renderHomepage()` orchestrator
- [ ] Create row configuration objects
- [ ] Implement generic `renderContentRow()` function
- [ ] Add new CSS classes for rows

**Day 3-4: Core Rows**
- [ ] Implement Hero Section
- [ ] Implement India Top 25 Row
- [ ] Implement Trending Now Row
- [ ] Test row rendering

**Day 5-7: Discovery Rows**
- [ ] Implement Regional Charts Section (with tabs)
- [ ] Implement Discover Playlists Row
- [ ] Implement New This Week Row
- [ ] Test all rows together

---

### Week 2 (Jan 8-14)

**Day 1-2: Authenticated Rows**
- [ ] Implement Recently Played Row
- [ ] Implement Favorites Row
- [ ] Test authentication-based rendering

**Day 3-4: Artist Row & Global Chart**
- [ ] Backend: Implement `/api/charts/top-artists` endpoint
- [ ] Frontend: Implement Top Artists Row
- [ ] Implement Global Top 25 Row

**Day 5-6: Performance & Polish**
- [ ] Implement lazy loading for below-fold rows
- [ ] Add caching for chart data
- [ ] Optimize images (lazy loading)
- [ ] Test on mobile devices

**Day 7: Testing & Deployment**
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Fix bugs
- [ ] Deploy to production

---

### Week 3 (Jan 15+): Phase 2 Features

- [ ] Add 35 new playlists (mood, era, seasonal)
- [ ] Implement playlist shuffle
- [ ] Add "Similar Artists" functionality
- [ ] User analytics for recommendations

---

## Success Metrics

### Technical Metrics
- [ ] Homepage loads in < 2 seconds
- [ ] All API calls complete in < 500ms
- [ ] No layout shift (CLS < 0.1)
- [ ] Mobile performance score > 90

### User Metrics
- [ ] Homepage engagement rate > 70%
- [ ] Average rows scrolled: 5+
- [ ] Click-through rate on playlists: 15%+
- [ ] Return visit rate increase: 20%+

---

## Rollout Plan

### Phase 1: Beta Testing (Jan 8-10)
- Deploy to staging environment
- Test with 10-20 beta users
- Collect feedback
- Fix critical issues

### Phase 2: Soft Launch (Jan 11-13)
- Deploy to production
- Monitor error rates
- A/B test row ordering
- Optimize based on analytics

### Phase 3: Full Launch (Jan 14+)
- Announce new homepage
- Update marketing materials
- Monitor performance
- Iterate based on user feedback

---

## Appendix: Code Snippets

### Complete `app.js` Changes

```javascript
// ==========================================
// HOMEPAGE RENDERING FUNCTIONS
// ==========================================

// Main orchestrator
async function renderHomepage() {
  const homeView = document.getElementById('homeView');

  if (!homeView) return;

  homeView.innerHTML = '<div class="loading-spinner">Loading amazing content...</div>';

  try {
    const isAuth = isAuthenticated();

    const rowPromises = [
      isAuth ? renderHeroSection() : Promise.resolve(''),
      isAuth ? renderRecentlyPlayedRow() : Promise.resolve(''),
      isAuth ? renderFavoritesRow() : Promise.resolve(''),
      renderIndiaChartRow(),
      renderTrendingRow(),
      renderRegionalChartsSection(),
      renderDiscoverPlaylistsRow(),
      renderNewThisWeekRow(),
      renderTopArtistsRow(),
      renderGlobalChartRow()
    ];

    const rows = await Promise.all(rowPromises);
    homeView.innerHTML = rows.filter(row => row !== '').join('');

  } catch (error) {
    console.error('Homepage render error:', error);
    homeView.innerHTML = `
      <div class="error-message">
        <h2>Oops! Something went wrong</h2>
        <p>We couldn't load the homepage. Please refresh to try again.</p>
        <button onclick="location.reload()">Refresh Page</button>
      </div>
    `;
  }
}

// Hero section
async function renderHeroSection() {
  const song = await getHeroSong();
  return `[... hero HTML ...]`;
}

// [... all other render functions ...]

// Update showMainView
function showMainView() {
  hideAllViews();
  document.getElementById('mainView').style.display = 'block';

  // Render new homepage
  renderHomepage();
}
```

---

## Sign-Off Checklist

Before considering Phase 1 complete:

**Code Quality:**
- [ ] All functions have JSDoc comments
- [ ] No console.log statements in production
- [ ] Error handling implemented for all API calls
- [ ] Accessibility (ARIA labels) added

**Performance:**
- [ ] Lighthouse score > 90
- [ ] All images lazy loaded
- [ ] API calls cached appropriately
- [ ] No memory leaks in scroll handlers

**Testing:**
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] Manual testing on Chrome, Safari, Firefox
- [ ] Mobile testing on iOS and Android

**Documentation:**
- [ ] CLAUDE.md updated
- [ ] README updated with new features
- [ ] Deployment guide updated
- [ ] API changes documented

**Deployment:**
- [ ] Backend changes deployed to Cloud Run
- [ ] Frontend changes deployed to GitHub Pages
- [ ] No breaking changes for existing users
- [ ] Rollback plan documented

---

**Document Status:** ✅ Ready for Implementation
**Last Updated:** December 28, 2025
**Next Review:** January 7, 2026
