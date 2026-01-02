//
//  Models.swift
//  TLDR Music
//
//  Data models for Music Conductor API responses
//

import Foundation

// MARK: - Charts Models

struct ChartResponse: Codable {
    let chartId: String
    let region: String
    let week: String
    let generatedAt: String
    let sources: [String]
    let totalSongs: Int
    let songs: [ChartSong]

    enum CodingKeys: String, CodingKey {
        case chartId = "chart_id"
        case region, week
        case generatedAt = "generated_at"
        case sources
        case totalSongs = "total_songs"
        case songs
    }
}

struct ChartSong: Codable, Identifiable, Hashable {
    let rank: Int
    let title: String
    let artist: String
    let score: Double
    let platformsCount: Int
    let platformRanks: PlatformRanks
    let youtubeId: String?
    let artworkUrl: String?
    let isrc: String?
    let spotifyId: String?
    let appleMusicId: String?

    var id: Int { rank }

    enum CodingKeys: String, CodingKey {
        case rank, title, artist, score
        case platformsCount = "platforms_count"
        case platformRanks = "platform_ranks"
        case youtubeId = "youtube_id"
        case artworkUrl = "artwork_url"
        case isrc
        case spotifyId = "spotify_id"
        case appleMusicId = "apple_music_id"
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(rank)
    }

    static func == (lhs: ChartSong, rhs: ChartSong) -> Bool {
        lhs.rank == rhs.rank
    }
}

struct PlatformRanks: Codable {
    let youtubeMusic: Int?
    let appleMusic: Int?
    let spotify: Int?
    let billboard: Int?
    let shazam: Int?

    enum CodingKeys: String, CodingKey {
        case youtubeMusic = "youtube_music"
        case appleMusic = "apple_music"
        case spotify, billboard, shazam
    }
}

// MARK: - Search Models

struct SearchResponse: Codable {
    let query: String
    let found: Int
    let page: Int
    let perPage: Int
    let songs: [Song]
    let facets: SearchFacets?
    let personalizationApplied: Bool?
    let boostedByLanguage: [String]?
    let boostedByGenre: [String]?

    enum CodingKeys: String, CodingKey {
        case query, found, page
        case perPage = "per_page"
        case songs, facets
        case personalizationApplied = "personalization_applied"
        case boostedByLanguage = "boosted_by_language"
        case boostedByGenre = "boosted_by_genre"
    }
}

struct SearchFacets: Codable {
    let language: [FacetValue]
    let genres: [FacetValue]
    let hasYoutube: [FacetValue]

    enum CodingKeys: String, CodingKey {
        case language, genres
        case hasYoutube = "has_youtube"
    }
}

struct FacetValue: Codable {
    let value: String
    let count: Int
}

struct Song: Codable, Identifiable, Hashable {
    let id: String
    let title: String
    let artistName: String
    let albumName: String?
    let language: String?
    let genres: [String]
    let youtubeVideoId: String?
    let artworkUrl: String?
    let durationSeconds: Int?
    let isrc: String?

    enum CodingKeys: String, CodingKey {
        case id, title
        case artistName = "artist_name"
        case albumName = "album_name"
        case language, genres
        case youtubeVideoId = "youtube_video_id"
        case artworkUrl = "artwork_url"
        case durationSeconds = "duration_seconds"
        case isrc
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: Song, rhs: Song) -> Bool {
        lhs.id == rhs.id
    }
}

struct SuggestionResponse: Codable {
    let query: String
    let suggestions: [Suggestion]
}

struct Suggestion: Codable, Identifiable {
    let id: String
    let title: String
    let artistName: String
    let display: String
    let youtubeVideoId: String?
    let artworkUrl: String?

    enum CodingKeys: String, CodingKey {
        case id, title
        case artistName = "artist_name"
        case display
        case youtubeVideoId = "youtube_video_id"
        case artworkUrl = "artwork_url"
    }
}

struct UnifiedSearchResponse: Codable {
    let query: String
    let songs: [Song]
    let albums: [Album]
    let artists: [Artist]
    let songsTotal: Int
    let albumsTotal: Int
    let artistsTotal: Int

    enum CodingKeys: String, CodingKey {
        case query, songs, albums, artists
        case songsTotal = "songs_total"
        case albumsTotal = "albums_total"
        case artistsTotal = "artists_total"
    }
}

struct Album: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let artistName: String
    let artworkUrl: String?
    let releaseDate: String?
    let trackCount: Int?
    let genre: String?

    enum CodingKeys: String, CodingKey {
        case id, name
        case artistName = "artist_name"
        case artworkUrl = "artwork_url"
        case releaseDate = "release_date"
        case trackCount = "track_count"
        case genre
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: Album, rhs: Album) -> Bool {
        lhs.id == rhs.id
    }
}

