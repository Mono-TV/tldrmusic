"""
Rank History Service - Tracks song positions over time for rank change calculation
"""
import json
from pathlib import Path
from datetime import datetime, date
from typing import Dict, List, Optional, Any
from collections import defaultdict


class RankHistoryService:
    """
    Tracks historical ranks of songs to calculate position changes.

    Storage format (rank_history.json):
    {
        "india": {
            "2025-12-13": {
                "song-title-artist-key": {"rank": 1, "song_id": "...", "title": "...", "artist": "..."},
                ...
            },
            "2025-12-12": {...}
        },
        "regional_tamil": {...},
        "global": {...}
    }
    """

    _instance = None
    _history: Dict[str, Dict[str, Dict[str, Any]]] = {}
    _history_file: Path = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._init_storage()
        return cls._instance

    def _init_storage(self):
        """Initialize storage file path and load existing data"""
        data_dir = Path(__file__).parent.parent.parent / "data"
        data_dir.mkdir(exist_ok=True)
        self._history_file = data_dir / "rank_history.json"
        self._load_history()

    def _load_history(self):
        """Load history from JSON file"""
        if self._history_file.exists():
            try:
                with open(self._history_file, "r", encoding="utf-8") as f:
                    self._history = json.load(f)
                print(f"Loaded rank history: {sum(len(dates) for dates in self._history.values())} snapshots")
            except Exception as e:
                print(f"Error loading rank history: {e}")
                self._history = {}
        else:
            self._history = {}

    def _save_history(self):
        """Save history to JSON file"""
        try:
            with open(self._history_file, "w", encoding="utf-8") as f:
                json.dump(self._history, f, indent=2, ensure_ascii=False)
        except Exception as e:
            print(f"Error saving rank history: {e}")

    @staticmethod
    def _make_song_key(title: str, artist: str) -> str:
        """Create a unique key for a song based on title and artist"""
        return f"{title.lower().strip()}-{artist.lower().strip()}"

    def record_snapshot(
        self,
        chart_type: str,
        entries: List[Dict[str, Any]],
        snapshot_date: Optional[date] = None
    ):
        """
        Record a snapshot of chart positions for a specific date.

        Args:
            chart_type: 'india', 'global', 'regional_tamil', etc.
            entries: List of chart entries with rank, title, artist, song_id
            snapshot_date: Date of snapshot (defaults to today)
        """
        if snapshot_date is None:
            snapshot_date = date.today()

        date_str = snapshot_date.isoformat()

        if chart_type not in self._history:
            self._history[chart_type] = {}

        # Create snapshot
        snapshot = {}
        for entry in entries:
            title = entry.get("song_title") or entry.get("title", "")
            artist = entry.get("song_artist") or entry.get("artist", "")
            key = self._make_song_key(title, artist)

            snapshot[key] = {
                "rank": entry.get("rank"),
                "song_id": entry.get("song_id"),
                "title": title,
                "artist": artist
            }

        self._history[chart_type][date_str] = snapshot
        self._save_history()

        print(f"Recorded snapshot for {chart_type} on {date_str}: {len(snapshot)} songs")

    def get_previous_rank(
        self,
        chart_type: str,
        title: str,
        artist: str,
        current_date: Optional[date] = None,
        days_back: int = 7
    ) -> Optional[int]:
        """
        Get the previous rank of a song.

        Args:
            chart_type: 'india', 'global', 'regional_tamil', etc.
            title: Song title
            artist: Artist name
            current_date: Current date (defaults to today)
            days_back: How many days back to look (default 7 for weekly)

        Returns:
            Previous rank or None if not found
        """
        if chart_type not in self._history:
            return None

        if current_date is None:
            current_date = date.today()

        key = self._make_song_key(title, artist)
        chart_history = self._history[chart_type]

        # Get sorted dates (newest first)
        sorted_dates = sorted(chart_history.keys(), reverse=True)

        if not sorted_dates:
            return None

        # Find the second most recent snapshot (the one before the latest)
        # This gives us the "previous week" comparison
        current_date_str = current_date.isoformat()

        # If we have at least 2 snapshots, use the second newest for comparison
        # This ensures we always compare against previous snapshot
        if len(sorted_dates) >= 2:
            # Use second newest snapshot for comparison
            previous_snapshot_date = sorted_dates[1]
            snapshot = chart_history[previous_snapshot_date]
            if key in snapshot:
                return snapshot[key]["rank"]
        elif len(sorted_dates) == 1:
            # Only one snapshot - check if it's before current date
            if sorted_dates[0] < current_date_str:
                snapshot = chart_history[sorted_dates[0]]
                if key in snapshot:
                    return snapshot[key]["rank"]

        return None

    def calculate_rank_change(
        self,
        chart_type: str,
        title: str,
        artist: str,
        current_rank: int,
        current_date: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Calculate rank change for a song.

        Returns:
            {
                "direction": "up" | "down" | "same" | "new",
                "positions": int,
                "previous_rank": int | None,
                "is_new": bool
            }
        """
        previous_rank = self.get_previous_rank(
            chart_type, title, artist, current_date
        )

        if previous_rank is None:
            return {
                "direction": "new",
                "positions": 0,
                "previous_rank": None,
                "is_new": True
            }

        change = previous_rank - current_rank  # Positive = moved up

        if change > 0:
            direction = "up"
        elif change < 0:
            direction = "down"
        else:
            direction = "same"

        return {
            "direction": direction,
            "positions": abs(change),
            "previous_rank": previous_rank,
            "is_new": False
        }

    def enrich_chart_with_changes(
        self,
        chart_type: str,
        entries: List[Dict[str, Any]],
        current_date: Optional[date] = None
    ) -> List[Dict[str, Any]]:
        """
        Add rank change information to chart entries.

        Args:
            chart_type: 'india', 'global', 'regional_tamil', etc.
            entries: List of chart entries
            current_date: Current date for comparison

        Returns:
            Entries with added 'rank_change' and 'is_new' fields
        """
        enriched = []

        for entry in entries:
            title = entry.get("song_title") or entry.get("title", "")
            artist = entry.get("song_artist") or entry.get("artist", "")
            current_rank = entry.get("rank", 0)

            change_info = self.calculate_rank_change(
                chart_type, title, artist, current_rank, current_date
            )

            enriched_entry = {**entry}
            enriched_entry["movement"] = {
                "direction": change_info["direction"],
                "positions": change_info["positions"],
                "previous_rank": change_info["previous_rank"],
                "weeks_on_chart": 1,  # TODO: Calculate from history
                "peak_rank": current_rank  # TODO: Calculate from history
            }
            enriched_entry["is_new"] = change_info["is_new"]
            enriched_entry["rank_change"] = (
                change_info["positions"] if change_info["direction"] == "up"
                else -change_info["positions"] if change_info["direction"] == "down"
                else 0 if change_info["direction"] == "same"
                else None
            )

            enriched.append(enriched_entry)

        return enriched

    def get_history_dates(self, chart_type: str) -> List[str]:
        """Get list of dates with recorded history for a chart type"""
        if chart_type not in self._history:
            return []
        return sorted(self._history[chart_type].keys(), reverse=True)

    def clear_history(self, chart_type: Optional[str] = None):
        """Clear history (for testing/reset)"""
        if chart_type:
            self._history.pop(chart_type, None)
        else:
            self._history = {}
        self._save_history()


# Singleton instance
rank_history = RankHistoryService()
