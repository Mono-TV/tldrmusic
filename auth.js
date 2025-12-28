/**
 * TLDR Music - Authentication Module
 * Handles Google Sign-In, Guest Mode, and cloud sync
 *
 * API Architecture:
 * - Auth endpoints use Music Conductor API (Phase 1: Authentication)
 * - Library sync endpoints coming in Phase 2 (Personalization)
 * - Charts, Search, Discover use Music Conductor API (see app.js)
 */

// Configuration
const AUTH_CONFIG = {
    GOOGLE_CLIENT_ID: '401132033262-h6r5vjqgbfq9f67v8edjvhne7u06htad.apps.googleusercontent.com',
    API_BASE: 'https://tldrmusic-api-401132033262.asia-south1.run.app'  // TLDR Music API (auth, library, AI playlists)
};

// Storage keys for auth
const AUTH_STORAGE_KEYS = {
    ACCESS_TOKEN: 'tldr-access-token',
    REFRESH_TOKEN: 'tldr-refresh-token',
    USER: 'tldr-user'
};

// Auth state
let currentUser = null;
let isAuthenticated = false;
let pendingPlayAction = null;

// Real-time sync state
let realtimeSyncInterval = null;
let lastSyncTimestamp = 0;
let isSyncing = false;
let hasMultipleSessions = false;
const REALTIME_SYNC_INTERVAL = 2000; // 2 seconds

// Track pending local changes to prevent pullFromCloud from overwriting them
const pendingLocalChanges = new Set();
const SESSION_CHECK_INTERVAL = 60000; // Check for multiple sessions every 60 seconds

// Generate a unique session ID for this browser tab (persists in sessionStorage)
function getSessionId() {
    let sessionId = sessionStorage.getItem('tldr-session-id');
    if (!sessionId) {
        sessionId = 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
        sessionStorage.setItem('tldr-session-id', sessionId);
    }
    return sessionId;
}

// ============================================================
// DEVICE FINGERPRINTING (for guest mode)
// ============================================================

/**
 * Generate or retrieve device fingerprint for guest mode
 */
function getOrCreateDeviceFingerprint() {
    // Check if we already have a device ID stored
    let deviceId = localStorage.getItem('tldr-device-id');

    if (!deviceId) {
        // Generate a unique device fingerprint
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillText('browser fingerprint', 2, 2);
        const canvasFingerprint = canvas.toDataURL();

        // Combine various browser properties
        const fingerprint = [
            navigator.userAgent,
            navigator.language,
            screen.colorDepth,
            screen.width + 'x' + screen.height,
            new Date().getTimezoneOffset(),
            canvasFingerprint.substring(0, 100)
        ].join('|');

        // Simple hash function
        let hash = 0;
        for (let i = 0; i < fingerprint.length; i++) {
            const char = fingerprint.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }

        deviceId = 'device_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36);
        localStorage.setItem('tldr-device-id', deviceId);
    }

    return deviceId;
}

// ============================================================
// TEST MODE (for development/testing)
// ============================================================

/**
 * Enable test mode with a mock user (for development only)
 * Call this from browser console: enableTestMode()
 */
function enableTestMode() {
    const testUser = {
        id: 'test-user-123',
        google_id: 'test-google-id',
        email: 'testuser@example.com',
        name: 'Test User',
        // Use a reliable placeholder image for testing
        picture: 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&s=96'
    };

    currentUser = testUser;
    isAuthenticated = true;

    localStorage.setItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, 'test-token-for-development');
    localStorage.setItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN, 'test-refresh-token');
    localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(testUser));

    updateAuthUI();
    showToast('Test mode enabled - logged in as Test User');
    console.log('Test mode enabled. Use disableTestMode() to log out.');
}

/**
 * Disable test mode and log out
 */
function disableTestMode() {
    logout();
    console.log('Test mode disabled.');
}

// ============================================================
// GOOGLE SIGN-IN INITIALIZATION
// ============================================================

/**
 * Initialize Google Sign-In by loading the GSI library
 */
function initGoogleAuth() {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
        console.log('Google Identity Services loaded');
        setupGoogleSignIn();
    };
    script.onerror = () => {
        console.error('Failed to load Google Identity Services');
    };
    document.head.appendChild(script);
}

/**
 * Setup Google Sign-In after library loads
 */
function setupGoogleSignIn() {
    if (typeof google === 'undefined' || !google.accounts) {
        console.error('Google Identity Services not available');
        return;
    }

    google.accounts.id.initialize({
        client_id: AUTH_CONFIG.GOOGLE_CLIENT_ID,
        callback: handleGoogleCallback,
        auto_select: false,
        cancel_on_tap_outside: true
    });
}

/**
 * Handle callback from Google Sign-In
 */
async function handleGoogleCallback(response) {
    try {
        showToast('Signing in...');

        // Get local data to sync on first login
        const localData = {
            favorites: JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES)) || [],
            history: JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY)) || [],
            queue: JSON.parse(localStorage.getItem(STORAGE_KEYS.QUEUE)) || [],
            preferences: {
                shuffle: localStorage.getItem(STORAGE_KEYS.SHUFFLE) === 'true',
                repeat: localStorage.getItem(STORAGE_KEYS.REPEAT) || 'off'
            }
        };

        // Send to server
        const res = await fetch(`${AUTH_CONFIG.API_BASE}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_token: response.credential
            })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || 'Login failed');
        }

        const data = await res.json();

        // Store tokens
        localStorage.setItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
        localStorage.setItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
        localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(data.user));

        // Update state
        currentUser = data.user;
        isAuthenticated = true;

        // Clear old guest data when logging in with Google for the first time
        // This prevents old localStorage data from being synced to new account
        if (data.user.auth_method === 'google' && !data.user.onboarding_completed) {
            console.log('New Google account - clearing old guest data');
            localStorage.removeItem(STORAGE_KEYS.FAVORITES);
            localStorage.removeItem(STORAGE_KEYS.HISTORY);
            localStorage.removeItem(STORAGE_KEYS.QUEUE);
            localStorage.removeItem(STORAGE_KEYS.PLAYLISTS);
            localStorage.removeItem('tldr-total-songs-played');
        }

        // Sync data from cloud
        await syncFromCloud();

        // Start real-time sync system
        startRealtimeSync();

        // Save pending action before closing modal (closeLoginModal clears it)
        const actionToExecute = pendingPlayAction;

        // Close login modal
        closeLoginModal();

        // Update UI
        updateAuthUI();
        showToast(`Welcome, ${data.user.name}!`);

        // Check if user needs onboarding
        if (shouldShowOnboarding && shouldShowOnboarding()) {
            setTimeout(() => showOnboardingWizard(), 500);
        }

        // Execute pending play action if any (after UI is ready)
        if (actionToExecute) {
            setTimeout(() => actionToExecute(), 100);
        }

    } catch (error) {
        console.error('Login error:', error);
        // Check if it's a network/CORS error (API not available)
        if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
            showToast('Sign in is temporarily unavailable. Please try again later.');
        } else {
            showToast('Login failed: ' + error.message);
        }
    }
}

/**
 * Create guest user session
 */
async function createGuestUser() {
    try {
        showToast('Creating guest session...');

        const deviceId = getOrCreateDeviceFingerprint();

        const res = await fetch(`${AUTH_CONFIG.API_BASE}/api/auth/guest`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_id: deviceId })
        });

        if (!res.ok) {
            const error = await res.json();
            throw new Error(error.detail || 'Failed to create guest session');
        }

        const data = await res.json();

        // Store tokens
        localStorage.setItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
        localStorage.setItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN, data.refresh_token);
        localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(data.user));

        // Update state
        currentUser = data.user;
        isAuthenticated = true;

        // Save pending action before closing modal
        const actionToExecute = pendingPlayAction;

        // Close login modal
        closeLoginModal();

        // Update UI
        updateAuthUI();
        showToast('Guest mode enabled!');

        // Check if user needs onboarding
        if (shouldShowOnboarding && shouldShowOnboarding()) {
            setTimeout(() => showOnboardingWizard(), 500);
        }

        // Execute pending play action if any (after UI is ready)
        if (actionToExecute) {
            setTimeout(() => actionToExecute(), 100);
        }

    } catch (error) {
        console.error('Guest mode error:', error);
        showToast('Failed to create guest session: ' + error.message);
    }
}

// ============================================================
// AUTH STATE MANAGEMENT
// ============================================================

/**
 * Check auth state on page load
 */
function checkAuthState() {
    const token = localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
    const userJson = localStorage.getItem(AUTH_STORAGE_KEYS.USER);

    console.log('checkAuthState: token exists:', !!token, 'userJson exists:', !!userJson);

    if (token && userJson) {
        try {
            currentUser = JSON.parse(userJson);
            isAuthenticated = true;
            console.log('checkAuthState: User authenticated, starting real-time sync');
            updateAuthUI();

            // Verify token is still valid (async)
            verifyToken();

            // Start real-time sync system
            startRealtimeSync();
        } catch (e) {
            console.error('Error parsing stored user:', e);
            logout();
        }
    } else {
        console.log('checkAuthState: Not authenticated');
    }
}

/**
 * Verify access token is still valid
 */
async function verifyToken() {
    try {
        const res = await fetchWithAuth('/api/me/library');
        if (!res.ok) {
            // Token expired, try refresh
            await refreshAccessToken();
        }
    } catch (error) {
        console.error('Token verification failed:', error);
        // Don't logout on network errors, only on auth errors
        if (error.message.includes('401') || error.message.includes('expired')) {
            logout();
        }
    }
}

/**
 * Refresh access token using refresh token
 */
async function refreshAccessToken() {
    const refreshToken = localStorage.getItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
    if (!refreshToken) {
        throw new Error('No refresh token');
    }

    const res = await fetch(`${AUTH_CONFIG.API_BASE}/api/auth/token/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken })
    });

    if (!res.ok) {
        throw new Error('Refresh failed');
    }

    const data = await res.json();
    localStorage.setItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN, data.access_token);
}

