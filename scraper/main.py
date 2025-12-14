#!/usr/bin/env python3
"""
TLDR Music - Main Entry Point

Scrapes music charts from multiple platforms, consolidates rankings,
and generates a static JSON file for the frontend.

Usage:
    python main.py              # Full run: scrape all platforms + YouTube enrichment
    python main.py --dry-run    # Scrape only, no YouTube API calls
    python main.py --skip-scrape # Use cached scrape data, only do ranking + YouTube
"""

import asyncio
import argparse
import json
import os
import sys
from datetime import datetime
from typing import Dict, List

from playwright.async_api import async_playwright

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config import (
    CHART_URLS,
    CURRENT_CHART_FILE,
    ARCHIVE_DIR,
    DATA_DIR,
    FINAL_CHART_SIZE
)
from scrapers import (
    BillboardScraper,
    YouTubeMusicScraper,
    GaanaScraper,
    JioSaavnScraper,
    SpotifyScraper,
    AppleMusicScraper,
    PrimeMusicScraper,
    ShazamScraper,
    SpotifyViralScraper,
    TamilChartsScraper,
    TeluguChartsScraper,
    PunjabiChartsScraper,
    HindiChartsScraper,
    BhojpuriChartsScraper,
    HaryanviChartsScraper,
    BengaliChartsScraper,
    MarathiChartsScraper,
    KannadaChartsScraper,
    MalayalamChartsScraper,
    GujaratiChartsScraper,
)
from scrapers.base import Song
from ranking import RankingEngine, ConsolidatedSong, print_detailed_report
from youtube_api import YouTubeAPI, get_video_ids_from_songs
from metadata_api import MetadataFetcher
from lyrics_api import LyricsFetcher


# Cache file for scraped data (relative to frontend directory)
SCRAPE_CACHE_FILE = "data/scrape_cache.json"


async def scrape_all_platforms(headless: bool = True) -> Dict[str, List[Song]]:
    """
    Scrape charts from all platforms using Playwright.

    Args:
        headless: Run browser in headless mode

    Returns:
        Dict mapping platform name to list of Song objects
    """
    print("\n" + "=" * 60)
    print("TLDR MUSIC - SCRAPING ALL PLATFORMS")
    print("=" * 60)

    all_songs: Dict[str, List[Song]] = {}

    # Initialize scrapers
    scrapers = [
        # Primary platforms
        BillboardScraper(),
        YouTubeMusicScraper(),
        GaanaScraper(),
        JioSaavnScraper(),
        SpotifyScraper(),
        AppleMusicScraper(),
        # PrimeMusicScraper(),  # Disabled - requires auth
        # Discovery & viral platforms
        ShazamScraper(),
        SpotifyViralScraper(),
        # Regional charts (Spotify)
        TamilChartsScraper(),
        TeluguChartsScraper(),
        PunjabiChartsScraper(),
        HindiChartsScraper(),
        # Regional charts (YouTube Language)
        BhojpuriChartsScraper(),
        HaryanviChartsScraper(),
        BengaliChartsScraper(),
        MarathiChartsScraper(),
        KannadaChartsScraper(),
        MalayalamChartsScraper(),
        GujaratiChartsScraper(),
    ]

    async with async_playwright() as p:
        # Launch browser
        browser = await p.chromium.launch(headless=headless)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        )

        for scraper in scrapers:
            print(f"\n{'─' * 50}")
            print(f"Scraping: {scraper.platform_name.upper()}")
            print(f"{'─' * 50}")

            try:
                page = await context.new_page()
                songs = await scraper.scrape(page)
                all_songs[scraper.platform_name] = songs
                await page.close()
            except Exception as e:
                print(f"[ERROR] Failed to scrape {scraper.platform_name}: {e}")
                all_songs[scraper.platform_name] = []

        await browser.close()

    # Summary
    print("\n" + "=" * 60)
    print("SCRAPING SUMMARY")
    print("=" * 60)
    total = 0
    for platform, songs in all_songs.items():
        print(f"  {platform}: {len(songs)} songs")
        total += len(songs)
    print(f"  TOTAL: {total} songs across {len(all_songs)} platforms")

    return all_songs


def save_scrape_cache(all_songs: Dict[str, List[Song]]) -> None:
    """Save scraped data to cache file."""
    cache_path = os.path.join(os.path.dirname(__file__), '..', SCRAPE_CACHE_FILE)
    os.makedirs(os.path.dirname(cache_path), exist_ok=True)

    cache_data = {}
    for platform, songs in all_songs.items():
        cache_data[platform] = [song.to_dict() for song in songs]

    with open(cache_path, 'w', encoding='utf-8') as f:
        json.dump(cache_data, f, indent=2, ensure_ascii=False)

    print(f"\n[Cache] Saved scrape data to {SCRAPE_CACHE_FILE}")


