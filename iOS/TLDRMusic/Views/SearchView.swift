//
//  SearchView.swift
//  TLDR Music
//
//  Search for songs, albums, and artists
//

import SwiftUI

struct SearchView: View {
    @State private var searchText = ""
    @State private var searchResults: UnifiedSearchResponse?
    @State private var isSearching = false
    @State private var selectedFilter: SearchFilter = .all

    enum SearchFilter: String, CaseIterable {
        case all = "All"
        case songs = "Songs"
        case albums = "Albums"
        case artists = "Artists"
    }

    var body: some View {
        NavigationView {
            VStack(spacing: 0) {
                // Filter pills
                if !searchText.isEmpty {
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 12) {
                            ForEach(SearchFilter.allCases, id: \.self) { filter in
                                FilterPill(
                                    title: filter.rawValue,
                                    count: countForFilter(filter),
                                    isSelected: selectedFilter == filter
                                ) {
                                    selectedFilter = filter
                                }
                            }
                        }
                        .padding(.horizontal)
                        .padding(.vertical, 8)
                    }
                    .background(Color(uiColor: .systemBackground))

                    Divider()
                }

                // Results
                if isSearching {
                    ProgressView("Searching...")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else if searchText.isEmpty {
                    SearchEmptyState()
                } else if let results = searchResults {
                    ScrollView {
                        LazyVStack(spacing: 16) {
                            // Songs
                            if shouldShowSongs {
                                SearchSection(title: "Songs", count: results.songsTotal) {
                                    ForEach(results.songs) { song in
                                        NavigationLink(destination: SongDetailView(song: song)) {
                                            SongRow(song: song)
                                        }
                                        .buttonStyle(PlainButtonStyle())
                                    }
                                }
                            }

                            // Albums
                            if shouldShowAlbums {
                                SearchSection(title: "Albums", count: results.albumsTotal) {
                                    ForEach(results.albums) { album in
                                        AlbumRow(album: album)
                                    }
                                }
                            }

                            // Artists
                            if shouldShowArtists {
                                SearchSection(title: "Artists", count: results.artistsTotal) {
                                    ForEach(results.artists) { artist in
                                        ArtistRow(artist: artist)
                                    }
                                }
                            }
                        }
                        .padding()
                    }
                } else {
                    SearchEmptyState()
                }
            }
            .navigationTitle("Search")
            .searchable(text: $searchText, prompt: "Search songs, artists, albums...")
            .onChange(of: searchText) { oldValue, newValue in
                Task {
                    await performSearch(query: newValue)
                }
            }
        }
    }

    private var shouldShowSongs: Bool {
        selectedFilter == .all || selectedFilter == .songs
    }

    private var shouldShowAlbums: Bool {
        selectedFilter == .all || selectedFilter == .albums
    }

    private var shouldShowArtists: Bool {
        selectedFilter == .all || selectedFilter == .artists
    }

    private func countForFilter(_ filter: SearchFilter) -> Int {
        guard let results = searchResults else { return 0 }

        switch filter {
        case .all:
            return results.songsTotal + results.albumsTotal + results.artistsTotal
        case .songs:
            return results.songsTotal
        case .albums:
            return results.albumsTotal
        case .artists:
            return results.artistsTotal
        }
    }

    func performSearch(query: String) async {
        guard !query.isEmpty else {
            searchResults = nil
            return
        }

        isSearching = true

        do {
            let results = try await MusicConductorAPI.shared.unifiedSearch(query: query)
            searchResults = results
        } catch {
            print("Search error: \(error)")
        }

        isSearching = false
    }
}

struct SearchSection<Content: View>: View {
    let title: String
    let count: Int
    @ViewBuilder let content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title)
                    .font(.title2)
                    .fontWeight(.bold)

                Text("(\(count))")
                    .font(.caption)
                    .foregroundColor(.secondary)

                Spacer()
            }

            content
        }
    }
}

struct FilterPill: View {
    let title: String
    let count: Int
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 4) {
                Text(title)
                    .fontWeight(isSelected ? .semibold : .regular)

                if count > 0 {
                    Text("\(count)")
                        .font(.caption2)
                        .padding(.horizontal, 6)
                        .padding(.vertical, 2)
                        .background(isSelected ? Color.white.opacity(0.3) : Color.gray.opacity(0.2))
                        .cornerRadius(8)
                }
            }
            .font(.subheadline)
            .foregroundColor(isSelected ? .white : .primary)
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(isSelected ? Color.blue : Color.gray.opacity(0.15))
            .cornerRadius(20)
        }
    }
}