/**
 * Get auth headers for API requests
 */
function getAuthHeaders() {
    const token = localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
    if (token) {
        return { 'Authorization': `Bearer ${token}` };
    }
    return {};
}

/**
 * Make authenticated fetch request with auto token refresh
 */
async function fetchWithAuth(endpoint, options = {}) {
    const token = localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);

    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${token}`
    };

    let res = await fetch(`${AUTH_CONFIG.API_BASE}${endpoint}`, { ...options, headers });

    // If 401, try refreshing token and retry
    if (res.status === 401) {
        try {
            await refreshAccessToken();
            const newToken = localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
            headers['Authorization'] = `Bearer ${newToken}`;
            res = await fetch(`${AUTH_CONFIG.API_BASE}${endpoint}`, { ...options, headers });
        } catch (e) {
            logout();
            throw new Error('Session expired, please login again');
        }
    }

    return res;
}

/**
 * Logout user
 */
function logout() {
    // Stop real-time sync
    stopRealtimeSync();

    // Stop playback and clear player
    if (typeof player !== 'undefined' && player && typeof player.stopVideo === 'function') {
        player.stopVideo();
    }
    if (typeof theaterPlayer !== 'undefined' && theaterPlayer && typeof theaterPlayer.stopVideo === 'function') {
        theaterPlayer.stopVideo();
    }

    // Reset playback state
    if (typeof isPlaying !== 'undefined') {
        isPlaying = false;
    }
    if (typeof currentSongIndex !== 'undefined') {
        currentSongIndex = -1;
    }
    if (typeof currentPlayingVideoId !== 'undefined') {
        currentPlayingVideoId = null;
    }
    if (typeof isRegionalSongPlaying !== 'undefined') {
        isRegionalSongPlaying = false;
    }

    // Hide player bar
    const playerBar = document.getElementById('playerBar');
    if (playerBar) {
        playerBar.classList.remove('visible');
    }

    // Stop progress tracking
    if (typeof stopProgressTracking === 'function') {
        stopProgressTracking();
    }

    // Clear now-playing indicators from all song cards
    if (typeof updateNowPlayingIndicators === 'function') {
        updateNowPlayingIndicators();
    }

    // Remove playing state from all cards
    document.querySelectorAll('.song-card.playing, .detail-song.now-playing').forEach(el => {
        el.classList.remove('playing', 'now-playing');
    });

    // Update play/pause button state
    const playPauseBtn = document.getElementById('playPauseBtn');
    if (playPauseBtn) {
        playPauseBtn.classList.remove('playing');
    }

    localStorage.removeItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(AUTH_STORAGE_KEYS.USER);

    // Clear user data (favorites, history, and playlists)
    localStorage.removeItem(STORAGE_KEYS.FAVORITES);
    localStorage.removeItem(STORAGE_KEYS.HISTORY);
    localStorage.removeItem(STORAGE_KEYS.PLAYLISTS);

    currentUser = null;
    isAuthenticated = false;

    // Reset global favorites array and re-render (hide section)
    if (typeof favorites !== 'undefined') {
        favorites.length = 0; // Clear array without reassigning
    }
    if (typeof renderFavoritesSection === 'function') {
        renderFavoritesSection();
    }

    // Reset play history array
    if (typeof playHistory !== 'undefined') {
        playHistory.length = 0;
    }

    // Reset playlists array and re-render
    if (typeof playlists !== 'undefined') {
        playlists.length = 0;
    }
    if (typeof renderPlaylistPanel === 'function') {
        renderPlaylistPanel();
    }

    // Hide playlists view if visible and return to main content
    if (typeof isPlaylistPanelVisible !== 'undefined' && isPlaylistPanelVisible) {
        if (typeof hidePlaylistsView === 'function') {
            hidePlaylistsView();
        }
    }

    // Hide all detail views (favorites, history, playlist detail, chart detail)
    const detailViews = ['favoritesDetailView', 'historyDetailView', 'playlistDetailView', 'chartDetailView'];
    detailViews.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });

    // Close all modals and panels
    const modalsAndPanels = [
        'createPlaylistModal',
        'addToPlaylistModal',
        'sharePlaylistModal',
        'exportPlaylistModal',
        'artworkModal',
        'profilePanel',
        'publicProfileView'
    ];
    modalsAndPanels.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('visible');
    });

    // Restore body scroll (in case profile panel was open)
    document.body.style.overflow = '';

    // Hide context menu
    if (typeof hidePlaylistContextMenu === 'function') {
        hidePlaylistContextMenu();
    }

    // Show main content
    const mainContent = document.getElementById('mainContent');
    if (mainContent) mainContent.style.display = 'block';

    updateAuthUI();
    showToast('Logged out');
}

// ============================================================
// CLOUD SYNC
// ============================================================

/**
 * Sync data from cloud after login
 */
async function syncFromCloud() {
    if (!isAuthenticated) return;

    try {
        const localData = {
            local_favorites: JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES)) || [],
            local_history: JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY)) || [],
            local_total_songs_played: parseInt(localStorage.getItem('tldr-total-songs-played')) || 0,
            local_queue: JSON.parse(localStorage.getItem(STORAGE_KEYS.QUEUE)) || [],
            local_playlists: JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS)) || [],
            local_preferences: {
                shuffle: localStorage.getItem(STORAGE_KEYS.SHUFFLE) === 'true',
                repeat: localStorage.getItem(STORAGE_KEYS.REPEAT) || 'off'
            }
        };

        const res = await fetchWithAuth('/api/me/library/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localData)
        });

        if (res.ok) {
            const merged = await res.json();

            // Update localStorage with merged data
            if (merged.merged_favorites) {
                localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(merged.merged_favorites));
            }
            if (merged.merged_history) {
                localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(merged.merged_history));
            }
            // Sync total songs played (use max of local and server)
            if (merged.total_songs_played !== undefined) {
                const localTotal = parseInt(localStorage.getItem('tldr-total-songs-played')) || 0;
                const serverTotal = merged.total_songs_played || 0;
                const maxTotal = Math.max(localTotal, serverTotal);
                localStorage.setItem('tldr-total-songs-played', maxTotal);
            }
            if (merged.merged_queue) {
                localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(merged.merged_queue));
            }
            if (merged.merged_playlists) {
                localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(merged.merged_playlists));
            }
            if (merged.preferences) {
                localStorage.setItem(STORAGE_KEYS.SHUFFLE, merged.preferences.shuffle);
                localStorage.setItem(STORAGE_KEYS.REPEAT, merged.preferences.repeat);
            }
            if (merged.recent_searches) {
                localStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(merged.recent_searches));
                // Update global recentSearches array
                if (typeof recentSearches !== 'undefined') {
                    recentSearches.length = 0;
                    merged.recent_searches.forEach(s => recentSearches.push(s));
                }
            }

            // Reload user data into app state
            if (typeof loadUserData === 'function') {
                loadUserData();
            }

            // Re-render UI
            if (typeof initializePlaybackUI === 'function') {
                initializePlaybackUI();
            }
            if (typeof renderFavoritesSection === 'function') {
                renderFavoritesSection();
            }
            if (typeof renderPlaylistPanel === 'function') {
                renderPlaylistPanel();
            }
            if (typeof renderRecentSearches === 'function') {
                renderRecentSearches();
            }

            console.log('Synced from cloud:', {
                favorites: merged.merged_favorites?.length || 0,
                history: merged.merged_history?.length || 0,
                queue: merged.merged_queue?.length || 0,
                playlists: merged.merged_playlists?.length || 0,
                recent_searches: merged.recent_searches?.length || 0
            });
        }
    } catch (error) {
        console.error('Sync from cloud error:', error);
    }
}

/**
 * Sync specific data type to cloud
 */
async function syncToCloud(type) {
    if (!isAuthenticated) return;

    try {
        let endpoint, body;

        switch (type) {
            case 'favorites':
                endpoint = '/api/me/favorites';
                body = { favorites: JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES)) || [] };
                break;
            case 'history':
                endpoint = '/api/me/history';
                body = {
                    history: JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY)) || [],
                    total_songs_played: parseInt(localStorage.getItem('tldr-total-songs-played')) || 0
                };
                break;
            case 'queue':
                endpoint = '/api/me/queue';
                const localQueue = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUEUE)) || [];
                body = { queue: localQueue };
                break;
            case 'preferences':
                endpoint = '/api/me/preferences';
                body = {
                    shuffle: localStorage.getItem(STORAGE_KEYS.SHUFFLE) === 'true',
                    repeat: localStorage.getItem(STORAGE_KEYS.REPEAT) || 'off'
                };
                break;
            case 'recent_searches':
                endpoint = '/api/me/recent-searches';
                body = {
                    searches: JSON.parse(localStorage.getItem(STORAGE_KEYS.RECENT_SEARCHES) || '[]')
                };
                break;
            case 'playlists':
                endpoint = '/api/me/playlists';
                const localPlaylists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS)) || [];
                body = { playlists: localPlaylists };

                // Handle playlist sync specially to update IDs
                const playlistRes = await fetchWithAuth(endpoint, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body)
                });

                if (playlistRes.ok) {
                    const syncResult = await playlistRes.json();
                    if (syncResult.playlists) {
                        // Merge server response with local data to preserve songs
                        // Server response has updated IDs but no songs array
                        const mergedPlaylists = syncResult.playlists.map(serverPlaylist => {
                            // Find matching local playlist by old ID or name
                            const localMatch = localPlaylists.find(lp =>
                                lp.id === serverPlaylist.id ||
                                (lp.name === serverPlaylist.name && lp.id.startsWith('pl_'))
                            );

                            return {
                                ...serverPlaylist,
                                // Preserve songs from local playlist if server doesn't have them
                                songs: serverPlaylist.songs || localMatch?.songs || [],
                                song_count: serverPlaylist.song_count ?? localMatch?.songs?.length ?? 0,
                                cover_urls: serverPlaylist.cover_urls?.length > 0
                                    ? serverPlaylist.cover_urls
                                    : (localMatch?.cover_urls || []),
                                // Preserve custom artwork from local playlist
                                artwork_url: serverPlaylist.artwork_url || localMatch?.artwork_url || null,
                                custom_artwork: serverPlaylist.custom_artwork ?? localMatch?.custom_artwork ?? false,
                                is_public: serverPlaylist.is_public ?? false,
                                is_owner: serverPlaylist.is_owner ?? true
                            };
                        });

                        // Update local storage with merged playlists
                        localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(mergedPlaylists));

                        // Update global playlists array
                        if (typeof playlists !== 'undefined') {
                            playlists.length = 0;
                            mergedPlaylists.forEach(p => playlists.push(p));
                        }

                        // Re-render playlists panel
                        if (typeof renderPlaylistPanel === 'function') {
                            renderPlaylistPanel();
                        }
                    }
                    console.log(`Synced playlists to cloud: ${syncResult.count} playlists`);
                }
                // Clear pending flag after successful sync
                pendingLocalChanges.delete('playlists');
                return;
            default:
                return;
        }

        await fetchWithAuth(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        // Clear pending flag after successful sync
        pendingLocalChanges.delete(type);
        console.log(`Synced ${type} to cloud`);
    } catch (error) {
        // Clear pending flag even on error to prevent permanent blocking
        pendingLocalChanges.delete(type);
        console.error(`Sync ${type} error:`, error);
    }
}

/**
 * Debounce function for sync calls
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Debounced sync functions (1 second delay)
// These set pending flags to prevent pullFromCloud from overwriting local changes
const debouncedSyncFavorites = debounce(() => syncToCloud('favorites'), 1000);
const debouncedSyncHistory = debounce(() => syncToCloud('history'), 1000);
const debouncedSyncQueue = debounce(() => syncToCloud('queue'), 1000);
const debouncedSyncPreferences = debounce(() => syncToCloud('preferences'), 1000);
const debouncedSyncPlaylists = debounce(() => syncToCloud('playlists'), 1000);
const debouncedSyncRecentSearches = debounce(() => syncToCloud('recent_searches'), 1000);

// Wrapper functions that set pending flag before debounced sync
function triggerFavoritesSync() {
    pendingLocalChanges.add('favorites');
    debouncedSyncFavorites();
}
function triggerHistorySync() {
    pendingLocalChanges.add('history');
    debouncedSyncHistory();
}
function triggerQueueSync() {
    pendingLocalChanges.add('queue');
    debouncedSyncQueue();
}
function triggerPlaylistsSync() {
    pendingLocalChanges.add('playlists');
    debouncedSyncPlaylists();
}

// ============================================================
// REAL-TIME SYNC (Background polling - only when multiple sessions)
// ============================================================

/**
 * Start real-time sync system
 * - Syncs on tab visibility change (when user comes back to tab)
 * - Polls every 30 seconds only if user has multiple active sessions
 */
function startRealtimeSync() {
    if (!isAuthenticated) return;

    console.log('Initializing real-time sync system (2s interval)');
    lastSyncTimestamp = Date.now();

    // Add visibility change listener - sync when tab becomes visible
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Add storage event listener - sync when another tab in same browser makes changes
    window.addEventListener('storage', handleStorageChange);

    // Check for multiple sessions and start polling if needed
    checkMultipleSessions();

    // Periodically check for multiple sessions
    setInterval(checkMultipleSessions, SESSION_CHECK_INTERVAL);
}

/**
 * Handle visibility change - sync when tab becomes visible
 */
function handleVisibilityChange() {
    if (document.visibilityState === 'visible' && isAuthenticated) {
        // Only sync if it's been more than 5 seconds since last sync
        if (Date.now() - lastSyncTimestamp > 5000) {
            console.log('Tab became visible - syncing from cloud');
            pullFromCloud();
        }
    }
}

/**
 * Handle storage changes from other tabs
 */
function handleStorageChange(event) {
    // If a cloud-synced key changed in another tab, update our state
    const syncKeys = [
        STORAGE_KEYS.FAVORITES,
        STORAGE_KEYS.HISTORY,
        STORAGE_KEYS.PLAYLISTS,
        STORAGE_KEYS.QUEUE,
        STORAGE_KEYS.SHUFFLE,
        STORAGE_KEYS.REPEAT,
        STORAGE_KEYS.RECENT_SEARCHES
    ];

    if (syncKeys.includes(event.key) && event.newValue !== event.oldValue) {
        console.log(`Storage changed in another tab: ${event.key}`);
        // Reload the data into memory
        if (typeof loadUserData === 'function') {
            loadUserData();
        }
        // Re-render affected UI
        if (event.key === STORAGE_KEYS.FAVORITES && typeof renderFavoritesSection === 'function') {
            renderFavoritesSection();
        }
        if (event.key === STORAGE_KEYS.PLAYLISTS && typeof renderPlaylistPanel === 'function') {
            renderPlaylistPanel();
        }
    }
}

/**
 * Check if user has multiple active sessions
 * If yes, enable background polling
 */
async function checkMultipleSessions() {
    if (!isAuthenticated) return;

    try {
        const res = await fetchWithAuth('/api/me/session/ping', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: getSessionId() })
        });

        if (res.ok) {
            const data = await res.json();
            const hadMultipleSessions = hasMultipleSessions;
            hasMultipleSessions = data.multiple_sessions;

            console.log(`Session check: ${data.active_sessions} active session(s), multiple=${hasMultipleSessions}`);

            if (hasMultipleSessions && !hadMultipleSessions) {
                // Just detected multiple sessions - start polling
                console.log('Multiple sessions detected - enabling real-time sync polling');
                startPolling();
                showToast('Syncing across devices enabled');
            } else if (!hasMultipleSessions && hadMultipleSessions) {
                // No more multiple sessions - stop polling
                console.log('Single session detected - disabling real-time sync polling');
                stopPolling();
            }
        }
    } catch (error) {
        // Silently fail - session ping is optional
        console.debug('Session ping failed:', error);
    }
}

/**
 * Start background polling (only when multiple sessions detected)
 */
function startPolling() {
    if (realtimeSyncInterval) {
        clearInterval(realtimeSyncInterval);
    }

    realtimeSyncInterval = setInterval(() => {
        if (isAuthenticated && !isSyncing && hasMultipleSessions) {
            pullFromCloud();
        }
    }, REALTIME_SYNC_INTERVAL);
}

/**
 * Stop background polling
 */
function stopPolling() {
    if (realtimeSyncInterval) {
        clearInterval(realtimeSyncInterval);
        realtimeSyncInterval = null;
    }
}

/**
 * Stop real-time sync system completely
 */
function stopRealtimeSync() {
    stopPolling();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('storage', handleStorageChange);
    hasMultipleSessions = false;
    console.log('Stopped real-time sync');
}

/**
 * Pull data from cloud and update local state
 * This is the "receive" side of real-time sync
 */
async function pullFromCloud() {
    if (!isAuthenticated || isSyncing) return;

    isSyncing = true;
    updateSyncIndicator('syncing');

    try {
        const res = await fetchWithAuth('/api/me/library/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}) // Send empty object for pull-only
        });

        if (res.ok) {
            const serverData = await res.json();
            let hasChanges = false;

            // Compare and update favorites (skip if local changes pending)
            if (serverData.merged_favorites && !pendingLocalChanges.has('favorites')) {
                const localFavorites = JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES) || '[]');
                if (!arraysEqual(localFavorites, serverData.merged_favorites, 'videoId')) {
                    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(serverData.merged_favorites));
                    if (typeof favorites !== 'undefined') {
                        favorites.length = 0;
                        serverData.merged_favorites.forEach(f => favorites.push(f));
                    }
                    if (typeof renderFavoritesSection === 'function') {
                        renderFavoritesSection();
                    }
                    if (typeof updateFavoriteButtons === 'function') {
                        updateFavoriteButtons();
                    }
                    hasChanges = true;
                }
            }

            // Compare and update history (skip if local changes pending)
            if (serverData.merged_history && !pendingLocalChanges.has('history')) {
                const localHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY) || '[]');
                if (!arraysEqual(localHistory, serverData.merged_history, 'videoId')) {
                    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(serverData.merged_history));
                    if (typeof playHistory !== 'undefined') {
                        playHistory.length = 0;
                        serverData.merged_history.forEach(h => playHistory.push(h));
                    }
                    if (typeof renderHistorySection === 'function') {
                        renderHistorySection();
                    }
                    hasChanges = true;
                }
            }

            // Compare and update queue (skip if local changes pending)
            if (serverData.merged_queue && !pendingLocalChanges.has('queue')) {
                const localQueue = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUEUE) || '[]');
                if (!arraysEqual(localQueue, serverData.merged_queue, 'videoId')) {
                    localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(serverData.merged_queue));
                    if (typeof queue !== 'undefined') {
                        queue.length = 0;
                        serverData.merged_queue.forEach(q => queue.push(q));
                    }
                    if (typeof renderQueuePanel === 'function') {
                        renderQueuePanel();
                    }
                    hasChanges = true;
                }
            }

            // Compare and update playlists (skip if local changes pending)
            if (serverData.merged_playlists && !pendingLocalChanges.has('playlists')) {
                const localPlaylists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS) || '[]');
                if (!playlistsEqual(localPlaylists, serverData.merged_playlists)) {
                    localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(serverData.merged_playlists));
                    if (typeof playlists !== 'undefined') {
                        playlists.length = 0;
                        serverData.merged_playlists.forEach(p => playlists.push(p));
                    }
                    if (typeof renderPlaylistPanel === 'function') {
                        renderPlaylistPanel();
                    }
                    // Re-render playlist detail if currently viewing one
                    if (typeof currentPlaylistId !== 'undefined' && currentPlaylistId) {
                        if (typeof renderPlaylistDetail === 'function') {
                            renderPlaylistDetail(currentPlaylistId);
                        }
                    }
                    hasChanges = true;
                }
            }

            // Update preferences
            if (serverData.preferences) {
                const localShuffle = localStorage.getItem(STORAGE_KEYS.SHUFFLE) === 'true';
                const localRepeat = localStorage.getItem(STORAGE_KEYS.REPEAT) || 'off';

                if (serverData.preferences.shuffle !== localShuffle || serverData.preferences.repeat !== localRepeat) {
                    localStorage.setItem(STORAGE_KEYS.SHUFFLE, serverData.preferences.shuffle);
                    localStorage.setItem(STORAGE_KEYS.REPEAT, serverData.preferences.repeat);
                    if (typeof shuffleEnabled !== 'undefined') {
                        shuffleEnabled = serverData.preferences.shuffle;
                    }
                    if (typeof repeatMode !== 'undefined') {
                        repeatMode = serverData.preferences.repeat;
                    }
                    if (typeof updatePlaybackUI === 'function') {
                        updatePlaybackUI();
                    }
                    hasChanges = true;
                }
            }

            // Update recent searches
            if (serverData.recent_searches) {
                const localSearches = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECENT_SEARCHES) || '[]');
                if (JSON.stringify(localSearches) !== JSON.stringify(serverData.recent_searches)) {
                    localStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(serverData.recent_searches));
                    if (typeof recentSearches !== 'undefined') {
                        recentSearches.length = 0;
                        serverData.recent_searches.forEach(s => recentSearches.push(s));
                    }
                    if (typeof renderRecentSearches === 'function') {
                        renderRecentSearches();
                    }
                    hasChanges = true;
                }
            }

            lastSyncTimestamp = Date.now();
            updateSyncIndicator(hasChanges ? 'updated' : 'synced');

            if (hasChanges) {
                console.log('Real-time sync: Updated with changes from cloud');
            }
        }
    } catch (error) {
        console.error('Real-time sync error:', error);
        updateSyncIndicator('error');
    } finally {
        isSyncing = false;
    }
}

/**
 * Compare two arrays for equality by a key
 */
function arraysEqual(arr1, arr2, key) {
    if (!arr1 || !arr2) return arr1 === arr2;
    if (arr1.length !== arr2.length) return false;

    const ids1 = arr1.map(item => item[key] || item.id).sort();
    const ids2 = arr2.map(item => item[key] || item.id).sort();

    return JSON.stringify(ids1) === JSON.stringify(ids2);
}

/**
 * Compare playlists for equality (by id and song count)
 */
function playlistsEqual(local, server) {
    if (!local || !server) return local === server;
    if (local.length !== server.length) return false;

    // Create maps for comparison
    const localMap = new Map(local.map(p => [p.id, p]));

    for (const serverPlaylist of server) {
        const localPlaylist = localMap.get(serverPlaylist.id);
        if (!localPlaylist) return false;

        // Compare basic properties
        if (localPlaylist.name !== serverPlaylist.name) return false;
        if ((localPlaylist.songs?.length || 0) !== (serverPlaylist.songs?.length || serverPlaylist.song_count || 0)) return false;
        if (localPlaylist.is_public !== serverPlaylist.is_public) return false;
    }

    return true;
}

/**
 * Update sync indicator in UI
 */
function updateSyncIndicator(status) {
    let indicator = document.getElementById('syncIndicator');

    // Create indicator if it doesn't exist
    if (!indicator) {
        indicator = document.createElement('div');
        indicator.id = 'syncIndicator';
        indicator.className = 'sync-indicator';
        document.body.appendChild(indicator);
    }

    // Update status
    indicator.className = `sync-indicator ${status}`;

    switch (status) {
        case 'syncing':
            indicator.innerHTML = `
                <svg class="sync-icon spinning" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                    <path d="M3 3v5h5"></path>
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path>
                    <path d="M16 21h5v-5"></path>
                </svg>
            `;
            indicator.title = 'Syncing...';
            break;
        case 'synced':
            indicator.innerHTML = `
                <svg class="sync-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
            `;
            indicator.title = 'Synced';
            // Hide after 2 seconds
            setTimeout(() => {
                if (indicator.classList.contains('synced')) {
                    indicator.classList.add('hidden');
                }
            }, 2000);
            break;
        case 'updated':
            indicator.innerHTML = `
                <svg class="sync-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                    <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
            `;
            indicator.title = 'Updated from cloud';
            // Hide after 3 seconds
            setTimeout(() => {
                if (indicator.classList.contains('updated')) {
                    indicator.classList.add('hidden');
                }
            }, 3000);
            break;
        case 'error':
            indicator.innerHTML = `
                <svg class="sync-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
            `;
            indicator.title = 'Sync error';
            // Hide after 5 seconds
            setTimeout(() => {
                if (indicator.classList.contains('error')) {
                    indicator.classList.add('hidden');
                }
            }, 5000);
            break;
    }

    // Remove hidden class to show
    indicator.classList.remove('hidden');
}

/**
 * Force an immediate sync from cloud
 */
function forceSync() {
    if (!isAuthenticated) {
        showToast('Please sign in to sync');
        return;
    }

    pullFromCloud();
    showToast('Syncing...');
}

// ============================================================
// LOGIN MODAL
// ============================================================

/**
 * Show login modal when user tries to play without auth
 */
function showLoginModal(playAction) {
    pendingPlayAction = playAction;

    let modal = document.getElementById('loginModal');
    if (!modal) {
        createLoginModal();
        modal = document.getElementById('loginModal');
    }

    modal.classList.add('visible');

    // Render Google button
    if (typeof google !== 'undefined' && google.accounts) {
        setTimeout(() => {
            google.accounts.id.renderButton(
                document.getElementById('googleSignInBtn'),
                {
                    theme: 'outline',
                    size: 'large',
                    width: 300,
                    text: 'continue_with',
                    shape: 'rectangular',
                    logo_alignment: 'center'
                }
            );
        }, 100);
    }
}

/**
 * Close login modal
 */
function closeLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.remove('visible');
    }
    pendingPlayAction = null;
}

/**
 * Create login modal element
 */
function createLoginModal() {
    const modal = document.createElement('div');
    modal.id = 'loginModal';
    modal.className = 'login-modal';
    modal.innerHTML = `
        <div class="login-modal-overlay" onclick="closeLoginModal()"></div>
        <div class="login-modal-content">
            <button class="login-modal-close" onclick="closeLoginModal()" aria-label="Close">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            <div class="login-modal-logo">
                <span class="logo-tldr">TLDR</span><span class="logo-music">Music</span>
            </div>
            <h2>Sign in to Play</h2>
            <p>Create a free account to start streaming and save your favorites across devices.</p>
            <div id="googleSignInBtn"></div>
            <div class="login-modal-divider">
                <span>or</span>
            </div>
            <button class="guest-signin-btn" onclick="createGuestUser()">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                Continue as Guest
            </button>
            <p class="login-modal-terms">By continuing, you agree to our Terms of Service.</p>
        </div>
    `;
    document.body.appendChild(modal);
}

// ============================================================
// AUTH UI
// ============================================================

/**
 * Update UI based on auth state
 */
function updateAuthUI() {
    const headerMeta = document.querySelector('.header-meta');
    if (!headerMeta) return;

    // Remove existing auth button
    const existingBtn = document.getElementById('authBtn');
    if (existingBtn) existingBtn.remove();

    // Update sidebar profile button visibility
    const sidebarProfileBtn = document.getElementById('sidebarProfileBtn');
    if (sidebarProfileBtn) {
        sidebarProfileBtn.style.display = isAuthenticated ? 'flex' : 'none';
    }

    if (isAuthenticated && currentUser) {
        // Show user avatar with dropdown menu
        const authBtn = document.createElement('div');
        authBtn.id = 'authBtn';
        authBtn.className = 'auth-btn logged-in';

        // Get user initials for fallback
        const initials = (currentUser.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

        // Create inline SVG fallback (no network required)
        const fallbackSvg = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><rect fill="#D4AF37" width="56" height="56" rx="28"/><text x="28" y="35" text-anchor="middle" fill="#1a1a2e" font-family="system-ui,sans-serif" font-size="20" font-weight="600">${initials}</text></svg>`)}`;

        // Process Google profile photo URL to ensure it loads
        let avatarUrl = currentUser.picture || '';
        if (avatarUrl) {
            // Google profile photos: ensure proper size parameter
            if (avatarUrl.includes('googleusercontent.com')) {
                // Remove existing size param and add proper one
                avatarUrl = avatarUrl.replace(/=s\d+-c/, '').replace(/=s\d+/, '');
                avatarUrl = avatarUrl + (avatarUrl.includes('?') ? '&' : '?') + 's=96-c';
            }
        }

        // Create the auth button with avatar and dropdown
        const firstName = currentUser.name ? currentUser.name.split(' ')[0] : 'User';

        authBtn.innerHTML = `
            <img src="${avatarUrl || fallbackSvg}"
                 alt="${currentUser.name}"
                 class="user-avatar"
                 referrerpolicy="no-referrer"
                 onerror="this.onerror=null; this.src='${fallbackSvg}';">
            <span class="user-name">${firstName}</span>
            <div class="auth-dropdown">
                <button class="auth-dropdown-item auth-dropdown-profile" id="authDropdownProfile">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                    </svg>
                    Profile
                </button>
                <button class="auth-dropdown-item auth-dropdown-logout" id="authDropdownLogout">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
                        <polyline points="16 17 21 12 16 7"></polyline>
                        <line x1="21" y1="12" x2="9" y2="12"></line>
                    </svg>
                    Sign Out
                </button>
            </div>
        `;
        headerMeta.insertBefore(authBtn, headerMeta.firstChild);

        // Add click handlers for dropdown items
        const profileBtn = document.getElementById('authDropdownProfile');
        const logoutBtn = document.getElementById('authDropdownLogout');

        if (profileBtn) {
            profileBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                showProfilePanel();
            });
        }

        if (logoutBtn) {
            logoutBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                logout();
            });
        }
    } else {
        // Show login button
        const authBtn = document.createElement('button');
        authBtn.id = 'authBtn';
        authBtn.className = 'auth-btn';
        authBtn.textContent = 'Sign In';
        authBtn.onclick = () => showLoginModal(null);
        headerMeta.insertBefore(authBtn, headerMeta.firstChild);
    }
}

// ============================================================
// AUTH CHECK FOR PLAYBACK
// ============================================================

/**
 * Check if user can play (is authenticated)
 * If not, show login modal with callback
 */
function requireAuth(callback) {
    if (isAuthenticated) {
        return true;
    }
    showLoginModal(callback);
    return false;
}

// ============================================================
// PROFILE PANEL
// ============================================================

/**
 * Show profile page
 */
function showProfilePanel() {
    if (!isAuthenticated || !currentUser) {
        showLoginModal(null);
        return;
    }

    const panel = document.getElementById('profilePanel');
    if (!panel) return;

    // Update profile info
    const avatar = document.getElementById('profileAvatar');
    const name = document.getElementById('profileName');
    const topLanguageEl = document.getElementById('profileTopLanguage');
    const memberSinceEl = document.getElementById('profileMemberSince');

    if (avatar) {
        // Get user initials for fallback
        const initials = (currentUser.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        const fallbackSvg = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect fill="#D4AF37" width="96" height="96" rx="48"/><text x="48" y="58" text-anchor="middle" fill="#1a1a2e" font-family="system-ui,sans-serif" font-size="36" font-weight="600">${initials}</text></svg>`)}`;
        avatar.src = currentUser.picture || fallbackSvg;
        avatar.onerror = function() { this.onerror=null; this.src=fallbackSvg; };
        avatar.referrerPolicy = 'no-referrer';
    }
    if (name) name.textContent = currentUser.name;

    // Update username display
    const usernameEl = document.getElementById('profileUsername');
    if (usernameEl) {
        if (currentUser.username) {
            usernameEl.textContent = `@${currentUser.username}`;
            usernameEl.classList.add('has-username');
        } else {
            usernameEl.textContent = 'Set a username';
            usernameEl.classList.remove('has-username');
        }
    }

    // Update stats using unified functions from app.js
    if (typeof updateAllCounts === 'function') {
        updateAllCounts();
    }

    // Compute and display top language
    const favs = JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES)) || [];
    if (topLanguageEl) {
        const topLang = computeTopLanguage(favs);
        topLanguageEl.textContent = topLang || '-';
    }

    // Update member since date
    if (memberSinceEl) {
        const createdAt = currentUser.created_at || currentUser.createdAt;
        if (createdAt) {
            const date = new Date(createdAt);
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            memberSinceEl.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                    <line x1="16" y1="2" x2="16" y2="6"></line>
                    <line x1="8" y1="2" x2="8" y2="6"></line>
                    <line x1="3" y1="10" x2="21" y2="10"></line>
                </svg>
                Listening since ${monthNames[date.getMonth()]} ${date.getFullYear()}
            `;
        }
    }

    // Update profile banner gradient based on preferences
    updateProfileBanner(favs);

    // Render liked songs and history
    renderProfileLikedSongs();
    renderProfileHistory();

    // Render top artists
    renderProfileTopArtists(favs);

    // Render top/most played songs
    const userHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY)) || [];
    renderProfileTopSongs(userHistory);

    // Show page
    panel.classList.add('visible');
    document.body.style.overflow = 'hidden';

    // Close other panels
    const queuePanel = document.getElementById('queuePanel');
    if (queuePanel) queuePanel.classList.remove('visible');
}