def load_scrape_cache() -> Dict[str, List[Song]]:
    """Load scraped data from cache file."""
    cache_path = os.path.join(os.path.dirname(__file__), '..', SCRAPE_CACHE_FILE)

    if not os.path.exists(cache_path):
        raise FileNotFoundError(f"Cache file not found: {SCRAPE_CACHE_FILE}")

    with open(cache_path, 'r', encoding='utf-8') as f:
        cache_data = json.load(f)

    all_songs = {}
    for platform, song_dicts in cache_data.items():
        all_songs[platform] = [
            Song(
                title=s['title'],
                artist=s['artist'],
                position=s['position'],
                platform=s['platform']
            )
            for s in song_dicts
        ]

    print(f"\n[Cache] Loaded scrape data from {SCRAPE_CACHE_FILE}")
    return all_songs


def load_previous_chart() -> Dict[str, int]:
    """
    Load the previous week's chart to calculate rank changes.

    Returns:
        Dict mapping normalized song key (title|artist) to previous rank
    """
    base_path = os.path.join(os.path.dirname(__file__), '..')
    archive_path = os.path.join(base_path, ARCHIVE_DIR)

    if not os.path.exists(archive_path):
        return {}

    # Find all archive files and get the most recent one
    archive_files = []
    for year_dir in os.listdir(archive_path):
        year_path = os.path.join(archive_path, year_dir)
        if os.path.isdir(year_path):
            for file in os.listdir(year_path):
                if file.endswith('.json'):
                    archive_files.append(os.path.join(year_path, file))

    if not archive_files:
        return {}

    # Sort by filename (week number) and get the most recent
    archive_files.sort(reverse=True)
    latest_archive = archive_files[0]

    try:
        with open(latest_archive, 'r', encoding='utf-8') as f:
            previous_data = json.load(f)

        # Build lookup dict: normalized key -> previous rank
        previous_ranks = {}
        for song in previous_data.get('chart', []):
            # Create normalized key for matching
            title = song.get('title', '').lower().strip()
            artist = song.get('artist', '').lower().strip()
            key = f"{title}|{artist}"
            previous_ranks[key] = song.get('rank', 0)

        print(f"[Rank Change] Loaded previous chart from {os.path.basename(latest_archive)} ({len(previous_ranks)} songs)")
        return previous_ranks

    except Exception as e:
        print(f"[Rank Change] Could not load previous chart: {e}")
        return {}


def calculate_rank_changes(top_songs: List[ConsolidatedSong], previous_ranks: Dict[str, int]) -> List[Dict]:
    """
    Calculate rank changes by comparing current rankings with previous week.

    Args:
        top_songs: Current chart songs
        previous_ranks: Dict of previous week's song key -> rank

    Returns:
        List of dicts with rank_change and is_new for each song
    """
    changes = []

    for i, song in enumerate(top_songs, 1):
        current_rank = i
        # Create normalized key for matching
        title = song.canonical_title.lower().strip()
        artist = song.canonical_artist.lower().strip()
        key = f"{title}|{artist}"

        if key in previous_ranks:
            previous_rank = previous_ranks[key]
            # Positive change means moved UP (lower rank number = higher position)
            rank_change = previous_rank - current_rank
            is_new = False
        else:
            rank_change = 0
            is_new = True

        changes.append({
            'rank_change': rank_change,
            'is_new': is_new
        })

    # Stats
    new_entries = sum(1 for c in changes if c['is_new'])
    movers_up = sum(1 for c in changes if c['rank_change'] > 0)
    movers_down = sum(1 for c in changes if c['rank_change'] < 0)
    unchanged = sum(1 for c in changes if c['rank_change'] == 0 and not c['is_new'])

    print(f"[Rank Change] New entries: {new_entries}, Up: {movers_up}, Down: {movers_down}, Unchanged: {unchanged}")

    return changes


def generate_output(
    top_songs: List[ConsolidatedSong],
    video_ids: List[str],
    regional_songs: Dict[str, List[Song]] = None,
    rank_changes: List[Dict] = None
) -> dict:
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
        song_data = {
            "rank": i,
            "title": song.canonical_title,
            "artist": song.canonical_artist,
            "score": round(song.score, 3),
            "platforms_count": song.platforms_count,
            # YouTube metadata
            "youtube_video_id": song.youtube_video_id,
            "youtube_views": song.youtube_views,
            "artwork_url": song.artwork_url
        }

        # Add rank change data if available
        if rank_changes and i <= len(rank_changes):
            change_data = rank_changes[i - 1]
            if change_data['is_new']:
                song_data['is_new'] = True
            elif change_data['rank_change'] != 0:
                song_data['rank_change'] = change_data['rank_change']
        # Include additional YouTube metadata if available
        if song.youtube_likes:
            song_data["youtube_likes"] = song.youtube_likes
        if song.youtube_duration:
            song_data["youtube_duration"] = song.youtube_duration
        if song.youtube_published:
            song_data["youtube_published"] = song.youtube_published
        # Include iTunes/Apple Music metadata if available
        if song.album_name:
            song_data["album"] = song.album_name
        if song.release_date:
            song_data["release_date"] = song.release_date
        if song.genre:
            song_data["genre"] = song.genre
        if song.duration_ms:
            song_data["duration_ms"] = song.duration_ms
        if song.preview_url:
            song_data["preview_url"] = song.preview_url
        if song.itunes_url:
            song_data["itunes_url"] = song.itunes_url
        if song.apple_music_url:
            song_data["apple_music_url"] = song.apple_music_url
        if song.explicit:
            song_data["explicit"] = song.explicit
        # Include lyrics if available (to keep JSON smaller)
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
            "bhojpuri": {"name": "Bhojpuri", "icon": "🪘"},
            "haryanvi": {"name": "Haryanvi", "icon": "🎺"},
            "bengali": {"name": "Bengali", "icon": "🎻"},
            "marathi": {"name": "Marathi", "icon": "🥁"},
            "kannada": {"name": "Kannada", "icon": "🎹"},
            "malayalam": {"name": "Malayalam", "icon": "🎷"},
            "gujarati": {"name": "Gujarati", "icon": "🪕"},
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
                            "artist": song.artist
                        }
                        for i, song in enumerate(songs[:10])  # Top 10 per region
                    ]
                }

    return output


