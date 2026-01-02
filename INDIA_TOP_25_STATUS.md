# India Top 25 Chart - Integration Status

## ✅ **FULLY INTEGRATED AND LIVE**

The India Top 25 chart is **already integrated** into your website and updating automatically!

---

## Current Configuration

### Frontend Setup (app.js)

**Line 7:**
```javascript
const MUSIC_CONDUCTOR_API = 'https://tldr-music-401132033262.asia-south1.run.app';
```

**Lines 8783-8802 - Chart Configuration:**
```javascript
const MAIN_CHARTS = [
    {
        id: 'india-top-25',
        name: 'India Top 25',
        description: 'Most popular songs in India this week',
        endpoint: '/api/charts/v2/bollywood_top_25',
        icon: '🇮🇳',
        gradient: ['#FF9933', '#138808'],
        region: 'india'
    }
];
```

**Line 8947 - Data Fetching:**
```javascript
response = await fetch(`${MUSIC_CONDUCTOR_API}/api/charts/v2/bollywood_top_25`);
```

---

## How It Works

### 1. User Navigation
- User clicks "Charts" in sidebar (`#/charts`)
- `showChartsView()` function is called
- Charts overview page is displayed

### 2. Chart Selection
- User clicks "India Top 25" chart card
- `openChartFromChartsView('india-top-25')` is called
- Fetches data from production API

### 3. Data Flow
```
Frontend Request
    ↓
https://tldr-music-401132033262.asia-south1.run.app/api/charts/v2/bollywood_top_25
    ↓
Returns Chart Data (15 songs, 100% match rate)
    ↓
Rendered in Chart Detail View
    ↓
Users can play songs via YouTube IDs
```

---

## What's Working

✅ **API Endpoint** - Correctly configured to production
✅ **Chart Card** - India Top 25 shows on Charts page
✅ **Data Fetching** - Pulls fresh data from API
✅ **Caching** - 5-minute cache to reduce API calls
✅ **Rendering** - Songs display with artwork and metadata
✅ **Playback** - YouTube IDs work for playing songs
✅ **Auto-Update** - Chart updates daily at 6:00 AM IST

---

## Live Chart Data (Dec 30, 2025)

**Currently Showing:**
- **15 songs** (filtered by 2+ platform consensus)
- **100% match rate** - all songs have YouTube IDs
- **Generated:** 12:31 PM IST today
- **Top 3:**
  1. FA9LA - Flipperachi
  2. Sahiba - Aditya Rikhari
  3. Zaalima - Arijit Singh

---

## How to Access

### On Your Website

1. **Go to:** https://music.lumiolabs.in
2. **Click:** "Charts" in the sidebar
3. **See:** India Top 25 card (orange gradient with 🇮🇳 icon)
4. **Click:** The card to view full chart
5. **Play:** Any song from the chart

### Direct API Access

```bash
curl https://tldr-music-401132033262.asia-south1.run.app/api/charts/v2/bollywood_top_25
```

---

## Update Schedule

| Time (IST) | Action |
|------------|--------|
| 6:00 AM | Main sync runs (scrapes 5 platforms) |
| 6:30 AM | Retry failed sources (if any) |
| All day | Chart available via API with latest data |

**Next Update:** Tomorrow (Dec 31) at 6:00 AM IST

---

## Enhancements You Could Add

While the chart is fully functional, here are optional improvements:

### 1. Add "Updated X hours ago" Badge
```javascript
// In renderChartDetailFromChartsView(), add:
const generatedDate = new Date(chartData.generated_at);
const hoursAgo = Math.floor((Date.now() - generatedDate) / (1000 * 60 * 60));
const updateBadge = `
    <div class="chart-update-badge">
        Updated ${hoursAgo} hours ago
    </div>
`;
```

### 2. Show Platform Badges
```javascript
// For each song, show which platforms it's on:
const platformBadges = song.sources.map(source => `
    <span class="platform-badge">${source}</span>
`).join('');
```

### 3. Add Trend Indicators
```javascript
// Show if song is new, rising, or falling:
const trendIcon = {
    'new': '✨ NEW',
    'rising': '📈 RISING',
    'falling': '📉',
    'stable': ''
}[song.trend];
```

### 4. Display Chart Stats
```javascript
// At top of chart detail:
const statsHtml = `
    <div class="chart-stats">
        <div class="stat">
            <span class="stat-label">Total Songs</span>
            <span class="stat-value">${rawData.stats.total_songs}</span>
        </div>
        <div class="stat">
            <span class="stat-label">Sources</span>
            <span class="stat-value">${rawData.sources_used.length}</span>
        </div>
        <div class="stat">
            <span class="stat-label">Match Rate</span>
            <span class="stat-value">${(rawData.stats.match_rate * 100).toFixed(0)}%</span>
        </div>
    </div>
`;
```

### 5. Add "Days on Chart" Information
```javascript
// For each song:
if (song.days_on_chart > 1) {
    html += `<span class="days-badge">${song.days_on_chart} days on chart</span>`;
}
if (song.peak_rank < song.rank) {
    html += `<span class="peak-badge">Peak: #${song.peak_rank}</span>`;
}
```

---

## Testing Checklist

Test the integration on your website:

- [ ] Navigate to https://music.lumiolabs.in
- [ ] Click "Charts" in sidebar
- [ ] Verify India Top 25 card appears
- [ ] Click India Top 25 card
- [ ] Confirm chart detail view loads
- [ ] Check songs are displayed (should show ~15 songs)
- [ ] Verify artwork images load
- [ ] Click play on a song
- [ ] Confirm YouTube player starts
- [ ] Check on mobile device
- [ ] Verify chart updates tomorrow (Dec 31 at 6 AM IST)

---

## Troubleshooting

### If Chart Doesn't Load

1. **Open browser console** (F12 → Console tab)
2. **Check for errors** when clicking India Top 25
3. **Verify API request:**
   - Should see: `GET https://tldr-music-401132033262.asia-south1.run.app/api/charts/v2/bollywood_top_25`
   - Status should be: 200 OK
4. **Check response data:**
   - Should contain `songs` array
   - Each song should have `youtube_id`

### If Songs Don't Play

1. **Check YouTube IDs** - Each song should have a `youtube_id` field
2. **Verify player is initialized** - YouTube iframe player must be ready
3. **Check console for errors** - May be CORS or API issues

### If Chart Shows Old Data

1. **Clear cache** - Chart data is cached for 5 minutes
2. **Force refresh** - Hard reload the page (Ctrl+Shift+R or Cmd+Shift+R)
3. **Check API response** - Verify `generated_at` timestamp is recent

---

## Support

**Frontend Code:** `/Users/mono/Documents/Programs/Lumio/tldrmusic/app.js`
**API Endpoint:** https://tldr-music-401132033262.asia-south1.run.app/api/charts/v2/bollywood_top_25
**Health Check:** https://tldr-music-401132033262.asia-south1.run.app/health/chart-sync

The India Top 25 chart is **fully operational** and requires no additional work! 🚀
