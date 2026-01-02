# TLDR Music - iOS App

Native iOS app for TLDR Music, connecting to the Music Conductor backend.

## 📱 Features

- **Bollywood Top 25 Charts**: Real-time aggregated charts from 5 platforms (YouTube Music, Spotify, Apple Music, Billboard, Shazam)
- **Advanced Search**: Search songs, albums, and artists with typo-tolerant matching
- **Playlists**: Curated mood, genre, and language-based playlists
- **YouTube Integration**: Play songs directly via YouTube
- **User Authentication**: Google Sign-In and Guest mode
- **Personalized Recommendations**: AI-powered discovery based on listening habits
- **Play History & Favorites**: Track your listening and save favorites

## 🏗️ Architecture

```
iOS App (Swift/SwiftUI)
    ↓ HTTPS API Calls
Music Conductor Backend (Cloud Run)
    ↓ MongoDB
Charts, Catalog, User Data
```

**Backend API**: `https://tldr-music-ncrhtdqoiq-el.a.run.app`

## 📂 Project Structure

```
iOS/TLDRMusic/
├── API/
│   └── MusicConductorAPI.swift     # API client (REST)
├── Models/
│   └── Models.swift                # Data models (Codable)
├── Views/
│   ├── ChartsView.swift            # Bollywood Top 25 screen
│   ├── SearchView.swift            # Search interface
│   └── MusicPlayerView.swift      # Player & YouTube integration
└── Documentation/
    ├── INTEGRATION_GUIDE.md        # Setup & implementation guide
    └── API_REFERENCE.md            # API endpoint documentation
```

## 🚀 Quick Start

### 1. Create Xcode Project

```bash
# Open Xcode and create a new project
# - Template: iOS → App
# - Interface: SwiftUI
# - Language: Swift
# - Bundle ID: com.yourcompany.tldrmusic
```

### 2. Add Files to Project

Copy the following files into your Xcode project:

- `API/MusicConductorAPI.swift`
- `Models/Models.swift`
- `Views/ChartsView.swift`
- `Views/SearchView.swift`
- `Views/MusicPlayerView.swift`

### 3. Add Dependencies

**Option A: Swift Package Manager (Recommended)**

In Xcode:
1. File → Add Package Dependencies
2. Add these packages:
   - **YouTubePlayerKit**: `https://github.com/SvenTiigi/YouTubePlayerKit.git`
   - **GoogleSignIn** (optional): `https://github.com/google/GoogleSignIn-iOS.git`

**Option B: CocoaPods**

```ruby
# Podfile
platform :ios, '15.0'

target 'TLDRMusic' do
  use_frameworks!

  pod 'YouTubePlayerKit'
  pod 'GoogleSignIn' # Optional
end
```

### 4. Update App Entry Point

```swift
// TLDRMusicApp.swift
import SwiftUI

@main
struct TLDRMusicApp: App {
    var body: some Scene {
        WindowGroup {
            TabView {
                ChartsView()
                    .tabItem {
                        Label("Charts", systemImage: "chart.bar")
                    }

                SearchView()
                    .tabItem {
                        Label("Search", systemImage: "magnifyingglass")
                    }

                // Add more tabs: Playlists, Library, Profile
            }
        }
    }
}
```

### 5. Test the App

Build and run:
1. Select a simulator (iPhone 15 Pro recommended)
2. Press ⌘R or click Run
3. Navigate to Charts tab to see Bollywood Top 25
4. Use Search tab to find songs

## 🔑 Authentication Setup

### Guest Mode (No Setup Required)

```swift
// Automatically creates a guest user
let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString
let authResponse = try await MusicConductorAPI.shared.signInAsGuest(deviceId: deviceId)
```

### Google Sign-In (Optional)

