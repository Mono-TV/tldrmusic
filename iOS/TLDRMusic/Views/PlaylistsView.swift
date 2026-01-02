//
//  PlaylistsView.swift
//  TLDR Music
//
//  Browse curated playlists by mood, genre, and language
//

import SwiftUI

struct PlaylistsView: View {
    @State private var playlists: [PlaylistSummary] = []
    @State private var featuredPlaylists: [PlaylistSummary] = []
    @State private var isLoading = true
    @State private var errorMessage: String?
    @State private var selectedCategory: PlaylistCategory = .all

    enum PlaylistCategory: String, CaseIterable {
        case all = "All"
        case mood = "Mood"
        case genre = "Genre"
        case language = "Language"

        var systemImage: String {
            switch self {
            case .all: return "music.note.list"
            case .mood: return "face.smiling"
            case .genre: return "guitars"
            case .language: return "globe"
            }
        }
    }

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                if isLoading {
                    ProgressView("Loading playlists...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if let error = errorMessage {
                    ErrorView(message: error) {
                        Task {
                            await loadPlaylists()
                        }
                    }
                } else {
                    ScrollView {
                        VStack(spacing: 24) {
                            // Featured Playlists
                            if !featuredPlaylists.isEmpty {
                                VStack(alignment: .leading, spacing: 12) {
                                    Text("Featured")
                                        .font(.title2)
                                        .fontWeight(.bold)
                                        .padding(.horizontal)

                                    ScrollView(.horizontal, showsIndicators: false) {
                                        LazyHStack(spacing: 16) {
                                            ForEach(featuredPlaylists) { playlist in
                                                NavigationLink(destination: PlaylistDetailView(playlistId: playlist.id)) {
                                                    FeaturedPlaylistCard(playlist: playlist)
                                                }
                                                .buttonStyle(PlainButtonStyle())
                                            }
                                        }
                                        .padding(.horizontal)
                                    }
                                }
                            }

                            // Category Filter
                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 12) {
                                    ForEach(PlaylistCategory.allCases, id: \.self) { category in
                                        CategoryButton(
                                            category: category,
                                            isSelected: selectedCategory == category
                                        ) {
                                            selectedCategory = category
                                        }
                                    }
                                }
                                .padding(.horizontal)
                            }

                            // Playlists Grid
                            LazyVGrid(columns: [
                                GridItem(.flexible(), spacing: 16),
                                GridItem(.flexible(), spacing: 16)
                            ], spacing: 16) {
                                ForEach(filteredPlaylists) { playlist in
                                    NavigationLink(destination: PlaylistDetailView(playlistId: playlist.id)) {
                                        PlaylistGridCard(playlist: playlist)
                                    }
                                    .buttonStyle(PlainButtonStyle())
                                }
                            }
                            .padding(.horizontal)
                            .padding(.bottom, 20)
                        }
                        .padding(.top)
                    }
                    .refreshable {
                        await loadPlaylists()
                    }
                }
            }
            .navigationTitle("Playlists")
            .navigationBarTitleDisplayMode(.large)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        Task {
                            await loadPlaylists()
                        }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .disabled(isLoading)
                }
            }
        }
        .task {
            await loadPlaylists()
        }
    }

    private var filteredPlaylists: [PlaylistSummary] {
        guard selectedCategory != .all else {
            return playlists
        }

        return playlists.filter { $0.category == selectedCategory.rawValue.lowercased() }
    }

    private func loadPlaylists() async {
        isLoading = true
        errorMessage = nil

        do {
            // Load all playlists
            let response = try await MusicConductorAPI.shared.fetchPlaylists()
            playlists = response.playlists

            // Load featured playlists
            let featuredResponse = try await MusicConductorAPI.shared.fetchPlaylists(homepageFeatured: true)
            featuredPlaylists = featuredResponse.playlists

            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }
}

// MARK: - Featured Playlist Card