/**
 * Close profile page
 */
function closeProfilePanel() {
    const panel = document.getElementById('profilePanel');
    if (panel) {
        panel.classList.remove('visible');
        document.body.style.overflow = '';
    }
}

/**
 * Render liked songs row in profile page
 */
function renderProfileLikedSongs() {
    const container = document.getElementById('profileLikedSongs');
    if (!container) return;

    const favorites = JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES)) || [];

    if (favorites.length === 0) {
        container.innerHTML = `
            <div class="profile-row-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                <p>No liked songs yet</p>
            </div>
        `;
        return;
    }

    container.innerHTML = favorites.map((song, index) => `
        <div class="profile-card" onclick="playFavoriteFromProfile(${index})">
            <div class="profile-card-artwork">
                <img src="${song.artwork || ''}"
                     alt="${song.title}"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23333%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23666%22 font-size=%2240%22>♪</text></svg>'">
                <button class="profile-card-play" onclick="event.stopPropagation(); playFavoriteFromProfile(${index})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                </button>
            </div>
            <div class="profile-card-info">
                <div class="profile-card-title">${song.title}</div>
                <div class="profile-card-artist">${song.artist}</div>
            </div>
        </div>
    `).join('');
}

/**
 * Render play history row in profile page
 */
function renderProfileHistory() {
    const container = document.getElementById('profileHistory');
    if (!container) return;

    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY)) || [];

    if (history.length === 0) {
        container.innerHTML = `
            <div class="profile-row-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <p>No play history yet</p>
            </div>
        `;
        return;
    }

    container.innerHTML = history.map((song, index) => `
        <div class="profile-card" onclick="playHistoryFromProfile(${index})">
            <div class="profile-card-artwork">
                <img src="${song.artwork || ''}"
                     alt="${song.title}"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23333%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23666%22 font-size=%2240%22>♪</text></svg>'">
                <button class="profile-card-play" onclick="event.stopPropagation(); playHistoryFromProfile(${index})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                </button>
            </div>
            <div class="profile-card-info">
                <div class="profile-card-title">${song.title}</div>
                <div class="profile-card-artist">${song.artist}</div>
            </div>
        </div>
    `).join('');
}

