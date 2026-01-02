//
//  ProfileView.swift
//  TLDR Music
//
//  User profile, favorites, history, and settings
//

import SwiftUI

struct ProfileView: View {
    @StateObject private var authManager = AuthManager.shared
    @State private var favorites: [Song] = []
    @State private var playHistory: [PlayHistoryItem] = []
    @State private var isLoadingFavorites = false
    @State private var isLoadingHistory = false
    @State private var showingSignInSheet = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationView {
            ScrollView {
                VStack(spacing: 24) {
                    // Profile Header
                    if authManager.isAuthenticated {
                        AuthenticatedProfileHeader(user: authManager.currentUser)
                    } else {
                        GuestProfileHeader(onSignIn: {
                            showingSignInSheet = true
                        })
                    }

                    Divider()

                    // Favorites Section
                    if authManager.isAuthenticated {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Label("Favorites", systemImage: "heart.fill")
                                    .font(.title2)
                                    .fontWeight(.bold)
                                    .foregroundColor(.red)

                                Spacer()

                                if isLoadingFavorites {
                                    ProgressView()
                                        .scaleEffect(0.8)
                                }
                            }
                            .padding(.horizontal)

                            if favorites.isEmpty {
                                EmptyStateView(
                                    icon: "heart",
                                    title: "No favorites yet",
                                    message: "Add songs to your favorites to see them here"
                                )
                                .padding(.vertical, 20)
                            } else {
                                ScrollView(.horizontal, showsIndicators: false) {
                                    LazyHStack(spacing: 16) {
                                        ForEach(favorites.prefix(10)) { song in
                                            NavigationLink(destination: SongDetailView(song: song)) {
                                                FavoriteSongCard(song: song)
                                            }
                                            .buttonStyle(PlainButtonStyle())
                                        }
                                    }
                                    .padding(.horizontal)
                                }

                                if favorites.count > 10 {
                                    NavigationLink(destination: FavoritesListView()) {
                                        HStack {
                                            Text("See all \(favorites.count) favorites")
                                            Spacer()
                                            Image(systemName: "chevron.right")
                                        }
                                        .foregroundColor(.blue)
                                        .padding(.horizontal)
                                    }
                                }
                            }
                        }

                        Divider()

                        // Play History Section
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Label("Recently Played", systemImage: "clock.fill")
                                    .font(.title2)
                                    .fontWeight(.bold)

                                Spacer()

                                if isLoadingHistory {
                                    ProgressView()
                                        .scaleEffect(0.8)
                                }
                            }
                            .padding(.horizontal)

                            if playHistory.isEmpty {
                                EmptyStateView(
                                    icon: "clock",
                                    title: "No play history",
                                    message: "Your recently played songs will appear here"
                                )
                                .padding(.vertical, 20)
                            } else {
                                VStack(spacing: 0) {
                                    ForEach(playHistory.prefix(5)) { item in
                                        if let song = item.song {
                                            HistoryRow(item: item, song: song)
                                            Divider()
                                                .padding(.leading, 70)
                                        }
                                    }
                                }

                                if playHistory.count > 5 {
                                    NavigationLink(destination: HistoryListView()) {
                                        HStack {
                                            Text("See all history")
                                            Spacer()
                                            Image(systemName: "chevron.right")
                                        }
                                        .foregroundColor(.blue)
                                        .padding(.horizontal)
                                        .padding(.top, 8)
                                    }
                                }
                            }
                        }

