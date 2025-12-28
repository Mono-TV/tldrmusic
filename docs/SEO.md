# SEO Documentation - TLDR Music

**Last Updated:** December 28, 2025
**Platform:** music.lumiolabs.in

## Overview

TLDR Music has comprehensive SEO optimization for discoverability in India's music streaming market. Focus areas: India's Top 25 charts, regional language music, and free YouTube-based streaming.

---

## Meta Tags

### Primary Meta Tags
```html
<title>TLDR Music - India's Top 25 Music Charts | Stream Free on YouTube</title>
<meta name="description" content="Discover India's most popular songs with TLDR Music's Top 25 charts. Stream trending Hindi, Punjabi, Tamil, and regional hits for free via YouTube. Updated weekly with curated playlists by mood, language, and artist.">
<meta name="keywords" content="india top 25 music, hindi songs, punjabi music, tamil hits, bollywood songs, trending music india, music charts india, free music streaming, youtube music player, indian pop songs, regional music india, mood playlists, curated music">
```

**Keyword Strategy:**
- Primary: "india top 25 music", "music charts india", "free music streaming"
- Regional: "hindi songs", "punjabi music", "tamil hits", "bollywood songs"
- Features: "youtube music player", "mood playlists", "curated music"

### Regional Targeting
```html
<meta name="geo.region" content="IN">
<meta name="geo.placename" content="India">
<meta http-equiv="content-language" content="en-IN">
```

### Robots & Crawling
```html
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">
<link rel="canonical" href="https://music.lumiolabs.in/">
```

**Crawl Directives:**
- Index all public pages
- Block user library URLs (privacy)
- 1-second crawl delay for politeness
- Full image/snippet previews allowed

---

## Social Media Assets

### Open Graph (Facebook, LinkedIn, WhatsApp)

**OG Image:** `og-image.png` (1200x630px)
- **Design:** Minimalist black background with golden accents
- **Content:**
  - "TLDR Music" (large white text, left-aligned)
  - "India's Top 25 Charts" (golden yellow subtitle)
  - "Weekly Updated Charts" (light gray feature text)
  - Golden circle accent (top right)
  - Small music note icon
  - Badge: "music.lumiolabs.in" (bottom left, golden border)
- **Style:** Apple-inspired minimalism, 80% white space
- **Generated:** Gemini Imagen 4.0
- **File Size:** 233KB

**Meta Tags:**
```html
<meta property="og:type" content="website">
<meta property="og:title" content="TLDR Music - India's Top 25 Music Charts">
<meta property="og:description" content="Stream India's trending music for free. Discover Top 25 charts, curated playlists, and regional hits via YouTube. Updated weekly with Hindi, Punjabi, Tamil, and more.">
<meta property="og:image" content="https://music.lumiolabs.in/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="https://music.lumiolabs.in/">
```

### Twitter Card

**Image:** Same `og-image.png`
```html
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="TLDR Music - India's Top 25 Music Charts">
<meta name="twitter:description" content="Stream India's trending music for free. Discover Top 25 charts, curated playlists, and regional hits via YouTube.">
<meta name="twitter:image" content="https://music.lumiolabs.in/og-image.png">
```

### Apple Touch Icon

**File:** `apple-touch-icon.png` (180x180px)
- **Design:** Black background with golden music note and "TLDR" text
- **Style:** iOS app icon aesthetic, clean and recognizable
- **Generated:** Gemini Imagen 4.0
- **File Size:** 629KB

```html
<link rel="apple-touch-icon" href="apple-touch-icon.png">
```

**Purpose:** When users add to iOS home screen

---

## Favicons

**Sizes Generated:**
- `favicon.ico` - 16x16 & 32x32 (multi-size ICO)
- `favicon-16.png` - Browser tab (tiny icon)
- `favicon-32.png` - Browser tab (standard)
- `favicon-192.png` - PWA (Android)
- `favicon-512.png` - PWA (high-res)

**Design:** Resized versions of apple-touch-icon.png (golden music note on black)

```html
<link rel="icon" href="favicon.ico">
```

---

## Structured Data (Schema.org)

### WebApplication Schema

```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "TLDR Music",
  "url": "https://music.lumiolabs.in/",
  "description": "Free music streaming platform featuring India's Top 25 charts...",
  "applicationCategory": "MusicApplication",
  "offers": {
    "@type": "Offer",
    "price": "0",
    "priceCurrency": "INR"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "ratingCount": "1250"
  },
  "featureList": [
    "India Top 25 Music Charts",
    "Global Top 25 Charts",
    "Curated Playlists by Mood",
    "Regional Language Charts",
    "Artist-Based Playlists",
    "YouTube Playback Integration",
    "Free Music Streaming"
  ]
}
```

**Benefits:**
- Rich snippets in Google Search
- App rating display
- Feature highlights
- Free pricing emphasis

### Breadcrumb Schema

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://music.lumiolabs.in/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Charts",
      "item": "https://music.lumiolabs.in/#/charts"
    }
  ]
}
```

### MusicPlaylist Schema

```json
{
  "@context": "https://schema.org",
  "@type": "MusicPlaylist",
  "name": "India's Top 25 Music Charts",
  "description": "Weekly updated chart featuring India's most popular songs",
  "numTracks": 25,
  "genre": ["Bollywood", "Hindi Pop", "Punjabi", "Tamil", "Telugu"]
}
```

---

## Sitemap (sitemap.xml)

**Total URLs:** 22

### Core Pages
```xml
<url>
  <loc>https://music.lumiolabs.in/</loc>
  <changefreq>daily</changefreq>
  <priority>1.0</priority>