/**
 * Play a favorite song from profile page
 */
function playFavoriteFromProfile(index) {
    const favorites = JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES)) || [];
    const song = favorites[index];
    if (!song) return;

    // Close profile page first
    closeProfilePanel();

    // Use the app's playFavorite function if available
    if (typeof playFavorite === 'function') {
        playFavorite(index);
    } else if (typeof playSongDirect === 'function') {
        playSongDirect(song);
    }
}

/**
 * Play a history song from profile page
 */
function playHistoryFromProfile(index) {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY)) || [];
    const song = history[index];
    if (!song) return;

    // Close profile page first
    closeProfilePanel();

    // Play the song directly
    if (typeof playRegionalSongDirect === 'function') {
        playRegionalSongDirect(song.title, song.artist, song.videoId, song.artwork);
    } else if (typeof playSongDirect === 'function') {
        playSongDirect(song);
    }
}

// ============================================================
// ENHANCED PROFILE FUNCTIONS
// ============================================================

/**
 * Compute top language from favorites
 */
function computeTopLanguage(favorites) {
    if (!favorites || favorites.length === 0) return null;

    // Language keywords mapping
    const languageKeywords = {
        'Hindi': ['bollywood', 'hindi', 'desi'],
        'English': ['english', 'pop', 'rock', 'edm', 'electronic'],
        'Punjabi': ['punjabi', 'bhangra'],
        'Tamil': ['tamil', 'kollywood'],
        'Telugu': ['telugu', 'tollywood'],
        'Bengali': ['bengali', 'bangla'],
        'Kannada': ['kannada', 'sandalwood'],
        'Malayalam': ['malayalam', 'mollywood'],
        'Korean': ['k-pop', 'korean', 'kpop'],
        'Spanish': ['spanish', 'latin', 'reggaeton'],
        'Japanese': ['j-pop', 'japanese', 'jpop', 'anime']
    };

    const langCounts = {};

    favorites.forEach(song => {
        const titleLower = (song.title || '').toLowerCase();
        const artistLower = (song.artist || '').toLowerCase();
        const combinedText = `${titleLower} ${artistLower}`;

        // Check for language keywords
        for (const [lang, keywords] of Object.entries(languageKeywords)) {
            if (keywords.some(kw => combinedText.includes(kw))) {
                langCounts[lang] = (langCounts[lang] || 0) + 1;
            }
        }
    });

    // Default to Hindi if no language detected (since it's an Indian app)
    if (Object.keys(langCounts).length === 0) {
        return favorites.length > 0 ? 'Hindi' : null;
    }

    // Return the most common language
    return Object.entries(langCounts)
        .sort((a, b) => b[1] - a[1])[0][0];
}

