#!/usr/bin/env python3
"""Debug JioSaavn with stealth settings."""

import asyncio
from playwright.async_api import async_playwright


async def debug_jiosaavn():
    """Try to scrape JioSaavn with stealth settings."""
    url = "https://www.jiosaavn.com/featured/trending-today/I3kvhipIy73uCJW60TJk1Q__"

    print(f"\n{'='*60}")
    print("Debugging JioSaavn with stealth settings")
    print(f"{'='*60}")

    async with async_playwright() as p:
        # Launch with more realistic settings
        browser = await p.chromium.launch(
            headless=True,
            args=[
                '--disable-blink-features=AutomationControlled',
                '--no-sandbox',
                '--disable-dev-shm-usage',
            ]
        )

        # Create context with realistic browser fingerprint
        context = await browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            locale='en-IN',
            timezone_id='Asia/Kolkata',
            geolocation={'latitude': 28.6139, 'longitude': 77.2090},  # Delhi
            permissions=['geolocation'],
        )

        # Add stealth scripts
        await context.add_init_script("""
            // Override navigator.webdriver
            Object.defineProperty(navigator, 'webdriver', {
                get: () => undefined
            });

            // Override chrome
            window.chrome = {
                runtime: {}
            };

            // Override permissions
            const originalQuery = window.navigator.permissions.query;
            window.navigator.permissions.query = (parameters) => (
                parameters.name === 'notifications' ?
                    Promise.resolve({ state: Notification.permission }) :
                    originalQuery(parameters)
            );
        """)

        page = await context.new_page()

        try:
            print(f"\nNavigating to {url}...")
            await page.goto(url, wait_until="domcontentloaded", timeout=60000)

            # Wait longer for JS
            print("Waiting for page to load...")
            await page.wait_for_timeout(8000)

            # Check page title
            title = await page.title()
            print(f"Page title: {title}")

            if "Access Denied" in title or "blocked" in title.lower():
                print("Still blocked!")

                # Save screenshot
                await page.screenshot(path="jiosaavn_blocked.png")
                print("Saved screenshot to jiosaavn_blocked.png")
            else:
                print("Page loaded successfully!")

                # Try to find song elements
                selectors = [
                    "li.song-wrap",
                    "article.song-wrap",
                    "figure[data-type='song']",
                    ".o-list-1 li",
                    "[class*='song']",
                    ".u-centi",
                    "figcaption",
                ]

                for selector in selectors:
                    elements = await page.query_selector_all(selector)
                    if elements:
                        print(f"✓ '{selector}' → {len(elements)} elements")
                        if elements:
                            text = await elements[0].inner_text()
                            print(f"  First: {text[:80]}...")

                # Save HTML
                html = await page.content()
                with open("jiosaavn_debug.html", "w") as f:
                    f.write(html)
                print("Saved HTML to jiosaavn_debug.html")

        except Exception as e:
            print(f"Error: {e}")

        await browser.close()


if __name__ == "__main__":
    asyncio.run(debug_jiosaavn())
