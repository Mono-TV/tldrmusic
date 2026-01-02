# Views Directory

All SwiftUI views for the TLDR Music iOS app.

## 📱 Main Views

### ChartsView.swift
**Displays Bollywood Top 25 charts**

Features:
- Live chart data from 5 platforms (YouTube Music, Spotify, Apple Music, Billboard, Shazam)
- Rank badges (Gold, Silver, Bronze for top 3)
- Platform indicators showing where each song is ranked
- Platform-specific scores and aggregate rankings
- Pull-to-refresh functionality
- Error handling with retry
- Navigation to detailed player view

Components:
- `ChartSongRow`: Individual song row with artwork, title, artist, platforms
- `PlatformBadge`: Small badge showing platform name (YT, Spotify, etc.)

API Integration:
```swift
MusicConductorAPI.shared.fetchBollywoodTop25()
```

---

### SearchView.swift
**Advanced search for songs, albums, and artists**

Features:
- Unified search across songs, albums, and artists
- Filter pills (All, Songs, Albums, Artists) with result counts
- Real-time search with async/await
- Empty state handling
- Navigation to song details
- Search results categorization

Components:
- `SearchSection`: Section header with title and count
- `FilterPill`: Category filter button with count badge
- `SearchEmptyState`: Empty state with helpful message
- `SongRow`: Song result row with artwork and metadata
- `AlbumRow`: Album result row
- `ArtistRow`: Artist result row with song count
- `SongDetailView`: Full song details with artwork and metadata
- `MetadataRow`: Key-value metadata display

API Integration:
```swift
MusicConductorAPI.shared.unifiedSearch(query: "arijit")
MusicConductorAPI.shared.searchSongs(query: "arijit", language: "hi")
MusicConductorAPI.shared.getSearchSuggestions(query: "ari")
```

---

### MusicPlayerView.swift
**Music player for chart songs**

