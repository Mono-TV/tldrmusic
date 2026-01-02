//
//  AuthManager.swift
//  TLDR Music
//
//  Manages user authentication state
//

import Foundation
import UIKit

/// Singleton class to manage authentication state across the app
class AuthManager: ObservableObject {
    static let shared = AuthManager()

    @Published var isAuthenticated = false
    @Published var currentUser: User?

    private init() {
        // Check if user is already authenticated on app launch
        checkAuthStatus()
    }

    // MARK: - Authentication

    /// Sign in with Google OAuth
    func signInWithGoogle() async throws {
        // Note: This requires GoogleSignIn SDK to be integrated
        // For now, this is a placeholder that will throw an error

        throw AuthError.googleSignInNotImplemented
    }

    /// Sign in as guest user
    func signInAsGuest() async throws {
        let deviceId = await getDeviceId()

        let authResponse = try await MusicConductorAPI.shared.signInAsGuest(deviceId: deviceId)

        await MainActor.run {
            self.currentUser = authResponse.user
            self.isAuthenticated = true
        }
    }

    /// Sign out current user
    func signOut() async throws {
        try await MusicConductorAPI.shared.logout()

        await MainActor.run {
            self.currentUser = nil
            self.isAuthenticated = false
        }
    }

    /// Refresh user profile
    func refreshUserProfile() async throws {
        let user = try await MusicConductorAPI.shared.getCurrentUser()

        await MainActor.run {
            self.currentUser = user
        }
    }

    // MARK: - Helpers

    /// Check if user is already authenticated
    private func checkAuthStatus() {
        // Check if we have stored tokens
        let hasAccessToken = UserDefaults.standard.string(forKey: "access_token") != nil

        if hasAccessToken {
            isAuthenticated = true

            // Try to fetch user profile
            Task {
                do {
                    try await refreshUserProfile()
                } catch {
                    // Token might be expired, sign out
                    await MainActor.run {
                        self.isAuthenticated = false
                        self.currentUser = nil
                    }
                }
            }
        }
    }

    /// Get stable device identifier
    private func getDeviceId() async -> String {
        // Try to get stored device ID first
        if let storedId = UserDefaults.standard.string(forKey: "device_id") {
            return storedId
        }

        // Generate new device ID
        let deviceId = UIDevice.current.identifierForVendor?.uuidString ?? UUID().uuidString

        // Store it
        UserDefaults.standard.set(deviceId, forKey: "device_id")

        return deviceId
    }
}

// MARK: - Google Sign-In Extension

#if canImport(GoogleSignIn)
import GoogleSignIn

extension AuthManager {
    /// Sign in with Google (requires GoogleSignIn SDK)
    func signInWithGoogle() async throws {
        // Get the root view controller
        guard let windowScene = await UIApplication.shared.connectedScenes.first as? UIWindowScene,
              let rootViewController = await windowScene.windows.first?.rootViewController else {
            throw AuthError.noViewController
        }

        // Sign in with Google
        let result = try await GIDSignIn.sharedInstance.signIn(withPresenting: rootViewController)

        guard let idToken = result.user.idToken?.tokenString else {
            throw AuthError.noIDToken
        }

        // Authenticate with backend
        let authResponse = try await MusicConductorAPI.shared.signInWithGoogle(idToken: idToken)

        await MainActor.run {
            self.currentUser = authResponse.user
            self.isAuthenticated = true
        }
    }
}
#endif

// MARK: - Auth Errors

enum AuthError: Error, LocalizedError {
    case noViewController
    case noIDToken
    case googleSignInNotImplemented

    var errorDescription: String? {
        switch self {
        case .noViewController:
            return "Could not find view controller for sign in"
        case .noIDToken:
            return "Failed to get ID token from Google"
        case .googleSignInNotImplemented:
            return "Google Sign-In is not implemented yet. Please use Guest mode or add GoogleSignIn SDK to your project."
        }
    }
}