/**
 * Compute top artists from favorites
 */
function computeTopArtists(favorites, limit = 5) {
    if (!favorites || favorites.length === 0) return [];

    const artistCounts = {};

    favorites.forEach(song => {
        // Get the primary artist (first one before comma or &)
        const primaryArtist = (song.artist || 'Unknown')
            .split(/[,&]/)[0]
            .trim();

        if (primaryArtist && primaryArtist !== 'Unknown') {
            artistCounts[primaryArtist] = (artistCounts[primaryArtist] || 0) + 1;
        }
    });

    return Object.entries(artistCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([name, count]) => ({ name, count }));
}

/**
 * Compute most played songs from history
 */
function computeTopSongs(history, limit = 5) {
    if (!history || history.length === 0) return [];

    const songCounts = {};
    const songData = {};

    history.forEach(song => {
        const key = song.videoId || `${song.title}-${song.artist}`;
        songCounts[key] = (songCounts[key] || 0) + 1;
        songData[key] = song;
    });

    return Object.entries(songCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([key, count]) => ({
            ...songData[key],
            playCount: count
        }));
}

/**
 * Update profile banner gradient based on user preferences
 */
function updateProfileBanner(favorites) {
    const banner = document.getElementById('profileBanner');
    if (!banner) return;

    // Define gradient presets based on music taste
    const gradientPresets = {
        'Hindi': 'linear-gradient(135deg, #ff6b35 0%, #f7c59f 50%, #ffd93d 100%)',
        'English': 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #6B8DD6 100%)',
        'Punjabi': 'linear-gradient(135deg, #f093fb 0%, #f5576c 50%, #ff6b6b 100%)',
        'Tamil': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 50%, #43e97b 100%)',
        'Telugu': 'linear-gradient(135deg, #fa709a 0%, #fee140 50%, #fa709a 100%)',
        'Korean': 'linear-gradient(135deg, #a8edea 0%, #fed6e3 50%, #d299c2 100%)',
        'Spanish': 'linear-gradient(135deg, #f093fb 0%, #f5576c 50%, #4facfe 100%)',
        'default': 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #6B8DD6 100%)'
    };

    const topLang = computeTopLanguage(favorites);
    const gradient = gradientPresets[topLang] || gradientPresets['default'];

    const bannerGradient = banner.querySelector('.profile-banner-gradient');
    if (bannerGradient) {
        bannerGradient.style.background = gradient;
    }
}

