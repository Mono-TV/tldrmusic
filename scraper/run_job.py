#!/usr/bin/env python3
"""
TLDR Music - Cloud Run Job Entry Point

Runs the full scraping pipeline and uploads results to the API.
Features:
- MongoDB-based YouTube cache (persistent across runs)
- Song metadata caching with fallback (shows cached data if fresh fetch fails)
"""

import asyncio
import json
import os
import sys
import requests
from datetime import datetime

# Add current directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import scrape_all_platforms, save_scrape_cache
from ranking import RankingEngine, print_detailed_report, ConsolidatedSong
from youtube_api import YouTubeAPI, get_video_ids_from_songs
from artwork_api import ArtworkFetcher
from lyrics_api import LyricsFetcher
from mongo_cache import get_mongo_cache
from config import FINAL_CHART_SIZE, PLATFORM_WEIGHTS

# Configuration from environment
API_URL = os.environ.get('API_URL', 'https://tldrmusic-api-401132033262.asia-south1.run.app')
API_KEY = os.environ.get('ADMIN_API_KEY', '')


def generate_output(top_songs, regional_songs=None):
    """Generate the output JSON structure."""
    now = datetime.utcnow()
    week_number = now.isocalendar()[1]
    year = now.year

    output = {
        "generated_at": now.isoformat() + "Z",
        "week": f"{year}-W{week_number:02d}",
        "total_songs": len(top_songs),
        "chart": []
    }

    for i, song in enumerate(top_songs, 1):
        # Build platform_ranks array with platform name, position, and weight
        platform_ranks = []
        for platform, position in song.platforms.items():
            weight = PLATFORM_WEIGHTS.get(platform, 1.0)
            platform_ranks.append({
                "platform": platform,
                "rank": position,
                "weight": weight
            })
        # Sort by position for consistent output
        platform_ranks.sort(key=lambda x: x["rank"])

        song_data = {
            "rank": i,
            "title": song.canonical_title,
            "artist": song.canonical_artist,
            "score": round(song.score, 3),
            "platforms_count": song.platforms_count,
            "platform_ranks": platform_ranks,
            "youtube_video_id": song.youtube_video_id or "",
            "youtube_views": song.youtube_views or 0,
            "artwork_url": song.artwork_url or ""
        }
        if song.lyrics_plain:
            song_data["lyrics_plain"] = song.lyrics_plain
        if song.lyrics_synced:
            song_data["lyrics_synced"] = song.lyrics_synced
        output["chart"].append(song_data)

    # Add regional charts
    if regional_songs:
        output["regional"] = {}
        regional_config = {
            "hindi": {"name": "Hindi", "icon": "🎵"},
            "tamil": {"name": "Tamil", "icon": "🎶"},
            "telugu": {"name": "Telugu", "icon": "🎤"},
            "punjabi": {"name": "Punjabi", "icon": "🎧"},
        }
        for region, songs in regional_songs.items():
            if region in regional_config and songs:
                output["regional"][region] = {
                    "name": regional_config[region]["name"],
                    "icon": regional_config[region]["icon"],
                    "songs": [
                        {
                            "rank": i + 1,
                            "title": song.title,
                            "artist": song.artist,
                            "youtube_video_id": getattr(song, 'youtube_video_id', '') or '',
                            "artwork_url": getattr(song, 'artwork_url', '') or ''
                        }
                        for i, song in enumerate(songs[:10])
                    ]
                }

    return output


def add_global_chart(output, global_top_songs):
    """Add consolidated global chart to output (same format as India chart)."""
    if global_top_songs:
        output["global_chart"] = []
        for i, song in enumerate(global_top_songs, 1):
            # Build platform_ranks array with platform name, position, and weight
            platform_ranks = []
            for platform, position in song.platforms.items():
                weight = PLATFORM_WEIGHTS.get(platform, 1.0)
                platform_ranks.append({
                    "platform": platform,
                    "rank": position,
                    "weight": weight
                })
            # Sort by position for consistent output
            platform_ranks.sort(key=lambda x: x["rank"])

            song_data = {
                "rank": i,
                "title": song.canonical_title,
                "artist": song.canonical_artist,
                "score": round(song.score, 3),
                "platforms_count": song.platforms_count,
                "platform_ranks": platform_ranks,
                "youtube_video_id": song.youtube_video_id or "",
                "youtube_views": song.youtube_views or 0,
                "artwork_url": song.artwork_url or ""
            }
            if song.lyrics_plain:
                song_data["lyrics_plain"] = song.lyrics_plain
            if song.lyrics_synced:
                song_data["lyrics_synced"] = song.lyrics_synced
            output["global_chart"].append(song_data)
    return output


