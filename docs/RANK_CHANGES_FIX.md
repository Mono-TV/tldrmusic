# Rank Changes Fix - January 2, 2026

## Problem

The TLDR Music frontend was not displaying rank change indicators (up/down arrows, "NEW" badges) because the `/api/charts/aggregated` endpoint was returning `null` for `rank_change`, `is_new`, and `previous_rank` fields.

## Root Cause

1. **Missing fields in response model**: The `ChartSong` Pydantic model didn't include rank tracking fields
2. **No rank change lookup**: The endpoint wasn't querying chart history data
3. **song_id mismatch**: Songs in the charts collection don't have `song_id` populated (catalog matching not run), so the `ChartHistoryRepository` lookups by `song_id` returned nothing

## Solution

Updated the `/api/charts/aggregated` endpoint to:

1. Query the `chart_history` collection directly
2. Match songs by normalized `title|artist` key instead of `song_id`
3. Return rank change data from the most recent history entries

## Files Changed

### 1. `src/music_conductor/api/routers/charts.py`

**Added to `ChartSong` model:**
```python
# Rank change tracking
rank_change: Optional[int] = None
is_new: Optional[bool] = None
previous_rank: Optional[int] = None
```

**Added helper function:**
```python
def _normalize_song_key(title: str, artist: str) -> str:
    """Create a normalized key for song matching."""
    title = (title or "").lower().strip()
    artist = (artist or "").lower().strip()
    return f"{title}|{artist}"
```

**Updated `get_aggregated_chart` endpoint:**
- Query `chart_history` collection for latest entries by chart_id
- Build lookup dict: `{normalized_title_artist: {rank_change, days_on_chart, peak_rank}}`
- Populate rank_change fields when transforming songs to response

### 2. `src/music_conductor/services/ytmusic_conflict_resolver.py`

**Fixed import:**
```python
# Before
from typing import Dict, Any

# After
from typing import Dict, Any, Optional, List
```

### 3. `requirements.txt`

**Added missing dependency:**
```
google-auth-oauthlib>=1.2
```

## API Response Changes

### Before
```json
{
  "rank": 3,
  "title": "FA9LA",
  "artist": "Flipperachi",
  "rank_change": null,
  "is_new": null,
  "previous_rank": null
}
```

### After
```json
{
  "rank": 3,
  "title": "FA9LA",
  "artist": "Flipperachi",
  "rank_change": 1,
  "is_new": false,
  "previous_rank": 4
}
```

## Deployment

```bash
cd /Users/mono/Documents/Programs/Lumio/music-conductor
gcloud run deploy tldr-music --source . --region asia-south1
```

**Deployed revision:** `tldr-music-00050-4qj`

## How Rank Change Calculation Works

1. **Chart History**: When the orchestrator runs, it saves entries to `chart_history` collection with:
   - `song_id`, `chart_id`, `date`, `rank`
   - `rank_change` (calculated as `previous_rank - current_rank`)
   - `days_on_chart`, `peak_rank`
   - `title`, `artist` (for matching)

2. **API Lookup**: The `/api/charts/aggregated` endpoint:
   - Queries `chart_history` for entries matching the `chart_id`
   - Sorts by date descending, takes latest 100 entries
   - Builds a lookup dict keyed by `title|artist`
   - For each song in the current chart, looks up rank_change data

3. **Frontend Display**:
   - `rank_change > 0`: Green up arrow with number
   - `rank_change < 0`: Red down arrow with number
   - `rank_change == 0`: Dash (-)
   - `is_new == true`: "NEW" badge

## Notes

- Rank change data depends on the `chart_history` collection having entries
- History is populated when the music-conductor orchestrator runs with `--store`
- Songs without history entries will show `null` for rank_change fields
- The title+artist matching is case-insensitive and trimmed
