"""
Chart Service - Business logic for charts
"""
from typing import List, Optional
import json
from pathlib import Path

from ..models import Chart, ChartSummary, ChartRegion, ChartEntry, ChartMovement, MovementDirection
from ..config import Database
from .rank_history import rank_history


class ChartService:
    """
    Handles chart operations
    """

    # Cache for file-based charts (development mode)
    _file_cache: dict = {}

    @classmethod
    async def get_current_chart(
        cls,
        region: ChartRegion = ChartRegion.INDIA,
        language: Optional[str] = None,
        with_rank_changes: bool = True
    ) -> Optional[Chart]:
        """
        Get the current (latest) chart for a region

        For development, loads from JSON files.
        In production, queries MongoDB.
        """
        # Development mode - load from files
        charts = await cls._load_charts_from_files()

        for chart in charts:
            if chart.region == region:
                if region == ChartRegion.REGIONAL:
                    if chart.language == language:
                        if with_rank_changes:
                            return cls._enrich_with_rank_changes(chart)
                        return chart
                else:
                    if with_rank_changes:
                        return cls._enrich_with_rank_changes(chart)
                    return chart

        return None

    @classmethod
    def _enrich_with_rank_changes(cls, chart: Chart) -> Chart:
        """Add rank change information from history and populate V1 fields"""
        chart_type = cls._get_chart_type_key(chart)

        enriched_entries = []
        for entry in chart.entries:
            change_info = rank_history.calculate_rank_change(
                chart_type=chart_type,
                title=entry.song_title,
                artist=entry.song_artist,
                current_rank=entry.rank
            )

            # Convert direction string to enum
            direction_str = change_info["direction"]
            direction = MovementDirection(direction_str)

            # Create new movement with historical data
            new_movement = ChartMovement(
                direction=direction,
                positions=change_info["positions"],
                previous_rank=change_info["previous_rank"],
                weeks_on_chart=entry.movement.weeks_on_chart if entry.movement else 1,
                peak_rank=entry.movement.peak_rank if entry.movement else entry.rank
            )

            # Calculate V1 flat fields from movement
            is_new = direction_str == "new"
            if direction_str == "up":
                rank_change = change_info["positions"]
            elif direction_str == "down":
                rank_change = -change_info["positions"]
            else:
                rank_change = 0 if direction_str == "same" else None

            # Create new entry with updated movement and V1 fields
            new_entry = ChartEntry(
                rank=entry.rank,
                song_id=entry.song_id,
                score=entry.score,
                platforms_count=entry.platforms_count,
                platform_ranks=entry.platform_ranks,
                movement=new_movement,
                youtube_views=entry.youtube_views,
                spotify_streams=entry.spotify_streams,
                song_title=entry.song_title,
                song_artist=entry.song_artist,
                artwork_url=entry.artwork_url,
                youtube_video_id=entry.youtube_video_id,
                # V1 flat fields
                rank_change=rank_change,
                previous_rank=change_info["previous_rank"],
                is_new=is_new,
                # Preserve existing V1 fields from entry
                youtube_likes=entry.youtube_likes,
                youtube_duration=entry.youtube_duration,
                youtube_published=entry.youtube_published,
                album=entry.album,
                genre=entry.genre,
                duration_ms=entry.duration_ms,
                release_date=entry.release_date,
                preview_url=entry.preview_url,
                itunes_url=entry.itunes_url,
                apple_music_url=entry.apple_music_url,
                lyrics_plain=entry.lyrics_plain,
                lyrics_synced=entry.lyrics_synced,
            )
            enriched_entries.append(new_entry)

        # Return new chart with enriched entries
        return Chart(
            id=chart.id,
            name=chart.name,
            description=chart.description,
            region=chart.region,
            language=chart.language,
            week=chart.week,
            generated_at=chart.generated_at,
            entries=enriched_entries,
            total_songs=len(enriched_entries),  # V1 field
            previous_chart_id=chart.previous_chart_id,
            next_chart_id=chart.next_chart_id
        )

    @classmethod
    def _get_chart_type_key(cls, chart: Chart) -> str:
        """Get the key used for rank history storage"""
        if chart.region == ChartRegion.INDIA:
            return "india"
        elif chart.region == ChartRegion.GLOBAL:
            return "global"
        elif chart.region == ChartRegion.REGIONAL and chart.language:
            return f"regional_{chart.language}"
        return "unknown"

    @classmethod
    async def get_chart_by_id(cls, chart_id: str) -> Optional[Chart]:
        """Get chart by ID"""
        charts = await cls._load_charts_from_files()

        for chart in charts:
            if chart.id == chart_id:
                return chart

        return None

    @classmethod
    async def list_charts(
        cls,
        region: Optional[ChartRegion] = None,
        language: Optional[str] = None,
        limit: int = 10
    ) -> List[ChartSummary]:
        """List available charts"""
        charts = await cls._load_charts_from_files()

        result = []
        for chart in charts:
            if region and chart.region != region:
                continue
            if language and chart.language != language:
                continue

            summary = ChartSummary(
                id=chart.id,
                name=chart.name,
                region=chart.region,
                week=chart.week,
                total_entries=len(chart.entries),
                top_song_title=chart.entries[0].song_title if chart.entries else None,
                top_song_artist=chart.entries[0].song_artist if chart.entries else None,
            )
            result.append(summary)

            if len(result) >= limit:
                break

        return result

    @classmethod
    async def get_chart_history(
        cls,
        chart_id: str,
        limit: int = 10
    ) -> List[ChartSummary]:
        """Get historical charts (placeholder for now)"""
        # In production, would query historical charts from MongoDB
        return []

    @classmethod
    async def _load_charts_from_files(cls) -> List[Chart]:
        """Load charts from JSON files (development mode)"""
        if cls._file_cache.get("charts"):
            return cls._file_cache["charts"]

        data_dir = Path(__file__).parent.parent.parent / "data" / "v2"
        charts_file = data_dir / "charts.json"

        if not charts_file.exists():
            return []

        with open(charts_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        charts = [Chart(**c) for c in data]
        cls._file_cache["charts"] = charts

        return charts

    @classmethod
    def clear_cache(cls):
        """Clear file cache"""
        cls._file_cache.clear()