def upload_to_api(chart_data):
    """Upload chart data to the API."""
    if not API_KEY:
        print("[ERROR] ADMIN_API_KEY not set, skipping upload")
        return False

    url = f"{API_URL}/admin/upload"
    headers = {
        "Content-Type": "application/json",
        "X-API-Key": API_KEY
    }

    print(f"\n[Upload] Sending to {url}")

    try:
        response = requests.post(url, json=chart_data, headers=headers, timeout=30)
        response.raise_for_status()
        result = response.json()
        print(f"[Upload] Success: {result}")
        return True
    except requests.exceptions.RequestException as e:
        print(f"[Upload] Failed: {e}")
        return False


async def apply_cached_metadata_fallback(songs, mongo_cache):
    """
    Apply cached metadata as fallback for songs missing YouTube/artwork data.
    This ensures UI consistency even when API quotas are exceeded.
    """
    print("\n[Fallback] Checking for cached metadata...")
    fallback_count = 0

    for song in songs:
        # Skip if song already has all metadata
        if song.youtube_video_id and song.artwork_url:
            continue

        # Try to get cached metadata
        cached = await mongo_cache.get_song_metadata(
            song.canonical_title,
            song.canonical_artist
        )

        if cached:
            # Apply cached values only if current values are missing
            if not song.youtube_video_id and cached.get('youtube_video_id'):
                song.youtube_video_id = cached['youtube_video_id']
                song.youtube_views = cached.get('youtube_views', 0)
                print(f"  [Fallback] Applied cached YouTube for: {song.canonical_title}")
                fallback_count += 1

            if not song.artwork_url and cached.get('artwork_url'):
                song.artwork_url = cached['artwork_url']
                print(f"  [Fallback] Applied cached artwork for: {song.canonical_title}")
                fallback_count += 1

            if not song.lyrics_plain and cached.get('lyrics_plain'):
                song.lyrics_plain = cached['lyrics_plain']

            if not song.lyrics_synced and cached.get('lyrics_synced'):
                song.lyrics_synced = cached['lyrics_synced']

    print(f"[Fallback] Applied {fallback_count} cached metadata entries")
    return songs


async def save_song_metadata_to_cache(songs, mongo_cache):
    """Save successfully enriched song metadata to cache for future fallback."""
    print("\n[Cache] Saving song metadata...")
    saved_count = 0

    for song in songs:
        # Only cache songs that have at least some enriched data
        if song.youtube_video_id or song.artwork_url:
            await mongo_cache.save_song_metadata(
                song.canonical_title,
                song.canonical_artist,
                {
                    'youtube_video_id': song.youtube_video_id,
                    'youtube_views': song.youtube_views,
                    'artwork_url': song.artwork_url,
                    'lyrics_plain': song.lyrics_plain,
                    'lyrics_synced': song.lyrics_synced,
                }
            )
            saved_count += 1

    print(f"[Cache] Saved metadata for {saved_count} songs")


