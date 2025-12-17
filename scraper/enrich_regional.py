#!/usr/bin/env python3
"""
Enrich regional songs with YouTube data, metadata, and lyrics.

This script takes the regional songs from current.json and enriches them
with the same data as the main chart songs.
"""

import asyncio
import aiohttp
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from youtube_api import YouTubeAPI
from metadata_api import MetadataFetcher
from lyrics_api import LyricsFetcher


async def enrich_regional_songs():
    """Enrich all regional songs with YouTube, metadata, and lyrics."""

    # Load current chart
    chart_path = os.path.join(os.path.dirname(__file__), '..', 'current.json')

    print(f"\n{'=' * 60}")
    print("ENRICHING REGIONAL SONGS")
    print(f"{'=' * 60}")

    with open(chart_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    if 'regional' not in data:
        print("No regional data found in current.json")
        return

    # Initialize APIs
    youtube = YouTubeAPI()
    metadata = MetadataFetcher()
    lyrics = LyricsFetcher()

    total_songs = 0
    enriched_count = 0
    with_artwork = 0
    with_lyrics = 0

    async with aiohttp.ClientSession() as session:
        for region_key, region_data in data['regional'].items():
            print(f"\n{'─' * 50}")
            print(f"Processing: {region_data.get('name', region_key).upper()}")
            print(f"{'─' * 50}")

            songs = region_data.get('songs', [])
            total_songs += len(songs)

            for i, song in enumerate(songs):
                title = song.get('title', '')
                artist = song.get('artist', '')

                if not title or not artist:
                    continue

                print(f"\n[{i+1}/{len(songs)}] {title} - {artist}")

                # 1. YouTube data
                yt_result = await youtube.search_song(title, artist)
                if yt_result:
                    song['youtube_video_id'] = yt_result.get('video_id', '')
                    song['youtube_views'] = yt_result.get('views', 0)
                    song['youtube_likes'] = yt_result.get('likes', 0)
                    song['youtube_duration'] = yt_result.get('duration', '')
                    enriched_count += 1

                # 2. Metadata (artwork, album, genre, etc.)
                meta_result = await metadata.search_metadata(session, title, artist)
                if meta_result:
                    song['artwork_url'] = meta_result.get('artwork_url', '')
                    song['album'] = meta_result.get('album_name', '')
                    song['genre'] = meta_result.get('genre', '')
                    song['preview_url'] = meta_result.get('preview_url', '')
                    if meta_result.get('artwork_url'):
                        with_artwork += 1

                # 3. Lyrics
                plain, synced = await lyrics.search_lyrics(session, title, artist)
                if plain:
                    song['lyrics_plain'] = plain
                    with_lyrics += 1
                if synced:
                    song['lyrics_synced'] = synced

                # Small delay to be nice to APIs
                await asyncio.sleep(0.1)

    # Save enriched data
    with open(chart_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print(f"\n{'=' * 60}")
    print("REGIONAL ENRICHMENT COMPLETE")
    print(f"{'=' * 60}")
    print(f"Total regional songs: {total_songs}")
    print(f"Songs with YouTube data: {enriched_count}")
    print(f"Songs with artwork: {with_artwork}")
    print(f"Songs with lyrics: {with_lyrics}")
    print(f"Saved to: {chart_path}")


if __name__ == '__main__':
    asyncio.run(enrich_regional_songs())
