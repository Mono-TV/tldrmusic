//
//  MusicConductorAPI.swift
//  TLDR Music
//
//  API client for Music Conductor backend
//  https://tldr-music-ncrhtdqoiq-el.a.run.app
//

import Foundation

/// Main API client for Music Conductor backend
class MusicConductorAPI {
    static let shared = MusicConductorAPI()

    private let baseURL = "https://tldr-music-ncrhtdqoiq-el.a.run.app"

    private var accessToken: String? {
        get { UserDefaults.standard.string(forKey: "access_token") }
        set { UserDefaults.standard.set(newValue, forKey: "access_token") }
    }

    private var refreshToken: String? {
        get { UserDefaults.standard.string(forKey: "refresh_token") }
        set { UserDefaults.standard.set(newValue, forKey: "refresh_token") }
    }

    private init() {}

    // MARK: - Charts API

    /// Fetch Bollywood Top 25 chart
    /// GET /api/charts/aggregated?region=india
    func fetchBollywoodTop25() async throws -> ChartResponse {
        let endpoint = "/api/charts/aggregated?region=india"
        return try await get(endpoint: endpoint)
    }

    // MARK: - Search API

    /// Search songs with optional filters
    /// GET /api/search/songs
    func searchSongs(
        query: String,
        language: String? = nil,
        genre: String? = nil,
        hasYoutube: Bool? = nil,
        page: Int = 1,
        perPage: Int = 20,
        personalize: Bool = false
    ) async throws -> SearchResponse {
        var components = URLComponents(string: baseURL + "/api/search/songs")!
        var queryItems: [URLQueryItem] = []

        if !query.isEmpty {
            queryItems.append(URLQueryItem(name: "q", value: query))
        }
        if let language = language {
            queryItems.append(URLQueryItem(name: "language", value: language))
        }
        if let genre = genre {
            queryItems.append(URLQueryItem(name: "genre", value: genre))
        }
        if let hasYoutube = hasYoutube {
            queryItems.append(URLQueryItem(name: "has_youtube", value: String(hasYoutube)))
        }
        queryItems.append(URLQueryItem(name: "page", value: String(page)))
        queryItems.append(URLQueryItem(name: "per_page", value: String(perPage)))

        if personalize {
            queryItems.append(URLQueryItem(name: "personalize", value: "true"))
        }

        components.queryItems = queryItems

        guard let url = components.url else {
            throw APIError.invalidURL
        }

        if personalize {
            return try await getAuthenticated(url: url)
        } else {
            return try await get(url: url)
        }
    }

    /// Get autocomplete suggestions
    /// GET /api/search/suggest
    func getSearchSuggestions(query: String, limit: Int = 5) async throws -> SuggestionResponse {
        let endpoint = "/api/search/suggest?q=\(query.urlEncoded)&limit=\(limit)"
        return try await get(endpoint: endpoint)
    }

    /// Unified search across songs, albums, and artists
    /// GET /api/search
    func unifiedSearch(
        query: String,
        songsLimit: Int = 5,
        albumsLimit: Int = 5,
        artistsLimit: Int = 5
    ) async throws -> UnifiedSearchResponse {
        let endpoint = "/api/search?q=\(query.urlEncoded)&songs_limit=\(songsLimit)&albums_limit=\(albumsLimit)&artists_limit=\(artistsLimit)"
        return try await get(endpoint: endpoint)
    }

    // MARK: - Playlists API

    /// Fetch all playlists
    /// GET /api/playlists
    func fetchPlaylists(
        category: String? = nil,
        homepageFeatured: Bool? = nil
    ) async throws -> PlaylistListResponse {
        var components = URLComponents(string: baseURL + "/api/playlists")!
        var queryItems: [URLQueryItem] = []

        if let category = category {
            queryItems.append(URLQueryItem(name: "category", value: category))
        }
        if let featured = homepageFeatured {
            queryItems.append(URLQueryItem(name: "homepage_featured", value: String(featured)))
        }

        components.queryItems = queryItems.isEmpty ? nil : queryItems

        guard let url = components.url else {
            throw APIError.invalidURL
        }

        return try await get(url: url)
    }