async def run_job():
    """Main job entry point."""
    print("\n" + "=" * 60)
    print("  TLDR MUSIC - Cloud Run Job")
    print("=" * 60)
    print(f"  Started at: {datetime.utcnow().isoformat()}Z")
    print(f"  API URL: {API_URL}")
    print("=" * 60)

    # Initialize MongoDB cache
    mongo_cache = await get_mongo_cache()

    # Step 1: Scrape all platforms
    print("\n[Step 1/8] Scraping all platforms...")
    all_songs = await scrape_all_platforms(headless=True)

    # Step 2: Consolidate and rank
    print("\n[Step 2/8] Ranking songs...")
    engine = RankingEngine()
    top_songs = engine.consolidate(all_songs)
    print_detailed_report(top_songs)

    # Step 3: Enrich with YouTube data (using MongoDB cache)
    print("\n[Step 3/8] Fetching YouTube data (with MongoDB cache)...")
    youtube_success = False
    try:
        youtube = YouTubeAPI(mongo_cache=mongo_cache)
        top_songs = await youtube.enrich_songs_with_youtube_data(top_songs)
        youtube_success = not youtube.quota_exceeded
        top_songs = sorted(
            top_songs,
            key=lambda s: (s.score, s.platforms_count, s.youtube_views or 0),
            reverse=True
        )[:FINAL_CHART_SIZE]
    except Exception as e:
        print(f"[WARNING] YouTube enrichment failed: {e}")

    # Step 4: Fetch artwork and lyrics
    print("\n[Step 4/8] Fetching artwork and lyrics...")
    try:
        artwork = ArtworkFetcher()
        top_songs = await artwork.enrich_songs_with_artwork(top_songs)
    except Exception as e:
        print(f"[WARNING] Artwork fetch failed: {e}")

    try:
        lyrics = LyricsFetcher()
        top_songs = await lyrics.enrich_songs_with_lyrics(top_songs)
    except Exception as e:
        print(f"[WARNING] Lyrics fetch failed: {e}")

    # Step 5: Apply cached metadata fallback for any missing data
    print("\n[Step 5/8] Applying cached metadata fallback...")
    top_songs = await apply_cached_metadata_fallback(top_songs, mongo_cache)

    # Save current metadata to cache for future runs
    await save_song_metadata_to_cache(top_songs, mongo_cache)

    # Step 6: Enrich regional songs
    print("\n[Step 6/8] Enriching regional songs...")
    regional_songs = {
        region: songs for region, songs in all_songs.items()
        if region in ['hindi', 'tamil', 'telugu', 'punjabi']
    }

    # Enrich regional songs with YouTube, artwork
    for region, songs in regional_songs.items():
        if not songs:
            continue
        print(f"  Enriching {region} ({len(songs)} songs)...")

        # Create ConsolidatedSong objects for enrichment
        enriched = []
        for song in songs[:10]:  # Top 10 per region
            cs = ConsolidatedSong(
                canonical_title=song.title,
                canonical_artist=song.artist
            )
            enriched.append(cs)

        # YouTube enrichment with MongoDB cache
        try:
            youtube = YouTubeAPI(mongo_cache=mongo_cache)
            enriched = await youtube.enrich_songs_with_youtube_data(enriched)
        except Exception as e:
            print(f"    [WARNING] YouTube enrichment failed for {region}: {e}")

        # Artwork enrichment
        try:
            artwork = ArtworkFetcher()
            enriched = await artwork.enrich_songs_with_artwork(enriched)
        except Exception as e:
            print(f"    [WARNING] Artwork enrichment failed for {region}: {e}")

        # Apply fallback for regional songs too
        enriched = await apply_cached_metadata_fallback(enriched, mongo_cache)

        # Save regional metadata to cache
        await save_song_metadata_to_cache(enriched, mongo_cache)

        # Update original songs with enriched data
        for i, song in enumerate(songs[:10]):
            if i < len(enriched):
                song.youtube_video_id = enriched[i].youtube_video_id
                song.youtube_views = enriched[i].youtube_views
                song.artwork_url = enriched[i].artwork_url

    # Step 7: Consolidate and enrich global songs
    print("\n[Step 7/8] Consolidating global chart...")

    # Filter only global platforms
    global_platforms = {
        platform: songs for platform, songs in all_songs.items()
        if platform in ['spotify_global', 'billboard_hot100', 'apple_global']
    }

    # Use ranking engine to consolidate global songs (same as India chart)
    global_engine = RankingEngine()
    global_top_songs = global_engine.consolidate(global_platforms)
    print(f"  Consolidated {len(global_top_songs)} global songs")

    # Enrich global songs with YouTube data
    print("  Enriching global songs with YouTube data...")
    try:
        youtube = YouTubeAPI(mongo_cache=mongo_cache)
        global_top_songs = await youtube.enrich_songs_with_youtube_data(global_top_songs)
        global_top_songs = sorted(
            global_top_songs,
            key=lambda s: (s.score, s.platforms_count, s.youtube_views or 0),
            reverse=True
        )[:FINAL_CHART_SIZE]
    except Exception as e:
        print(f"    [WARNING] YouTube enrichment failed for global: {e}")

    # Enrich with artwork
    print("  Enriching global songs with artwork...")
    try:
        artwork = ArtworkFetcher()
        global_top_songs = await artwork.enrich_songs_with_artwork(global_top_songs)
    except Exception as e:
        print(f"    [WARNING] Artwork enrichment failed for global: {e}")

    # Apply fallback and save to cache
    global_top_songs = await apply_cached_metadata_fallback(global_top_songs, mongo_cache)
    await save_song_metadata_to_cache(global_top_songs, mongo_cache)

    # Step 8: Generate output and upload
    print("\n[Step 8/8] Uploading to API...")

    chart_data = generate_output(top_songs, regional_songs)
    chart_data = add_global_chart(chart_data, global_top_songs)

    # Save locally for debugging
    with open('/tmp/chart_output.json', 'w') as f:
        json.dump(chart_data, f, indent=2, ensure_ascii=False)
    print("[Output] Saved to /tmp/chart_output.json")

    # Upload to API
    success = upload_to_api(chart_data)

    # Disconnect from MongoDB
    await mongo_cache.disconnect()

    # Summary
    print("\n" + "=" * 60)
    print("  JOB COMPLETE")
    print("=" * 60)
    print(f"  Songs scraped: {sum(len(s) for s in all_songs.values())}")
    print(f"  Final chart: {len(top_songs)} songs")
    songs_with_youtube = sum(1 for s in top_songs if s.youtube_video_id)
    songs_with_artwork = sum(1 for s in top_songs if s.artwork_url)
    print(f"  Songs with YouTube: {songs_with_youtube}/{len(top_songs)}")
    print(f"  Songs with artwork: {songs_with_artwork}/{len(top_songs)}")
    print(f"  Upload status: {'SUCCESS' if success else 'FAILED'}")
    print(f"  Completed at: {datetime.utcnow().isoformat()}Z")
    print("=" * 60)

    return 0 if success else 1


if __name__ == '__main__':
    exit_code = asyncio.run(run_job())
    sys.exit(exit_code)