struct FeaturedPlaylistCard: View {
    let playlist: PlaylistSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Artwork
            ZStack(alignment: .bottomLeading) {
                if let artworkUrl = playlist.artwork?.primary {
                    AsyncImage(url: URL(string: artworkUrl)) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(contentMode: .fill)
                                .frame(width: 280, height: 180)
                                .clipped()
                        case .failure, .empty:
                            Rectangle()
                                .fill(Color.gray.opacity(0.3))
                                .frame(width: 280, height: 180)
                                .overlay(
                                    Image(systemName: "music.note")
                                        .font(.largeTitle)
                                        .foregroundColor(.secondary)
                                )
                        @unknown default:
                            EmptyView()
                        }
                    }
                } else {
                    Rectangle()
                        .fill(LinearGradient(
                            colors: [.blue.opacity(0.6), .purple.opacity(0.6)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))
                        .frame(width: 280, height: 180)
                        .overlay(
                            Image(systemName: "music.note")
                                .font(.largeTitle)
                                .foregroundColor(.white.opacity(0.8))
                        )
                }

                // Gradient overlay
                LinearGradient(
                    colors: [.clear, .black.opacity(0.7)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: 180)

                // Track count badge
                HStack {
                    Image(systemName: "music.note.list")
                        .font(.caption2)
                    Text("\(playlist.totalTracks) tracks")
                        .font(.caption)
                        .fontWeight(.medium)
                }
                .foregroundColor(.white)
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(.ultraThinMaterial)
                .cornerRadius(12)
                .padding(8)
            }
            .frame(width: 280, height: 180)
            .cornerRadius(12)
            .shadow(radius: 5)

            // Playlist info
            VStack(alignment: .leading, spacing: 4) {
                Text(playlist.name)
                    .font(.headline)
                    .foregroundColor(.primary)
                    .lineLimit(1)

                Text(playlist.description)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(2)
            }
            .frame(width: 280)
        }
    }
}

// MARK: - Playlist Grid Card

struct PlaylistGridCard: View {
    let playlist: PlaylistSummary

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Artwork
            ZStack(alignment: .topTrailing) {
                if let artworkUrl = playlist.artwork?.primary {
                    AsyncImage(url: URL(string: artworkUrl)) { phase in
                        switch phase {
                        case .success(let image):
                            image
                                .resizable()
                                .aspectRatio(1, contentMode: .fill)
                        case .failure, .empty:
                            Rectangle()
                                .fill(Color.gray.opacity(0.3))
                                .aspectRatio(1, contentMode: .fit)
                                .overlay(
                                    Image(systemName: "music.note")
                                        .font(.title)
                                        .foregroundColor(.secondary)
                                )
                        @unknown default:
                            EmptyView()
                        }
                    }
                } else {
                    Rectangle()
                        .fill(LinearGradient(
                            colors: [.blue.opacity(0.6), .purple.opacity(0.6)],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))
                        .aspectRatio(1, contentMode: .fit)
                        .overlay(
                            Image(systemName: categoryIcon(playlist.category))
                                .font(.title)
                                .foregroundColor(.white.opacity(0.8))
                        )
                }

                // Category badge
                Text(playlist.category.capitalized)
                    .font(.caption2)
                    .fontWeight(.semibold)
                    .foregroundColor(.white)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(categoryColor(playlist.category))
                    .cornerRadius(8)
                    .padding(6)
            }
            .cornerRadius(12)
            .shadow(radius: 3)

            // Playlist info
            VStack(alignment: .leading, spacing: 4) {
                Text(playlist.name)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundColor(.primary)
                    .lineLimit(1)

                HStack(spacing: 4) {
                    Image(systemName: "music.note")
                        .font(.caption2)
                    Text("\(playlist.totalTracks)")
                        .font(.caption)
                }
                .foregroundColor(.secondary)
            }
        }
    }

    private func categoryIcon(_ category: String) -> String {
        switch category.lowercased() {
        case "mood": return "face.smiling"
        case "genre": return "guitars"
        case "language": return "globe"
        default: return "music.note"
        }
    }

    private func categoryColor(_ category: String) -> Color {
        switch category.lowercased() {
        case "mood": return .orange
        case "genre": return .purple
        case "language": return .blue
        default: return .gray
        }
    }
}

// MARK: - Category Button

struct CategoryButton: View {
    let category: PlaylistsView.PlaylistCategory
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 6) {
                Image(systemName: category.systemImage)
                    .font(.caption)
                Text(category.rawValue)
                    .font(.subheadline)
                    .fontWeight(isSelected ? .semibold : .regular)
            }
            .foregroundColor(isSelected ? .white : .primary)
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
            .background(isSelected ? Color.blue : Color.gray.opacity(0.15))
            .cornerRadius(20)
        }
    }
}

// MARK: - Playlist Detail View

struct PlaylistDetailView: View {
    let playlistId: String

