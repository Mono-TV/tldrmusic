"""
Chart Service - Business logic for charts
"""
from typing import List, Optional
import json
from pathlib import Path
from datetime import datetime
import logging

from ..models import Chart, ChartSummary, ChartRegion, ChartEntry, ChartMovement, MovementDirection
from ..config import Database
from .rank_history import rank_history

logger = logging.getLogger(__name__)


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

        Queries MongoDB for production, falls back to files for development.
        """
        # Try MongoDB first
        chart = await cls._load_chart_from_mongodb(region, language)
        if chart:
            if with_rank_changes:
                return cls._enrich_with_rank_changes(chart)
            return chart

        # Fallback to files for development
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
    async def _load_chart_from_mongodb(
        cls,
        region: ChartRegion,
        language: Optional[str] = None
    ) -> Optional[Chart]:
        """Load chart from MongoDB"""
        if Database.db is None:
            return None

        try:
            # Get the most recent chart document
            chart_doc = await Database.charts().find_one(
                {},
                sort=[("week", -1)]
            )

            if not chart_doc:
                return None

            week = chart_doc.get("week", "")
            generated_at = chart_doc.get("generated_at")
            if isinstance(generated_at, str):
                try:
                    generated_at = datetime.fromisoformat(generated_at.replace("Z", "+00:00"))
                except:
                    generated_at = datetime.utcnow()
            elif generated_at is None:
                generated_at = datetime.utcnow()

            if region == ChartRegion.INDIA:
                # Main India chart
                chart_songs = chart_doc.get("chart", [])
                entries = cls._convert_songs_to_entries(chart_songs)

                return Chart(
                    id=f"india-{week}",
                    name="India Top 25",
                    description="India's definitive music chart, aggregated from 9 major platforms",
                    region=ChartRegion.INDIA,
                    language=None,
                    week=week,
                    generated_at=generated_at,
                    entries=entries,
                    total_songs=len(entries),
                )

            elif region == ChartRegion.GLOBAL:
                # Global chart
                global_songs = chart_doc.get("global_chart", [])
                entries = cls._convert_songs_to_entries(global_songs)

                return Chart(
                    id=f"global-{week}",
                    name="Global Top 25",
                    description="Global music chart aggregated from Spotify, Billboard, and Apple Music",
                    region=ChartRegion.GLOBAL,
                    language=None,
                    week=week,
                    generated_at=generated_at,
                    entries=entries,
                    total_songs=len(entries),
                )

            elif region == ChartRegion.REGIONAL and language:
                # Regional chart
                regional_data = chart_doc.get("regional", {})

                # Map language codes to keys
                lang_key_map = {
                    "hi": "hindi",
                    "ta": "tamil",
                    "te": "telugu",
                    "pa": "punjabi",
                    "bh": "bhojpuri",
                    "hr": "haryanvi",
                    "bn": "bengali",
                    "mr": "marathi",
                    "kn": "kannada",
                    "ml": "malayalam",
                    "gu": "gujarati",
                }
                lang_key = lang_key_map.get(language, language)

                region_chart = regional_data.get(lang_key, {})
                if not region_chart:
                    return None

                regional_songs = region_chart.get("songs", [])
                entries = cls._convert_songs_to_entries(regional_songs)

                region_name = region_chart.get("name", lang_key.title())

                return Chart(
                    id=f"regional-{lang_key}-{week}",
                    name=f"{region_name} Top 10",
                    description=f"Top {region_name} songs this week",
                    region=ChartRegion.REGIONAL,
                    language=language,
                    week=week,
                    generated_at=generated_at,
                    entries=entries,
                    total_songs=len(entries),
                )

        except Exception as e:
            logger.error(f"Error loading chart from MongoDB: {e}")
            return None

        return None

    @classmethod
    def _convert_songs_to_entries(cls, songs: list) -> List[ChartEntry]:
        """Convert MongoDB song documents to ChartEntry objects"""
        entries = []
        for song in songs:
            try:
                # Determine movement direction
                is_new = song.get("is_new", False)
                rank_change = song.get("rank_change", 0)
                previous_rank = song.get("previous_rank")

                if is_new:
                    direction = MovementDirection.NEW
                    positions = 0
                elif rank_change and rank_change > 0:
                    direction = MovementDirection.UP
                    positions = abs(rank_change)
                elif rank_change and rank_change < 0:
                    direction = MovementDirection.DOWN
                    positions = abs(rank_change)
                else:
                    direction = MovementDirection.SAME
                    positions = 0

                movement = ChartMovement(
                    direction=direction,
                    positions=positions,
                    previous_rank=previous_rank,
                    weeks_on_chart=1,
                    peak_rank=song.get("rank", 1)
                )

                entry = ChartEntry(
                    rank=song.get("rank", 0),
                    song_id=song.get("youtube_video_id", ""),
                    score=song.get("score", 0.0),
                    platforms_count=song.get("platforms_count", 0),
                    platform_ranks=song.get("platform_ranks", []),
                    movement=movement,
                    youtube_views=song.get("youtube_views"),
                    song_title=song.get("title", ""),
                    song_artist=song.get("artist", ""),
                    artwork_url=song.get("artwork_url", ""),
                    youtube_video_id=song.get("youtube_video_id", ""),
                    rank_change=rank_change,
                    previous_rank=previous_rank,
                    is_new=is_new,
                    youtube_likes=song.get("youtube_likes"),
                    youtube_duration=song.get("youtube_duration"),
                    lyrics_plain=song.get("lyrics_plain"),
                    lyrics_synced=song.get("lyrics_synced"),
                )
                entries.append(entry)
            except Exception as e:
                logger.warning(f"Error converting song to entry: {e}")
                continue

        return entries

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
        result = []

        # Try loading from MongoDB first
        if Database.db is not None:
            try:
                # Query available weeks from MongoDB
                cursor = Database.charts().find(
                    {},
                    {"week": 1, "chart": 1, "global_chart": 1, "regional": 1}
                ).sort("week", -1).limit(limit)

                async for chart_doc in cursor:
                    week = chart_doc.get("week", "")

                    # Add India chart summary
                    if not region or region == ChartRegion.INDIA:
                        chart_songs = chart_doc.get("chart", [])
                        if chart_songs:
                            result.append(ChartSummary(
                                id=f"india-{week}",
                                name="India Top 25",
                                region=ChartRegion.INDIA,
                                week=week,
                                total_entries=len(chart_songs),
                                top_song_title=chart_songs[0].get("title") if chart_songs else None,
                                top_song_artist=chart_songs[0].get("artist") if chart_songs else None,
                            ))

                    # Add Global chart summary
                    if not region or region == ChartRegion.GLOBAL:
                        global_songs = chart_doc.get("global_chart", [])
                        if global_songs:
                            result.append(ChartSummary(
                                id=f"global-{week}",
                                name="Global Top 25",
                                region=ChartRegion.GLOBAL,
                                week=week,
                                total_entries=len(global_songs),
                                top_song_title=global_songs[0].get("title") if global_songs else None,
                                top_song_artist=global_songs[0].get("artist") if global_songs else None,
                            ))

                    # Add Regional chart summaries
                    if not region or region == ChartRegion.REGIONAL:
                        regional_data = chart_doc.get("regional", {})
                        for lang_key, region_chart in regional_data.items():
                            if language and lang_key != language:
                                continue
                            regional_songs = region_chart.get("songs", [])
                            region_name = region_chart.get("name", lang_key.title())
                            if regional_songs:
                                result.append(ChartSummary(
                                    id=f"regional-{lang_key}-{week}",
                                    name=f"{region_name} Top 10",
                                    region=ChartRegion.REGIONAL,
                                    week=week,
                                    total_entries=len(regional_songs),
                                    top_song_title=regional_songs[0].get("title") if regional_songs else None,
                                    top_song_artist=regional_songs[0].get("artist") if regional_songs else None,
                                ))

                    if len(result) >= limit:
                        break

                if result:
                    return result[:limit]
            except Exception as e:
                logger.error(f"Error listing charts from MongoDB: {e}")

        # Fallback to files
        charts = await cls._load_charts_from_files()

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
