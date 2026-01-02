# iOS App Integration Guide

Complete guide for integrating TLDR Music with the Music Conductor backend.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Project Setup](#project-setup)
3. [API Integration](#api-integration)
4. [Authentication](#authentication)
5. [YouTube Player](#youtube-player)
6. [UI Implementation](#ui-implementation)
7. [Testing](#testing)
8. [Production Deployment](#production-deployment)

---

## Prerequisites

### Required Tools

- **Xcode 15.0+** (latest stable version)
- **iOS 15.0+** deployment target
- **Swift 5.9+**
- **macOS Ventura 13.0+**

### Optional Tools

- CocoaPods (if not using SPM)
- Fastlane (for automated deployment)

### Backend Requirements

- Music Conductor API running at: `https://tldr-music-ncrhtdqoiq-el.a.run.app`
- Valid internet connection for API calls

---

## Project Setup

### 1. Create New Xcode Project

```bash
# Open Xcode
# File → New → Project
# Select: iOS → App
```

**Configuration:**
- **Product Name**: TLDR Music
- **Team**: Your Apple Developer Team
- **Organization Identifier**: `com.yourcompany`
- **Bundle Identifier**: `com.yourcompany.tldrmusic`
- **Interface**: SwiftUI
- **Language**: Swift
- **Storage**: SwiftData (optional)

### 2. Project Structure

Create the following folder structure in Xcode:

```
TLDRMusic/
├── App/
│   ├── TLDRMusicApp.swift
│   └── ContentView.swift
├── API/
│   └── MusicConductorAPI.swift
├── Models/
│   └── Models.swift
├── Views/
│   ├── Charts/
│   │   ├── ChartsView.swift
│   │   └── ChartDetailView.swift
│   ├── Search/
│   │   └── SearchView.swift
│   ├── Player/
│   │   └── MusicPlayerView.swift
│   ├── Playlists/
│   │   └── PlaylistsView.swift
│   └── Profile/
│       └── ProfileView.swift
├── ViewModels/
│   ├── ChartsViewModel.swift
│   └── SearchViewModel.swift
└── Utilities/
    ├── Extensions.swift
    └── Constants.swift
```

### 3. Add Package Dependencies

**File → Add Package Dependencies**

Add these packages:

| Package | URL | Version |
|---------|-----|---------|
| YouTubePlayerKit | `https://github.com/SvenTiigi/YouTubePlayerKit.git` | 1.7.0+ |
| GoogleSignIn (optional) | `https://github.com/google/GoogleSignIn-iOS.git` | 7.0.0+ |

**In Package.swift** (if using SPM):

```swift
dependencies: [
    .package(url: "https://github.com/SvenTiigi/YouTubePlayerKit.git", from: "1.7.0"),
    .package(url: "https://github.com/google/GoogleSignIn-iOS.git", from: "7.0.0")
]
```

### 4. Configure Info.plist

Add the following keys:

```xml
<!-- Info.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- App Transport Security -->
    <key>NSAppTransportSecurity</key>
    <dict>
        <key>NSAllowsArbitraryLoads</key>
        <false/>
        <key>NSExceptionDomains</key>
        <dict>
            <key>tldr-music-ncrhtdqoiq-el.a.run.app</key>
            <dict>
                <key>NSExceptionAllowsInsecureHTTPLoads</key>
                <false/>
                <key>NSIncludesSubdomains</key>
                <true/>
            </dict>
        </dict>
    </dict>

    <!-- Google Sign-In (if using) -->
    <key>GIDClientID</key>
    <string>YOUR_GOOGLE_CLIENT_ID</string>

    <key>CFBundleURLTypes</key>
    <array>
        <dict>
            <key>CFBundleURLSchemes</key>
            <array>
                <string>com.googleusercontent.apps.YOUR_REVERSED_CLIENT_ID</string>
            </array>
        </dict>
    </array>
</dict>
</plist>
```

---

## API Integration

### 1. Copy API Client

Copy `MusicConductorAPI.swift` into your project's `API/` folder.

**Verify Configuration:**

```swift
// In MusicConductorAPI.swift
private let baseURL = "https://tldr-music-ncrhtdqoiq-el.a.run.app"
```

### 2. Copy Models

Copy `Models.swift` into your project's `Models/` folder.

### 3. Test API Connection

Create a test view to verify API connectivity:

```swift
// TestAPIView.swift
import SwiftUI

struct TestAPIView: View {
    @State private var status = "Testing..."

    var body: some View {
        VStack {
            Text(status)
                .padding()

            Button("Test API") {
                Task {
                    await testAPI()
                }
            }
        }
        .task {
            await testAPI()
        }
    }

    func testAPI() async {
        do {
            let chart = try await MusicConductorAPI.shared.fetchBollywoodTop25()
            status = "✅ API Working! Found \(chart.totalSongs) songs"
        } catch {
            status = "❌ Error: \(error.localizedDescription)"
        }
    }
}
```

Run this view first to ensure backend connectivity.

---

## Authentication

### Option 1: Guest Mode (Simplest)

No setup required. Automatically creates an anonymous user.

```swift
// AuthManager.swift
import Foundation

class AuthManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?

    func signInAsGuest() async throws {
        let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString

        let authResponse = try await MusicConductorAPI.shared.signInAsGuest(deviceId: deviceId)

        DispatchQueue.main.async {
            self.currentUser = authResponse.user
            self.isAuthenticated = true
        }
    }
}
```

**Usage:**

```swift
// ContentView.swift
@StateObject private var authManager = AuthManager()

var body: some View {
    if authManager.isAuthenticated {
        MainTabView()
    } else {
        WelcomeView(authManager: authManager)
    }
}
```

### Option 2: Google Sign-In

**1. Get OAuth Credentials**

- Go to [Google Cloud Console](https://console.cloud.google.com)
- Create a new project or select existing
- Enable **Google Sign-In API**
- Create **iOS OAuth Client ID**:
  - Application type: iOS
  - Bundle ID: `com.yourcompany.tldrmusic`
- Download the `GoogleService-Info.plist`

**2. Configure Xcode**

Add `GoogleService-Info.plist` to your project.

Update `Info.plist`:

```xml
<key>GIDClientID</key>
<string>YOUR_CLIENT_ID_HERE.apps.googleusercontent.com</string>

<key>CFBundleURLTypes</key>
<array>
    <dict>
        <key>CFBundleURLSchemes</key>
        <array>
            <string>com.googleusercontent.apps.YOUR_REVERSED_CLIENT_ID</string>
        </array>
    </dict>
</array>
```

**3. Implement Sign-In**

```swift
// GoogleAuthManager.swift
import GoogleSignIn
import SwiftUI

class GoogleAuthManager: ObservableObject {
    @Published var isAuthenticated = false
    @Published var currentUser: User?

    func signInWithGoogle() async throws {
        // Get the root view controller
        guard let windowScene = UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = windowScene.windows.first?.rootViewController else {
            throw AuthError.noViewController
        }

        // Sign in with Google
        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: rootViewController)

        guard let idToken = result.user.idToken?.tokenString else {
            throw AuthError.noIDToken
        }

        // Authenticate with backend
        let authResponse = try await MusicConductorAPI.shared.signInWithGoogle(idToken: idToken)

        DispatchQueue.main.async {
            self.currentUser = authResponse.user
            self.isAuthenticated = true
        }
    }

    func signOut() {
        GIDSignIn.sharedInstance.signOut()
        Task {
            try? await MusicConductorAPI.shared.logout()
        }

        DispatchQueue.main.async {
            self.isAuthenticated = false
            self.currentUser = nil
        }
    }
}

enum AuthError: Error {
    case noViewController
    case noIDToken
}
```

**4. Sign-In UI**

```swift
// SignInView.swift
import SwiftUI

struct SignInView: View {
    @EnvironmentObject var authManager: GoogleAuthManager
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 20) {
            Text("TLDR Music")
                .font(.largeTitle)
                .fontWeight(.bold)

            Text("Discover trending Bollywood music")
                .foregroundColor(.secondary)

            Spacer()

            Button {
                Task {
                    await signIn()
                }
            } label: {
                HStack {
                    Image(systemName: "g.circle.fill")
                    Text("Sign in with Google")
                }
                .frame(maxWidth: .infinity)
                .padding()
                .background(Color.blue)
                .foregroundColor(.white)
                .cornerRadius(12)
            }
            .disabled(isLoading)

            if let error = errorMessage {
                Text(error)
                    .foregroundColor(.red)
                    .font(.caption)
            }
        }
        .padding()
    }

    func signIn() async {
        isLoading = true
        errorMessage = nil

        do {
            try await authManager.signInWithGoogle()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}
```

---

## YouTube Player

### 1. Install YouTubePlayerKit

Already added via SPM in Project Setup step.

### 2. Implement Player

```swift
// YouTubePlayerView.swift
import SwiftUI
import YouTubePlayerKit

struct YouTubePlayerView: View {
    let youtubeId: String
    let song: ChartSong

    @State private var player: YouTubePlayer
    @State private var isPlaying = false

    init(youtubeId: String, song: ChartSong) {
        self.youtubeId = youtubeId
        self.song = song
        self._player = State(initialValue: YouTubePlayer(
            source: .video(id: youtubeId),
            configuration: .init(
                autoPlay: true,
                showControls: true
            )
        ))
    }

    var body: some View {
        VStack(spacing: 20) {
            // Song artwork
            AsyncImage(url: URL(string: song.artworkUrl ?? "")) { image in
                image
                    .resizable()
                    .aspectRatio(contentMode: .fill)
            } placeholder: {
                ProgressView()
            }
            .frame(width: 300, height: 300)
            .cornerRadius(12)

            // Song info
            VStack {
                Text(song.title)
                    .font(.title2)
                    .fontWeight(.bold)

                Text(song.artist)
                    .foregroundColor(.secondary)
            }

            // YouTube player (hidden, audio only)
            YouTubePlayerView(player) { state in
                switch state {
                case .idle:
                    ProgressView()
                case .ready:
                    EmptyView()
                case .error(let error):
                    Text("Error: \(error.localizedDescription)")
                        .foregroundColor(.red)
                }
            }
            .frame(height: 0) // Hide video, keep audio

            // Playback controls
            HStack(spacing: 40) {
                Button {
                    player.pause()
                    isPlaying = false
                } label: {
                    Image(systemName: "pause.fill")
                        .font(.largeTitle)
                }

                Button {
                    player.play()
                    isPlaying = true
                } label: {
                    Image(systemName: "play.fill")
                        .font(.largeTitle)
                }
            }
        }
        .padding()
        .onAppear {
            // Track play event
            Task {
                try? await MusicConductorAPI.shared.trackPlay(
                    songId: String(song.rank),
                    youtubeId: youtubeId
                )
            }
        }
    }
}
```

---

## UI Implementation

### 1. Main Tab View

```swift
// MainTabView.swift
import SwiftUI

struct MainTabView: View {
    var body: some View {
        TabView {
            ChartsView()
                .tabItem {
                    Label("Charts", systemImage: "chart.bar.fill")
                }

            SearchView()
                .tabItem {
                    Label("Search", systemImage: "magnifyingglass")
                }

            PlaylistsView()
                .tabItem {
                    Label("Playlists", systemImage: "music.note.list")
                }

            ProfileView()
                .tabItem {
                    Label("Profile", systemImage: "person.fill")
                }
        }
    }
}
```

### 2. Copy View Files

Copy the provided view files into your project:
- `ChartsView.swift` → `Views/Charts/`
- `SearchView.swift` → `Views/Search/`
- `MusicPlayerView.swift` → `Views/Player/`

### 3. Customize Theme (Optional)

```swift
// Theme.swift
import SwiftUI

struct AppTheme {
    static let primaryColor = Color.blue
    static let accentColor = Color.red

    static func apply() {
        UITabBar.appearance().backgroundColor = UIColor.systemBackground
        UINavigationBar.appearance().largeTitleTextAttributes = [
            .foregroundColor: UIColor.label
        ]
    }
}
```

Apply in app entry point:

```swift
// TLDRMusicApp.swift
@main
struct TLDRMusicApp: App {
    init() {
        AppTheme.apply()
    }

    var body: some Scene {
        WindowGroup {
            ContentView()
        }
    }
}
```

---

## Testing

### 1. Unit Tests

Create test target and add tests:

```swift
// APITests.swift
import XCTest
@testable import TLDRMusic

final class APITests: XCTestCase {
    func testFetchCharts() async throws {
        let chart = try await MusicConductorAPI.shared.fetchBollywoodTop25()

        XCTAssertEqual(chart.region, "india")
        XCTAssertGreaterThan(chart.songs.count, 0)
        XCTAssertEqual(chart.songs.count, chart.totalSongs)
    }

    func testSearchSongs() async throws {
        let results = try await MusicConductorAPI.shared.searchSongs(query: "arijit")

        XCTAssertGreaterThan(results.found, 0)
        XCTAssertFalse(results.songs.isEmpty)
    }
}
```

Run tests: `⌘U`

### 2. UI Tests

```swift
// UITests.swift
import XCTest

final class TLDRMusicUITests: XCTestCase {
    func testChartsLoad() throws {
        let app = XCUIApplication()
        app.launch()

        // Tap Charts tab
        app.tabBars.buttons["Charts"].tap()

        // Wait for chart to load
        let firstSong = app.tables.cells.element(boundBy: 0)
        XCTAssertTrue(firstSong.waitForExistence(timeout: 5))
    }

    func testSearch() throws {
        let app = XCUIApplication()
        app.launch()

        // Tap Search tab
        app.tabBars.buttons["Search"].tap()

        // Type in search field
        let searchField = app.searchFields.firstMatch
        searchField.tap()
        searchField.typeText("arijit")

        // Wait for results
        let firstResult = app.tables.cells.element(boundBy: 0)
        XCTAssertTrue(firstResult.waitForExistence(timeout: 5))
    }
}
```

---

## Production Deployment

### 1. App Store Preparation

**Update Version & Build**:
```
Version: 1.0.0
Build: 1
```

**Add App Icons**:
- Required sizes: 1024×1024, 180×180, 120×120, 87×87, 80×80, 60×60, 58×58, 40×40, 29×29
- Use SF Symbols or custom designs

**Create Screenshots**:
- 6.7" (iPhone 15 Pro Max): 1290×2796
- 6.5" (iPhone 14 Plus): 1242×2688
- 5.5" (iPhone 8 Plus): 1242×2208

### 2. App Store Connect

1. Create app in [App Store Connect](https://appstoreconnect.apple.com)
2. Fill in metadata:
   - Name: TLDR Music
   - Subtitle: Bollywood Charts & Music
   - Category: Music
   - Description: See below

**Description Template**:

```
Discover the best of Bollywood music with TLDR Music!

FEATURES:
• Bollywood Top 25 charts updated daily
• Aggregated rankings from YouTube Music, Spotify, Apple Music, and more
• Search millions of songs with instant results
• Curated playlists for every mood
• Play songs directly via YouTube
• Save your favorite tracks
• Personalized recommendations

Stay up-to-date with the latest trending Bollywood hits!
```

3. Upload screenshots
4. Submit for review

### 3. Archive & Upload

```bash
# In Xcode
# 1. Select "Any iOS Device (arm64)" as target
# 2. Product → Archive
# 3. Window → Organizer
# 4. Select archive → Distribute App
# 5. Choose "App Store Connect"
# 6. Upload
```

### 4. TestFlight (Optional)

Distribute beta builds via TestFlight:
- Add internal testers (up to 100)
- Add external testers (up to 10,000)
- Collect feedback before public release

---

## Troubleshooting

### API Issues

**Problem**: "Invalid URL" error
- **Solution**: Verify `baseURL` in `MusicConductorAPI.swift`

**Problem**: Charts not loading
- **Solution**: Check internet connection, test endpoint in browser

### Authentication Issues

**Problem**: Google Sign-In fails
- **Solution**: Verify OAuth credentials in Google Cloud Console
- Check `GIDClientID` in Info.plist

### YouTube Player Issues

**Problem**: Video won't play
- **Solution**: Verify YouTubePlayerKit is installed
- Check YouTube video ID is valid

---

## Next Steps

1. ✅ Implement additional features (Playlists, Profile)
2. ✅ Add offline mode with local caching
3. ✅ Integrate Firebase Analytics
4. ✅ Add push notifications for new charts
5. ✅ Implement Apple Music integration

---

**Questions?** Check the [API Reference](API_REFERENCE.md) or backend documentation.