                        Divider()
                    }

                    // Settings Section
                    VStack(alignment: .leading, spacing: 0) {
                        Text("Settings")
                            .font(.title2)
                            .fontWeight(.bold)
                            .padding(.horizontal)
                            .padding(.bottom, 12)

                        VStack(spacing: 0) {
                            SettingsRow(
                                icon: "bell.fill",
                                title: "Notifications",
                                subtitle: "Get notified about new charts"
                            ) {
                                // Navigate to notifications settings
                            }

                            Divider()
                                .padding(.leading, 60)

                            SettingsRow(
                                icon: "arrow.down.circle.fill",
                                title: "Downloads",
                                subtitle: "Manage offline content"
                            ) {
                                // Navigate to downloads
                            }

                            Divider()
                                .padding(.leading, 60)

                            SettingsRow(
                                icon: "info.circle.fill",
                                title: "About",
                                subtitle: "Version 1.0.0"
                            ) {
                                // Navigate to about
                            }

                            if authManager.isAuthenticated {
                                Divider()
                                    .padding(.leading, 60)

                                Button {
                                    Task {
                                        await signOut()
                                    }
                                } label: {
                                    HStack(spacing: 16) {
                                        Image(systemName: "rectangle.portrait.and.arrow.right")
                                            .font(.title3)
                                            .foregroundColor(.red)
                                            .frame(width: 30)

                                        VStack(alignment: .leading, spacing: 2) {
                                            Text("Sign Out")
                                                .font(.body)
                                                .foregroundColor(.red)
                                        }

                                        Spacer()
                                    }
                                    .padding()
                                }
                            }
                        }
                        .background(Color(uiColor: .secondarySystemGroupedBackground))
                        .cornerRadius(12)
                        .padding(.horizontal)
                    }

                    // Footer
                    VStack(spacing: 8) {
                        Text("TLDR Music")
                            .font(.caption)
                            .fontWeight(.semibold)

                        Text("Discover trending Bollywood music")
                            .font(.caption2)
                            .foregroundColor(.secondary)

                        Text("Powered by Music Conductor")
                            .font(.caption2)
                            .foregroundColor(.secondary)
                    }
                    .padding(.vertical, 20)
                }
                .padding(.vertical)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .navigationTitle("Profile")
            .navigationBarTitleDisplayMode(.large)
            .refreshable {
                if authManager.isAuthenticated {
                    await loadUserData()
                }
            }
            .sheet(isPresented: $showingSignInSheet) {
                SignInSheet()
            }
            .alert("Error", isPresented: .constant(errorMessage != nil), presenting: errorMessage) { _ in
                Button("OK") {
                    errorMessage = nil
                }
            } message: { error in
                Text(error)
            }
        }
        .task {
            if authManager.isAuthenticated {
                await loadUserData()
            }
        }
    }

    private func loadUserData() async {
        await withTaskGroup(of: Void.self) { group in
            group.addTask {
                await loadFavorites()
            }
            group.addTask {
                await loadPlayHistory()
            }
        }
    }

    private func loadFavorites() async {
        isLoadingFavorites = true

        do {
            favorites = try await MusicConductorAPI.shared.getFavorites()
        } catch {
            print("Error loading favorites: \(error)")
        }

        isLoadingFavorites = false
    }

    private func loadPlayHistory() async {
        isLoadingHistory = true

        do {
            playHistory = try await MusicConductorAPI.shared.getPlayHistory(limit: 20)
        } catch {
            print("Error loading history: \(error)")
        }

        isLoadingHistory = false
    }

    private func signOut() async {
        do {
            try await authManager.signOut()
            favorites = []
            playHistory = []
        } catch {
            errorMessage = error.localizedDescription
        }
    }
}

// MARK: - Authenticated Profile Header

struct AuthenticatedProfileHeader: View {
    let user: User?

    var body: some View {
        VStack(spacing: 16) {
            // Profile photo
            if let photoUrl = user?.photoUrl {
                AsyncImage(url: URL(string: photoUrl)) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .aspectRatio(contentMode: .fill)
                            .frame(width: 100, height: 100)
                            .clipShape(Circle())
                            .overlay(Circle().stroke(Color.blue, lineWidth: 3))
                    case .failure, .empty:
                        DefaultProfileImage()
                    @unknown default:
                        DefaultProfileImage()
                    }
                }
            } else {
                DefaultProfileImage()
            }

            // User info
            VStack(spacing: 4) {
                Text(user?.displayName ?? "User")
                    .font(.title2)
                    .fontWeight(.bold)

                if let email = user?.email {
                    Text(email)
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                }
            }

            // Preferences
            if let preferences = user?.preferences {
                VStack(spacing: 8) {
                    if let languages = preferences.languages, !languages.isEmpty {
                        HStack {
                            Image(systemName: "globe")
                                .font(.caption)
                            Text("Languages: \(languages.joined(separator: ", "))")
                                .font(.caption)
                        }
                        .foregroundColor(.secondary)
                    }

                    if let genres = preferences.genres, !genres.isEmpty {
                        HStack {
                            Image(systemName: "guitars")
                                .font(.caption)
                            Text("Genres: \(genres.joined(separator: ", "))")
                                .font(.caption)
                        }
                        .foregroundColor(.secondary)
                    }
                }
            }
        }
        .padding()
    }
}

struct DefaultProfileImage: View {
    var body: some View {
        Circle()
            .fill(LinearGradient(
                colors: [.blue, .purple],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ))
            .frame(width: 100, height: 100)
            .overlay(
                Image(systemName: "person.fill")
                    .font(.system(size: 50))
                    .foregroundColor(.white)
            )
            .overlay(Circle().stroke(Color.blue, lineWidth: 3))
    }
}

// MARK: - Guest Profile Header

struct GuestProfileHeader: View {
    let onSignIn: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "person.circle.fill")
                .font(.system(size: 80))
                .foregroundColor(.secondary)

            VStack(spacing: 8) {
                Text("Guest User")
                    .font(.title2)
                    .fontWeight(.bold)

                Text("Sign in to sync your favorites and history across devices")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)
            }

            Button {
                onSignIn()
            } label: {
                HStack {
                    Image(systemName: "person.badge.plus")
                    Text("Sign In")
                }
                .font(.headline)
                .foregroundColor(.white)
                .padding()
                .frame(maxWidth: 200)
                .background(Color.blue)
                .cornerRadius(12)
            }
        }
        .padding()
    }
}

// MARK: - Favorite Song Card

