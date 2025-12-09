# TLDR Music - Configuration

import os

# YouTube API Configuration
# Uses environment variable if set (for GitHub Actions), otherwise falls back to default
YOUTUBE_API_KEY = os.environ.get("YOUTUBE_API_KEY", "AIzaSyDWU-r2TlBWZgihFBkJHY73zC4Azm8_dOk")
YOUTUBE_MUSIC_TOPIC_ID = "/m/04rlf"  # Music topic for filtered search

# Platform Weights for Ranking Algorithm
# Higher weight = more influence on final ranking
PLATFORM_WEIGHTS = {
    # Primary platforms (major streaming services)
    "apple_music": 1.5,
    "spotify": 1.5,
    "billboard": 1.2,
    "youtube_music": 1.0,
    "jiosaavn": 1.0,
    "gaana": 0.8,
    "prime_music": 0.7,
    # Discovery & viral platforms
    "shazam": 1.1,           # Discovery-focused, good signal
    "spotify_viral": 0.9,    # Viral/emerging songs
    # Regional platforms (lower weight to avoid regional bias)
    "tamil": 0.6,
    "telugu": 0.6,
    "punjabi": 0.6,
    "hindi": 0.7,
    # YouTube Language Charts (regional)
    "bhojpuri": 0.5,
    "haryanvi": 0.5,
    "bengali": 0.5,
    "marathi": 0.5,
    "kannada": 0.5,
    "malayalam": 0.5,
    "gujarati": 0.5,
}

# Chart URLs
CHART_URLS = {
    "billboard": "https://www.billboard.com/charts/india-songs-hotw/",
    "youtube_music": "https://charts.youtube.com/charts/TrendingVideos/in/weekly",
    "gaana": "https://gaana.com/charts/top-songs/weekly",
    "jiosaavn": "https://www.jiosaavn.com/featured/trending-today/I3kvhipIy73uCJW60TJk1Q__",
    "spotify": "https://open.spotify.com/playlist/37i9dQZEVXbLZ52XmnySJg",
    "apple_music": "https://music.apple.com/in/new/top-charts/songs",
    "prime_music": "https://music.amazon.in/popular/songs",
    "shazam": "https://www.shazam.com/charts/top-200/india",
    "spotify_viral": "https://open.spotify.com/playlist/37i9dQZEVXbMWDif5SCBJq",
    "tamil": "https://open.spotify.com/playlist/37i9dQZF1DX6XceWZP1znY",
    "telugu": "https://open.spotify.com/playlist/37i9dQZF1DWTyiBJ6yEqeu",
    "punjabi": "https://open.spotify.com/playlist/37i9dQZF1DX5cZuAHLNjGz",
    "hindi": "https://open.spotify.com/playlist/37i9dQZF1DXd8cOUiye2V6",
    # YouTube Language Charts
    "bhojpuri": "https://charts.youtube.com/charts/TopLanguageVideos/in/weekly/bho",
    "haryanvi": "https://charts.youtube.com/charts/TopLanguageVideos/in/weekly/bgc",
    "bengali": "https://charts.youtube.com/charts/TopLanguageVideos/in/weekly/bn",
    "marathi": "https://charts.youtube.com/charts/TopLanguageVideos/in/weekly/mr",
    "kannada": "https://charts.youtube.com/charts/TopLanguageVideos/in/weekly/kn",
    "malayalam": "https://charts.youtube.com/charts/TopLanguageVideos/in/weekly/ml",
    "gujarati": "https://charts.youtube.com/charts/TopLanguageVideos/in/weekly/gu",
}

# Chart Configuration
MAX_SONGS_PER_PLATFORM = 50  # Max songs to scrape from each platform
FINAL_CHART_SIZE = 25  # Top N songs in final consolidated chart

# File Paths (relative to frontend directory - main.py goes up one level first)
DATA_DIR = "data"
CURRENT_CHART_FILE = "current.json"
ARCHIVE_DIR = "data/archive"

# Cache Configuration
YOUTUBE_CACHE_FILE = "data/youtube_cache.json"
