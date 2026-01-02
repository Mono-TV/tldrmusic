//
//  ChartsView.swift
//  TLDR Music
//
//  Displays Bollywood Top 25 chart
//

import SwiftUI

struct ChartsView: View {
    @State private var chartData: ChartResponse?
    @State private var isLoading = true
    @State private var errorMessage: String?

    var body: some View {
        NavigationView {
            Group {
                if isLoading {
                    ProgressView("Loading chart...")
                } else if let error = errorMessage {
                    VStack(spacing: 16) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 50))
                            .foregroundColor(.orange)
                        Text("Error loading chart")
                            .font(.headline)
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                        Button("Retry") {
                            Task {
                                await loadChart()
                            }
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .padding()
                } else if let chart = chartData {
                    ScrollView {
                        VStack(spacing: 0) {
                            // Chart header
                            VStack(alignment: .leading, spacing: 8) {
                                Text("Bollywood Top 25")
                                    .font(.largeTitle)
                                    .fontWeight(.bold)

                                HStack {
                                    Image(systemName: "calendar")
                                    Text("Week: \(chart.week)")
                                }
                                .font(.caption)
                                .foregroundColor(.secondary)

                                HStack {
                                    Image(systemName: "music.note.list")
                                    Text("\(chart.totalSongs) songs")
                                }
                                .font(.caption)
                                .foregroundColor(.secondary)

                                // Sources
                                Text("Sources: \(chart.sources.joined(separator: ", "))")
                                    .font(.caption2)
                                    .foregroundColor(.secondary)
                            }
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding()

                            // Chart songs
                            LazyVStack(spacing: 0) {
                                ForEach(chart.songs) { song in
                                    NavigationLink(destination: MusicPlayerView(song: song)) {
                                        ChartSongRow(song: song)
                                    }
                                    .buttonStyle(PlainButtonStyle())

                                    Divider()
                                        .padding(.leading, 80)
                                }
                            }
                        }
                    }
                    .refreshable {
                        await loadChart()
                    }
                }
            }
            .navigationTitle("Charts")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button {
                        Task {
                            await loadChart()
                        }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .disabled(isLoading)
                }
            }
        }
        .task {
            await loadChart()
        }
    }

    func loadChart() async {
        isLoading = true
        errorMessage = nil

        do {
            chartData = try await MusicConductorAPI.shared.fetchBollywoodTop25()
            isLoading = false
        } catch {
            errorMessage = error.localizedDescription
            isLoading = false
        }
    }
}

struct ChartSongRow: View {
    let song: ChartSong

    var body: some View {
        HStack(spacing: 12) {
            // Rank badge
            ZStack {
                Circle()
                    .fill(rankColor)
                    .frame(width: 40, height: 40)

                Text("#\(song.rank)")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(.white)
            }

            // Artwork
            AsyncImage(url: URL(string: song.artworkUrl ?? "")) { phase in
                switch phase {
                case .empty:
                    ProgressView()
                        .frame(width: 60, height: 60)
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(contentMode: .fill)
                        .frame(width: 60, height: 60)
                        .cornerRadius(8)
                case .failure:
                    Image(systemName: "music.note")
                        .font(.title)
                        .foregroundColor(.secondary)
                        .frame(width: 60, height: 60)
                        .background(Color.gray.opacity(0.2))
                        .cornerRadius(8)
                @unknown default:
                    EmptyView()
                }
            }

            // Song info
            VStack(alignment: .leading, spacing: 4) {
                Text(song.title)
                    .font(.headline)
                    .lineLimit(2)
                    .foregroundColor(.primary)

                Text(song.artist)
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .lineLimit(1)

                // Platform badges
                HStack(spacing: 4) {
                    if song.platformRanks.youtubeMusic != nil {
                        PlatformBadge(name: "YT", color: .red)
                    }
                    if song.platformRanks.spotify != nil {
                        PlatformBadge(name: "Spotify", color: .green)
                    }
                    if song.platformRanks.appleMusic != nil {
                        PlatformBadge(name: "Apple", color: .pink)
                    }
                    if song.platformRanks.shazam != nil {
                        PlatformBadge(name: "Shazam", color: .blue)
                    }

                    Spacer()

                    Text("Score: \(song.score, specifier: "%.1f")")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }
                .padding(.top, 2)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
        .background(Color(uiColor: .systemBackground))
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
}

struct PlatformBadge: View {
    let name: String
    let color: Color

    var body: some View {
        Text(name)
            .font(.system(size: 9, weight: .medium))
            .foregroundColor(.white)
            .padding(.horizontal, 4)
            .padding(.vertical, 2)
            .background(color)
            .cornerRadius(4)
    }
}

#Preview {
    ChartsView()
}