struct Artist: Codable, Identifiable, Hashable {
    let artistName: String
    var id: String { artistName }
    let songCount: Int
    let sampleArtwork: String?

    enum CodingKeys: String, CodingKey {
        case artistName = "artist_name"
        case songCount = "song_count"
        case sampleArtwork = "sample_artwork"
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(artistName)
    }

    static func == (lhs: Artist, rhs: Artist) -> Bool {
        lhs.artistName == rhs.artistName
    }
}

// MARK: - Playlist Models

struct PlaylistListResponse: Codable {
    let playlists: [PlaylistSummary]
    let total: Int
}

struct PlaylistSummary: Codable, Identifiable, Hashable {
    let id: String
    let slug: String
    let name: String
    let description: String
    let type: String
    let category: String
    let totalTracks: Int
    let artwork: PlaylistArtwork?
    let homepageFeatured: Bool?

    enum CodingKeys: String, CodingKey {
        case id, slug, name, description, type, category
        case totalTracks = "total_tracks"
        case artwork
        case homepageFeatured = "homepage_featured"
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }

    static func == (lhs: PlaylistSummary, rhs: PlaylistSummary) -> Bool {
        lhs.id == rhs.id
    }
}

struct PlaylistFull: Codable {
    let id: String
    let slug: String
    let name: String
    let description: String
    let type: String
    let category: String
    let artwork: PlaylistArtwork?
    let tracks: [PlaylistTrack]
    let totalTracks: Int
    let totalDurationMs: Int
    let createdAt: String?
    let updatedAt: String?

    enum CodingKeys: String, CodingKey {
        case id, slug, name, description, type, category, artwork, tracks
        case totalTracks = "total_tracks"
        case totalDurationMs = "total_duration_ms"
        case createdAt = "created_at"
        case updatedAt = "updated_at"
    }
}

struct PlaylistArtwork: Codable {
    let primary: String?
    let fallback: String?
    let color: String?
}

struct PlaylistTrack: Codable, Identifiable {
    let position: Int
    var id: Int { position }
    let songId: String?
    let title: String?
    let artist: String?
    let youtubeId: String?
    let artworkUrl: String?
    let durationMs: Int?

    enum CodingKeys: String, CodingKey {
        case position
        case songId = "song_id"
        case title, artist
        case youtubeId = "youtube_id"
        case artworkUrl = "artwork_url"
        case durationMs = "duration_ms"
    }
}

// MARK: - Authentication Models

struct AuthResponse: Codable {
    let accessToken: String
    let refreshToken: String
    let user: User

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case user
    }
}

struct User: Codable {
    let userId: String
    let displayName: String?
    let email: String?
    let photoUrl: String?
    let preferences: UserPreferences?

    enum CodingKeys: String, CodingKey {
        case userId = "user_id"
        case displayName = "display_name"
        case email
        case photoUrl = "photo_url"
        case preferences
    }
}

struct UserPreferences: Codable {
    let languages: [String]?
    let genres: [String]?
}

// MARK: - Library Models

struct FavoritesResponse: Codable {
    let songs: [Song]
}

struct PlayHistoryResponse: Codable {
    let history: [PlayHistoryItem]
}

struct PlayHistoryItem: Codable, Identifiable {
    let id: String
    let songId: String
    let playedAt: String
    let song: Song?

    enum CodingKeys: String, CodingKey {
        case id
        case songId = "song_id"
        case playedAt = "played_at"
        case song
    }
}

// MARK: - Discovery Models

struct TrendingResponse: Codable {
    let songs: [TrendingSong]
    let timeWindow: String

    enum CodingKeys: String, CodingKey {
        case songs
        case timeWindow = "time_window"
    }
}

struct TrendingSong: Codable, Identifiable {
    let id: String
    let title: String
    let artistName: String
    let youtubeVideoId: String?
    let artworkUrl: String?
    let playCount: Int
    let velocity: Double

    enum CodingKeys: String, CodingKey {
        case id, title
        case artistName = "artist_name"
        case youtubeVideoId = "youtube_video_id"
        case artworkUrl = "artwork_url"
        case playCount = "play_count"
        case velocity
    }
}

struct RadioResponse: Codable {
    let seedSongId: String
    let songs: [Song]
    let total: Int

    enum CodingKeys: String, CodingKey {
        case seedSongId = "seed_song_id"
        case songs
        case total
    }
}

// MARK: - Empty Response

struct EmptyResponse: Codable {}