/**
 * Render top artists in profile
 */
function renderProfileTopArtists(favorites) {
    const container = document.getElementById('profileTopArtists');
    if (!container) return;

    const topArtists = computeTopArtists(favorites, 6);

    if (topArtists.length === 0) {
        container.innerHTML = `
            <div class="profile-row-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                    <circle cx="12" cy="7" r="4"></circle>
                </svg>
                <p>Like some songs to see your top artists</p>
            </div>
        `;
        return;
    }

    container.innerHTML = topArtists.map(artist => {
        const initials = artist.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        return `
            <div class="profile-artist-card" onclick="searchForArtist('${escapeHtml(artist.name)}')">
                <div class="profile-artist-avatar">${initials}</div>
                <div class="profile-artist-name">${escapeHtml(artist.name)}</div>
                <div class="profile-artist-count">${artist.count} ${artist.count === 1 ? 'song' : 'songs'}</div>
            </div>
        `;
    }).join('');
}

/**
 * Render top/most played songs in profile
 */
function renderProfileTopSongs(history) {
    const container = document.getElementById('profileTopSongs');
    if (!container) return;

    const topSongs = computeTopSongs(history, 5);

    if (topSongs.length === 0) {
        container.innerHTML = `
            <div class="profile-row-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 18V5l12-2v13"></path>
                    <circle cx="6" cy="18" r="3"></circle>
                    <circle cx="18" cy="16" r="3"></circle>
                </svg>
                <p>Play some songs to see your most played</p>
            </div>
        `;
        return;
    }

    container.innerHTML = topSongs.map((song, index) => `
        <div class="profile-song-item" onclick="playTopSongFromProfile(${index})">
            <div class="profile-song-rank">${index + 1}</div>
            <div class="profile-song-artwork">
                <img src="${song.artwork || ''}"
                     alt="${escapeHtml(song.title)}"
                     onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect fill=%22%23333%22 width=%22100%22 height=%22100%22/><text x=%2250%22 y=%2255%22 text-anchor=%22middle%22 fill=%22%23666%22 font-size=%2240%22>♪</text></svg>'">
            </div>
            <div class="profile-song-info">
                <div class="profile-song-title">${escapeHtml(song.title)}</div>
                <div class="profile-song-artist">${escapeHtml(song.artist)}</div>
            </div>
            <div class="profile-song-plays">${song.playCount} ${song.playCount === 1 ? 'play' : 'plays'}</div>
        </div>
    `).join('');
}

