/**
 * TLDR Music - Authentication Module
 * Handles Google Sign-In and cloud sync
 */

// Configuration
const AUTH_CONFIG = {
    GOOGLE_CLIENT_ID: '401132033262-h6r5vjqgbfq9f67v8edjvhne7u06htad.apps.googleusercontent.com',
    // Always use production API (set to 'http://localhost:8000' if running local API server)
    API_BASE: 'https://tldrmusic-api-401132033262.asia-south1.run.app'
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
        const res = await fetch(`${AUTH_CONFIG.API_BASE}/auth/google/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                google_token: response.credential,
                local_data: localData
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

        // Sync data from cloud
        await syncFromCloud();

        // Close login modal
        closeLoginModal();

        // Execute pending play action if any
        if (pendingPlayAction) {
            pendingPlayAction();
            pendingPlayAction = null;
        }

        // Update UI
        updateAuthUI();
        showToast(`Welcome, ${data.user.name}!`);

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

// ============================================================
// AUTH STATE MANAGEMENT
// ============================================================

/**
 * Check auth state on page load
 */
function checkAuthState() {
    const token = localStorage.getItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
    const userJson = localStorage.getItem(AUTH_STORAGE_KEYS.USER);

    if (token && userJson) {
        try {
            currentUser = JSON.parse(userJson);
            isAuthenticated = true;
            updateAuthUI();

            // Verify token is still valid (async)
            verifyToken();
        } catch (e) {
            console.error('Error parsing stored user:', e);
            logout();
        }
    }
}

/**
 * Verify access token is still valid
 */
async function verifyToken() {
    try {
        const res = await fetchWithAuth('/user/profile');
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

    const res = await fetch(`${AUTH_CONFIG.API_BASE}/auth/refresh`, {
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
    localStorage.removeItem(AUTH_STORAGE_KEYS.ACCESS_TOKEN);
    localStorage.removeItem(AUTH_STORAGE_KEYS.REFRESH_TOKEN);
    localStorage.removeItem(AUTH_STORAGE_KEYS.USER);

    currentUser = null;
    isAuthenticated = false;

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
            local_queue: JSON.parse(localStorage.getItem(STORAGE_KEYS.QUEUE)) || [],
            local_preferences: {
                shuffle: localStorage.getItem(STORAGE_KEYS.SHUFFLE) === 'true',
                repeat: localStorage.getItem(STORAGE_KEYS.REPEAT) || 'off'
            }
        };

        const res = await fetchWithAuth('/user/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(localData)
        });

        if (res.ok) {
            const merged = await res.json();

            // Update localStorage with merged data
            localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(merged.merged_favorites));
            localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(merged.merged_history));
            localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(merged.merged_queue));
            localStorage.setItem(STORAGE_KEYS.SHUFFLE, merged.preferences.shuffle);
            localStorage.setItem(STORAGE_KEYS.REPEAT, merged.preferences.repeat);

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

            console.log('Synced from cloud:', {
                favorites: merged.merged_favorites.length,
                history: merged.merged_history.length,
                queue: merged.merged_queue.length
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
                endpoint = '/user/favorites';
                body = { favorites: JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES)) || [] };
                break;
            case 'history':
                endpoint = '/user/history';
                body = { history: JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY)) || [] };
                break;
            case 'queue':
                endpoint = '/user/queue';
                body = { queue: JSON.parse(localStorage.getItem(STORAGE_KEYS.QUEUE)) || [] };
                break;
            case 'preferences':
                endpoint = '/user/preferences';
                body = {
                    shuffle: localStorage.getItem(STORAGE_KEYS.SHUFFLE) === 'true',
                    repeat: localStorage.getItem(STORAGE_KEYS.REPEAT) || 'off'
                };
                break;
            default:
                return;
        }

        await fetchWithAuth(endpoint, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        console.log(`Synced ${type} to cloud`);
    } catch (error) {
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
const debouncedSyncFavorites = debounce(() => syncToCloud('favorites'), 1000);
const debouncedSyncHistory = debounce(() => syncToCloud('history'), 1000);
const debouncedSyncQueue = debounce(() => syncToCloud('queue'), 1000);
const debouncedSyncPreferences = debounce(() => syncToCloud('preferences'), 1000);

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
        // Show user avatar - click opens profile panel
        const authBtn = document.createElement('div');
        authBtn.id = 'authBtn';
        authBtn.className = 'auth-btn logged-in';
        authBtn.onclick = showProfilePanel;

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

        // Create the auth button with avatar
        const firstName = currentUser.name ? currentUser.name.split(' ')[0] : 'User';

        authBtn.innerHTML = `
            <img src="${avatarUrl || fallbackSvg}"
                 alt="${currentUser.name}"
                 class="user-avatar"
                 referrerpolicy="no-referrer"
                 onerror="this.onerror=null; this.src='${fallbackSvg}';">
            <span class="user-name">${firstName}</span>
        `;
        headerMeta.insertBefore(authBtn, headerMeta.firstChild);
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
    const email = document.getElementById('profileEmail');
    const favCount = document.getElementById('profileFavCount');
    const historyCount = document.getElementById('profileHistoryCount');
    const likedCount = document.getElementById('likedCount');
    const historyRowCount = document.getElementById('historyCount');

    if (avatar) {
        // Get user initials for fallback
        const initials = (currentUser.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        const fallbackSvg = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect fill="#D4AF37" width="96" height="96" rx="48"/><text x="48" y="58" text-anchor="middle" fill="#1a1a2e" font-family="system-ui,sans-serif" font-size="36" font-weight="600">${initials}</text></svg>`)}`;
        avatar.src = currentUser.picture || fallbackSvg;
        avatar.onerror = function() { this.onerror=null; this.src=fallbackSvg; };
        avatar.referrerPolicy = 'no-referrer';
    }
    if (name) name.textContent = currentUser.name;
    if (email) email.textContent = currentUser.email;

    // Update stats
    const favs = JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES)) || [];
    const history = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY)) || [];
    if (favCount) favCount.textContent = favs.length;
    if (historyCount) historyCount.textContent = history.length;
    if (likedCount) likedCount.textContent = `${favs.length} song${favs.length !== 1 ? 's' : ''}`;
    if (historyRowCount) historyRowCount.textContent = `${history.length} song${history.length !== 1 ? 's' : ''}`;

    // Render liked songs and history
    renderProfileLikedSongs();
    renderProfileHistory();

    // Show page
    panel.classList.add('visible');
    document.body.style.overflow = 'hidden';

    // Close other panels
    const queuePanel = document.getElementById('queuePanel');
    const lyricsPanel = document.getElementById('lyricsPanel');
    if (queuePanel) queuePanel.classList.remove('visible');
    if (lyricsPanel) lyricsPanel.classList.remove('visible');
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

    // Click outside to close
    document.addEventListener('click', (e) => {
        const panel = document.getElementById('profilePanel');
        const authBtn = document.getElementById('authBtn');
        if (panel && panel.classList.contains('visible')) {
            if (!panel.contains(e.target) && !authBtn?.contains(e.target)) {
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
