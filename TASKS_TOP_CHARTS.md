# tldrmusic Tasks: Integrate Top Charts API

## Status: TODO 📋

The following tasks need to be completed to integrate YouTube Music Top Charts.

---

## Prerequisites

- [x] music-harvester API endpoints created
- [x] music-conductor generating playlists
- [ ] music-harvester deployed to production

---

## Tasks

### Task 1: Add API Constant
**File:** `app.js` (around line 20)
**Priority:** High
**Effort:** 5 min

```javascript
// Add this near other API constants
const TOP_CHARTS_API_BASE = 'https://music-harvester-401132033262.asia-south1.run.app/api/top-charts';
```

---

### Task 2: Create Fetch Function
**File:** `app.js`
**Priority:** High
**Effort:** 15 min

```javascript
/**
 * Fetch YouTube Music Top Charts
 * @param {string} region - 'india' or 'global'
 * @returns {Promise<Object>} Chart data
 */
async function loadTopCharts(region = 'india') {
    try {
        const response = await fetch(`${TOP_CHARTS_API_BASE}/${region}`);
        if (!response.ok) throw new Error('Failed to fetch top charts');
        return await response.json();
    } catch (error) {
        console.error('Top charts fetch error:', error);
        return null;
    }
}
```

---

### Task 3: Create Data Transformer
**File:** `app.js`
**Priority:** Medium
**Effort:** 15 min

Convert new API format to existing chart format for compatibility:

```javascript
/**
 * Transform Top Charts API response to existing chart format
 */
function transformTopChartData(topChart) {
    return {
        generated_at: topChart.generated_at,
        week: topChart.playlist_id.split('_').pop(), // Extract date
        total_songs: topChart.track_count,
        chart: topChart.tracks.map(track => ({
            rank: track.position,
            title: track.title,
            artist: track.artist,
            youtube_video_id: track.youtube_id,
            artwork_url: track.artwork_url,
            album: track.album,
            score: track.aggregate_score,
            platforms_count: track.sources.length,
            platform_positions: track.source_positions,
            is_new: false,
            rank_change: 0
        }))
    };
}
```

---

### Task 4: Add UI Section (Option A - New Section)
**File:** `app.js`, `index.html`, `style.css`
**Priority:** Medium
**Effort:** 30 min

Add a new "YouTube Music Charts" section to the homepage:

**HTML (index.html):**
```html
<!-- Add after existing chart section -->
<section id="youtube-charts-section" class="youtube-charts-section">
    <div class="section-header">
        <h3>🎵 YouTube Music Trending</h3>
        <span class="chart-source">Updated daily</span>
    </div>
    <div id="youtube-charts-list" class="chart-list"></div>
</section>
```

**JavaScript (app.js):**
```javascript
async function renderYouTubeCharts() {
    const topChart = await loadTopCharts('india');
    if (!topChart) return;

    const container = document.getElementById('youtube-charts-list');
    container.innerHTML = topChart.tracks.slice(0, 10).map(track => `
        <div class="song-card" onclick="playVideo('${track.youtube_id}')">
            <div class="song-card-rank">${track.position}</div>
            <img class="song-card-artwork" src="${track.artwork_url}" alt="">
            <div class="song-card-info">
                <div class="song-card-title">${track.title}</div>
                <div class="song-card-artist">${track.artist}</div>
            </div>
        </div>
    `).join('');
}
```

**CSS (style.css):**
```css
.youtube-charts-section {
    margin: 2rem 0;
    padding: 1.5rem;
}

.youtube-charts-section .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
}

.youtube-charts-section .chart-source {
    font-size: 0.8rem;
    color: var(--text-secondary);
    background: var(--surface-color);
    padding: 4px 8px;
    border-radius: 4px;
}
```

---

### Task 5: Use as Fallback (Option B - Simpler)
**File:** `app.js`
**Priority:** Low
**Effort:** 15 min

Use Top Charts as fallback when main API fails:

```javascript
// Modify existing loadChartData() function
async function loadChartData() {
    // ... existing code ...

    // Add fallback
    if (!chartData || !chartData.chart || chartData.chart.length === 0) {
        console.log('Using YouTube Music charts as fallback');
        const topChart = await loadTopCharts('india');
        if (topChart) {
            chartData = transformTopChartData(topChart);
        }
    }

    // ... rest of existing code ...
}
```

---

### Task 6: Add Global Charts Tab
**File:** `app.js`
**Priority:** Low
**Effort:** 20 min

Add toggle between India and Global YouTube charts:

```javascript
// Add tab switching
let currentTopChartRegion = 'india';

function switchTopChartRegion(region) {
    currentTopChartRegion = region;
    renderYouTubeCharts();

    // Update active tab
    document.querySelectorAll('.top-chart-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.region === region);
    });
}
```

---

## Testing Checklist

- [ ] Top Charts section renders correctly
- [ ] Clicking song plays video
- [ ] Artwork images load
- [ ] Fallback works when API fails
- [ ] Mobile responsive
- [ ] No console errors

---

## API Reference

**Base URL:** `https://music-harvester-401132033262.asia-south1.run.app/api/top-charts`

**Endpoints:**
| Endpoint | Returns |
|----------|---------|
| `/india` | India Top 25 with full metadata |
| `/global` | Global Top 25 with full metadata |
| `/india/youtube-urls` | Just YouTube URLs (for playlists) |

**Response Fields:**
- `tracks[].position` - Chart position (1-25)
- `tracks[].title` - Song title
- `tracks[].artist` - Artist name
- `tracks[].youtube_id` - YouTube video ID
- `tracks[].youtube_url` - Full YouTube Music URL
- `tracks[].artwork_url` - Album artwork URL
- `tracks[].album` - Album name

---

## Priority Order

1. **Task 1 + 2** - Add API constant and fetch function (required)
2. **Task 3** - Data transformer (if reusing existing UI)
3. **Task 4 OR 5** - Choose: New section OR Fallback
4. **Task 6** - Global charts (optional enhancement)

---

## Questions?

See `INTEGRATE_TOP_CHARTS.md` for full code examples.
