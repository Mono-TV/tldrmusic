"""
SEO Routes - Server-rendered pages for search engines and social sharing

These routes serve HTML pages with proper meta tags for SEO and social media previews.
They redirect to the SPA after a brief delay for actual user interaction.
"""
import json
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, PlainTextResponse

from ...config import settings, Database

router = APIRouter(tags=["SEO"])


def require_db():
    """Get database connection or raise 503 if not available"""
    if Database.db is None:
        raise HTTPException(
            status_code=503,
            detail="Database not available"
        )
    return Database.db

# Frontend URL for redirects
FRONTEND_URL = "https://mono-tv.github.io/tldrmusic"
SITE_NAME = "TLDR Music"
DEFAULT_IMAGE = f"{FRONTEND_URL}/og-image.png"


def generate_seo_html(
    title: str,
    description: str,
    canonical_url: str,
    redirect_url: str,
    og_type: str = "website",
    og_image: str = DEFAULT_IMAGE,
    structured_data: Optional[dict] = None,
) -> str:
    """Generate SEO-optimized HTML with meta tags and structured data"""

    # Escape HTML entities
    title = title.replace('"', '&quot;').replace('<', '&lt;').replace('>', '&gt;')
    description = description.replace('"', '&quot;').replace('<', '&lt;').replace('>', '&gt;')

    schema_script = ""
    if structured_data:
        schema_script = f'<script type="application/ld+json">{json.dumps(structured_data, ensure_ascii=False)}</script>'

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{title} | {SITE_NAME}</title>
    <meta name="description" content="{description}">
    <link rel="canonical" href="{canonical_url}">

    <!-- Open Graph -->
    <meta property="og:type" content="{og_type}">
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{description}">
    <meta property="og:image" content="{og_image}">
    <meta property="og:url" content="{canonical_url}">
    <meta property="og:site_name" content="{SITE_NAME}">

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{title}">
    <meta name="twitter:description" content="{description}">
    <meta name="twitter:image" content="{og_image}">

    <!-- Favicon -->
    <link rel="icon" href="{FRONTEND_URL}/favicon.ico">

    {schema_script}

    <style>
        * {{ margin: 0; padding: 0; box-sizing: border-box; }}
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #0f0f1a 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
        }}
        .container {{
            text-align: center;
            padding: 2rem;
        }}
        h1 {{
            font-size: 1.5rem;
            margin-bottom: 1rem;
            color: #f59e0b;
        }}
        p {{
            color: rgba(255,255,255,0.7);
        }}
        .loader {{
            width: 40px;
            height: 40px;
            border: 3px solid rgba(245, 158, 11, 0.3);
            border-top-color: #f59e0b;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin: 1rem auto;
        }}
        @keyframes spin {{
            to {{ transform: rotate(360deg); }}
        }}
    </style>
    <script>
        setTimeout(function() {{
            window.location.href = '{redirect_url}';
        }}, 100);
    </script>
</head>
<body>
    <div class="container">
        <h1>{title}</h1>
        <div class="loader"></div>
        <p>Loading {SITE_NAME}...</p>
    </div>
