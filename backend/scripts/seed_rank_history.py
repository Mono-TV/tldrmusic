#!/usr/bin/env python3
"""
Seed Rank History from Archive Data

This script:
1. Loads historical chart data from the archive folder
2. Creates rank history snapshots for each week
3. For testing, can also create simulated historical data

Usage:
    python scripts/seed_rank_history.py [--simulate]
"""
import json
import sys
from pathlib import Path
from datetime import date, timedelta
import random

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from services.rank_history import rank_history


def load_archive_charts():
    """Load all historical charts from archive folder"""
    archive_dir = Path(__file__).parent.parent.parent / "data" / "archive"

    charts = []

    if not archive_dir.exists():
        print(f"Archive directory not found: {archive_dir}")
        return charts

    # Find all JSON files in archive
    for json_file in sorted(archive_dir.rglob("*.json")):
        try:
            with open(json_file, "r", encoding="utf-8") as f:
                data = json.load(f)

            # Extract week from filename (e.g., 2025-W50.json)
            week = json_file.stem  # "2025-W50"

            charts.append({
                "file": str(json_file),
                "week": week,
                "data": data
            })
            print(f"Loaded: {json_file.name}")
        except Exception as e:
            print(f"Error loading {json_file}: {e}")

    return charts


def week_to_date(week_str: str) -> date:
    """Convert week string (2025-W50) to a date (Monday of that week)"""
    try:
        year, week = week_str.split("-W")
        # Get the Monday of the given ISO week
        return date.fromisocalendar(int(year), int(week), 1)
    except:
        return date.today()


def seed_from_archive():
    """Seed rank history from archive files"""
    charts = load_archive_charts()

    if not charts:
        print("No archive data found")
        return False

    for chart_info in charts:
        data = chart_info["data"]
        week = chart_info["week"]
        snapshot_date = week_to_date(week)

        # Main chart (India)
        if "chart" in data and data["chart"]:
            entries = [
                {
                    "rank": i + 1,
                    "title": song.get("title", ""),
                    "artist": song.get("artist", ""),
                    "song_id": None
                }
                for i, song in enumerate(data["chart"])
            ]
            rank_history.record_snapshot("india", entries, snapshot_date)

        # Regional charts
        if "regional" in data and data["regional"]:
            for lang_key, lang_data in data["regional"].items():
                songs = lang_data.get("songs", [])
                if songs:
                    entries = [
                        {
                            "rank": song.get("rank", i + 1),
                            "title": song.get("title", ""),
                            "artist": song.get("artist", ""),
                            "song_id": None
                        }
                        for i, song in enumerate(songs)
                    ]
                    # Map to language code
                    lang_map = {
                        "hindi": "hi", "tamil": "ta", "telugu": "te",
                        "punjabi": "pa", "bhojpuri": "bh", "haryanvi": "hr",
                        "bengali": "bn", "marathi": "mr", "kannada": "kn",
                        "malayalam": "ml", "gujarati": "gu"
                    }
                    lang_code = lang_map.get(lang_key.lower(), lang_key)
                    rank_history.record_snapshot(f"regional_{lang_code}", entries, snapshot_date)

        # Global chart
        if "global" in data and data["global"]:
            # Combine all global sources
            all_songs = []
            for source, source_data in data["global"].items():
                for song in source_data.get("songs", []):
                    all_songs.append({
                        "rank": song.get("rank", 99),
                        "title": song.get("title", ""),
                        "artist": song.get("artist", ""),
                        "song_id": None
                    })

            if all_songs:
                # Dedupe and sort by rank
                seen = set()
                unique_songs = []
                for song in sorted(all_songs, key=lambda x: x["rank"]):
                    key = f"{song['title'].lower()}-{song['artist'].lower()}"
                    if key not in seen:
                        seen.add(key)
                        unique_songs.append(song)

                # Re-rank
                for i, song in enumerate(unique_songs[:25]):
                    song["rank"] = i + 1

                rank_history.record_snapshot("global", unique_songs[:25], snapshot_date)

    print(f"\nSeeded history for {len(charts)} week(s)")
    return True


def create_simulated_history(weeks_back: int = 4):
    """
    Create simulated historical data for testing rank changes.

    This simulates what the chart might have looked like in previous weeks
    by shuffling positions slightly.
    """
    # Load current chart
    v2_data_dir = Path(__file__).parent.parent / "data" / "v2"
    charts_file = v2_data_dir / "charts.json"

    if not charts_file.exists():
        print("No v2 charts data found")
        return False

    with open(charts_file, "r", encoding="utf-8") as f:
        charts = json.load(f)

    # Find India chart
    india_chart = None
    for chart in charts:
        if chart.get("region") == "india":
            india_chart = chart
            break

    if not india_chart:
        print("India chart not found")
        return False

    current_entries = india_chart.get("entries", [])
    if not current_entries:
        print("No entries in India chart")
        return False

    print(f"Creating simulated history for {weeks_back} weeks...")

    today = date.today()

    for week_offset in range(1, weeks_back + 1):
        # Date for this historical week
        historical_date = today - timedelta(weeks=week_offset)

        # Create a shuffled version of the current chart
        # Some songs drop off, some new ones appear, positions shift
        simulated_entries = []

        # Keep most songs but shuffle positions
        for entry in current_entries:
            # Randomly decide if this song was on chart last week
            if random.random() > 0.15:  # 85% chance it was there
                # Randomize position a bit
                old_rank = entry.get("rank", 25)
                shift = random.randint(-3, 3)
                simulated_rank = max(1, min(30, old_rank + shift))

                simulated_entries.append({
                    "rank": simulated_rank,
                    "title": entry.get("song_title", ""),
                    "artist": entry.get("song_artist", ""),
                    "song_id": entry.get("song_id")
                })

        # Sort by simulated rank and re-number
        simulated_entries.sort(key=lambda x: x["rank"])
        for i, entry in enumerate(simulated_entries[:25]):
            entry["rank"] = i + 1

        # Record this historical snapshot
        rank_history.record_snapshot("india", simulated_entries[:25], historical_date)

        print(f"  Week -{week_offset}: {historical_date.isoformat()} - {len(simulated_entries[:25])} songs")

    print(f"\nSimulated {weeks_back} weeks of history")
    return True


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Seed rank history data")
    parser.add_argument("--simulate", action="store_true",
                        help="Create simulated historical data for testing")
    parser.add_argument("--weeks", type=int, default=4,
                        help="Number of weeks to simulate (default: 4)")
    parser.add_argument("--clear", action="store_true",
                        help="Clear existing history before seeding")

    args = parser.parse_args()

    if args.clear:
        print("Clearing existing history...")
        rank_history.clear_history()

    # First try to load from archive
    print("Loading from archive...")
    archive_success = seed_from_archive()

    # If requested or no archive data, create simulated history
    if args.simulate or not archive_success:
        print("\nCreating simulated historical data...")
        create_simulated_history(args.weeks)

    # Show summary
    print("\n=== History Summary ===")
    for chart_type in ["india", "global", "regional_ta", "regional_te", "regional_pa", "regional_hi"]:
        dates = rank_history.get_history_dates(chart_type)
        if dates:
            print(f"{chart_type}: {len(dates)} snapshots ({dates[-1]} to {dates[0]})")


if __name__ == "__main__":
    main()
