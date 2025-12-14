# TLDR Music - Scrapers Package

from .billboard import BillboardScraper
from .youtube_music import YouTubeMusicScraper
from .gaana import GaanaScraper
from .jiosaavn import JioSaavnScraper
from .spotify import SpotifyScraper
from .apple_music import AppleMusicScraper
from .prime_music import PrimeMusicScraper
from .shazam import ShazamScraper
from .spotify_viral import SpotifyViralScraper
from .regional import (
    TamilChartsScraper,
    TeluguChartsScraper,
    PunjabiChartsScraper,
    HindiChartsScraper,
)
from .youtube_language import (
    BhojpuriChartsScraper,
    HaryanviChartsScraper,
    BengaliChartsScraper,
    MarathiChartsScraper,
    KannadaChartsScraper,
    MalayalamChartsScraper,
    GujaratiChartsScraper,
)
from .global_charts import (
    SpotifyGlobalScraper,
    BillboardHot100Scraper,
    AppleMusicGlobalScraper,
)

__all__ = [
    # India platforms
    "BillboardScraper",
    "YouTubeMusicScraper",
    "GaanaScraper",
    "JioSaavnScraper",
    "SpotifyScraper",
    "AppleMusicScraper",
    "PrimeMusicScraper",
    "ShazamScraper",
    "SpotifyViralScraper",
    # Regional (India)
    "TamilChartsScraper",
    "TeluguChartsScraper",
    "PunjabiChartsScraper",
    "HindiChartsScraper",
    "BhojpuriChartsScraper",
    "HaryanviChartsScraper",
    "BengaliChartsScraper",
    "MarathiChartsScraper",
    "KannadaChartsScraper",
    "MalayalamChartsScraper",
    "GujaratiChartsScraper",
    # Global platforms
    "SpotifyGlobalScraper",
    "BillboardHot100Scraper",
    "AppleMusicGlobalScraper",
]