</body>
</html>"""


# ============== Playlist SEO ==============

@router.get("/p/{playlist_id}", response_class=HTMLResponse)
async def seo_playlist(playlist_id: str):
    """SEO-friendly playlist page"""
    db = require_db()

    # Fetch playlist
    playlist = await db.playlists.find_one({"_id": playlist_id})
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    # Check if public
    if not playlist.get("is_public", False):
        raise HTTPException(status_code=403, detail="This playlist is private")

    # Get creator info
    creator = await db.users.find_one({"_id": playlist.get("user_id")})
    creator_name = creator.get("name", "Unknown") if creator else "Unknown"

    # Build metadata
    title = playlist.get("name", "Untitled Playlist")
    song_count = len(playlist.get("songs", []))
    description = f"A playlist by {creator_name} with {song_count} songs on TLDR Music."
    if playlist.get("description"):
        description = playlist.get("description")[:160]

    # Get cover image
    cover_image = DEFAULT_IMAGE
    songs = playlist.get("songs", [])
    if songs and songs[0].get("artwork"):
        cover_image = songs[0]["artwork"]

    canonical_url = f"{FRONTEND_URL}/p/{playlist_id}"
    redirect_url = f"{FRONTEND_URL}/?playlist={playlist_id}"

    # Schema.org structured data
    structured_data = {
        "@context": "https://schema.org",
        "@type": "MusicPlaylist",
        "name": title,
        "description": description,
        "numTracks": song_count,
        "url": canonical_url,
        "image": cover_image,
        "creator": {
            "@type": "Person",
            "name": creator_name
        }
    }

    return generate_seo_html(
        title=title,
        description=description,
        canonical_url=canonical_url,
        redirect_url=redirect_url,
        og_type="music.playlist",
        og_image=cover_image,
        structured_data=structured_data
    )


# ============== User Profile SEO ==============

@router.get("/u/{username}", response_class=HTMLResponse)
async def seo_user_profile(username: str):
    """SEO-friendly user profile page"""
    db = require_db()

    # Find user by username
    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Get public playlist count
    playlist_count = await db.playlists.count_documents({
        "user_id": str(user["_id"]),
        "is_public": True
    })

    title = user.get("name", username)
    description = f"{title}'s profile on TLDR Music. {playlist_count} public playlists."

    profile_image = user.get("picture", DEFAULT_IMAGE)
    canonical_url = f"{FRONTEND_URL}/u/{username}"
    redirect_url = f"{FRONTEND_URL}/?user={username}"

    # Schema.org structured data
    structured_data = {
        "@context": "https://schema.org",
        "@type": "Person",
        "name": title,
        "url": canonical_url,
        "image": profile_image
    }

    return generate_seo_html(
        title=f"{title} on TLDR Music",
        description=description,
        canonical_url=canonical_url,
        redirect_url=redirect_url,
        og_type="profile",
        og_image=profile_image,
        structured_data=structured_data
    )


# ============== Chart SEO Pages ==============

@router.get("/chart/india", response_class=HTMLResponse)
async def seo_india_chart():
    """India Top 25 chart landing page"""
    db = require_db()

    # Get current chart
    chart = await db.charts.find_one({"chart_type": "india"}, sort=[("week_start", -1)])

    description = "India's definitive Top 25 music chart. Aggregated weekly from Spotify, Apple Music, YouTube Music, JioSaavn, Gaana, and more."

    # Get #1 song image
    og_image = DEFAULT_IMAGE
    songs = []
    if chart and chart.get("songs"):
        songs = chart["songs"][:5]
        if songs[0].get("artwork_url"):
            og_image = songs[0]["artwork_url"]

    canonical_url = f"{FRONTEND_URL}/chart/india"
    redirect_url = f"{FRONTEND_URL}/?chart=india"

    # Schema.org ItemList
    item_list = []
    for i, song in enumerate(songs):
        item_list.append({
            "@type": "ListItem",
            "position": i + 1,
            "item": {
                "@type": "MusicRecording",
                "name": song.get("title", "Unknown"),
                "byArtist": {
                    "@type": "MusicGroup",
                    "name": song.get("artist", "Unknown")
                }
            }
        })

    structured_data = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "India Top 25 Music Chart",
        "description": description,
        "numberOfItems": 25,
        "url": canonical_url,
        "itemListElement": item_list
    }

    return generate_seo_html(
        title="India Top 25 Music Chart",
        description=description,
        canonical_url=canonical_url,
        redirect_url=redirect_url,
        og_type="music.album",
        og_image=og_image,
        structured_data=structured_data
    )


@router.get("/chart/global", response_class=HTMLResponse)
async def seo_global_chart():
    """Global Top 25 chart landing page"""
    db = require_db()

    # Get current global chart
    chart = await db.charts.find_one({"chart_type": "global"}, sort=[("week_start", -1)])

    description = "Global Top 25 music chart. Aggregated from Spotify Global, Billboard Hot 100, and Apple Music Worldwide."

    og_image = DEFAULT_IMAGE
    songs = []
    if chart and chart.get("songs"):
        songs = chart["songs"][:5]
        if songs[0].get("artwork_url"):
            og_image = songs[0]["artwork_url"]

    canonical_url = f"{FRONTEND_URL}/chart/global"
    redirect_url = f"{FRONTEND_URL}/?chart=global"

    item_list = []
    for i, song in enumerate(songs):
        item_list.append({
            "@type": "ListItem",
            "position": i + 1,
            "item": {
                "@type": "MusicRecording",
                "name": song.get("title", "Unknown"),
                "byArtist": {
                    "@type": "MusicGroup",
                    "name": song.get("artist", "Unknown")
                }
            }
        })

    structured_data = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": "Global Top 25 Music Chart",
        "description": description,
        "numberOfItems": 25,
        "url": canonical_url,
        "itemListElement": item_list
    }

    return generate_seo_html(
        title="Global Top 25 Music Chart",
        description=description,
        canonical_url=canonical_url,
        redirect_url=redirect_url,
        og_type="music.album",
        og_image=og_image,
        structured_data=structured_data
    )


@router.get("/chart/{language}", response_class=HTMLResponse)
async def seo_regional_chart(language: str):
    """Regional chart landing page"""

    # Supported languages
    language_names = {
        "hindi": "Hindi",
        "punjabi": "Punjabi",
        "tamil": "Tamil",
        "telugu": "Telugu",
        "kannada": "Kannada",
        "malayalam": "Malayalam",
        "bengali": "Bengali",
        "marathi": "Marathi",
        "gujarati": "Gujarati",
    }

    if language.lower() not in language_names:
        raise HTTPException(status_code=404, detail="Chart not found")

    language_name = language_names[language.lower()]

    description = f"Top {language_name} songs chart. Discover the most popular {language_name} music trending in India."

    canonical_url = f"{FRONTEND_URL}/chart/{language.lower()}"
    redirect_url = f"{FRONTEND_URL}/?chart={language.lower()}"

    structured_data = {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "name": f"{language_name} Top Songs Chart",
        "description": description,
        "url": canonical_url
    }

    return generate_seo_html(
        title=f"{language_name} Top Songs Chart",
        description=description,
        canonical_url=canonical_url,
        redirect_url=redirect_url,
        og_type="music.album",
        structured_data=structured_data
    )


# ============== Song SEO ==============

@router.get("/s/{song_id}", response_class=HTMLResponse)
async def seo_song(song_id: str):
    """SEO-friendly song page"""
    db = require_db()

    # Fetch song from songs collection or from charts
    song = await db.songs.find_one({"_id": song_id})

    if not song:
        # Try to find in chart data
        chart = await db.charts.find_one(
            {"songs.youtube_video_id": song_id},
            {"songs.$": 1}
        )
        if chart and chart.get("songs"):
            song = chart["songs"][0]
            song["_id"] = song_id

    if not song:
        raise HTTPException(status_code=404, detail="Song not found")

    title = song.get("title", "Unknown Song")
    artist = song.get("artist", "Unknown Artist")
    description = f"Listen to {title} by {artist} on TLDR Music. Discover more trending songs."

    og_image = song.get("artwork_url") or song.get("artwork") or DEFAULT_IMAGE

    canonical_url = f"{FRONTEND_URL}/s/{song_id}"
    redirect_url = f"{FRONTEND_URL}/?song={song_id}"

    # Schema.org MusicRecording
    structured_data = {
        "@context": "https://schema.org",
        "@type": "MusicRecording",
        "name": title,
        "url": canonical_url,
        "image": og_image,
        "byArtist": {
            "@type": "MusicGroup",
            "name": artist
        }
    }

    if song.get("duration"):
        # Convert seconds to ISO 8601 duration
        duration_sec = song["duration"]
        mins = duration_sec // 60
        secs = duration_sec % 60
        structured_data["duration"] = f"PT{mins}M{secs}S"

    return generate_seo_html(
        title=f"{title} - {artist}",
        description=description,
        canonical_url=canonical_url,
        redirect_url=redirect_url,
        og_type="music.song",
        og_image=og_image,
        structured_data=structured_data
    )


# ============== Artist SEO ==============

@router.get("/a/{artist_id}", response_class=HTMLResponse)
async def seo_artist(artist_id: str):
    """SEO-friendly artist page"""
    db = require_db()

    artist = await db.artists.find_one({"_id": artist_id})

    if not artist:
        raise HTTPException(status_code=404, detail="Artist not found")

    name = artist.get("name", "Unknown Artist")
    description = f"Discover songs by {name} on TLDR Music. Listen to their top tracks and explore more music."

    og_image = artist.get("image") or artist.get("picture") or DEFAULT_IMAGE

    canonical_url = f"{FRONTEND_URL}/a/{artist_id}"
    redirect_url = f"{FRONTEND_URL}/?artist={artist_id}"

    # Schema.org MusicGroup
    structured_data = {
        "@context": "https://schema.org",
        "@type": "MusicGroup",
        "name": name,
        "url": canonical_url,
        "image": og_image
    }

    if artist.get("genres"):
        structured_data["genre"] = artist["genres"]

    return generate_seo_html(
        title=name,
        description=description,
        canonical_url=canonical_url,
        redirect_url=redirect_url,
        og_type="music.musician",
        og_image=og_image,
        structured_data=structured_data
    )


# ============== Sitemap ==============

@router.get("/sitemap.xml", response_class=PlainTextResponse)
async def sitemap():
    """Dynamic sitemap.xml"""
    db = require_db()

    urls = []

    # Static pages
    static_pages = [
        ("", "1.0", "daily"),  # Homepage
        ("/chart/india", "0.9", "daily"),
        ("/chart/global", "0.9", "daily"),
        ("/chart/hindi", "0.8", "weekly"),
        ("/chart/punjabi", "0.8", "weekly"),
        ("/chart/tamil", "0.8", "weekly"),
        ("/chart/telugu", "0.8", "weekly"),
    ]

    for path, priority, freq in static_pages:
        urls.append(f"""  <url>
    <loc>{FRONTEND_URL}{path}</loc>
    <changefreq>{freq}</changefreq>
    <priority>{priority}</priority>
  </url>""")

    # Public playlists
    playlists = await db.playlists.find(
        {"is_public": True},
        {"_id": 1, "updated_at": 1}
    ).limit(500).to_list(500)

    for playlist in playlists:
        lastmod = ""
        if playlist.get("updated_at"):
            lastmod = f"\n    <lastmod>{playlist['updated_at'].strftime('%Y-%m-%d')}</lastmod>"
        urls.append(f"""  <url>
    <loc>{FRONTEND_URL}/p/{playlist['_id']}</loc>{lastmod}
    <priority>0.5</priority>
  </url>""")

    # Songs from current chart
    chart = await db.charts.find_one({"chart_type": "india"}, sort=[("week_start", -1)])
    if chart and chart.get("songs"):
        for song in chart["songs"][:25]:
            video_id = song.get("youtube_video_id")
            if video_id:
                urls.append(f"""  <url>
    <loc>{FRONTEND_URL}/s/{video_id}</loc>
    <priority>0.6</priority>
  </url>""")

    sitemap_xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{chr(10).join(urls)}
</urlset>"""

    return PlainTextResponse(content=sitemap_xml, media_type="application/xml")


# ============== Robots.txt ==============

@router.get("/robots.txt", response_class=PlainTextResponse)
async def robots():
    """robots.txt file"""
    robots_txt = f"""User-agent: *
Allow: /
Allow: /p/
Allow: /s/
Allow: /a/
Allow: /u/
Allow: /chart/
Disallow: /api/
Disallow: /docs
Disallow: /redoc

Sitemap: {FRONTEND_URL}/sitemap.xml
"""
    return PlainTextResponse(content=robots_txt, media_type="text/plain")