def save_output(output: dict) -> None:
    """Save output to current.json and archive."""
    base_path = os.path.join(os.path.dirname(__file__), '..')

    # Save to current.json
    current_path = os.path.join(base_path, CURRENT_CHART_FILE)
    os.makedirs(os.path.dirname(current_path), exist_ok=True)

    with open(current_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"\n[Output] Saved to {CURRENT_CHART_FILE}")

    # Save to archive
    week = output.get('week', 'unknown')
    year = week.split('-')[0] if '-' in week else str(datetime.utcnow().year)
    archive_dir = os.path.join(base_path, ARCHIVE_DIR, year)
    os.makedirs(archive_dir, exist_ok=True)

    archive_path = os.path.join(archive_dir, f"{week}.json")
    with open(archive_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"[Output] Archived to {ARCHIVE_DIR}/{year}/{week}.json")


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='TLDR Music - Chart Aggregator')
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Scrape only, no YouTube API calls'
    )
    parser.add_argument(
        '--skip-scrape',
        action='store_true',
        help='Use cached scrape data'
    )
    parser.add_argument(
        '--no-headless',
        action='store_true',
        help='Show browser window during scraping'
    )
    args = parser.parse_args()

    print("\n" + "=" * 60)
    print("  TLDR MUSIC - India's Musicscape Aggregator")
    print("=" * 60)
    print(f"  Mode: {'DRY RUN' if args.dry_run else 'FULL RUN'}")
    print(f"  Scraping: {'SKIP (using cache)' if args.skip_scrape else 'ENABLED'}")
    print("=" * 60)

    # Step 1: Scrape or load from cache
    if args.skip_scrape:
        try:
            all_songs = load_scrape_cache()
        except FileNotFoundError as e:
            print(f"\n[ERROR] {e}")
            print("Run without --skip-scrape first to generate cache.")
            sys.exit(1)
    else:
        all_songs = await scrape_all_platforms(headless=not args.no_headless)
        save_scrape_cache(all_songs)

    # Step 2: Consolidate and rank
    engine = RankingEngine()
    top_songs = engine.consolidate(all_songs)

    # Print detailed report
    print_detailed_report(top_songs)

    # Step 3: Enrich with YouTube data (unless dry run)
    if not args.dry_run:
        youtube = YouTubeAPI()
        top_songs = youtube.enrich_songs_with_youtube_data(top_songs)

        # Re-sort with YouTube views as tiebreaker
        top_songs = sorted(
            top_songs,
            key=lambda s: (s.score, s.platforms_count, s.youtube_views),
            reverse=True
        )[:FINAL_CHART_SIZE]

    # Step 4: Fetch rich metadata (artwork, album, genre, duration, preview, etc.)
    if not args.dry_run:
        metadata = MetadataFetcher()
        top_songs = await metadata.enrich_songs_with_metadata(top_songs)

    # Step 5: Fetch lyrics
    if not args.dry_run:
        lyrics = LyricsFetcher()
        top_songs = await lyrics.enrich_songs_with_lyrics(top_songs)

    # Step 6: Calculate rank changes from previous week
    previous_ranks = load_previous_chart()
    rank_changes = calculate_rank_changes(top_songs, previous_ranks) if previous_ranks else None

    # Step 7: Generate and save output
    video_ids = get_video_ids_from_songs(top_songs)
    # Extract regional songs for spotlight sections
    regional_songs = {
        region: songs for region, songs in all_songs.items()
        if region in ['hindi', 'tamil', 'telugu', 'punjabi', 'bhojpuri', 'haryanvi',
                      'bengali', 'marathi', 'kannada', 'malayalam', 'gujarati']
    }
    output = generate_output(top_songs, video_ids, regional_songs, rank_changes)
    save_output(output)

    # Final summary
    print("\n" + "=" * 60)
    print("  COMPLETE!")
    print("=" * 60)
    print(f"  Generated Top {len(top_songs)} chart")
    print(f"  Output: {CURRENT_CHART_FILE}")
    if not args.dry_run:
        print(f"  YouTube videos matched: {len(video_ids)}/{len(top_songs)}")
    print("\n  To view the chart, open frontend/index.html in a browser")
    print("=" * 60)


if __name__ == '__main__':
    asyncio.run(main())
