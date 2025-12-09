#!/usr/bin/env python3
"""Debug script to investigate page structures for scrapers."""

import asyncio
import sys
from playwright.async_api import async_playwright

SITES = {
    "billboard": "https://www.billboard.com/charts/india-songs-hotw/",
    "youtube_music": "https://charts.youtube.com/charts/TrendingVideos/in/weekly",
    "gaana": "https://gaana.com/charts/top-songs/weekly",
    "jiosaavn": "https://www.jiosaavn.com/featured/trending-today/I3kvhipIy73uCJW60TJk1Q__",
    "prime_music": "https://music.amazon.in/popular/songs",
}


async def debug_site(site_name: str):
    """Debug a single site to find correct selectors."""
    url = SITES.get(site_name)
    if not url:
        print(f"Unknown site: {site_name}")
        return

    print(f"\n{'='*60}")
    print(f"Debugging: {site_name.upper()}")
    print(f"URL: {url}")
    print(f"{'='*60}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        )
        page = await context.new_page()

        try:
            print(f"\nNavigating (timeout: 90s)...")
            await page.goto(url, wait_until="domcontentloaded", timeout=90000)

            # Wait a bit for JS to render
            print("Waiting for JS to render...")
            await page.wait_for_timeout(5000)

            # Get page title
            title = await page.title()
            print(f"Page title: {title}")

            # Try to find common song/track elements
            selectors_to_try = [
                # Billboard
                "div.o-chart-results-list-row-container",
                "ul.lrv-a-unstyle-list li",
                "[class*='chart']",
                # YouTube Music
                "ytmc-entry-row",
                "table tbody tr",
                "[class*='chart-row']",
                # Gaana
                "div.track-item",
                "div._track",
                "article.track",
                "[class*='track']",
                "[class*='song']",
                # JioSaavn
                "article.song-wrap",
                "figure.song-wrap",
                "li[data-type='song']",
                "[class*='song-']",
                "section[class*='song']",
                # Prime Music / Amazon
                "music-vertical-item",
                "[class*='TrackList']",
                "[class*='track-']",
                # Generic
                "li",
                "tr",
                "article",
            ]

            print("\n--- Checking selectors ---")
            for selector in selectors_to_try:
                try:
                    elements = await page.query_selector_all(selector)
                    if elements and len(elements) > 0:
                        print(f"✓ '{selector}' → {len(elements)} elements")
                        # Get first element's text
                        if len(elements) > 0:
                            text = await elements[0].inner_text()
                            text_preview = text[:100].replace('\n', ' ')
                            print(f"  First element text: {text_preview}...")
                except:
                    pass

            # Save HTML for manual inspection
            html = await page.content()
            filename = f"debug_{site_name}.html"
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(html)
            print(f"\nSaved HTML to {filename}")

        except Exception as e:
            print(f"Error: {e}")

        await browser.close()


async def main():
    site = sys.argv[1] if len(sys.argv) > 1 else None

    if site:
        await debug_site(site)
    else:
        # Debug all failing sites
        for site_name in ["billboard", "youtube_music", "gaana", "jiosaavn", "prime_music"]:
            await debug_site(site_name)


if __name__ == "__main__":
    asyncio.run(main())