    /// Fetch a specific playlist by ID
    /// GET /api/playlists/{id}
    func fetchPlaylist(id: String) async throws -> PlaylistFull {
        let endpoint = "/api/playlists/\(id)"
        return try await get(endpoint: endpoint)
    }

    /// Fetch playlists by type
    /// GET /api/playlists/by-type/{type}
    func fetchPlaylistsByType(type: String) async throws -> PlaylistListResponse {
        let endpoint = "/api/playlists/by-type/\(type)"
        return try await get(endpoint: endpoint)
    }

    // MARK: - Authentication API

    /// Sign in with Google OAuth
    /// POST /api/auth/google
    func signInWithGoogle(idToken: String) async throws -> AuthResponse {
        let endpoint = "/api/auth/google"
        let body = ["id_token": idToken]
        let response: AuthResponse = try await post(endpoint: endpoint, body: body)

        // Store tokens
        accessToken = response.accessToken
        refreshToken = response.refreshToken

        return response
    }

    /// Sign in as guest
    /// POST /api/auth/guest
    func signInAsGuest(deviceId: String) async throws -> AuthResponse {
        let endpoint = "/api/auth/guest"
        let body = ["device_id": deviceId]
        let response: AuthResponse = try await post(endpoint: endpoint, body: body)

        accessToken = response.accessToken
        refreshToken = response.refreshToken

        return response
    }

    /// Refresh access token
    /// POST /api/auth/token/refresh
    func refreshAccessToken() async throws -> AuthResponse {
        guard let refreshToken = refreshToken else {
            throw APIError.unauthorized
        }

        let endpoint = "/api/auth/token/refresh"
        let body = ["refresh_token": refreshToken]
        let response: AuthResponse = try await post(endpoint: endpoint, body: body)

        accessToken = response.accessToken
        self.refreshToken = response.refreshToken

        return response
    }

    /// Get current user profile
    /// GET /api/auth/me
    func getCurrentUser() async throws -> User {
        let endpoint = "/api/auth/me"
        return try await getAuthenticated(endpoint: endpoint)
    }

    /// Logout
    /// POST /api/auth/logout
    func logout() async throws {
        guard let refreshToken = refreshToken else {
            throw APIError.unauthorized
        }

        let endpoint = "/api/auth/logout"
        var request = URLRequest(url: URL(string: baseURL + endpoint)!)
        request.httpMethod = "POST"
        request.addValue("Bearer \(refreshToken)", forHTTPHeaderField: "Authorization")

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse,
              (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(statusCode: (response as? HTTPURLResponse)?.statusCode ?? 0)
        }

        // Clear stored tokens
        accessToken = nil
        self.refreshToken = nil
    }

    // MARK: - Library API (Authenticated)

    /// Get user's favorite songs
    /// GET /api/library/favorites
    func getFavorites() async throws -> [Song] {
        let endpoint = "/api/library/favorites"
        let response: FavoritesResponse = try await getAuthenticated(endpoint: endpoint)
        return response.songs
    }

    /// Add song to favorites
    /// POST /api/library/favorites
    func addToFavorites(songId: String) async throws {
        let endpoint = "/api/library/favorites"
        let body = ["song_id": songId]
        let _: EmptyResponse = try await postAuthenticated(endpoint: endpoint, body: body)
    }

    /// Remove song from favorites
    /// DELETE /api/library/favorites/{song_id}
    func removeFromFavorites(songId: String) async throws {
        let endpoint = "/api/library/favorites/\(songId)"
        try await deleteAuthenticated(endpoint: endpoint)
    }

    /// Get play history
    /// GET /api/library/history
    func getPlayHistory(limit: Int = 50) async throws -> [PlayHistoryItem] {
        let endpoint = "/api/library/history?limit=\(limit)"
        let response: PlayHistoryResponse = try await getAuthenticated(endpoint: endpoint)
        return response.history
    }

    // MARK: - Behavior Tracking API (Authenticated)

    /// Track a song play
    /// POST /api/behavior/play
    func trackPlay(
        songId: String,
        youtubeId: String? = nil,
        durationMs: Int? = nil,
        source: String = "ios_app"
    ) async throws {
        let endpoint = "/api/behavior/play"
        var body: [String: Any] = [
            "song_id": songId,
            "source": source
        ]
        if let youtubeId = youtubeId {
            body["youtube_id"] = youtubeId
        }
        if let durationMs = durationMs {
            body["duration_ms"] = durationMs
        }

        let _: EmptyResponse = try await postAuthenticated(endpoint: endpoint, body: body)
    }