struct FavoriteSongCard: View {
    let song: Song

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            // Artwork
            AsyncImage(url: URL(string: song.artworkUrl ?? "")) { phase in
                switch phase {
                case .success(let image):
                    image
                        .resizable()
                        .aspectRatio(1, contentMode: .fill)
                        .frame(width: 140, height: 140)
                        .cornerRadius(8)
                case .failure, .empty:
                    Rectangle()
                        .fill(Color.gray.opacity(0.3))
                        .frame(width: 140, height: 140)
                        .cornerRadius(8)
                        .overlay(
                            Image(systemName: "music.note")
                                .font(.largeTitle)
                                .foregroundColor(.secondary)
                        )
                @unknown default:
                    EmptyView()
                }
            }

            // Song info
            VStack(alignment: .leading, spacing: 4) {
                Text(song.title)
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundColor(.primary)
                    .lineLimit(1)

                Text(song.artistName)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }
            .frame(width: 140)
        }
    }
}

// MARK: - History Row

struct HistoryRow: View {
    let item: PlayHistoryItem
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
                        .cornerRadius(6)
                case .failure, .empty:
                    Rectangle()
                        .fill(Color.gray.opacity(0.3))
                        .frame(width: 50, height: 50)
                        .cornerRadius(6)
                @unknown default:
                    EmptyView()
                }
            }

            // Song info
            VStack(alignment: .leading, spacing: 4) {
                Text(song.title)
                    .font(.subheadline)
                    .foregroundColor(.primary)
                    .lineLimit(1)

                Text(song.artistName)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)

                Text(formatPlayedAt(item.playedAt))
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding(.horizontal)
        .padding(.vertical, 8)
    }

    private func formatPlayedAt(_ dateString: String) -> String {
        // Simple formatting - in production, use DateFormatter
        return "Recently"
    }
}

// MARK: - Settings Row

struct SettingsRow: View {
    let icon: String
    let title: String
    let subtitle: String
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            HStack(spacing: 16) {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundColor(.blue)
                    .frame(width: 30)

                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.body)
                        .foregroundColor(.primary)

                    Text(subtitle)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }

                Spacer()

                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
            .padding()
        }
    }
}

// MARK: - Empty State View

struct EmptyStateView: View {
    let icon: String
    let title: String
    let message: String

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 40))
                .foregroundColor(.secondary)

            Text(title)
                .font(.headline)
                .foregroundColor(.secondary)

            Text(message)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
        }
        .padding()
    }
}

// MARK: - Sign In Sheet

struct SignInSheet: View {
    @Environment(\.dismiss) var dismiss
    @StateObject private var authManager = AuthManager.shared
    @State private var isLoading = false
    @State private var errorMessage: String?

    var body: some View {
        NavigationView {
            VStack(spacing: 24) {
                Spacer()

                // Logo or Icon
                Image(systemName: "music.note.house.fill")
                    .font(.system(size: 80))
                    .foregroundColor(.blue)

                VStack(spacing: 12) {
                    Text("Welcome to TLDR Music")
                        .font(.title)
                        .fontWeight(.bold)

                    Text("Sign in to sync your favorites and get personalized recommendations")
                        .font(.subheadline)
                        .foregroundColor(.secondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal)
                }

                Spacer()

                VStack(spacing: 16) {
                    // Google Sign In
                    Button {
                        Task {
                            await signInWithGoogle()
                        }
                    } label: {
                        HStack {
                            Image(systemName: "g.circle.fill")
                            Text("Continue with Google")
                        }
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.red)
                        .cornerRadius(12)
                    }
                    .disabled(isLoading)

                    // Guest Mode
                    Button {
                        Task {
                            await signInAsGuest()
                        }
                    } label: {
                        HStack {
                            Image(systemName: "person.fill")
                            Text("Continue as Guest")
                        }
                        .font(.headline)
                        .foregroundColor(.blue)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue.opacity(0.1))
                        .cornerRadius(12)
                    }
                    .disabled(isLoading)

                    if isLoading {
                        ProgressView()
                    }

                    if let error = errorMessage {
                        Text(error)
                            .font(.caption)
                            .foregroundColor(.red)
                            .multilineTextAlignment(.center)
                    }
                }
                .padding(.horizontal)

                Spacer()
            }
            .navigationTitle("Sign In")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Cancel") {
                        dismiss()
                    }
                }
            }
        }
    }

    private func signInWithGoogle() async {
        isLoading = true
        errorMessage = nil

        do {
            try await authManager.signInWithGoogle()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }

    private func signInAsGuest() async {
        isLoading = true
        errorMessage = nil

        do {
            try await authManager.signInAsGuest()
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }

        isLoading = false
    }
}

// MARK: - List Views (Placeholders)

struct FavoritesListView: View {
    var body: some View {
        Text("All Favorites")
            .navigationTitle("Favorites")
    }
}

struct HistoryListView: View {
    var body: some View {
        Text("Play History")
            .navigationTitle("History")
    }
}

#Preview {
    ProfileView()
}