1. **Create OAuth Client ID**:
   - Go to [Google Cloud Console](https://console.cloud.google.com)
   - Create iOS OAuth Client ID
   - Get your `CLIENT_ID`

2. **Configure Xcode**:
   ```swift
   // Info.plist
   <key>GIDClientID</key>
   <string>YOUR_GOOGLE_CLIENT_ID</string>

   <key>CFBundleURLTypes</key>
   <array>
       <dict>
           <key>CFBundleURLSchemes</key>
           <array>
               <string>com.googleusercontent.apps.YOUR_CLIENT_ID</string>
           </array>
       </dict>
   </array>
   ```

3. **Implement Sign-In**:
   ```swift
   import GoogleSignIn

   GIDSignIn.sharedInstance.signIn(withPresenting: viewController) { result, error in
       guard let idToken = result?.user.idToken?.tokenString else { return }

       Task {
           let auth = try await MusicConductorAPI.shared.signInWithGoogle(idToken: idToken)
           print("Signed in: \(auth.user.displayName)")
       }
   }
   ```

## 🎵 YouTube Player Integration

**Install YouTubePlayerKit**:

```swift
import YouTubePlayerKit

struct PlayerView: View {
    @State var player = YouTubePlayer(source: .video(id: "dQw4w9WgXcQ"))

    var body: some View {
        YouTubePlayerView(player) { state in
            switch state {
            case .idle:
                ProgressView()
            case .ready:
                EmptyView()
            case .error(let error):
                Text("Error: \(error)")
            }
        }
        .frame(height: 300)
    }
}
```

## 📊 Key API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/charts/aggregated?region=india` | GET | Bollywood Top 25 |
| `/api/search/songs?q={query}` | GET | Search songs |
| `/api/search/suggest?q={prefix}` | GET | Autocomplete |
| `/api/playlists` | GET | All playlists |
| `/api/auth/google` | POST | Google Sign-In |
| `/api/auth/guest` | POST | Guest mode |
| `/api/library/favorites` | GET/POST | Favorites |
| `/api/behavior/play` | POST | Track play |

**See**: [API_REFERENCE.md](Documentation/API_REFERENCE.md) for complete documentation.

## 🛠️ Development Tips

### 1. Enable Offline Mode

Cache chart data using SwiftData:

```swift
@Model
class CachedChart {
    var chartId: String
    var data: Data
    var cachedAt: Date
}
```

### 2. Optimize Images

Use AsyncImage with caching:

```swift
AsyncImage(url: URL(string: artworkUrl)) { phase in
    // ... handle phases
}
.frame(width: 50, height: 50)
```

### 3. Handle Errors Gracefully

```swift
do {
    let chart = try await MusicConductorAPI.shared.fetchBollywoodTop25()
} catch APIError.unauthorized {
    // Show login screen
} catch {
    // Show error message
}
```

### 4. Track Analytics

```swift
// Track song play
try await MusicConductorAPI.shared.trackPlay(
    songId: song.id,
    youtubeId: song.youtubeVideoId,
    source: "ios_app"
)

// Track search
try await MusicConductorAPI.shared.trackSearch(query: "arijit singh")
```

## 📖 Documentation

- **[Integration Guide](Documentation/INTEGRATION_GUIDE.md)**: Complete setup instructions
- **[API Reference](Documentation/API_REFERENCE.md)**: Endpoint documentation
- **[Backend Docs](../docs/)**: Music Conductor backend docs

## 🐛 Troubleshooting

### "Invalid URL" Error
- Check that `baseURL` in `MusicConductorAPI.swift` is correct
- Ensure internet connection is active

### Charts Not Loading
- Verify API endpoint: `https://tldr-music-ncrhtdqoiq-el.a.run.app/api/charts/aggregated?region=india`
- Check backend status: `GET /health`

### YouTube Player Not Working
- Ensure YouTubePlayerKit is installed
- Verify YouTube video ID is valid

### Authentication Fails
- Check Google OAuth credentials
- Verify device ID is being generated

## 🚢 Production Deployment

### 1. App Store Submission

- Set version and build number
- Add app icons (all sizes)
- Create screenshots
- Write app description
- Submit for review

### 2. Performance Optimization

- Enable compiler optimizations (Release mode)
- Optimize images (WebP/HEIC format)
- Implement lazy loading for lists
- Cache API responses

### 3. Analytics & Monitoring

- Add Firebase Analytics
- Track user flows
- Monitor crash reports
- A/B test features

## 📝 License

This iOS app integrates with TLDR Music's Music Conductor backend.

## 🔗 Links

- **Backend API**: https://tldr-music-ncrhtdqoiq-el.a.run.app
- **Music Conductor Repo**: ../music-conductor/
- **Frontend (Web)**: ../index.html

---

Built with ❤️ using Swift & SwiftUI
