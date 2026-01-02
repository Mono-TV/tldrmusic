//
//  MusicPlayerView.swift
//  TLDR Music
//
//  Music player for chart songs
//

import SwiftUI

struct MusicPlayerView: View {
    let song: ChartSong
    @State private var isFavorite = false

    var body: some View {
        ScrollView {
            VStack(spacing: 24) {
                // Large artwork with rank overlay
                ZStack(alignment: .topLeading) {
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

                    // Rank badge
                    ZStack {
                        Circle()
                            .fill(rankColor)
                            .frame(width: 60, height: 60)

                        VStack(spacing: 2) {
                            Text("#\(song.rank)")
                                .font(.system(size: 18, weight: .bold))
                                .foregroundColor(.white)

                            Text("India")
                                .font(.system(size: 8, weight: .medium))
                                .foregroundColor(.white.opacity(0.8))
                        }
                    }
                    .offset(x: -8, y: -8)
                    .shadow(radius: 4)
                }

                // Song info
                VStack(spacing: 8) {
                    Text(song.title)
                        .font(.title)
                        .fontWeight(.bold)
                        .multilineTextAlignment(.center)

                    Text(song.artist)
                        .font(.title3)
                        .foregroundColor(.secondary)
                }

                // Platform ranks
                VStack(alignment: .leading, spacing: 12) {
                    Text("Platform Rankings")
                        .font(.headline)

                    HStack(spacing: 16) {
                        if let ytRank = song.platformRanks.youtubeMusic {
                            PlatformRankCard(platform: "YouTube Music", rank: ytRank, color: .red)
                        }
                        if let spotifyRank = song.platformRanks.spotify {
                            PlatformRankCard(platform: "Spotify", rank: spotifyRank, color: .green)
                        }
                    }

                    HStack(spacing: 16) {
                        if let appleRank = song.platformRanks.appleMusic {
                            PlatformRankCard(platform: "Apple Music", rank: appleRank, color: .pink)
                        }
                        if let shazamRank = song.platformRanks.shazam {
                            PlatformRankCard(platform: "Shazam", rank: shazamRank, color: .blue)
                        }
                    }
                }
                .padding()
                .background(Color.gray.opacity(0.1))
                .cornerRadius(12)

                // Stats
                VStack(alignment: .leading, spacing: 12) {
                    Text("Chart Statistics")
                        .font(.headline)

                    HStack {
                        StatCard(label: "Score", value: String(format: "%.1f", song.score))
                        StatCard(label: "Platforms", value: "\(song.platformsCount)")
                    }
                }

                // Actions
                VStack(spacing: 12) {
                    // Play button
                    if let youtubeId = song.youtubeId {
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

                    // Favorite button
                    Button {
                        toggleFavorite()
                    } label: {
                        HStack {
                            Image(systemName: isFavorite ? "heart.fill" : "heart")
                            Text(isFavorite ? "Remove from Favorites" : "Add to Favorites")
                        }
                        .font(.headline)
                        .foregroundColor(isFavorite ? .white : .red)
                        .padding()
                        .frame(maxWidth: .infinity)
                        .background(isFavorite ? Color.red : Color.red.opacity(0.1))
                        .cornerRadius(12)
                    }
                }
            }
            .padding()
        }
        .navigationTitle("Now Playing")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var rankColor: Color {
        switch song.rank {
        case 1:
            return Color(red: 1.0, green: 0.84, blue: 0.0) // Gold
        case 2:
            return Color(red: 0.75, green: 0.75, blue: 0.75) // Silver
        case 3:
            return Color(red: 0.80, green: 0.50, blue: 0.20) // Bronze
        default:
            return Color.blue
        }
    }

    private func toggleFavorite() {
        isFavorite.toggle()

        Task {
            // Track favorite action (requires authentication)
            // try? await MusicConductorAPI.shared.addToFavorites(songId: song.id)
        }
    }
}

struct PlatformRankCard: View {
    let platform: String
    let rank: Int
    let color: Color

    var body: some View {
        VStack(spacing: 4) {
            Text("#\(rank)")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(color)

            Text(platform)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(color.opacity(0.1))
        .cornerRadius(8)
    }
}

struct StatCard: View {
    let label: String
    let value: String

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title2)
                .fontWeight(.bold)

            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color.gray.opacity(0.1))
        .cornerRadius(8)
    }
}

// MARK: - YouTube Player View

struct YouTubePlayerView: View {
    let youtubeId: String
    let song: ChartSong

    var body: some View {
        VStack(spacing: 20) {
            // Artwork
            AsyncImage(url: URL(string: song.artworkUrl ?? "")) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 250, height: 250)
                        .cornerRadius(12)
                case .failure, .empty:
                    Image(systemName: "music.note")
                        .font(.system(size: 60))
                        .foregroundColor(.secondary)
                        .frame(width: 250, height: 250)
                        .background(Color.gray.opacity(0.2))
                        .cornerRadius(12)
                @unknown default:
                    EmptyView()
                }
            }

            // Song info
            VStack(spacing: 8) {
                Text(song.title)
                    .font(.title2)
                    .fontWeight(.bold)
                    .multilineTextAlignment(.center)

                Text(song.artist)
                    .font(.body)
                    .foregroundColor(.secondary)
            }

            // YouTube integration note
            VStack(spacing: 12) {
                Image(systemName: "play.tv")
                    .font(.system(size: 50))
                    .foregroundColor(.red)

                Text("YouTube Player Integration")
                    .font(.headline)

                Text("To play this song, integrate YouTubePlayerKit:")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)

                Text("Video ID: \(youtubeId)")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .padding()
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(8)

                // Instructions
                VStack(alignment: .leading, spacing: 8) {
                    Text("Setup Instructions:")
                        .font(.subheadline)
                        .fontWeight(.semibold)

                    Text("1. Add YouTubePlayerKit via SPM")
                        .font(.caption)

                    Text("2. Import: import YouTubePlayerKit")
                        .font(.caption)

                    Text("3. Use: YouTubePlayerView(player)")
                        .font(.caption)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding()
                .background(Color.orange.opacity(0.1))
                .cornerRadius(8)

                Link("Open in YouTube", destination: URL(string: "https://www.youtube.com/watch?v=\(youtubeId)")!)
                    .font(.headline)
                    .foregroundColor(.white)
                    .padding()
                    .frame(maxWidth: .infinity)
                    .background(Color.red)
                    .cornerRadius(12)
            }
            .padding()

            Spacer()
        }
        .padding()
        .navigationTitle("YouTube Player")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear {
            // Track play
            Task {
                try? await MusicConductorAPI.shared.trackPlay(
                    songId: String(song.rank), // In real app, use actual song_id from catalog
                    youtubeId: youtubeId
                )
            }
        }
    }
}

#Preview {
    NavigationView {
        MusicPlayerView(song: ChartSong(
            rank: 1,
            title: "Sample Song",
            artist: "Sample Artist",
            score: 95.5,
            platformsCount: 3,
            platformRanks: PlatformRanks(
                youtubeMusic: 1,
                appleMusic: 2,
                spotify: 1,
                billboard: nil,
                shazam: 3
            ),
            youtubeId: "dQw4w9WgXcQ",
            artworkUrl: nil,
            isrc: nil,
            spotifyId: nil,
            appleMusicId: nil
        ))
    }
}