    /// Track a search query
    /// POST /api/behavior/search
    func trackSearch(query: String) async throws {
        let endpoint = "/api/behavior/search"
        let body = ["query": query]
        let _: EmptyResponse = try await postAuthenticated(endpoint: endpoint, body: body)
    }

    /// Track adding to favorites
    /// POST /api/behavior/favorite
    func trackFavorite(songId: String) async throws {
        let endpoint = "/api/behavior/favorite"
        let body = ["song_id": songId]
        let _: EmptyResponse = try await postAuthenticated(endpoint: endpoint, body: body)
    }

    // MARK: - Discovery API (Authenticated)

    /// Get trending songs
    /// GET /api/discovery/trending
    func getTrendingSongs(
        timeWindow: String = "24h",
        limit: Int = 20
    ) async throws -> [TrendingSong] {
        let endpoint = "/api/discovery/trending?time_window=\(timeWindow)&limit=\(limit)"
        let response: TrendingResponse = try await getAuthenticated(endpoint: endpoint)
        return response.songs
    }

    /// Get personalized radio based on seed song
    /// GET /api/discovery/radio/{song_id}
    func getRadio(songId: String, limit: Int = 20) async throws -> RadioResponse {
        let endpoint = "/api/discovery/radio/\(songId)?limit=\(limit)"
        return try await getAuthenticated(endpoint: endpoint)
    }

    // MARK: - HTTP Methods

    private func get<T: Decodable>(endpoint: String) async throws -> T {
        guard let url = URL(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }
        return try await get(url: url)
    }

    private func get<T: Decodable>(url: URL) async throws -> T {
        let (data, response) = try await URLSession.shared.data(from: url)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(T.self, from: data)
    }

    private func getAuthenticated<T: Decodable>(endpoint: String) async throws -> T {
        guard let url = URL(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }
        return try await getAuthenticated(url: url)
    }

    private func getAuthenticated<T: Decodable>(url: URL) async throws -> T {
        guard let token = accessToken else {
            throw APIError.unauthorized
        }

        var request = URLRequest(url: url)
        request.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            // Token expired, try to refresh
            try await refreshAccessToken()
            // Retry the request
            return try await getAuthenticated(url: url)
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(T.self, from: data)
    }

    private func post<T: Decodable>(endpoint: String, body: [String: Any]) async throws -> T {
        guard let url = URL(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(T.self, from: data)
    }

    private func postAuthenticated<T: Decodable>(endpoint: String, body: [String: Any]) async throws -> T {
        guard let token = accessToken else {
            throw APIError.unauthorized
        }

        guard let url = URL(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.addValue("application/json", forHTTPHeaderField: "Content-Type")
        request.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            try await refreshAccessToken()
            return try await postAuthenticated(endpoint: endpoint, body: body)
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(T.self, from: data)
    }

    private func deleteAuthenticated(endpoint: String) async throws {
        guard let token = accessToken else {
            throw APIError.unauthorized
        }

        guard let url = URL(string: baseURL + endpoint) else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        request.addValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (_, response) = try await URLSession.shared.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIError.invalidResponse
        }

        if httpResponse.statusCode == 401 {
            try await refreshAccessToken()
            try await deleteAuthenticated(endpoint: endpoint)
            return
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw APIError.httpError(statusCode: httpResponse.statusCode)
        }
    }
}

// MARK: - API Error

enum APIError: Error, LocalizedError {
    case invalidURL
    case invalidResponse
    case unauthorized
    case httpError(statusCode: Int)
    case decodingError(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .invalidResponse:
            return "Invalid response from server"
        case .unauthorized:
            return "Unauthorized - please sign in"
        case .httpError(let statusCode):
            return "HTTP error: \(statusCode)"
        case .decodingError(let error):
            return "Decoding error: \(error.localizedDescription)"
        }
    }
}

// MARK: - String Extension

extension String {
    var urlEncoded: String {
        addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? self
    }
}
