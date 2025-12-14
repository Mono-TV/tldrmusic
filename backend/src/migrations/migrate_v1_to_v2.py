"""
Migration Script: V1 (flat JSON) → V2 (normalized entities)

Transforms the current.json flat structure into normalized
Song, Artist, Album, and Chart entities.
"""
import json
import uuid
import re
import asyncio
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from pathlib import Path

# Add parent to path for imports
import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from src.models import (
    Song, Artist, Chart, ChartEntry, ChartMovement,
    AudioSource, AudioProvider, Artwork, Lyrics, SyncedLyric,
    MovementDirection, ChartRegion, PlatformRank,
    ArtistType,
)


class MigrationV1ToV2:
    """
    Migrates V1 flat JSON data to V2 normalized structure
    """

    def __init__(self):
        self.songs: Dict[str, Song] = {}
        self.artists: Dict[str, Artist] = {}
        self.charts: List[Chart] = []

        # Artist name normalization cache
        self._artist_name_map: Dict[str, str] = {}  # normalized_name -> artist_id

    def normalize_string(self, s: str) -> str:
        """Normalize string for matching/search"""
        if not s:
            return ""
        # Lowercase, remove extra spaces, strip
        s = s.lower().strip()
        s = re.sub(r'\s+', ' ', s)
        return s

    def generate_id(self) -> str:
        """Generate unique ID"""
        return str(uuid.uuid4())

    def parse_synced_lyrics(self, synced_str: str) -> List[SyncedLyric]:
        """
        Parse synced lyrics from LRC format
        [00:10.10] Line text
        """
        if not synced_str:
            return []

        lyrics = []
        pattern = r'\[(\d{2}):(\d{2})\.(\d{2})\]\s*(.+)'

        for line in synced_str.strip().split('\n'):
            match = re.match(pattern, line.strip())
            if match:
                minutes, seconds, centiseconds, text = match.groups()
                time_ms = (
                    int(minutes) * 60 * 1000 +
                    int(seconds) * 1000 +
                    int(centiseconds) * 10
                )
                if text.strip():
                    lyrics.append(SyncedLyric(time_ms=time_ms, text=text.strip()))

        return lyrics

    def get_or_create_artist(self, name: str) -> str:
        """
        Get existing artist ID or create new artist
        Returns artist ID
        """
        normalized = self.normalize_string(name)

        # Check if we've seen this artist
        if normalized in self._artist_name_map:
            return self._artist_name_map[normalized]

        # Create new artist
        artist_id = self.generate_id()
        artist = Artist(
            id=artist_id,
            name=name.strip(),
            name_normalized=normalized,
            type=ArtistType.SOLO,  # Default, can be refined later
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        self.artists[artist_id] = artist
        self._artist_name_map[normalized] = artist_id

        return artist_id

    def detect_language(self, title: str, lyrics: Optional[str]) -> str:
        """
        Detect song language based on script used
        """
        text = (title or "") + " " + (lyrics or "")

        # Check for specific scripts
        if re.search(r'[\u0900-\u097F]', text):  # Devanagari (Hindi)
            return "hi"
        if re.search(r'[\u0A80-\u0AFF]', text):  # Gujarati
            return "gu"
        if re.search(r'[\u0A00-\u0A7F]', text):  # Gurmukhi (Punjabi)
            return "pa"
        if re.search(r'[\u0B80-\u0BFF]', text):  # Tamil
            return "ta"
        if re.search(r'[\u0C00-\u0C7F]', text):  # Telugu
            return "te"
        if re.search(r'[\u0C80-\u0CFF]', text):  # Kannada
            return "kn"
        if re.search(r'[\u0D00-\u0D7F]', text):  # Malayalam
            return "ml"
        if re.search(r'[\u0980-\u09FF]', text):  # Bengali
            return "bn"
        if re.search(r'[\u0600-\u06FF]', text):  # Arabic
            return "ar"

        # Default to English for Latin script
        return "en"

    def migrate_song(self, v1_song: dict, rank: int) -> Tuple[str, ChartEntry]:
        """
        Migrate a V1 song to V2 Song entity

        Returns: (song_id, chart_entry)
        """
        # Parse artist (may contain multiple artists)
        artist_name = v1_song.get("artist", "Unknown Artist")
        # Handle "Artist1, Artist2" or "Artist1 & Artist2"
        artist_names = re.split(r',\s*|\s*&\s*|\s*feat\.?\s*|\s*ft\.?\s*', artist_name)

        primary_artist_ids = []
        featured_artist_ids = []

        for i, name in enumerate(artist_names):
            name = name.strip()
            if not name:
                continue
            artist_id = self.get_or_create_artist(name)
            if i == 0:
                primary_artist_ids.append(artist_id)
            else:
                featured_artist_ids.append(artist_id)

        # Create song ID based on title + primary artist for deduplication
        title = v1_song.get("title", "Unknown")
        normalized_title = self.normalize_string(title)
        primary_artist = artist_names[0] if artist_names else "unknown"

        # Check for existing song (deduplication)
        song_key = f"{normalized_title}_{self.normalize_string(primary_artist)}"
        existing_song_id = None
        for sid, song in self.songs.items():
            if song.title_normalized == normalized_title:
                if song.artist_ids and song.artist_ids[0] in primary_artist_ids:
                    existing_song_id = sid
                    break

        if existing_song_id:
            song_id = existing_song_id
            song = self.songs[song_id]
        else:
            song_id = self.generate_id()

            # Parse lyrics
            lyrics = None
            if v1_song.get("lyrics_plain") or v1_song.get("lyrics_synced"):
                synced = self.parse_synced_lyrics(v1_song.get("lyrics_synced", ""))
                lyrics = Lyrics(
                    plain=v1_song.get("lyrics_plain"),
                    synced=synced if synced else None,
                    language=self.detect_language(title, v1_song.get("lyrics_plain")),
                )

            # Create artwork
            artwork_url = v1_song.get("artwork_url")
            artwork = Artwork(
                large=artwork_url,
                medium=artwork_url.replace("600x600", "300x300") if artwork_url and "600x600" in artwork_url else artwork_url,
                small=artwork_url.replace("600x600", "100x100") if artwork_url and "600x600" in artwork_url else artwork_url,
                original=artwork_url,
            ) if artwork_url else Artwork()

            # Create audio source
            youtube_id = v1_song.get("youtube_video_id")
            sources = []
            if youtube_id:
                sources.append(AudioSource(
                    provider=AudioProvider.YOUTUBE,
                    id=youtube_id,
                    url=f"https://youtube.com/watch?v={youtube_id}",
                    is_primary=True,
                ))

            # Detect language
            language = self.detect_language(title, v1_song.get("lyrics_plain"))

            # Create song
            song = Song(
                id=song_id,
                title=title,
                title_normalized=normalized_title,
                artist_ids=primary_artist_ids,
                featured_artist_ids=featured_artist_ids,
                language=language,
                sources=sources,
                artwork=artwork,
                lyrics=lyrics,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
            )

            self.songs[song_id] = song

        # Parse platform_ranks from V1 data (if available)
        v1_platform_ranks = v1_song.get("platform_ranks", [])
        platform_ranks = [
            PlatformRank(
                platform=pr.get("platform", "unknown"),
                rank=pr.get("rank", 0),
                weight=pr.get("weight", 1.0)
            )
            for pr in v1_platform_ranks
        ]

        # Create chart entry with all V1 metadata preserved
        chart_entry = ChartEntry(
            rank=rank,
            song_id=song_id,
            score=v1_song.get("score", 0),
            platforms_count=v1_song.get("platforms_count", 0),
            platform_ranks=platform_ranks,
            movement=ChartMovement(
                direction=MovementDirection.NEW,  # Default for migration
                positions=0,
                previous_rank=None,
                weeks_on_chart=1,
                peak_rank=rank,
            ),
            youtube_views=v1_song.get("youtube_views"),
            # Denormalized fields
            song_title=title,
            song_artist=artist_name,
            artwork_url=v1_song.get("artwork_url"),
            youtube_video_id=v1_song.get("youtube_video_id"),
            # V1 rank change fields
            rank_change=v1_song.get("rank_change"),
            previous_rank=v1_song.get("previous_rank"),
            is_new=v1_song.get("is_new", False),
            # V1 metadata fields
            youtube_likes=v1_song.get("youtube_likes"),
            youtube_duration=v1_song.get("youtube_duration"),
            youtube_published=v1_song.get("youtube_published"),
            album=v1_song.get("album"),
            genre=v1_song.get("genre"),
            duration_ms=v1_song.get("duration_ms"),
            release_date=v1_song.get("release_date"),
            preview_url=v1_song.get("preview_url"),
            itunes_url=v1_song.get("itunes_url"),
            apple_music_url=v1_song.get("apple_music_url"),
            lyrics_plain=v1_song.get("lyrics_plain"),
            lyrics_synced=v1_song.get("lyrics_synced"),
        )

        return song_id, chart_entry

    def migrate_chart(self, v1_data: dict) -> Chart:
        """
        Migrate V1 chart data to V2 Chart entity
        """
        entries = []

        for v1_song in v1_data.get("chart", []):
            rank = v1_song.get("rank", len(entries) + 1)
            song_id, chart_entry = self.migrate_song(v1_song, rank)
            entries.append(chart_entry)

        chart = Chart(
            id=f"india-{v1_data.get('week', 'unknown')}",
            name="India Top 25",
            description="Weekly chart aggregated from 7+ streaming platforms",
            region=ChartRegion.INDIA,
            week=v1_data.get("week", ""),
            generated_at=datetime.fromisoformat(
                v1_data.get("generated_at", datetime.utcnow().isoformat()).replace("Z", "+00:00")
            ),
            entries=entries,
        )

        self.charts.append(chart)
        return chart

    def migrate_regional(self, v1_data: dict) -> List[Chart]:
        """
        Migrate V1 regional charts to V2 Chart entities
        """
        regional_charts = []
        regional = v1_data.get("regional", {})

        language_map = {
            "tamil": ("ta", "Tamil"),
            "telugu": ("te", "Telugu"),
            "punjabi": ("pa", "Punjabi"),
            "hindi": ("hi", "Hindi"),
            "malayalam": ("ml", "Malayalam"),
            "kannada": ("kn", "Kannada"),
            "bengali": ("bn", "Bengali"),
        }

        for key, data in regional.items():
            lang_code, lang_name = language_map.get(key, (key, key.title()))

            entries = []
            for song in data.get("songs", []):
                # Regional songs have minimal data
                artist_name = song.get("artist", "Unknown")
                artist_id = self.get_or_create_artist(artist_name)

                song_id = self.generate_id()
                title = song.get("title", "Unknown")

                # Create minimal song
                song_entity = Song(
                    id=song_id,
                    title=title,
                    title_normalized=self.normalize_string(title),
                    artist_ids=[artist_id],
                    language=lang_code,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow(),
                )
                self.songs[song_id] = song_entity

                entries.append(ChartEntry(
                    rank=song.get("rank", len(entries) + 1),
                    song_id=song_id,
                    score=0,
                    platforms_count=1,
                    platform_ranks=[],
                    movement=ChartMovement(
                        direction=MovementDirection.NEW,
                        positions=0,
                        weeks_on_chart=1,
                        peak_rank=song.get("rank", 1),
                    ),
                    song_title=title,
                    song_artist=artist_name,
                ))

            chart = Chart(
                id=f"regional-{key}-{v1_data.get('week', 'unknown')}",
                name=f"{lang_name} Chart",
                region=ChartRegion.REGIONAL,
                language=lang_code,
                week=v1_data.get("week", ""),
                generated_at=datetime.fromisoformat(
                    v1_data.get("generated_at", datetime.utcnow().isoformat()).replace("Z", "+00:00")
                ),
                entries=entries,
            )

            regional_charts.append(chart)
            self.charts.append(chart)

        return regional_charts

    def migrate_global_chart(self, v1_data: dict) -> Chart:
        """
        Migrate V1 global chart data to V2 Chart entity
        """
        entries = []

        for v1_song in v1_data.get("chart", []):
            rank = v1_song.get("rank", len(entries) + 1)
            song_id, chart_entry = self.migrate_song(v1_song, rank)
            entries.append(chart_entry)

        chart = Chart(
            id=f"global-{v1_data.get('week', 'unknown')}",
            name="Global Top 25",
            description="Weekly chart aggregated from global streaming platforms",
            region=ChartRegion.GLOBAL,
            week=v1_data.get("week", ""),
            generated_at=datetime.fromisoformat(
                v1_data.get("generated_at", datetime.utcnow().isoformat()).replace("Z", "+00:00")
            ),
            entries=entries,
        )

        self.charts.append(chart)
        return chart

    def migrate(self, v1_data: dict, global_data: dict = None) -> dict:
        """
        Run full migration

        Args:
            v1_data: India chart data (current.json)
            global_data: Global chart data (global.json), optional

        Returns dict with all migrated entities
        """
        print("Starting V1 to V2 migration...")

        # Migrate main chart (India)
        print("Migrating India chart...")
        self.migrate_chart(v1_data)

        # Migrate global chart if provided
        if global_data:
            print("Migrating global chart...")
            self.migrate_global_chart(global_data)

        # Migrate regional charts
        print("Migrating regional charts...")
        self.migrate_regional(v1_data)

        # Update artist stats
        print("Updating artist stats...")
        for artist_id, artist in self.artists.items():
            # Count songs per artist
            song_count = sum(
                1 for s in self.songs.values()
                if artist_id in s.artist_ids or artist_id in s.featured_artist_ids
            )
            artist.top_song_ids = [
                s.id for s in self.songs.values()
                if artist_id in s.artist_ids
            ][:10]

        print(f"Migration complete:")
        print(f"  - Songs: {len(self.songs)}")
        print(f"  - Artists: {len(self.artists)}")
        print(f"  - Charts: {len(self.charts)}")

        return {
            "songs": [s.model_dump() for s in self.songs.values()],
            "artists": [a.model_dump() for a in self.artists.values()],
            "charts": [c.model_dump() for c in self.charts],
        }

    def save_to_files(self, output_dir: Path):
        """Save migrated data to JSON files"""
        output_dir.mkdir(parents=True, exist_ok=True)

        # Songs
        with open(output_dir / "songs.json", "w", encoding="utf-8") as f:
            json.dump(
                [s.model_dump() for s in self.songs.values()],
                f, indent=2, ensure_ascii=False, default=str
            )

        # Artists
        with open(output_dir / "artists.json", "w", encoding="utf-8") as f:
            json.dump(
                [a.model_dump() for a in self.artists.values()],
                f, indent=2, ensure_ascii=False, default=str
            )

        # Charts
        with open(output_dir / "charts.json", "w", encoding="utf-8") as f:
            json.dump(
                [c.model_dump() for c in self.charts],
                f, indent=2, ensure_ascii=False, default=str
            )

        print(f"Saved migrated data to {output_dir}")


def main():
    """Run migration on current.json and global.json"""
    # Paths - look in project root (tldrmusic/) not frontend/
    project_root = Path(__file__).parent.parent.parent.parent
    current_json = project_root / "current.json"
    global_json = project_root / "global.json"
    output_dir = Path(__file__).parent.parent.parent / "data" / "v2"

    if not current_json.exists():
        print(f"Error: {current_json} not found")
        return

    # Load V1 India data
    print(f"Loading {current_json}...")
    with open(current_json, "r", encoding="utf-8") as f:
        v1_data = json.load(f)

    # Load global chart data if available
    global_data = None
    if global_json.exists():
        print(f"Loading {global_json}...")
        with open(global_json, "r", encoding="utf-8") as f:
            global_data = json.load(f)
    else:
        print(f"[Warning] Global chart not found: {global_json}")

    # Run migration
    migrator = MigrationV1ToV2()
    migrator.migrate(v1_data, global_data)

    # Save to files
    migrator.save_to_files(output_dir)


if __name__ == "__main__":
    main()
