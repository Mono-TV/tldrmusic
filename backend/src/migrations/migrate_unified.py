"""
Unified Migration Script: V1 (flat JSON) → Unified (normalized + V1 fields preserved)

Transforms the current.json flat structure into normalized entities while
preserving ALL V1 fields for backward compatibility.
"""
import json
import uuid
import re
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


class UnifiedMigration:
    """
    Migrates V1 flat JSON data to unified structure with ALL fields preserved.
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
        s = s.lower().strip()
        s = re.sub(r'\s+', ' ', s)
        return s

    def generate_id(self) -> str:
        """Generate unique ID"""
        return str(uuid.uuid4())

    def parse_synced_lyrics(self, synced_str: str) -> List[SyncedLyric]:
        """Parse synced lyrics from LRC format"""
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
        """Get existing artist ID or create new artist"""
        normalized = self.normalize_string(name)

        if normalized in self._artist_name_map:
            return self._artist_name_map[normalized]

        artist_id = self.generate_id()
        artist = Artist(
            id=artist_id,
            name=name.strip(),
            name_normalized=normalized,
            type=ArtistType.SOLO,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        self.artists[artist_id] = artist
        self._artist_name_map[normalized] = artist_id

        return artist_id

    def detect_language(self, title: str, lyrics: Optional[str]) -> str:
        """Detect song language based on script used"""
        text = (title or "") + " " + (lyrics or "")

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

        return "en"

    def migrate_song(self, v1_song: dict, rank: int) -> Tuple[str, ChartEntry]:
        """
        Migrate a V1 song to unified Song entity with ALL fields preserved.
        """
        # Parse artist
        artist_name = v1_song.get("artist", "Unknown Artist")
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

        title = v1_song.get("title", "Unknown")
        normalized_title = self.normalize_string(title)
        primary_artist = artist_names[0] if artist_names else "unknown"

        # Check for existing song (deduplication)
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

            # Parse lyrics (V2 structure)
            lyrics = None
            lyrics_plain = v1_song.get("lyrics_plain")
            lyrics_synced = v1_song.get("lyrics_synced")
            if lyrics_plain or lyrics_synced:
                synced = self.parse_synced_lyrics(lyrics_synced or "")
                lyrics = Lyrics(
                    plain=lyrics_plain,
                    synced=synced if synced else None,
                    language=self.detect_language(title, lyrics_plain),
                )

            # Create artwork (V2 multi-resolution)
            artwork_url = v1_song.get("artwork_url")
            artwork = Artwork(
                large=artwork_url,
                medium=artwork_url.replace("600x600", "300x300") if artwork_url and "600x600" in artwork_url else artwork_url,
                small=artwork_url.replace("600x600", "100x100") if artwork_url and "600x600" in artwork_url else artwork_url,
                original=artwork_url,
            ) if artwork_url else Artwork()

            # Create audio source (V2 abstraction)
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
            language = self.detect_language(title, lyrics_plain)

            # Get genre (V1 single genre → V2 genres list)
            genre = v1_song.get("genre")
            genres = [genre] if genre else []

            # Create unified song with ALL V1 fields preserved
            song = Song(
                id=song_id,
                title=title,
                title_normalized=normalized_title,
                duration_ms=v1_song.get("duration_ms"),
                explicit=v1_song.get("explicit", False),
                release_date=v1_song.get("release_date"),
                artist_ids=primary_artist_ids,
                featured_artist_ids=featured_artist_ids,
                language=language,
                genres=genres,
                sources=sources,
                artwork=artwork,
                lyrics=lyrics,
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
                # V1 fields preserved as denormalized
                youtube_video_id=youtube_id,
                youtube_views=v1_song.get("youtube_views"),
                youtube_likes=v1_song.get("youtube_likes"),
                youtube_duration=v1_song.get("youtube_duration"),
                youtube_published=v1_song.get("youtube_published"),
                preview_url=v1_song.get("preview_url"),
                itunes_url=v1_song.get("itunes_url"),
                apple_music_url=v1_song.get("apple_music_url"),
                artist=artist_name,  # Original V1 artist string
                album=v1_song.get("album"),
                genre=genre,  # Single genre for V1 compat
                artwork_url=artwork_url,  # Single URL for V1 compat
                lyrics_plain=lyrics_plain,  # V1 format
                lyrics_synced=lyrics_synced,  # V1 LRC format
            )

            self.songs[song_id] = song

        # Calculate V1 movement fields
        is_new = v1_song.get("is_new", True)
        rank_change = v1_song.get("rank_change")
        previous_rank = v1_song.get("previous_rank")

        # Determine movement direction
        if is_new:
            direction = MovementDirection.NEW
            positions = 0
        elif rank_change is not None:
            if rank_change > 0:
                direction = MovementDirection.UP
                positions = rank_change
            elif rank_change < 0:
                direction = MovementDirection.DOWN
                positions = abs(rank_change)
            else:
                direction = MovementDirection.SAME
                positions = 0
        else:
            direction = MovementDirection.NEW
            positions = 0

        # Create chart entry with ALL V1 fields
        chart_entry = ChartEntry(
            rank=rank,
            song_id=song_id,
            score=v1_song.get("score", 0),
            platforms_count=v1_song.get("platforms_count", 0),
            platform_ranks=[],
            movement=ChartMovement(
                direction=direction,
                positions=positions,
                previous_rank=previous_rank,
                weeks_on_chart=1,
                peak_rank=rank,
            ),
            youtube_views=v1_song.get("youtube_views"),
            spotify_streams=v1_song.get("spotify_streams"),
            # Denormalized song data
            song_title=title,
            song_artist=artist_name,
            artwork_url=v1_song.get("artwork_url"),
            youtube_video_id=v1_song.get("youtube_video_id"),
            # V1 flat fields
            rank_change=rank_change,
            previous_rank=previous_rank,
            is_new=is_new,
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
        """Migrate V1 chart data to unified Chart entity"""
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
            total_songs=len(entries),
        )

        self.charts.append(chart)
        return chart

    def migrate_regional(self, v1_data: dict) -> List[Chart]:
        """Migrate V1 regional charts to unified Chart entities"""
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
            "bhojpuri": ("bh", "Bhojpuri"),
            "haryanvi": ("hr", "Haryanvi"),
            "marathi": ("mr", "Marathi"),
            "gujarati": ("gu", "Gujarati"),
        }

        for key, data in regional.items():
            lang_code, lang_name = language_map.get(key.lower(), (key, key.title()))

            entries = []
            for song in data.get("songs", []):
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
                    # V1 fields
                    artist=artist_name,
                    artwork_url=song.get("artwork_url"),
                    youtube_video_id=song.get("youtube_video_id"),
                    youtube_views=song.get("youtube_views"),
                    youtube_likes=song.get("youtube_likes"),
                )
                self.songs[song_id] = song_entity

                # V1 movement fields
                is_new = song.get("is_new", True)
                rank_change = song.get("rank_change")
                previous_rank = song.get("previous_rank")

                if is_new:
                    direction = MovementDirection.NEW
                    positions = 0
                elif rank_change is not None:
                    if rank_change > 0:
                        direction = MovementDirection.UP
                        positions = rank_change
                    elif rank_change < 0:
                        direction = MovementDirection.DOWN
                        positions = abs(rank_change)
                    else:
                        direction = MovementDirection.SAME
                        positions = 0
                else:
                    direction = MovementDirection.NEW
                    positions = 0

                entries.append(ChartEntry(
                    rank=song.get("rank", len(entries) + 1),
                    song_id=song_id,
                    score=0,
                    platforms_count=1,
                    platform_ranks=[],
                    movement=ChartMovement(
                        direction=direction,
                        positions=positions,
                        previous_rank=previous_rank,
                        weeks_on_chart=1,
                        peak_rank=song.get("rank", 1),
                    ),
                    song_title=title,
                    song_artist=artist_name,
                    artwork_url=song.get("artwork_url"),
                    youtube_video_id=song.get("youtube_video_id"),
                    # V1 flat fields
                    rank_change=rank_change,
                    previous_rank=previous_rank,
                    is_new=is_new,
                    youtube_views=song.get("youtube_views"),
                    youtube_likes=song.get("youtube_likes"),
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
                total_songs=len(entries),
            )

            regional_charts.append(chart)
            self.charts.append(chart)

        return regional_charts

    def migrate_global(self, v1_data: dict) -> Optional[Chart]:
        """
        Migrate global charts from V1 data.
        Combines songs from spotify_global, billboard_hot100, apple_global using weighted scoring.
        """
        global_data = v1_data.get("global", {})
        if not global_data:
            print("No global data found in current.json")
            return None

        # Platform weights (same as scraper config)
        platform_weights = {
            "apple_global": 1.5,
            "spotify_global": 1.5,
            "billboard_hot100": 1.2,
        }

        # Collect all songs with their weighted scores
        song_scores: Dict[str, Dict] = {}  # normalized_key -> {song_data, score, platforms}

        for platform_key, weight in platform_weights.items():
            platform_data = global_data.get(platform_key, {})
            songs = platform_data.get("songs", [])

            for song in songs:
                title = song.get("title", "Unknown")
                artist = song.get("artist", "Unknown")
                rank = song.get("rank", 100)

                # Normalize key for matching
                normalized_key = self.normalize_string(f"{title}|{artist}")

                # Calculate position score: higher rank = higher score
                max_position = 10
                position_score = (max_position - rank + 1) / max_position
                weighted_score = weight * position_score

                if normalized_key in song_scores:
                    song_scores[normalized_key]["score"] += weighted_score
                    song_scores[normalized_key]["platforms"].append(platform_key)
                    song_scores[normalized_key]["platform_ranks"].append({
                        "platform": platform_key,
                        "rank": rank
                    })
                else:
                    song_scores[normalized_key] = {
                        "title": title,
                        "artist": artist,
                        "score": weighted_score,
                        "platforms": [platform_key],
                        "platform_ranks": [{"platform": platform_key, "rank": rank}],
                        "best_rank": rank,
                        "artwork_url": song.get("artwork_url"),
                        "youtube_video_id": song.get("youtube_video_id"),
                    }

        if not song_scores:
            print("No global songs found to migrate")
            return None

        # Sort by score (descending), then by platform count
        sorted_songs = sorted(
            song_scores.values(),
            key=lambda x: (x["score"], len(x["platforms"])),
            reverse=True
        )

        # Take top 25
        top_25 = sorted_songs[:25]

        # Create chart entries
        entries = []
        for i, song_data in enumerate(top_25):
            song_id = self.generate_id()
            title = song_data["title"]
            artist_name = song_data["artist"]

            # Create artist
            artist_id = self.get_or_create_artist(artist_name)

            # Create song entity
            song_entity = Song(
                id=song_id,
                title=title,
                title_normalized=self.normalize_string(title),
                artist_ids=[artist_id],
                language="en",  # Global charts are English
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow(),
                artist=artist_name,
                artwork_url=song_data.get("artwork_url"),
                youtube_video_id=song_data.get("youtube_video_id"),
            )
            self.songs[song_id] = song_entity

            # Create platform ranks
            platform_ranks = []
            for pr in song_data.get("platform_ranks", []):
                platform_ranks.append(PlatformRank(
                    platform=pr["platform"],
                    rank=pr["rank"],
                    weight=platform_weights.get(pr["platform"], 1.0)
                ))

            entries.append(ChartEntry(
                rank=i + 1,
                song_id=song_id,
                score=song_data["score"],
                platforms_count=len(song_data["platforms"]),
                platform_ranks=platform_ranks,
                movement=ChartMovement(
                    direction=MovementDirection.NEW,
                    positions=0,
                    previous_rank=None,
                    weeks_on_chart=1,
                    peak_rank=i + 1,
                ),
                song_title=title,
                song_artist=artist_name,
                artwork_url=song_data.get("artwork_url"),
                youtube_video_id=song_data.get("youtube_video_id"),
                is_new=True,
            ))

        # Create the global chart
        chart = Chart(
            id=f"global-{v1_data.get('week', 'unknown')}",
            name="Global Top 25",
            description="Weekly global chart aggregated from Spotify, Apple Music, and Billboard",
            region=ChartRegion.GLOBAL,
            week=v1_data.get("week", ""),
            generated_at=datetime.fromisoformat(
                v1_data.get("generated_at", datetime.utcnow().isoformat()).replace("Z", "+00:00")
            ),
            entries=entries,
            total_songs=len(entries),
        )

        self.charts.append(chart)
        print(f"Created global chart with {len(entries)} songs")
        return chart

    def migrate(self, v1_data: dict) -> dict:
        """Run full migration"""
        print("Starting unified migration (preserving all V1 fields)...")

        print("Migrating main chart...")
        self.migrate_chart(v1_data)

        print("Migrating regional charts...")
        self.migrate_regional(v1_data)

        print("Migrating global chart...")
        self.migrate_global(v1_data)

        # Update artist stats
        print("Updating artist stats...")
        for artist_id, artist in self.artists.items():
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
    """Run migration on current.json"""
    # Paths
    project_root = Path(__file__).parent.parent.parent.parent
    frontend_dir = project_root / "frontend"
    current_json = frontend_dir / "current.json"

    # Also check root directory
    if not current_json.exists():
        current_json = project_root / "current.json"

    output_dir = Path(__file__).parent.parent.parent / "data" / "v2"

    if not current_json.exists():
        print(f"Error: current.json not found at {current_json}")
        print("Looking in other locations...")

        # Try data directory
        data_json = project_root / "data" / "current.json"
        if data_json.exists():
            current_json = data_json
        else:
            print("Could not find current.json")
            return

    # Load V1 data
    print(f"Loading {current_json}...")
    with open(current_json, "r", encoding="utf-8") as f:
        v1_data = json.load(f)

    # Run migration
    migrator = UnifiedMigration()
    migrator.migrate(v1_data)

    # Save to files
    migrator.save_to_files(output_dir)


if __name__ == "__main__":
    main()