    @State private var playlist: PlaylistFull?
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Loading playlist...")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            } else if let error = errorMessage {
                ErrorView(message: error) {
                    Task {
                        await loadPlaylist()
                    }
                }
            } else if let playlist = playlist {
                ScrollView {
                    VStack(spacing: 20) {
                        // Header
                        VStack(spacing: 16) {
                            // Artwork
                            if let artworkUrl = playlist.artwork?.primary {
                                AsyncImage(url: URL(string: artworkUrl)) { phase in
                                    switch phase {
                                    case .success(let image):
                                        image
                                            .resizable()
                                            .aspectRatio(contentMode: .fill)
                                            .frame(width: 250, height: 250)
                                            .cornerRadius(12)
                                            .shadow(radius: 10)
                                    case .failure, .empty:
                                        Rectangle()
                                            .fill(Color.gray.opacity(0.3))
                                            .frame(width: 250, height: 250)
                                            .cornerRadius(12)
                                    @unknown default:
                                        EmptyView()
                                    }
                                }
                            }

                            VStack(spacing: 8) {
                                Text(playlist.name)
                                    .font(.title)
                                    .fontWeight(.bold)
                                    .multilineTextAlignment(.center)

                                Text(playlist.description)
                                    .font(.subheadline)
                                    .foregroundColor(.secondary)
                                    .multilineTextAlignment(.center)

                                HStack(spacing: 16) {
                                    Label("\(playlist.totalTracks) songs", systemImage: "music.note.list")
                                    Label(formatDuration(playlist.totalDurationMs), systemImage: "clock")
                                }
                                .font(.caption)
                                .foregroundColor(.secondary)
                            }
                            .padding(.horizontal)
                        }
                        .padding(.top)

                        // Play All button
                        Button {
                            // Play all tracks
                        } label: {
                            HStack {
                                Image(systemName: "play.fill")
                                Text("Play All")
                            }
                            .font(.headline)
                            .foregroundColor(.white)
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.blue)
                            .cornerRadius(12)
                        }
                        .padding(.horizontal)

                        Divider()

                        // Track list
                        VStack(alignment: .leading, spacing: 0) {
                            Text("Songs")
                                .font(.headline)
                                .padding(.horizontal)
                                .padding(.bottom, 8)

                            ForEach(playlist.tracks) { track in
                                if let youtubeId = track.youtubeId,
                                   let title = track.title,
                                   let artist = track.artist {
                                    PlaylistTrackRow(
                                        position: track.position,
                                        title: title,
                                        artist: artist,
                                        artworkUrl: track.artworkUrl,
                                        durationMs: track.durationMs
                                    )

                                    Divider()
                                        .padding(.leading, 70)
                                }
                            }
                        }
                    }
                }
                .refreshable {
                    await loadPlaylist()
                }
            }
        }
        .navigationTitle(playlist?.name ?? "Playlist")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadPlaylist()
        }
    }

    private func loadPlaylist() async {
        isLoading = true
        errorMessage = nil

        do {
            playlist = try await MusicConductorAPI.shared.fetchPlaylist(id: playlistId)
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }

    private func formatDuration(_ ms: Int) -> String {
        let totalSeconds = ms / 1000
        let hours = totalSeconds / 3600
        let minutes = (totalSeconds % 3600) / 60

        if hours > 0 {
            return "\(hours)h \(minutes)m"
        } else {
            return "\(minutes) min"
        }
    }
}

// MARK: - Playlist Track Row

struct PlaylistTrackRow: View {
    let position: Int
    let title: String
    let artist: String
    let artworkUrl: String?
    let durationMs: Int?

    var body: some View {
        HStack(spacing: 12) {
            // Position number
            Text("\(position)")
                .font(.subheadline)
                .foregroundColor(.secondary)
                .frame(width: 30, alignment: .trailing)

            // Artwork
            if let artworkUrl = artworkUrl {
                AsyncImage(url: URL(string: artworkUrl)) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 40, height: 40)
                            .cornerRadius(6)
                    case .failure, .empty:
                        Rectangle()
                            .fill(Color.gray.opacity(0.3))
                            .frame(width: 40, height: 40)
                            .cornerRadius(6)
                    @unknown default:
                        EmptyView()
                    }
                }
            } else {
                Rectangle()
                    .fill(Color.gray.opacity(0.3))
                    .frame(width: 40, height: 40)
                    .cornerRadius(6)
            }

            // Song info
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline)
                    .foregroundColor(.primary)
                    .lineLimit(1)

                Text(artist)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            // Duration
            if let durationMs = durationMs {
                Text(formatTrackDuration(durationMs))
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            // More button
            Button {
                // Show options
            } label: {
                Image(systemName: "ellipsis")
                    .foregroundColor(.secondary)
            }
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    private func formatTrackDuration(_ ms: Int) -> String {
        let totalSeconds = ms / 1000
        let minutes = totalSeconds / 60
        let seconds = totalSeconds % 60
        return String(format: "%d:%02d", minutes, seconds)
    }
}

// MARK: - Error View

struct ErrorView: View {
    let message: String
    let retry: () -> Void

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 50))
                .foregroundColor(.orange)

            Text("Error loading playlists")
                .font(.headline)

            Text(message)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Button("Retry") {
                retry()
            }
            .buttonStyle(.borderedProminent)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

#Preview {
    PlaylistsView()
}
