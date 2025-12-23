"""
AI Playlist Generator Service

Uses Gemini to generate playlists based on user prompts.
"""
import json
import httpx
from typing import List, Optional, Dict, Any
from datetime import datetime

from ..config import settings


# Music Conductor API base URL
MUSIC_CONDUCTOR_API = "https://music-conductor-401132033262.asia-south1.run.app"


class PlaylistGeneratorService:
    """Service for generating playlists using AI"""

    @staticmethod
    async def generate_playlist(
        prompt: str,
        user_id: str,
        song_count: int = 25,
        language: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Generate a playlist based on user prompt using Gemini AI.

        Args:
            prompt: User's natural language request
            user_id: User's ID for ownership
            song_count: Number of songs to include (default 25)
            language: Optional language filter

        Returns:
            Generated playlist dict with songs
        """
        if not settings.GEMINI_API_KEY:
            raise ValueError("GEMINI_API_KEY not configured")

        # Step 1: Use Gemini to understand the prompt and generate search parameters
        search_params = await PlaylistGeneratorService._parse_prompt_with_gemini(prompt, language)

        # Step 2: Search for candidate songs from Music Conductor
        candidate_songs = await PlaylistGeneratorService._search_songs(
            search_params,
            limit=min(song_count * 4, 100)  # Get 4x candidates for better curation
        )

        if not candidate_songs:
            raise ValueError("No songs found matching your request. Try a different prompt.")

        # Step 3: Use Gemini to curate the final playlist from candidates
        curated_songs = await PlaylistGeneratorService._curate_playlist_with_gemini(
            prompt=prompt,
            candidates=candidate_songs,
            count=song_count
        )

        # Step 4: Generate playlist metadata
        playlist_name = await PlaylistGeneratorService._generate_playlist_name(prompt)

        return {
            "name": playlist_name,
            "description": f"AI-generated playlist: {prompt}",
            "songs": curated_songs,
            "total_tracks": len(curated_songs),
            "generated_from_prompt": prompt,
            "ai_model": "gemini-2.0-flash-exp"
        }

    @staticmethod
    async def _parse_prompt_with_gemini(prompt: str, language: Optional[str] = None) -> Dict[str, Any]:
        """
        Use Gemini to parse the user's prompt and extract search parameters.
        """
        system_prompt = """You are a music expert assistant. Analyze the user's playlist request and extract search parameters.

Return a JSON object with these fields:
- "search_queries": array of 2-4 search terms to find relevant songs (artist names, song titles, descriptive terms)
- "genres": array of relevant genres (e.g., "Pop", "Bollywood", "Hip-Hop", "Rock", "Electronic", "Classical", "Indie")
- "mood": one of: "chill", "workout", "party", "romance", "sad", "focus", "energize", "feel-good", or null
- "language": language code if mentioned (e.g., "hi" for Hindi, "en" for English, "ta" for Tamil, "pa" for Punjabi), or null

Only return valid JSON, no other text."""

        user_message = f"User request: {prompt}"
        if language:
            user_message += f"\nPreferred language: {language}"

        response = await PlaylistGeneratorService._call_gemini(
            system_prompt=system_prompt,
            user_message=user_message
        )

        try:
            # Clean up response - remove markdown code blocks if present
            cleaned = response.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1]  # Remove first line
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("\n", 1)[0]  # Remove last line
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()

            return json.loads(cleaned)
        except json.JSONDecodeError:
            # Fallback to simple search
            return {
                "search_queries": [prompt],
                "genres": [],
                "mood": None,
                "language": language
            }

    @staticmethod
    async def _search_songs(search_params: Dict[str, Any], limit: int = 100) -> List[Dict[str, Any]]:
        """
        Search for songs using Music Conductor API.
        """
        all_songs = []
        seen_ids = set()

        async with httpx.AsyncClient(timeout=30.0) as client:
            # Search with each query term
            queries = search_params.get("search_queries", [])
            if not queries:
                queries = ["popular"]

            for query in queries[:4]:  # Max 4 queries
                params = {
                    "q": query,
                    "has_youtube": "true",
                    "per_page": min(limit // len(queries), 50)
                }

                # Add language filter if specified
                if search_params.get("language"):
                    params["language"] = search_params["language"]

                # Add genre filter if specified
                genres = search_params.get("genres", [])
                if genres:
                    params["genre"] = genres[0]  # API accepts single genre

                try:
                    response = await client.get(
                        f"{MUSIC_CONDUCTOR_API}/api/search/songs",
                        params=params
                    )
                    response.raise_for_status()
                    data = response.json()

                    for song in data.get("songs", []):
                        song_id = song.get("id") or song.get("youtube_video_id")
                        if song_id and song_id not in seen_ids:
                            seen_ids.add(song_id)
                            all_songs.append({
                                "title": song.get("title"),
                                "artist": song.get("artist_name") or song.get("artist"),
                                "youtube_video_id": song.get("youtube_video_id") or song.get("youtube_id"),
                                "artwork_url": song.get("artwork_url"),
                                "language": song.get("language"),
                                "genres": song.get("genres", []),
                                "duration_seconds": song.get("duration_seconds")
                            })
                except Exception as e:
                    print(f"Search error for query '{query}': {e}")
                    continue

            # If we don't have enough songs, do a broader search
            if len(all_songs) < limit // 2:
                try:
                    params = {
                        "q": "",
                        "has_youtube": "true",
                        "per_page": 50
                    }
                    if search_params.get("language"):
                        params["language"] = search_params["language"]

                    response = await client.get(
                        f"{MUSIC_CONDUCTOR_API}/api/search/songs",
                        params=params
                    )
                    response.raise_for_status()
                    data = response.json()

                    for song in data.get("songs", []):
                        song_id = song.get("id") or song.get("youtube_video_id")
                        if song_id and song_id not in seen_ids:
                            seen_ids.add(song_id)
                            all_songs.append({
                                "title": song.get("title"),
                                "artist": song.get("artist_name") or song.get("artist"),
                                "youtube_video_id": song.get("youtube_video_id") or song.get("youtube_id"),
                                "artwork_url": song.get("artwork_url"),
                                "language": song.get("language"),
                                "genres": song.get("genres", []),
                                "duration_seconds": song.get("duration_seconds")
                            })
                except Exception as e:
                    print(f"Fallback search error: {e}")

        return all_songs[:limit]

    @staticmethod
    async def _curate_playlist_with_gemini(
        prompt: str,
        candidates: List[Dict[str, Any]],
        count: int
    ) -> List[Dict[str, Any]]:
        """
        Use Gemini to select and order the best songs for the playlist.
        """
        # Format candidates for Gemini
        candidates_text = "\n".join([
            f"{i+1}. \"{song['title']}\" by {song['artist']}"
            for i, song in enumerate(candidates)
        ])

        system_prompt = f"""You are a music curator creating a playlist. Given a user's request and a list of candidate songs, select the {count} best songs that match the request.

Consider:
- Relevance to the user's mood/theme
- Variety in artists (don't repeat same artist too much)
- Flow of the playlist (good song order)

Return ONLY a JSON array of song numbers (1-indexed) in the order they should appear in the playlist.
Example: [5, 12, 3, 8, 15, 1, 20]

Only return the JSON array, no other text."""

        user_message = f"""User request: {prompt}

Candidate songs:
{candidates_text}

Select {count} songs and return their numbers as a JSON array."""

        response = await PlaylistGeneratorService._call_gemini(
            system_prompt=system_prompt,
            user_message=user_message
        )

        try:
            # Clean up response
            cleaned = response.strip()
            if cleaned.startswith("```"):
                cleaned = cleaned.split("\n", 1)[1]
            if cleaned.endswith("```"):
                cleaned = cleaned.rsplit("\n", 1)[0]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:].strip()

            selected_indices = json.loads(cleaned)

            # Map indices to songs (1-indexed to 0-indexed)
            curated = []
            for idx in selected_indices[:count]:
                if isinstance(idx, int) and 1 <= idx <= len(candidates):
                    curated.append(candidates[idx - 1])

            # If we didn't get enough songs, add more from candidates
            if len(curated) < count:
                for song in candidates:
                    if song not in curated:
                        curated.append(song)
                        if len(curated) >= count:
                            break

            return curated

        except (json.JSONDecodeError, TypeError):
            # Fallback: return first N candidates
            return candidates[:count]

    @staticmethod
    async def _generate_playlist_name(prompt: str) -> str:
        """
        Generate a catchy playlist name using Gemini.
        """
        system_prompt = """Generate a short, catchy playlist name (max 5 words) based on the user's request.
Return only the name, no quotes or extra text."""

        response = await PlaylistGeneratorService._call_gemini(
            system_prompt=system_prompt,
            user_message=prompt
        )

        name = response.strip().strip('"\'')
        # Truncate if too long
        if len(name) > 50:
            name = name[:47] + "..."

        return name or "My AI Playlist"

    @staticmethod
    async def _call_gemini(system_prompt: str, user_message: str) -> str:
        """
        Call Gemini API with the given prompts.
        """
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={settings.GEMINI_API_KEY}"

        payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [{"text": f"{system_prompt}\n\n{user_message}"}]
                }
            ],
            "generationConfig": {
                "temperature": 0.7,
                "maxOutputTokens": 1024
            }
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()

            # Extract text from response
            candidates = data.get("candidates", [])
            if candidates:
                content = candidates[0].get("content", {})
                parts = content.get("parts", [])
                if parts:
                    return parts[0].get("text", "")

            return ""