/**
 * Play a top song from profile
 */
function playTopSongFromProfile(index) {
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY)) || [];
    const topSongs = computeTopSongs(history, 5);
    const song = topSongs[index];
    if (!song) return;

    closeProfilePanel();

    if (typeof playRegionalSongDirect === 'function') {
        playRegionalSongDirect(song.title, song.artist, song.videoId, song.artwork);
    } else if (typeof playSongDirect === 'function') {
        playSongDirect(song);
    }
}

/**
 * Search for an artist from profile
 */
function searchForArtist(artistName) {
    closeProfilePanel();

    // Navigate to search with artist name
    if (typeof showArtistPage === 'function') {
        showArtistPage(artistName);
    } else if (typeof navigate === 'function') {
        navigate(`/search?q=${encodeURIComponent(artistName)}`);
    }
}

/**
 * Share profile - show share card modal
 */
function shareProfile() {
    if (!currentUser || !currentUser.username) {
        showToast('Set a username first to share your profile');
        showUsernameModal();
        return;
    }

    showShareProfileCardModal();
}

/**
 * Show share profile card modal
 */
function showShareProfileCardModal() {
    const modal = document.getElementById('shareProfileCardModal');
    if (!modal) return;

    // Populate the card preview
    populateShareCard();

    modal.classList.add('visible');
    document.body.style.overflow = 'hidden';
}

/**
 * Hide share profile card modal
 */
function hideShareProfileCardModal() {
    const modal = document.getElementById('shareProfileCardModal');
    if (modal) {
        modal.classList.remove('visible');
        document.body.style.overflow = '';
    }
}

/**
 * Populate the share card with user data
 */