Features:
- Large artwork display with rank overlay
- Platform rankings breakdown (each platform's individual rank)
- Chart statistics (score, platform count)
- YouTube integration placeholder
- Favorite button (add/remove from favorites)
- Play tracking

Components:
- `PlatformRankCard`: Shows individual platform rank
- `StatCard`: Displays statistics (score, platforms)
- `YouTubePlayerView`: YouTube player integration screen

API Integration:
```swift
MusicConductorAPI.shared.trackPlay(songId: songId, youtubeId: youtubeId)
MusicConductorAPI.shared.addToFavorites(songId: songId)
```

---

### PlaylistsView.swift
**Browse curated playlists by mood, genre, and language**

Features:
- Featured playlists carousel (horizontal scroll)
- Category filtering (All, Mood, Genre, Language)
- Grid layout for playlists (2 columns)
- Playlist details with full track list
- Track count and total duration display
- Pull-to-refresh functionality

Components:
- `FeaturedPlaylistCard`: Large horizontal card for featured playlists
- `PlaylistGridCard`: Square card for grid layout with category badge
- `CategoryButton`: Filter button with icon and selection state
- `PlaylistDetailView`: Full playlist with track listing
- `PlaylistTrackRow`: Individual track in playlist
- `ErrorView`: Reusable error view with retry button

API Integration:
```swift
MusicConductorAPI.shared.fetchPlaylists(homepageFeatured: true)
MusicConductorAPI.shared.fetchPlaylists(category: "mood")
MusicConductorAPI.shared.fetchPlaylist(id: playlistId)
```

Playlist Categories:
- **Mood**: Chill, Party, Workout, Focus, etc.
- **Genre**: Bollywood, Pop, Rock, Classical, etc.
- **Language**: Hindi, English, Punjabi, Tamil, etc.

---

### ProfileView.swift
**User profile, favorites, history, and settings**

Features:
- **Authenticated Profile**:
  - Profile photo from Google
  - Display name and email
  - User preferences (languages, genres)
  - Favorites section with horizontal scroll
  - Play history (recently played songs)
  - Sign out functionality

- **Guest Profile**:
  - Guest user indicator
  - Sign-in prompt
  - Limited functionality

- **Settings**:
  - Notifications settings
  - Downloads management
  - About section with version
  - Sign out button

Components:
- `AuthenticatedProfileHeader`: Profile header for signed-in users
- `GuestProfileHeader`: Profile header for guest users with sign-in button
- `DefaultProfileImage`: Gradient circle fallback for profile photo
- `FavoriteSongCard`: Compact card for favorite songs (140x140)
- `HistoryRow`: Recently played song row with timestamp
- `SettingsRow`: Settings option row with icon and subtitle
- `EmptyStateView`: Generic empty state component
- `SignInSheet`: Modal sheet for authentication
- `FavoritesListView`: Full list of all favorites (placeholder)
- `HistoryListView`: Full play history (placeholder)

API Integration:
```swift
MusicConductorAPI.shared.getFavorites()
MusicConductorAPI.shared.getPlayHistory(limit: 20)
MusicConductorAPI.shared.signInWithGoogle(idToken: idToken)
MusicConductorAPI.shared.signInAsGuest(deviceId: deviceId)
MusicConductorAPI.shared.logout()
```

---

## 🎨 Design Patterns

### State Management
All views use `@State` and `@StateObject` for local state:
- `@State private var isLoading = true`
- `@State private var errorMessage: String?`
- `@StateObject private var authManager = AuthManager.shared`

### Error Handling
Consistent error handling pattern:
```swift
do {
    let data = try await MusicConductorAPI.shared.fetchSomething()
    // Success
} catch {
    errorMessage = error.localizedDescription
    isLoading = false
}
```

### Async/Await
All API calls use modern async/await:
```swift
.task {
    await loadData()
}
```

### Pull to Refresh
Standard SwiftUI refreshable modifier:
```swift
.refreshable {
    await loadData()
}
```

### Navigation
NavigationLink for view transitions:
```swift
NavigationLink(destination: DetailView(id: id)) {
    RowView(item: item)
}
.buttonStyle(PlainButtonStyle())
```

---

## 🎯 Common Components

### AsyncImage Pattern
Consistent image loading with phases:
```swift
AsyncImage(url: URL(string: imageUrl)) { phase in
    switch phase {
    case .success(let image):
        image.resizable()...
    case .failure, .empty:
        PlaceholderView()
    @unknown default:
        EmptyView()
    }
}
```

### Loading States
Three-state pattern:
1. Loading: `ProgressView()`
2. Error: `ErrorView(message:retry:)`
3. Success: Content view

### Empty States
Informative empty states:
- Icon (SF Symbol)
- Title (what's missing)
- Message (what to do)

---

## 🔗 View Relationships

```
MainTabView (TLDRMusicApp.swift)
├── ChartsView
│   └── MusicPlayerView
│       └── YouTubePlayerView
├── SearchView
│   └── SongDetailView
│       └── YouTubePlayerView
├── PlaylistsView
│   └── PlaylistDetailView
│       └── PlaylistTrackRow
└── ProfileView
    ├── SignInSheet
    ├── FavoritesListView
    └── HistoryListView
```

---

## 📝 Usage Examples

### Basic Navigation
```swift
NavigationView {
    ChartsView()
}
```

### With Tab Bar
```swift
TabView {
    ChartsView()
        .tabItem { Label("Charts", systemImage: "chart.bar.fill") }

    SearchView()
        .tabItem { Label("Search", systemImage: "magnifyingglass") }
}
```

### With Environment Object
```swift
ProfileView()
    .environmentObject(AuthManager.shared)
```

---

## 🚀 Next Steps

Additional views to implement:
- [ ] Detailed song view with full metadata
- [ ] Album detail view
- [ ] Artist detail view with discography
- [ ] Search filters view
- [ ] Settings detail views (notifications, downloads)
- [ ] Onboarding flow
- [ ] Now Playing mini player (persistent bottom bar)
- [ ] Queue management view

---

## 💡 Best Practices

1. **Keep views focused**: Each view should have a single responsibility
2. **Extract reusable components**: Create subviews for repeated UI patterns
3. **Use composition**: Build complex views from simple components
4. **Handle all states**: Loading, error, empty, and success states
5. **Provide feedback**: Loading indicators, error messages, success confirmations
6. **Test on different devices**: iPhone SE, iPhone 15 Pro, iPad
7. **Support Dark Mode**: All views use semantic colors
8. **Accessibility**: Use proper labels and hints for VoiceOver

---

Built with SwiftUI for iOS 15.0+