struct SearchEmptyState: View {
    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "magnifyingglass")
                .font(.system(size: 60))
                .foregroundColor(.secondary)

            Text("Search for songs, artists, and albums")
                .font(.headline)
                .foregroundColor(.secondary)

            Text("Try searching for \"Arijit Singh\" or \"Shape of You\"")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct SongRow: View {
    let song: Song

    var body: some View {
        HStack(spacing: 12) {
            // Artwork
            AsyncImage(url: URL(string: song.artworkUrl ?? "")) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 50, height: 50)
                        .cornerRadius(8)
                case .failure, .empty:
                    Image(systemName: "music.note")
                        .font(.title3)
                        .foregroundColor(.secondary)
                        .frame(width: 50, height: 50)
                        .background(Color.gray.opacity(0.2))
                        .cornerRadius(8)
                @unknown default:
                    EmptyView()
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(song.title)
                    .font(.headline)
                    .lineLimit(1)
                    .foregroundColor(.primary)

                Text(song.artistName)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(1)

                if let album = song.albumName {
                    Text(album)
                        .font(.caption)
                        .foregroundColor(.secondary)
                        .lineLimit(1)
                }
            }

            Spacer()

            if song.youtubeVideoId != nil {
                Image(systemName: "play.circle.fill")
                    .foregroundColor(.red)
            }
        }
        .padding(.vertical, 4)
    }
}

struct AlbumRow: View {
    let album: Album

    var body: some View {
        HStack(spacing: 12) {
            // Artwork
            AsyncImage(url: URL(string: album.artworkUrl ?? "")) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 50, height: 50)
                        .cornerRadius(8)
                case .failure, .empty:
                    Image(systemName: "rectangle.stack")
                        .font(.title3)
                        .foregroundColor(.secondary)
                        .frame(width: 50, height: 50)
                        .background(Color.gray.opacity(0.2))
                        .cornerRadius(8)
                @unknown default:
                    EmptyView()
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(album.name)
                    .font(.headline)
                    .lineLimit(1)

                Text(album.artistName)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(1)

                if let trackCount = album.trackCount {
                    Text("\(trackCount) tracks")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
            }

            Spacer()
        }
        .padding(.vertical, 4)
    }
}

struct ArtistRow: View {
    let artist: Artist

    var body: some View {
        HStack(spacing: 12) {
            // Artwork
            AsyncImage(url: URL(string: artist.sampleArtwork ?? "")) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 50, height: 50)
                        .clipShape(Circle())
                case .failure, .empty:
                    Image(systemName: "person.circle.fill")
                        .font(.system(size: 50))
                        .foregroundColor(.secondary)
                @unknown default:
                    EmptyView()
                }
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(artist.artistName)
                    .font(.headline)
                    .lineLimit(1)

                Text("\(artist.songCount) songs")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }

            Spacer()
        }
        .padding(.vertical, 4)
    }
}

struct SongDetailView: View {
    let song: Song

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Large artwork
                AsyncImage(url: URL(string: song.artworkUrl ?? "")) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 300, height: 300)
                            .cornerRadius(12)
                            .shadow(radius: 10)
                    case .failure, .empty:
                        Image(systemName: "music.note")
                            .font(.system(size: 80))
                            .foregroundColor(.secondary)
                            .frame(width: 300, height: 300)
                            .background(Color.gray.opacity(0.2))
                            .cornerRadius(12)
                    @unknown default:
                        EmptyView()
                    }
                }

                // Song info
                VStack(spacing: 8) {
                    Text(song.title)
                        .font(.title)
                        .fontWeight(.bold)
                        .multilineTextAlignment(.center)

                    Text(song.artistName)
                        .font(.title3)
                        .foregroundColor(.secondary)

                    if let album = song.albumName {
                        Text(album)
                            .font(.body)
                            .foregroundColor(.secondary)
                    }
                }

                // Metadata
                VStack(alignment: .leading, spacing: 12) {
                    if let language = song.language {
                        MetadataRow(label: "Language", value: language)
                    }

                    if !song.genres.isEmpty {
                        MetadataRow(label: "Genres", value: song.genres.joined(separator: ", "))
                    }

                    if let duration = song.durationSeconds {
                        let minutes = duration / 60
                        let seconds = duration % 60
                        MetadataRow(label: "Duration", value: String(format: "%d:%02d", minutes, seconds))
                    }
                }
                .padding()
                .background(Color.gray.opacity(0.1))
                .cornerRadius(12)

                // Play button
                if let youtubeId = song.youtubeVideoId {
                    NavigationLink(destination: YouTubePlayerView(youtubeId: youtubeId, song: song)) {
                        HStack {
                            Image(systemName: "play.fill")
                            Text("Play on YouTube")
                        }
                        .font(.headline)
                        .foregroundColor(.white)
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(Color.red)
                        .cornerRadius(12)
                    }
                }
            }
            .padding()
        }
        .navigationTitle("Song Details")
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct MetadataRow: View {
    let label: String
    let value: String

    var body: some View {
        HStack {
            Text(label)
                .font(.subheadline)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .font(.subheadline)
        }
    }
}

#Preview {
    SearchView()
}
