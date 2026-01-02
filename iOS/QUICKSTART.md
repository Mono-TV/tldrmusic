# iOS App - Quick Start Guide

Get your iOS app running in **5 minutes**!

## 📱 What You're Building

A native iOS app that displays:
- **Bollywood Top 25** charts (updated daily)
- **Search** millions of songs
- **Play music** via YouTube
- **Playlists** curated by mood and genre

## ⚡ Quick Setup

### 1. Create Xcode Project (2 min)

```bash
# Open Xcode
# File → New → Project → iOS → App

# Settings:
# - Interface: SwiftUI
# - Language: Swift
# - Storage: None (or SwiftData)
```

### 2. Add Package (1 min)

In Xcode:
- File → Add Package Dependencies
- Enter: `https://github.com/SvenTiigi/YouTubePlayerKit.git`
- Add Package

### 3. Copy Files (1 min)

Copy these 3 files into your Xcode project:

```
TLDRMusic/API/MusicConductorAPI.swift
TLDRMusic/Models/Models.swift
TLDRMusic/Views/ChartsView.swift
```

### 4. Update App Entry (1 min)

Replace `ContentView` with `ChartsView`:

```swift
// YourApp.swift
import SwiftUI

@main
struct TLDRMusicApp: App {
    var body: some Scene {
        WindowGroup {
            ChartsView()  // ← Change this line
        }
    }
}
```

### 5. Run! (30 sec)

Press **⌘R** and see the Bollywood Top 25 chart load!

---

## 🎯 Next Steps

### Add More Views

Create a tab view with multiple screens:

```swift
// TLDRMusicApp.swift
var body: some Scene {
    WindowGroup {
        TabView {
            ChartsView()
                .tabItem { Label("Charts", systemImage: "chart.bar") }

            SearchView()
                .tabItem { Label("Search", systemImage: "magnifyingglass") }
        }
    }
}
```

Copy `SearchView.swift` and `MusicPlayerView.swift` for the search feature.

### Enable Authentication (Optional)

**Guest Mode** (No setup):
```swift
let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
let auth = try await MusicConductorAPI.shared.signInAsGuest(deviceId: deviceId)
```

**Google Sign-In**:
1. Add package: `https://github.com/google/GoogleSignIn-iOS.git`
2. Get OAuth credentials from [Google Cloud Console](https://console.cloud.google.com)
3. See [Integration Guide](TLDRMusic/Documentation/INTEGRATION_GUIDE.md) for details

---

## 📚 Full Documentation

- **[README.md](README.md)**: Complete overview
- **[Integration Guide](TLDRMusic/Documentation/INTEGRATION_GUIDE.md)**: Step-by-step setup
- **[API Reference](TLDRMusic/Documentation/API_REFERENCE.md)**: All endpoints

---

## 🔍 Key Features Available

### Charts
- Bollywood Top 25 (updated daily)
- Aggregated from 5 platforms
- Platform rankings & scores

### Search
- 1M+ songs searchable
- Typo-tolerant matching
- Filter by language, genre, year

### Playlists
- Mood-based (Chill, Party, Workout)
- Genre-based (Bollywood, Pop, Rock)
- Language-based (Hindi, English, Punjabi)

### Discovery
- Trending songs (24h, 7d)
- Personalized radio
- AI-powered recommendations

### User Features (Requires Auth)
- Favorites
- Play history
- Personalized search

---

## 🛠️ Troubleshooting

**Charts not loading?**
- Check internet connection
- Test API: `https://tldr-music-ncrhtdqoiq-el.a.run.app/api/charts/aggregated?region=india`

**Build errors?**
- Clean build folder: `⌘⇧K`
- Rebuild: `⌘B`

**YouTube player not working?**
- Ensure YouTubePlayerKit is installed
- Check video ID is valid

---

**Ready to build?** Start with [README.md](README.md) or jump into the code!

---

**Backend API**: `https://tldr-music-ncrhtdqoiq-el.a.run.app`
**Web App**: `https://mono-tv.github.io/tldrmusic/`
