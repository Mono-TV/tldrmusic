#!/usr/bin/env python3
"""
Standalone script to seed rank history
"""
import json
from pathlib import Path
from datetime import date, timedelta
import random

# Storage file path
DATA_DIR = Path(__file__).parent / "data"
HISTORY_FILE = DATA_DIR / "rank_history.json"

def load_history():
    if HISTORY_FILE.exists():
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}

def save_history(history):
    DATA_DIR.mkdir(exist_ok=True)
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(history, f, indent=2, ensure_ascii=False)

def make_song_key(title: str, artist: str) -> str:
    return f"{title.lower().strip()}-{artist.lower().strip()}"

def record_snapshot(history, chart_type: str, entries: list, snapshot_date: date):
    date_str = snapshot_date.isoformat()

    if chart_type not in history:
        history[chart_type] = {}

    snapshot = {}
    for entry in entries:
        title = entry.get("song_title") or entry.get("title", "")
        artist = entry.get("song_artist") or entry.get("artist", "")
        key = make_song_key(title, artist)

        snapshot[key] = {
            "rank": entry.get("rank"),
            "song_id": entry.get("song_id"),
            "title": title,
            "artist": artist
        }

    history[chart_type][date_str] = snapshot
    print(f"Recorded snapshot for {chart_type} on {date_str}: {len(snapshot)} songs")

def main():
    # Load existing history
    history = load_history()

    # Load v2 charts
    v2_data_dir = Path(__file__).parent / "data" / "v2"
    charts_file = v2_data_dir / "charts.json"

    with open(charts_file, "r", encoding="utf-8") as f:
        charts = json.load(f)

    # Find India chart
    india_chart = None
    for chart in charts:
        if chart.get("region") == "india":
            india_chart = chart
            break

    if not india_chart:
        print("India chart not found!")
        return

    current_entries = india_chart.get("entries", [])
    print(f"Current chart has {len(current_entries)} entries")

    today = date.today()

    # Create historical data for past weeks
    for week_offset in range(1, 3):  # 2 weeks of history
        historical_date = today - timedelta(weeks=week_offset)

        simulated_entries = []
        for entry in current_entries:
            # 85% chance the song was on chart
            if random.random() > 0.15:
                old_rank = entry.get("rank", 25)
                # Random position shift
                shift = random.randint(-5, 5)
                simulated_rank = max(1, min(30, old_rank + shift))

                simulated_entries.append({
                    "rank": simulated_rank,
                    "title": entry.get("song_title", ""),
                    "artist": entry.get("song_artist", ""),
                    "song_id": entry.get("song_id")
                })

        # Sort and re-rank
        simulated_entries.sort(key=lambda x: x["rank"])
        for i, entry in enumerate(simulated_entries[:25]):
            entry["rank"] = i + 1

        record_snapshot(history, "india", simulated_entries[:25], historical_date)

    # Also seed from archive if available
    archive_file = Path(__file__).parent.parent / "data" / "archive" / "2025" / "2025-W50.json"
    if archive_file.exists():
        with open(archive_file, "r", encoding="utf-8") as f:
            archive_data = json.load(f)

        # Record the archive week
        archive_date = date(2025, 12, 9)  # Monday of W50
        if "chart" in archive_data:
            entries = [
                {
                    "rank": i + 1,
                    "title": song.get("title", ""),
                    "artist": song.get("artist", ""),
                }
                for i, song in enumerate(archive_data["chart"])
            ]
            record_snapshot(history, "india", entries, archive_date)

    # Save history
    save_history(history)

    # Show summary
    print(f"\n=== History Summary ===")
    for chart_type, dates_data in history.items():
        dates = sorted(dates_data.keys())
        print(f"{chart_type}: {len(dates)} snapshots")
        for d in dates:
            print(f"  - {d}: {len(dates_data[d])} songs")

if __name__ == "__main__":
    main()