function populateShareCard() {
    // Avatar
    const avatar = document.getElementById('shareCardAvatar');
    if (avatar && currentUser) {
        const initials = (currentUser.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        const fallbackSvg = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect fill="#D4AF37" width="96" height="96" rx="48"/><text x="48" y="58" text-anchor="middle" fill="#1a1a2e" font-family="system-ui,sans-serif" font-size="36" font-weight="600">${initials}</text></svg>`)}`;
        avatar.src = currentUser.picture || fallbackSvg;
        avatar.onerror = () => { avatar.src = fallbackSvg; };
    }

    // Name and handle
    const nameEl = document.getElementById('shareCardName');
    if (nameEl) nameEl.textContent = currentUser?.name || 'Music Lover';

    const handleEl = document.getElementById('shareCardHandle');
    if (handleEl) handleEl.textContent = currentUser?.username ? `@${currentUser.username}` : '';

    // Stats
    const songsPlayedEl = document.getElementById('shareCardSongsPlayed');
    const totalPlayed = parseInt(localStorage.getItem('tldr-total-songs-played')) || 0;
    if (songsPlayedEl) songsPlayedEl.textContent = totalPlayed;

    const likedSongsEl = document.getElementById('shareCardLikedSongs');
    if (likedSongsEl) likedSongsEl.textContent = userFavorites?.length || 0;

    const playlistsEl = document.getElementById('shareCardPlaylists');
    if (playlistsEl) playlistsEl.textContent = userPlaylists?.length || 0;

    // Top artists
    const topArtistsEl = document.getElementById('shareCardTopArtists');
    if (topArtistsEl) {
        const topArtists = computeTopArtists(userFavorites || [], 3);

        if (topArtists.length > 0) {
            topArtistsEl.innerHTML = `
                <div class="share-card-top-artists-title">Top Artists</div>
                ${topArtists.map((artist, i) => `
                    <div class="share-card-artist">
                        <span class="share-card-artist-rank">${i + 1}</span>
                        <span class="share-card-artist-name">${escapeHtml(artist.name)}</span>
                    </div>
                `).join('')}
            `;
        } else {
            topArtistsEl.innerHTML = `
                <div class="share-card-top-artists-title">Top Artists</div>
                <div class="share-card-artist" style="justify-content: center; color: rgba(255,255,255,0.5);">
                    Like songs to see your top artists
                </div>
            `;
        }
    }

    // Profile URL
    const urlEl = document.getElementById('shareCardUrl');
    if (urlEl && currentUser?.username) {
        urlEl.textContent = `tldrmusic.com/@${currentUser.username}`;
    }
}

/**
 * Download share card as image
 */
async function downloadShareCard() {
    const cardEl = document.getElementById('shareCardPreview');
    if (!cardEl) {
        showToast('Card element not found');
        return;
    }

    if (typeof html2canvas === 'undefined') {
        showToast('Image generation not available');
        return;
    }

    showToast('Generating image...');

    try {
        const canvas = await html2canvas(cardEl, {
            scale: 2,
            backgroundColor: '#1a1a2e',
            useCORS: true,
            logging: false
        });

        // Create download link
        const link = document.createElement('a');
        link.download = `tldrmusic-${currentUser?.username || 'profile'}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        showToast('Image downloaded!');
    } catch (error) {
        console.error('Error generating share card:', error);
        showToast('Failed to generate image');
    }
}

/**
 * Copy profile link to clipboard
 */
function copyProfileLink() {
    if (!currentUser?.username) {
        showToast('Set a username first');
        return;
    }

    const profileUrl = `${window.location.origin}${window.location.pathname}#/profile/${currentUser.username}`;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(profileUrl).then(() => {
            showToast('Profile link copied!');
        }).catch(() => {
            showToast('Failed to copy link');
        });
    } else {
        showToast('Clipboard not available');
    }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// USERNAME MODAL FUNCTIONS
// ============================================================

let usernameCheckTimeout = null;
let isUsernameAvailable = false;

/**
 * Show the username modal
 */
function showUsernameModal() {
    if (!isAuthenticated || !currentUser) {
        showToast('Please sign in first');
        return;
    }

    const modal = document.getElementById('usernameModal');
    const input = document.getElementById('usernameInput');
    const status = document.getElementById('usernameStatus');
    const saveBtn = document.getElementById('saveUsernameBtn');

    if (!modal) return;

    // Pre-fill with current username if exists
    if (input) {
        input.value = currentUser.username || '';
    }
    if (status) {
        status.textContent = '';
        status.className = 'username-status';
    }
    if (saveBtn) {
        saveBtn.disabled = true;
    }

    isUsernameAvailable = false;
    modal.classList.add('visible');

    // Focus input
    setTimeout(() => input?.focus(), 100);
}

/**
 * Hide the username modal
 */
function hideUsernameModal() {
    const modal = document.getElementById('usernameModal');
    if (modal) {
        modal.classList.remove('visible');
    }
    if (usernameCheckTimeout) {
        clearTimeout(usernameCheckTimeout);
        usernameCheckTimeout = null;
    }
}

/**
 * Check username availability with debounce
 */
function checkUsernameAvailability() {
    const input = document.getElementById('usernameInput');
    const status = document.getElementById('usernameStatus');
    const saveBtn = document.getElementById('saveUsernameBtn');

    if (!input || !status) return;

    const username = input.value.trim();

    // Clear previous timeout
    if (usernameCheckTimeout) {
        clearTimeout(usernameCheckTimeout);
    }

    // Reset state
    isUsernameAvailable = false;
    if (saveBtn) saveBtn.disabled = true;

    // Validate length
    if (username.length === 0) {
        status.textContent = '';
        status.className = 'username-status';
        return;
    }

    if (username.length < 3) {
        status.textContent = 'Username must be at least 3 characters';
        status.className = 'username-status unavailable';
        return;
    }

    // Validate format
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        status.textContent = 'Only letters, numbers, and underscores allowed';
        status.className = 'username-status unavailable';
        return;
    }

    if (/^\d/.test(username)) {
        status.textContent = 'Username cannot start with a number';
        status.className = 'username-status unavailable';
        return;
    }

    // If same as current username, just enable save
    if (currentUser.username && username.toLowerCase() === currentUser.username.toLowerCase()) {
        status.textContent = 'This is your current username';
        status.className = 'username-status';
        return;
    }

    // Show checking state
    status.textContent = 'Checking availability...';
    status.className = 'username-status checking';

    // Debounce API call
    usernameCheckTimeout = setTimeout(async () => {
        try {
            const response = await fetch(`${AUTH_CONFIG.API_BASE}/users/check-username/${encodeURIComponent(username)}`, {
                method: 'GET',
                headers: getAuthHeaders()
            });

            const data = await response.json();

            if (data.available) {
                status.textContent = `@${username.toLowerCase()} is available!`;
                status.className = 'username-status available';
                isUsernameAvailable = true;
                if (saveBtn) saveBtn.disabled = false;
            } else {
                status.textContent = data.message || 'Username is not available';
                status.className = 'username-status unavailable';
                isUsernameAvailable = false;
                if (saveBtn) saveBtn.disabled = true;
            }
        } catch (error) {
            console.error('Error checking username:', error);
            status.textContent = 'Error checking availability';
            status.className = 'username-status unavailable';
        }
    }, 500);
}

/**
 * Save the username
 */
async function saveUsername() {
    const input = document.getElementById('usernameInput');
    const saveBtn = document.getElementById('saveUsernameBtn');

    if (!input || !isUsernameAvailable) return;

    const username = input.value.trim();

    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Saving...';
    }

    try {
        const response = await fetch(`${AUTH_CONFIG.API_BASE}/user/username`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify({ username })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to save username');
        }

        // Update local user data
        currentUser.username = username.toLowerCase();
        localStorage.setItem(AUTH_STORAGE_KEYS.USER, JSON.stringify(currentUser));

        // Update profile display
        const usernameEl = document.getElementById('profileUsername');
        if (usernameEl) {
            usernameEl.textContent = `@${username.toLowerCase()}`;
            usernameEl.classList.add('has-username');
        }

        showToast(`Username set to @${username.toLowerCase()}`);
        hideUsernameModal();
    } catch (error) {
        console.error('Error saving username:', error);
        showToast(error.message || 'Failed to save username');
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Save Username';
        }
    }
}

/**
 * Initialize profile panel event listeners
 */
function initProfilePanel() {
    // Close button
    const closeBtn = document.getElementById('profileClose');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeProfilePanel);
    }

    // Sign out button
    const signoutBtn = document.getElementById('profileSignout');
    if (signoutBtn) {
        signoutBtn.addEventListener('click', () => {
            closeProfilePanel();
            logout();
        });
    }

    // Share profile button
    const shareBtn = document.getElementById('profileShareBtn');
    if (shareBtn) {
        shareBtn.addEventListener('click', shareProfile);
    }

    // Click outside to close
    document.addEventListener('click', (e) => {
        const panel = document.getElementById('profilePanel');
        const authBtn = document.getElementById('authBtn');
        const sidebarProfileBtn = document.getElementById('sidebarProfileBtn');
        if (panel && panel.classList.contains('visible')) {
            if (!panel.contains(e.target) && !authBtn?.contains(e.target) && !sidebarProfileBtn?.contains(e.target)) {
                closeProfilePanel();
            }
        }
    });
}

// Initialize profile panel when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProfilePanel);
} else {
    initProfilePanel();
}