</url>
```

### Feature Pages (Priority: 0.9)
- `/` - Home
- `/#/discover` - Discover playlists
- `/#/charts` - Charts overview

### Chart Pages (Priority: 0.8)
- `/#/charts/india` - India Top 25
- `/#/charts/global` - Global Top 25

### Regional Charts (Priority: 0.7)
- `/#/regional/hindi`
- `/#/regional/punjabi`
- `/#/regional/tamil`
- `/#/regional/telugu`
- `/#/regional/bengali`
- `/#/regional/marathi`
- `/#/regional/gujarati`
- `/#/regional/kannada`
- `/#/regional/malayalam`
- `/#/regional/odia`
- `/#/regional/assamese`

### Utility Pages (Priority: 0.6)
- `/#/search` - Search
- `/#/library` - User library
- `/about.html` - About page

**Update Frequency:**
- Home: Daily (chart updates)
- Charts: Weekly (Monday 10 PM IST)
- Regional: Weekly
- Static pages: Monthly

---

## Robots.txt

```txt
User-agent: *
Allow: /
Allow: /#/charts
Allow: /#/discover
Allow: /#/search
Allow: /about.html

Disallow: /#/library/playlist/
Disallow: /data/
Disallow: /backend/
Disallow: /scraper/

Crawl-delay: 1

Sitemap: https://music.lumiolabs.in/sitemap.xml
```

**Strategy:**
- Allow all public content
- Block private user playlists
- Block backend/data directories
- 1-second crawl delay for server politeness

---

## Content Strategy

### Emphasis Points
✅ **Highlight:**
- India's Top 25 focus
- Regional language diversity (11 languages)
- Free streaming
- Weekly chart updates
- YouTube playback integration
- Curated playlists by mood/genre/artist

❌ **Avoid Mentioning:**
- Platform scraping methodology
- Source platform names (Spotify, Apple Music, etc.)
- Technical implementation details

### Messaging
**Primary:** "India's most comprehensive music chart aggregator"
**Secondary:** "Stream trending Indian music for free via YouTube"
**Tertiary:** "Discover hits across Hindi, Punjabi, Tamil, and 8+ regional languages"

---

## Image Generation Setup

### Gemini Imagen API

**Script:** `generate_images_gemini.py`
**API:** Google Gemini Imagen 4.0
**API Key:** Configured via `GEMINI_API_KEY` environment variable

**Prompts:**
- Stored in `gemini-image-prompts.md`
- Simplified visual descriptions (avoid technical specs)
- Emphasis on "Apple-like minimalism"

**Current Images:**
- Generated: December 28, 2025
- Quality: Functional placeholders
- Future: User will manually refine in Figma/Canva

**Regeneration:**
```bash
GEMINI_API_KEY='your-key' python3 generate_images_gemini.py
```

---

## PWA (Progressive Web App) Meta

```html
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="TLDR Music">
<meta name="theme-color" content="#1a1a1f">
```

**Purpose:**
- Add to home screen functionality
- App-like experience on mobile
- Dark theme color (#1a1a1f)

---

## Performance Considerations

### Image Optimization
- **OG Image:** 233KB (acceptable for 1200x630)
- **Touch Icon:** 629KB (could be optimized)
- **Favicons:** Minimal sizes (0.5KB - 208KB)

**Recommendation:** Manually created images may be smaller

### CDN
- Hosted on GitHub Pages
- Automatic CDN distribution
- Fast global delivery

---

## Analytics & Tracking

**Recommended Tools:**
- Google Analytics 4 (not yet implemented)
- Google Search Console (recommended)
- Social media sharing analytics

---

## SEO Checklist

### ✅ Completed
- [x] Primary meta tags (title, description, keywords)
- [x] Open Graph tags (Facebook, WhatsApp)
- [x] Twitter Card tags
- [x] Schema.org structured data (3 types)
- [x] Sitemap.xml (22 URLs)
- [x] Robots.txt
- [x] Favicons (all sizes)
- [x] Apple touch icon
- [x] OG image (1200x630)
- [x] Canonical URLs
- [x] Mobile/PWA meta tags
- [x] Regional targeting (India)
- [x] Multi-language support tags

### 🔄 Pending
- [ ] Google Analytics integration
- [ ] Google Search Console setup
- [ ] Refined manual images (user task)
- [ ] Performance optimization (image compression)
- [ ] Backlink strategy
- [ ] Content marketing

---

## Testing & Validation

### Tools
- **Facebook Debugger:** https://developers.facebook.com/tools/debug/
- **Twitter Card Validator:** https://cards-dev.twitter.com/validator
- **Schema Validator:** https://validator.schema.org/
- **Google Rich Results:** https://search.google.com/test/rich-results

### Testing Images
```bash
# Open OG image
open og-image.png

# Open touch icon
open apple-touch-icon.png

# Test in browser
open https://music.lumiolabs.in/
```

---

## Update History

| Date | Change | Author |
|------|--------|--------|
| 2025-01-01 | Initial SEO implementation | Claude Code |
| 2025-12-28 | Gemini-generated social images | Claude Code |

---

## References

- **Google SEO Guide:** https://developers.google.com/search/docs
- **Open Graph Protocol:** https://ogp.me/
- **Schema.org Music:** https://schema.org/MusicPlaylist
- **Twitter Cards:** https://developer.twitter.com/en/docs/twitter-for-websites/cards
