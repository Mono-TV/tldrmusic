// TLDR Music - Frontend Application

const API_BASE = 'https://tldrmusic-api-401132033262.asia-south1.run.app';
const DATA_PATH = './current.json'; // Fallback for local development

// localStorage keys
const STORAGE_KEYS = {
    FAVORITES: 'tldr-favorites',
    HISTORY: 'tldr-history',
    SHUFFLE: 'tldr-shuffle',
    REPEAT: 'tldr-repeat',
    QUEUE: 'tldr-queue',
    PLAYLISTS: 'tldr-playlists'
};

// State
let chartData = null;
let currentSongIndex = -1;
let isRegionalSongPlaying = false;  // Track if a regional song is playing
let heroSongIndex = 0;  // Track which song is displayed in hero
let player = null;
let playerReady = false;
let isPlaying = false;
let isVideoVisible = false;
let isLyricsVisible = false;
let isTheaterMode = false;
let isQueueVisible = false;
let progressInterval = null;
let isHeroVisible = true;
let heroObserver = null;
let currentChartMode = 'india';  // 'india' or 'global'
let currentPlayingVideoId = null;  // Track currently playing video ID for global/regional

// User data (persisted in localStorage)
let favorites = [];           // Array of {title, artist, videoId, artwork, addedAt}
let playHistory = [];         // Array of recently played songs
let queue = [];               // Custom queue
let isShuffleOn = false;
let repeatMode = 'off';       // 'off', 'all', 'one'

// Playlist data
let playlists = [];           // Array of {id, name, description, songs[], createdAt, updatedAt}
let currentPlaylistId = null; // Currently viewing/playing playlist
let currentContextPlaylistId = null; // For context menu
let isPlaylistPanelVisible = false;

// DOM Elements
const chartList = document.getElementById('chartList');
const chartDate = document.getElementById('chartDate');
const weekLabel = document.getElementById('weekLabel');
const badgeLabel = document.getElementById('badgeLabel');
const chartToggle = document.getElementById('chartToggle');
const videoWrapper = document.getElementById('videoWrapper');
const shareBtn = document.getElementById('shareBtn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const playerBar = document.getElementById('playerBar');
const playerBarTitle = document.getElementById('playerBarTitle');
const playerBarArtist = document.getElementById('playerBarArtist');
const playerBarArtwork = document.getElementById('playerBarArtwork');
const playPauseBtn = document.getElementById('playPauseBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const videoToggleBtn = document.getElementById('videoToggleBtn');
const videoContainer = document.getElementById('videoContainer');
const videoClose = document.getElementById('videoClose');
const mainGradient = document.getElementById('mainGradient');
const lyricsPanel = document.getElementById('lyricsPanel');
const lyricsToggleBtn = document.getElementById('lyricsToggleBtn');
const lyricsClose = document.getElementById('lyricsClose');
const lyricsContent = document.getElementById('lyricsContent');
const lyricsSongTitle = document.getElementById('lyricsSongTitle');
const lyricsSongArtist = document.getElementById('lyricsSongArtist');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');
const progressHandle = document.getElementById('progressHandle');
const timeCurrent = document.getElementById('timeCurrent');
const timeDuration = document.getElementById('timeDuration');
const regionalSection = document.getElementById('regionalSection');
const regionalGrid = document.getElementById('regionalGrid');
const globalSpotlightsSection = document.getElementById('globalSpotlightsSection');
const globalSpotlightsGrid = document.getElementById('globalSpotlightsGrid');
const heroSection = document.getElementById('heroSection');
const heroTheater = document.getElementById('heroTheater');
const theaterVideo = document.getElementById('theaterVideo');
const theaterClose = document.getElementById('theaterClose');
const theaterTitle = document.getElementById('theaterTitle');
const theaterArtist = document.getElementById('theaterArtist');
const heroProgress = document.getElementById('heroProgress');
const heroProgressBar = document.getElementById('heroProgressBar');
const heroProgressFill = document.getElementById('heroProgressFill');
const heroTimeCurrent = document.getElementById('heroTimeCurrent');
const heroTimeDuration = document.getElementById('heroTimeDuration');
const heroLyricsBtn = document.getElementById('heroLyricsBtn');
const heroVideoBtn = document.getElementById('heroVideoBtn');

// Initialize YouTube API
function loadYouTubeAPI() {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

window.onYouTubeIframeAPIReady = function() {
    playerReady = true;
    videoWrapper.innerHTML = '<div id="ytplayer"></div>';
};

// Initialize
document.addEventListener('DOMContentLoaded', init);

async function init() {
    loadYouTubeAPI();
    initGoogleAuth();   // Initialize Google Sign-In
    checkAuthState();   // Check if user is already logged in
    loadUserData();
    initSidebar();      // Initialize sidebar
    renderSkeletons(); // Show skeletons immediately
    await loadChartData();
    setupEventListeners();
    initializePlaybackUI();
    updateAuthUI();     // Update auth button in header

    // Handle URL parameters for shared content
    handleUrlParameters();
}

// ============================================================
// URL PARAMETER HANDLING (for shared playlists and profiles)
// ============================================================

function handleUrlParameters() {
    const urlParams = new URLSearchParams(window.location.search);

    // Handle ?playlist={id} - shared playlist
    const playlistId = urlParams.get('playlist');
    if (playlistId) {
        loadSharedPlaylist(playlistId);
        return; // Don't process other params if playlist is being loaded
    }

    // Handle ?user={username} - public profile
    const username = urlParams.get('user');
    if (username) {
        loadUserProfile(username);
        return;
    }
}

async function loadSharedPlaylist(playlistId) {
    try {
        // Show loading state
        showToast('Loading shared playlist...');

        // Fetch playlist from API (works without auth for public playlists)
        const response = await fetch(`${API_BASE}/playlists/${playlistId}`);

        if (!response.ok) {
            if (response.status === 404) {
                showToast('Playlist not found');
            } else if (response.status === 403) {
                showToast('This playlist is private');
            } else {
                showToast('Failed to load playlist');
            }
            return;
        }

        const data = await response.json();
        const playlist = data.playlist;

        // Convert API playlist format to local format
        const localPlaylist = {
            id: playlist.id || playlist._id,
            name: playlist.name,
            description: playlist.description || '',
            songs: playlist.songs || [],
            is_public: playlist.is_public,
            owner: playlist.owner,
            song_count: playlist.song_count,
            follower_count: playlist.follower_count,
            createdAt: playlist.created_at,
            updatedAt: playlist.updated_at
        };

        // Show the shared playlist view
        showSharedPlaylistView(localPlaylist);

    } catch (error) {
        console.error('Error loading shared playlist:', error);
        showToast('Failed to load playlist');
    }
}

function showSharedPlaylistView(playlist) {
    // Hide main content sections
    const mainContent = document.getElementById('mainContent');
    const heroSection = document.getElementById('heroSection');
    const playlistsView = document.getElementById('playlistsView');
    const playlistDetailView = document.getElementById('playlistDetailView');

    if (mainContent) mainContent.style.display = 'none';
    if (heroSection) heroSection.style.display = 'none';
    if (playlistsView) playlistsView.style.display = 'none';
    if (playlistDetailView) playlistDetailView.style.display = 'block';

    // Render the playlist with shared mode flag
    renderSharedPlaylistDetail(playlist);
}

function renderSharedPlaylistDetail(playlist) {
    const content = document.getElementById('playlistDetailSongs');
    const header = document.getElementById('playlistDetailHeader');

    if (!header || !content) return;

    // Get cover image
    let coverArt;
    if (playlist.artwork_url) {
        coverArt = `<img src="${playlist.artwork_url}" alt="${escapeHtml(playlist.name)}">`;
    } else if (playlist.songs && playlist.songs.length > 0 && playlist.songs[0].artwork) {
        coverArt = `<img src="${playlist.songs[0].artwork}" alt="${escapeHtml(playlist.name)}">`;
    } else {
        coverArt = `<div class="detail-cover-placeholder">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
            </svg>
        </div>`;
    }

    const ownerName = playlist.owner?.name || 'Unknown';
    const songCount = playlist.songs?.length || playlist.song_count || 0;
    const isOwner = isAuthenticated && currentUser?.sub === playlist.owner?.id;

    header.innerHTML = `
        <button class="detail-back-btn" onclick="closeSharedPlaylist()" title="Back to Charts">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
        </button>
        <div class="detail-hero">
            <div class="detail-cover">
                ${coverArt}
            </div>
            <div class="detail-info">
                <span class="detail-type">Playlist${playlist.is_public ? ' • Public' : ''}</span>
                <h1 class="detail-name">${escapeHtml(playlist.name)}</h1>
                <span class="detail-meta">
                    <span class="shared-playlist-owner">by ${escapeHtml(ownerName)}</span>
                    • ${songCount} song${songCount !== 1 ? 's' : ''}
                </span>
                <div class="detail-buttons">
                    <button class="btn-primary" onclick="playSharedPlaylist()" ${songCount === 0 ? 'disabled' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        Play
                    </button>
                    <button class="btn-secondary" onclick="shuffleSharedPlaylist()" ${songCount === 0 ? 'disabled' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="16 3 21 3 21 8"></polyline>
                            <line x1="4" y1="20" x2="21" y2="3"></line>
                            <polyline points="21 16 21 21 16 21"></polyline>
                            <line x1="15" y1="15" x2="21" y2="21"></line>
                            <line x1="4" y1="4" x2="9" y2="9"></line>
                        </svg>
                        Shuffle
                    </button>
                    ${!isOwner ? `
                    <button class="btn-secondary" onclick="saveSharedPlaylistToLibrary('${playlist.id}')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
                        </svg>
                        ${isAuthenticated ? 'Save to Library' : 'Sign in to Save'}
                    </button>
                    ` : ''}
                    <button class="btn-secondary" onclick="sharePlaylistFromShared('${playlist.id}')">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="18" cy="5" r="3"></circle>
                            <circle cx="6" cy="12" r="3"></circle>
                            <circle cx="18" cy="19" r="3"></circle>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                        </svg>
                        Share
                    </button>
                </div>
            </div>
        </div>
    `;

    // Store the shared playlist for playback
    window.currentSharedPlaylist = playlist;

    if (!playlist.songs || playlist.songs.length === 0) {
        content.innerHTML = `
            <div class="detail-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 18V5l12-2v13"></path>
                    <circle cx="6" cy="18" r="3"></circle>
                    <circle cx="18" cy="16" r="3"></circle>
                </svg>
                <h3>This playlist is empty</h3>
            </div>
        `;
        return;
    }

    content.innerHTML = `
        <div class="detail-song-list">
            ${playlist.songs.map((song, index) => `
                <div class="detail-song" onclick="playSharedPlaylistFromIndex(${index})">
                    <span class="detail-song-num">${index + 1}</span>
                    <div class="detail-song-artwork">
                        ${song.artwork
                            ? `<img src="${song.artwork}" alt="${escapeHtml(song.title)}">`
                            : '<div class="placeholder"></div>'
                        }
                        <div class="detail-song-play-overlay">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                        </div>
                    </div>
                    <div class="detail-song-info">
                        <div class="detail-song-title">${escapeHtml(song.title)}</div>
                        <div class="detail-song-artist">${escapeHtml(song.artist)}</div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function closeSharedPlaylist() {
    // Clear URL params
    history.replaceState(null, '', window.location.pathname);

    // Show main content
    const mainContent = document.getElementById('mainContent');
    const heroSection = document.getElementById('heroSection');
    const playlistDetailView = document.getElementById('playlistDetailView');

    if (playlistDetailView) playlistDetailView.style.display = 'none';
    if (mainContent) mainContent.style.display = 'block';
    if (heroSection) heroSection.style.display = 'block';

    // Clear shared playlist data
    window.currentSharedPlaylist = null;
}

function playSharedPlaylist() {
    const playlist = window.currentSharedPlaylist;
    if (!playlist || !playlist.songs || playlist.songs.length === 0) return;
    playSharedPlaylistFromIndex(0);
}

function shuffleSharedPlaylist() {
    const playlist = window.currentSharedPlaylist;
    if (!playlist || !playlist.songs || playlist.songs.length === 0) return;

    const randomIndex = Math.floor(Math.random() * playlist.songs.length);
    playSharedPlaylistFromIndex(randomIndex);
}

function playSharedPlaylistFromIndex(index) {
    const playlist = window.currentSharedPlaylist;
    if (!playlist || !playlist.songs) return;

    const song = playlist.songs[index];
    if (!song) return;

    // Play the song
    if (song.videoId) {
        playSong(song.videoId, song.title, song.artist, song.artwork);
    }
}

async function saveSharedPlaylistToLibrary(playlistId) {
    if (!isAuthenticated) {
        showLoginModal();
        return;
    }

    try {
        const response = await fetchWithAuth(`/playlists/${playlistId}/follow`, {
            method: 'POST'
        });

        if (response.ok) {
            showToast('Playlist saved to your library!');
        } else {
            const error = await response.json();
            showToast(error.detail || 'Failed to save playlist');
        }
    } catch (error) {
        showToast('Failed to save playlist');
    }
}

function sharePlaylistFromShared(playlistId) {
    const playlist = window.currentSharedPlaylist;
    if (playlist) {
        showShareModal(playlist);
    }
}

// ============================================================
// PUBLIC PROFILE VIEW
// ============================================================

async function loadUserProfile(username) {
    try {
        showToast('Loading profile...');

        // Fetch user profile and playlists in parallel
        const [profileResponse, playlistsResponse] = await Promise.all([
            fetch(`${API_BASE}/user/${encodeURIComponent(username)}`),
            fetch(`${API_BASE}/user/${encodeURIComponent(username)}/playlists`)
        ]);

        if (!profileResponse.ok) {
            if (profileResponse.status === 404) {
                showToast('User not found');
            } else {
                showToast('Failed to load profile');
            }
            // Clear URL params
            window.history.replaceState({}, '', window.location.pathname);
            return;
        }

        const profile = await profileResponse.json();
        const playlistsData = playlistsResponse.ok ? await playlistsResponse.json() : { playlists: [] };

        // Store current profile
        window.currentPublicProfile = { profile, playlists: playlistsData.playlists };

        // Render the profile view
        renderPublicProfileView(profile, playlistsData.playlists);

    } catch (error) {
        console.error('Error loading profile:', error);
        showToast('Failed to load profile');
        window.history.replaceState({}, '', window.location.pathname);
    }
}

function renderPublicProfileView(profile, playlists) {
    // Get or create the public profile container
    let profileView = document.getElementById('publicProfileView');

    if (!profileView) {
        profileView = document.createElement('div');
        profileView.id = 'publicProfileView';
        profileView.className = 'public-profile-view';
        document.body.appendChild(profileView);
    }

    // Get initials for avatar fallback
    const initials = (profile.name || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    const fallbackSvg = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><rect fill="#D4AF37" width="96" height="96" rx="48"/><text x="48" y="58" text-anchor="middle" fill="#1a1a2e" font-family="system-ui,sans-serif" font-size="36" font-weight="600">${initials}</text></svg>`)}`;

    const playlistsHTML = playlists.length > 0 ? `
        <div class="public-profile-playlists">
            <h2>Public Playlists</h2>
            <div class="public-profile-playlist-grid">
                ${playlists.map(playlist => {
                    const coverArt = playlist.cover_urls?.[0] || playlist.artwork_url ||
                        (playlist.songs?.[0]?.artwork) || '/og-image.png';
                    return `
                        <div class="public-profile-playlist-card" onclick="loadSharedPlaylist('${playlist.id}'); hidePublicProfileView();">
                            <div class="public-profile-playlist-cover">
                                <img src="${coverArt}" alt="${escapeHtml(playlist.name)}" onerror="this.src='/og-image.png'">
                                <div class="public-profile-playlist-play">
                                    <svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                                </div>
                            </div>
                            <div class="public-profile-playlist-info">
                                <h3>${escapeHtml(playlist.name)}</h3>
                                <p>${playlist.song_count || 0} songs</p>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    ` : `
        <div class="public-profile-empty">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
            </svg>
            <p>No public playlists yet</p>
        </div>
    `;

    profileView.innerHTML = `
        <div class="public-profile-backdrop" onclick="hidePublicProfileView()"></div>
        <div class="public-profile-container">
            <button class="public-profile-close" onclick="hidePublicProfileView()">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
            </button>

            <div class="public-profile-hero">
                <img class="public-profile-avatar" src="${profile.picture || fallbackSvg}" alt="${escapeHtml(profile.name)}"
                     referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='${fallbackSvg}'">
                <div class="public-profile-info">
                    <h1 class="public-profile-name">${escapeHtml(profile.name)}</h1>
                    <p class="public-profile-username">@${profile.username}</p>
                    <p class="public-profile-stats">${profile.playlist_count} public playlist${profile.playlist_count !== 1 ? 's' : ''}</p>
                </div>
            </div>

            ${playlistsHTML}
        </div>
    `;

    profileView.classList.add('visible');
    document.body.style.overflow = 'hidden';
}

function hidePublicProfileView() {
    const profileView = document.getElementById('publicProfileView');
    if (profileView) {
        profileView.classList.remove('visible');
        document.body.style.overflow = '';
    }
    // Clear URL params if present
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.has('user')) {
        window.history.replaceState({}, '', window.location.pathname);
    }
    window.currentPublicProfile = null;
}

// Render skeleton loading placeholders
function renderSkeletons() {
    // Chart skeleton - 25 cards directly in chartList
    const chartList = document.getElementById('chartList');
    if (chartList) {
        let skeletonHTML = '';
        for (let i = 0; i < 25; i++) {
            skeletonHTML += `
                <div class="skeleton-card" data-skeleton="true">
                    <div class="skeleton skeleton-artwork"></div>
                    <div class="skeleton-info">
                        <div class="skeleton skeleton-title"></div>
                        <div class="skeleton skeleton-artist"></div>
                        <div class="skeleton-meta">
                            <div class="skeleton skeleton-score"></div>
                            <div class="skeleton skeleton-rank"></div>
                        </div>
                    </div>
                </div>
            `;
        }
        chartList.innerHTML = skeletonHTML;
    }

    // Regional skeleton - 4 language groups with 5 songs each
    const regionalGrid = document.getElementById('regionalGrid');
    if (regionalGrid) {
        let regionalHTML = '';
        for (let r = 0; r < 4; r++) {
            let songsHTML = '';
            for (let s = 0; s < 5; s++) {
                songsHTML += `
                    <div class="skeleton-regional-song">
                        <div class="skeleton skeleton-thumb"></div>
                        <div class="skeleton-song-info">
                            <div class="skeleton skeleton-song-title"></div>
                            <div class="skeleton skeleton-song-artist"></div>
                        </div>
                    </div>
                `;
            }
            regionalHTML += `
                <div class="skeleton-regional" data-skeleton="true">
                    <div class="skeleton-regional-header">
                        <div class="skeleton skeleton-icon"></div>
                        <div class="skeleton skeleton-name"></div>
                    </div>
                    <div class="skeleton-regional-songs">
                        ${songsHTML}
                    </div>
                </div>
            `;
        }
        regionalGrid.innerHTML = regionalHTML;
    }
}

// Load chart data from API (with fallback to local JSON)
async function loadChartData() {
    try {
        // Try API first
        const response = await fetch(`${API_BASE}/chart/current`);
        if (!response.ok) throw new Error('API request failed');
        chartData = await response.json();
        console.log('Loaded chart data from API');
        consolidateGlobalChart();
        renderHero();
        renderChart();
        renderRegionalCharts();
        updateMetadata();
    } catch (apiError) {
        console.warn('API unavailable, trying local fallback:', apiError.message);
        try {
            // Fallback to local JSON file
            const response = await fetch(DATA_PATH);
            if (!response.ok) throw new Error('Failed to load local chart data');
            chartData = await response.json();
            console.log('Loaded chart data from local JSON');
            consolidateGlobalChart();
            renderHero();
            renderChart();
            renderRegionalCharts();
            updateMetadata();
        } catch (localError) {
            console.error('Error loading chart:', localError);
            showError();
        }
    }
}

// Consolidate global chart from platform data if not already present
function consolidateGlobalChart() {
    if (!chartData || chartData.global_chart) return; // Already exists or no data

    if (!chartData.global) {
        console.warn('No global platform data available');
        return;
    }

    // Collect all songs from global platforms with their rankings
    const songScores = new Map();
    const platforms = ['spotify_global', 'billboard_hot100', 'apple_global'];
    const weights = { spotify_global: 1.5, billboard_hot100: 1.2, apple_global: 1.5 };

    platforms.forEach(platform => {
        const platformData = chartData.global[platform];
        if (!platformData || !platformData.songs) return;

        platformData.songs.forEach((song, index) => {
            const key = `${song.title?.toLowerCase()}-${song.artist?.toLowerCase()}`;
            const positionScore = (10 - index) / 10; // Higher rank = higher score
            const weightedScore = positionScore * (weights[platform] || 1);

            if (songScores.has(key)) {
                const existing = songScores.get(key);
                existing.score += weightedScore;
                existing.platforms.push(platform);
            } else {
                songScores.set(key, {
                    title: song.title,
                    artist: song.artist,
                    artwork: song.artwork || song.image,
                    video_id: song.video_id,
                    score: weightedScore,
                    platforms: [platform]
                });
            }
        });
    });

    // Sort by score and take top 25
    const sortedSongs = Array.from(songScores.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 25)
        .map((song, index) => ({
            ...song,
            rank: index + 1,
            rank_change: 0,
            is_new: false
        }));

    chartData.global_chart = sortedSongs;
    console.log(`Consolidated ${sortedSongs.length} songs into global_chart`);
}

// Hide skeleton loading and show actual content
function hideSkeletons() {
    // Hide hero skeleton, show hero content
    const heroSkeleton = document.getElementById('heroSkeleton');
    const heroInner = document.getElementById('heroInner');
    if (heroSkeleton) heroSkeleton.style.display = 'none';
    if (heroInner) heroInner.style.display = 'flex';

    // Chart and regional skeletons are replaced by innerHTML in render functions
}

// Render hero section with #1 song
function renderHero() {
    if (!chartData || !chartData.chart || !chartData.chart[0]) return;

    // Hide skeletons when rendering actual content
    hideSkeletons();

    const song = chartData.chart[0];

    document.getElementById('heroTitle').textContent = song.title;
    document.getElementById('heroArtist').textContent = song.artist;
    document.getElementById('heroScore').textContent = song.score.toFixed(2);

    // Hero artwork
    const heroArtwork = document.getElementById('heroArtwork');
    if (heroArtwork && song.artwork_url) {
        heroArtwork.src = song.artwork_url;
        heroArtwork.alt = `${song.title} album art`;
        heroArtwork.style.display = 'block';
    }

    // Hero background from album artwork
    const heroBg = document.getElementById('heroBg');
    if (heroBg && song.artwork_url) {
        heroBg.style.backgroundImage = `url(${song.artwork_url})`;
    }

    // YouTube views
    const viewsStat = document.getElementById('heroViewsStat');
    const viewsEl = document.getElementById('heroViews');
    if (song.youtube_views && song.youtube_views > 0) {
        viewsEl.textContent = formatViews(song.youtube_views);
        viewsStat.style.display = 'flex';
    } else {
        viewsStat.style.display = 'none';
    }

}

// Get platform CSS class
function getPlatformClass(platform) {
    const map = {
        spotify: 'spotify',
        apple_music: 'apple',
        youtube_music: 'youtube',
        billboard: 'billboard',
        jiosaavn: 'jiosaavn',
        gaana: 'gaana'
    };
    return map[platform] || platform;
}

// Render chart list
function renderChart() {
    if (!chartData || !chartData.chart) {
        showError();
        return;
    }

    chartList.innerHTML = '';

    chartData.chart.forEach((song, index) => {
        const songEl = createSongElement(song, index);
        chartList.appendChild(songEl);
    });

    // Update Quick Picks count badge
    const quickPicksCount = document.getElementById('quickPicksCount');
    if (quickPicksCount) {
        quickPicksCount.textContent = chartData.chart.length;
    }
}

// Render regional charts
function renderRegionalCharts() {
    if (!chartData || !chartData.regional || !regionalGrid) {
        // Hide section if no regional data
        if (regionalSection) regionalSection.style.display = 'none';
        return;
    }

    // Show section
    if (regionalSection) regionalSection.style.display = 'block';

    regionalGrid.innerHTML = '';

    // Order: All regional languages
    const regionOrder = [
        'hindi', 'tamil', 'telugu', 'punjabi',
        'bhojpuri', 'haryanvi', 'bengali', 'marathi',
        'kannada', 'malayalam', 'gujarati'
    ];

    regionOrder.forEach(regionKey => {
        const region = chartData.regional[regionKey];
        if (!region || !region.songs || region.songs.length === 0) return;

        const card = document.createElement('div');
        card.className = 'regional-card';

        const songsHtml = region.songs.slice(0, 5).map((song, i) => {
            // Use artwork from song data, or try main chart as fallback
            const artworkUrl = song.artwork_url || findSongInMainChart(song.title, song.artist)?.artwork_url || '';
            const videoId = song.youtube_video_id || '';

            const placeholderSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"></polygon>
                </svg>
            `;

            const playSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="6 3 20 12 6 21 6 3"></polygon>
                </svg>
            `;

            // Get rank movement for regional song
            const rankMovement = getRankMovementHtml(song);

            return `
                <div class="regional-song" data-title="${escapeHtml(song.title)}" data-artist="${escapeHtml(song.artist)}" data-video-id="${videoId}" data-artwork="${artworkUrl}">
                    <div class="regional-song-artwork">
                        ${artworkUrl
                            ? `<img src="${artworkUrl}" alt="${escapeHtml(song.title)}" loading="lazy">`
                            : `<div class="regional-song-artwork-placeholder">${placeholderSvg}</div>`}
                        <div class="regional-song-play">${playSvg}</div>
                    </div>
                    <span class="regional-song-rank ${i < 3 ? 'top-3' : ''}">${song.rank}</span>
                    ${rankMovement}
                    <div class="regional-song-info">
                        <div class="regional-song-title">${escapeHtml(song.title)}</div>
                        <div class="regional-song-artist">${escapeHtml(song.artist)}</div>
                    </div>
                </div>
            `;
        }).join('');

        card.innerHTML = `
            <div class="regional-card-header">
                <span class="regional-icon">${region.icon}</span>
                <div>
                    <div class="regional-card-title">${region.name}</div>
                    <div class="regional-card-label">Top 5</div>
                </div>
            </div>
            <div class="regional-list">
                ${songsHtml}
            </div>
        `;

        // Add click handlers for regional songs
        card.querySelectorAll('.regional-song').forEach(songEl => {
            songEl.addEventListener('click', () => {
                const title = songEl.dataset.title;
                const artist = songEl.dataset.artist;
                const videoId = songEl.dataset.videoId;
                const artwork = songEl.dataset.artwork;
                playRegionalSong(title, artist, videoId, artwork);
            });
        });

        regionalGrid.appendChild(card);
    });

    // Update Regional Spotlights count badge
    const regionalCount = document.getElementById('regionalCount');
    if (regionalCount) {
        const count = regionalGrid.querySelectorAll('.regional-card').length;
        regionalCount.textContent = count;
    }
}

// Render global platform spotlights (Spotify, Billboard, Apple Music)
function renderGlobalSpotlights() {
    const spotlightsGrid = document.getElementById('globalSpotlightsGrid');
    const spotlightsSection = document.getElementById('globalSpotlightsSection');

    if (!chartData || !chartData.global_chart || !spotlightsGrid) {
        if (spotlightsSection) spotlightsSection.style.display = 'none';
        return;
    }

    spotlightsGrid.innerHTML = '';

    // Platform configuration
    const platforms = [
        { key: 'spotify_global', name: 'Spotify', icon: '🎧', label: 'Global Top 5' },
        { key: 'billboard_hot100', name: 'Billboard', icon: '📊', label: 'Hot 100 Top 5' },
        { key: 'apple_global', name: 'Apple Music', icon: '🍎', label: 'Global Top 5' }
    ];

    let platformCount = 0;

    platforms.forEach(platform => {
        // Extract songs that have this platform in their platform_ranks
        const platformSongs = chartData.global_chart
            .filter(song => song.platform_ranks?.some(pr => pr.platform === platform.key))
            .map(song => {
                const platformRank = song.platform_ranks.find(pr => pr.platform === platform.key);
                return { ...song, platformRank: platformRank?.rank || 999 };
            })
            .sort((a, b) => a.platformRank - b.platformRank)
            .slice(0, 5);

        if (platformSongs.length === 0) return;

        platformCount++;

        const card = document.createElement('div');
        card.className = 'regional-card';

        const songsHtml = platformSongs.map((song, i) => {
            const artworkUrl = song.artwork_url || '';
            const videoId = song.youtube_video_id || '';

            const placeholderSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"></polygon>
                </svg>
            `;

            const playSvg = `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <polygon points="6 3 20 12 6 21 6 3"></polygon>
                </svg>
            `;

            return `
                <div class="regional-song" data-title="${escapeHtml(song.title)}" data-artist="${escapeHtml(song.artist)}" data-video-id="${videoId}" data-artwork="${artworkUrl}">
                    <div class="regional-song-artwork">
                        ${artworkUrl
                            ? `<img src="${artworkUrl}" alt="${escapeHtml(song.title)}" loading="lazy">`
                            : `<div class="regional-song-artwork-placeholder">${placeholderSvg}</div>`}
                        <div class="regional-song-play">${playSvg}</div>
                    </div>
                    <span class="regional-song-rank ${i < 3 ? 'top-3' : ''}">${song.platformRank}</span>
                    <span class="rank-dot">●</span>
                    <div class="regional-song-info">
                        <div class="regional-song-title">${escapeHtml(song.title)}</div>
                        <div class="regional-song-artist">${escapeHtml(song.artist)}</div>
                    </div>
                </div>
            `;
        }).join('');

        card.innerHTML = `
            <div class="regional-card-header">
                <span class="regional-icon">${platform.icon}</span>
                <div>
                    <div class="regional-card-title">${platform.name}</div>
                    <div class="regional-card-label">${platform.label}</div>
                </div>
            </div>
            <div class="regional-list">
                ${songsHtml}
            </div>
        `;

        // Add click handlers for global songs
        card.querySelectorAll('.regional-song').forEach(songEl => {
            songEl.addEventListener('click', () => {
                const title = songEl.dataset.title;
                const artist = songEl.dataset.artist;
                const videoId = songEl.dataset.videoId;
                const artwork = songEl.dataset.artwork;
                playRegionalSong(title, artist, videoId, artwork);
            });
        });

        spotlightsGrid.appendChild(card);
    });

    // Update Global Spotlights count badge
    const countBadge = document.getElementById('globalSpotlightsCount');
    if (countBadge) {
        countBadge.textContent = platformCount;
    }
}

// Find a song in the main chart by title/artist
function findSongInMainChart(title, artist) {
    if (!chartData || !chartData.chart) return null;

    const normalizedTitle = title.toLowerCase().trim();
    const normalizedArtist = artist.toLowerCase().trim();

    return chartData.chart.find(song => {
        const songTitle = song.title.toLowerCase().trim();
        const songArtist = song.artist.toLowerCase().trim();

        // Check for exact or partial match
        return songTitle.includes(normalizedTitle) ||
               normalizedTitle.includes(songTitle) ||
               (songArtist.includes(normalizedArtist) && songTitle.includes(normalizedTitle.split(' ')[0]));
    });
}

// Play a regional song
function playRegionalSong(title, artist, videoId, artworkUrl) {
    // If we have a video ID, play directly
    if (videoId) {
        playRegionalSongDirect(title, artist, videoId, artworkUrl);
        return;
    }

    // Try to find in main chart
    const mainChartIndex = chartData.chart.findIndex(song => {
        const songTitle = song.title.toLowerCase().trim();
        const songArtist = song.artist.toLowerCase().trim();
        const searchTitle = title.toLowerCase().trim();
        const searchArtist = artist.toLowerCase().trim();

        return songTitle.includes(searchTitle) ||
               searchTitle.includes(songTitle) ||
               (songArtist.includes(searchArtist) && songTitle.includes(searchTitle.split(' ')[0]));
    });

    if (mainChartIndex !== -1) {
        // Found in main chart, play it
        playSong(mainChartIndex);
    } else {
        // Not found anywhere, search YouTube
        const searchQuery = encodeURIComponent(`${title} ${artist} official audio`);
        window.open(`https://www.youtube.com/results?search_query=${searchQuery}`, '_blank');
        showToast(`Searching YouTube for "${title}"...`);
    }
}

// Play a regional song directly with video ID
function playRegionalSongDirect(title, artist, videoId, artworkUrl, score = null) {
    // Require authentication to play
    if (!requireAuth(() => playRegionalSongDirect(title, artist, videoId, artworkUrl, score))) return;

    // Mark that we're playing a regional song
    isRegionalSongPlaying = true;
    currentPlayingVideoId = videoId;  // Track the video ID
    currentSongIndex = -1; // Reset main chart index

    // Track in history
    addToHistory({ title, artist, youtube_video_id: videoId, artwork_url: artworkUrl });

    // Update player bar UI first (so updateFavoriteButtons can read correct title/artist)
    if (playerBarTitle) playerBarTitle.textContent = title;
    if (playerBarArtist) playerBarArtist.textContent = artist;

    // Update favorite button state (after UI update so it reads correct song info)
    updateFavoriteButtons();
    if (playerBarArtwork && artworkUrl) {
        playerBarArtwork.src = artworkUrl;
    }

    // Apply artwork as gradient background
    if (artworkUrl && mainGradient) {
        mainGradient.style.backgroundImage = `url(${artworkUrl})`;
        mainGradient.classList.add('active');
    }

    // Update hero/spotlight section
    updateHeroForDirectPlay(title, artist, artworkUrl, score);

    // Update card playing state (will use currentPlayingVideoId)
    updateCardPlayingState(true);

    // Update player bar visibility - must come after setting isRegionalSongPlaying
    updatePlayerBarVisibility();

    // Play on YouTube
    if (player && playerReady) {
        player.loadVideoById(videoId);
    } else if (playerReady) {
        createPlayerWithVideo(videoId);
    } else {
        setTimeout(() => playRegionalSongDirect(title, artist, videoId, artworkUrl, score), 100);
    }
}

// Update hero section for direct play (regional/global songs)
function updateHeroForDirectPlay(title, artist, artworkUrl, score) {
    const heroTitle = document.getElementById('heroTitle');
    const heroArtist = document.getElementById('heroArtist');
    const heroScore = document.getElementById('heroScore');
    const heroArtwork = document.getElementById('heroArtwork');
    const heroBg = document.getElementById('heroBg');
    const heroLabel = document.querySelector('.hero-label');
    const playHeroBtn = document.getElementById('playHeroBtn');

    // Update song info
    if (heroTitle) heroTitle.textContent = title;
    if (heroArtist) heroArtist.textContent = artist;
    if (heroScore) heroScore.textContent = score ? score.toFixed(2) : '-';

    // Update artwork
    if (heroArtwork && artworkUrl) {
        heroArtwork.src = artworkUrl;
        heroArtwork.alt = `${title} album art`;
    }

    // Update background
    if (heroBg && artworkUrl) {
        heroBg.style.backgroundImage = `url(${artworkUrl})`;
    }

    // Update label
    if (heroLabel) heroLabel.textContent = 'Now Playing';

    // Update play button
    if (playHeroBtn) {
        playHeroBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
            Now Playing
        `;
        playHeroBtn.classList.add('now-playing');
    }
}

// Create player with a single video
function createPlayerWithVideo(videoId) {
    if (!document.getElementById('ytplayer')) {
        videoWrapper.innerHTML = '<div id="ytplayer"></div>';
    }

    player = new YT.Player('ytplayer', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
            autoplay: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            origin: window.location.origin,
        },
        events: {
            onReady: (event) => {
                console.log('YouTube player ready');
                event.target.playVideo();
            },
            onStateChange: onPlayerStateChange,
            onError: (event) => {
                console.error('YouTube player error:', event.data);
            }
        }
    });
}

// Create song card element (Quick Picks style)
function createSongElement(song, index, chartMode = 'india') {
    const rank = index + 1;
    const el = document.createElement('div');
    el.className = 'song-card';
    el.dataset.index = index;
    el.dataset.chartMode = chartMode;
    el.dataset.videoId = song.youtube_video_id || '';
    el.dataset.title = song.title;
    el.dataset.artist = song.artist;
    el.dataset.artwork = song.artwork_url || '';

    // Format views
    const viewsText = song.youtube_views ? formatViews(song.youtube_views) : '';

    // Rank movement indicator
    const rankMovement = getRankMovementHtml(song);

    // Artwork placeholder SVG
    const placeholderSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"></polygon>
        </svg>
    `;

    el.innerHTML = `
        <div class="song-card-artwork">
            ${song.artwork_url
                ? `<img src="${song.artwork_url}" alt="${escapeHtml(song.title)}" loading="lazy">`
                : `<div class="song-card-artwork-placeholder">${placeholderSvg}</div>`}
            <span class="song-card-rank ${rank <= 3 ? 'top-3' : ''}">#${rank}</span>
            <div class="song-card-play">
                <div class="song-card-play-btn">
                    <svg class="icon-play" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="6 3 20 12 6 21 6 3"></polygon>
                    </svg>
                    <svg class="icon-pause" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16"></rect>
                        <rect x="14" y="4" width="4" height="16"></rect>
                    </svg>
                </div>
            </div>
            <div class="song-card-equalizer">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
        <div class="song-card-info">
            <div class="song-card-title">${escapeHtml(song.title)}</div>
            <div class="song-card-artist">${escapeHtml(song.artist)}</div>
            <div class="song-card-meta">
                <span class="score">${song.score.toFixed(2)}</span>
                ${rankMovement}
                ${viewsText ? `<span>${viewsText} views</span>` : ''}
            </div>
        </div>
        <div class="song-card-actions">
            <button class="song-add-playlist" title="Add to playlist">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M12 5v14M5 12h14"></path>
                </svg>
            </button>
        </div>
    `;

    el.addEventListener('click', () => {
        const mode = el.dataset.chartMode;

        if (mode === 'global') {
            // For global chart, use direct play with video ID
            const videoId = el.dataset.videoId;
            if (videoId) {
                playRegionalSongDirect(el.dataset.title, el.dataset.artist, videoId, el.dataset.artwork, song.score);
            }
        } else {
            // For India chart, use index-based play
            if (index === currentSongIndex && player) {
                togglePlayPause();
            } else {
                playSong(index);
            }
        }
    });

    // Add to playlist button handler - uses data attributes to avoid special character issues
    const addToPlaylistBtn = el.querySelector('.song-add-playlist');
    if (addToPlaylistBtn) {
        addToPlaylistBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            showAddToPlaylistModal({
                title: el.dataset.title,
                artist: el.dataset.artist,
                videoId: el.dataset.videoId,
                artwork: el.dataset.artwork
            });
        });
    }

    return el;
}

// Get rank movement indicator HTML
function getRankMovementHtml(song) {
    // Check if this is a new entry
    if (song.is_new) {
        return '<span class="rank-movement rank-new">NEW</span>';
    }

    // Check rank change
    const change = song.rank_change;
    if (change === undefined || change === null) {
        return ''; // No data available
    }

    if (change > 0) {
        // Moved up (positive change means better rank)
        return `<span class="rank-movement rank-up">▲${change}</span>`;
    } else if (change < 0) {
        // Moved down (negative change means worse rank)
        return `<span class="rank-movement rank-down">▼${Math.abs(change)}</span>`;
    } else {
        // No change
        return '<span class="rank-movement rank-same">●</span>';
    }
}

// Update metadata
function updateMetadata() {
    if (!chartData) return;

    const date = new Date(chartData.generated_at);
    chartDate.textContent = `Updated: ${formatDate(date)}`;

    if (chartData.week) {
        weekLabel.textContent = `Week ${chartData.week}`;
    }
}

// Switch between India and Global chart modes
function switchChartMode(mode) {
    currentChartMode = mode;

    // Update toggle button states (header toggle)
    chartToggle?.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.chart === mode);
    });

    // Update sidebar active state
    updateSidebarActiveState(mode);

    // Ensure auth UI is preserved after chart switch
    if (typeof updateAuthUI === 'function') {
        updateAuthUI();
    }

    // Update badge label and page title
    if (badgeLabel) {
        badgeLabel.textContent = mode === 'india' ? 'India Top 25' : 'Global Top 25';
    }
    document.title = mode === 'india' ? "TLDR Music - India's Top 25" : "TLDR Music - Global Top 25";

    // Update chart section header
    const chartHeader = document.querySelector('.chart-section .chart-header h3');
    if (chartHeader) {
        chartHeader.textContent = mode === 'india' ? 'Quick Picks' : 'Global Charts';
    }

    // Re-render chart list with appropriate data
    const regSection = document.getElementById('regionalSection');
    const globalSection = document.getElementById('globalSpotlightsSection');

    if (mode === 'india') {
        renderChart();
        // Show regional section, hide global spotlights for India mode
        if (regSection) regSection.style.display = 'block';
        if (globalSection) globalSection.style.display = 'none';
    } else {
        renderGlobalMainChart();
        renderGlobalSpotlights();
        // Hide regional section, show global spotlights for Global mode
        if (regSection) regSection.style.display = 'none';
        if (globalSection) globalSection.style.display = 'block';
    }

    // Only update hero if nothing is playing, otherwise keep showing current song
    if (!isPlaying && !player) {
        const heroLabel = document.querySelector('.hero-label');
        if (heroLabel) {
            heroLabel.textContent = mode === 'india' ? "This Week's #1" : "Global #1";
        }
        if (mode === 'india') {
            renderHero();
        } else {
            renderGlobalHero();
        }
    }

    // Update card playing states for the new view
    updateCardPlayingState(isPlaying);
}

// Render hero for global chart
function renderGlobalHero() {
    if (!chartData || !chartData.global_chart || !chartData.global_chart[0]) {
        const heroLabel = document.querySelector('.hero-label');
        if (heroLabel) heroLabel.textContent = 'Global #1';
        return;
    }

    const song = chartData.global_chart[0];

    document.getElementById('heroTitle').textContent = song.title;
    document.getElementById('heroArtist').textContent = song.artist;
    document.getElementById('heroScore').textContent = song.score.toFixed(2);

    const heroArtwork = document.getElementById('heroArtwork');
    if (heroArtwork && song.artwork_url) {
        heroArtwork.src = song.artwork_url;
        heroArtwork.alt = `${song.title} album art`;
        heroArtwork.style.display = 'block';
    }

    const heroBg = document.getElementById('heroBg');
    if (heroBg && song.artwork_url) {
        heroBg.style.backgroundImage = `url(${song.artwork_url})`;
    }

    const viewsStat = document.getElementById('heroViewsStat');
    const viewsEl = document.getElementById('heroViews');
    if (song.youtube_views && song.youtube_views > 0) {
        viewsEl.textContent = formatViews(song.youtube_views);
        viewsStat.style.display = 'flex';
    } else {
        viewsStat.style.display = 'none';
    }

    const heroLabel = document.querySelector('.hero-label');
    if (heroLabel) heroLabel.textContent = 'Global #1';
}

// Render main chart with global data (same format as India chart)
function renderGlobalMainChart() {
    if (!chartData || !chartData.global_chart) {
        chartList.innerHTML = '<div class="loading-state"><p>No global chart data available</p></div>';
        return;
    }

    chartList.innerHTML = '';

    chartData.global_chart.forEach((song, index) => {
        const songEl = createSongElement(song, index, 'global');
        chartList.appendChild(songEl);
    });
}

// Update now playing UI
function updateNowPlaying(index) {
    if (!chartData || !chartData.chart[index]) return;

    const song = chartData.chart[index];

    // Update active state
    document.querySelectorAll('.song-card').forEach(el => el.classList.remove('active'));
    const activeEl = document.querySelector(`.song-card[data-index="${index}"]`);
    if (activeEl) {
        activeEl.classList.add('active');
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    currentSongIndex = index;

    // Update player bar info
    if (playerBarTitle) playerBarTitle.textContent = song.title;
    if (playerBarArtist) playerBarArtist.textContent = song.artist;
    if (playerBarArtwork && song.artwork_url) {
        playerBarArtwork.src = song.artwork_url;
    }

    // Update player bar visibility based on hero visibility
    updatePlayerBarVisibility();

    // Apply artwork as gradient background
    if (song.artwork_url && mainGradient) {
        mainGradient.style.backgroundImage = `url(${song.artwork_url})`;
        mainGradient.classList.add('active');
    }

    // Update hero section with currently playing song
    updateHeroWithSong(song, index);

    // Update lyrics if panel is visible
    if (isLyricsVisible) {
        updateLyrics(index);
    }

    // Update theater info if in theater mode
    if (isTheaterMode) {
        if (theaterTitle) theaterTitle.textContent = song.title;
        if (theaterArtist) theaterArtist.textContent = song.artist;
    }
}

// Update hero section with a specific song
function updateHeroWithSong(song, index) {
    heroSongIndex = index;  // Track which song is in hero

    const heroLabel = document.querySelector('.hero-label');
    const heroTitle = document.getElementById('heroTitle');
    const heroArtist = document.getElementById('heroArtist');
    const heroScore = document.getElementById('heroScore');
    const heroArtwork = document.getElementById('heroArtwork');
    const heroBg = document.getElementById('heroBg');
    const heroRankNum = document.querySelector('.rank-num');
    const viewsStat = document.getElementById('heroViewsStat');
    const viewsEl = document.getElementById('heroViews');
    const playHeroBtn = document.getElementById('playHeroBtn');

    // Update label to show "Now Playing"
    if (heroLabel) heroLabel.textContent = 'Now Playing';

    // Update song info
    if (heroTitle) heroTitle.textContent = song.title;
    if (heroArtist) heroArtist.textContent = song.artist;
    if (heroScore) heroScore.textContent = song.score.toFixed(2);

    // Update rank number
    if (heroRankNum) heroRankNum.textContent = index + 1;

    // Update artwork
    if (heroArtwork && song.artwork_url) {
        heroArtwork.src = song.artwork_url;
        heroArtwork.alt = `${song.title} album art`;
        heroArtwork.style.display = 'block';
    }

    // Update hero background
    if (heroBg && song.artwork_url) {
        heroBg.style.backgroundImage = `url(${song.artwork_url})`;
    }

    // Update header background
    const headerBg = document.getElementById('headerBg');
    if (headerBg && song.artwork_url) {
        headerBg.style.backgroundImage = `url(${song.artwork_url})`;
        headerBg.classList.add('active');
    }

    // Update YouTube views
    if (song.youtube_views && song.youtube_views > 0) {
        if (viewsEl) viewsEl.textContent = formatViews(song.youtube_views);
        if (viewsStat) viewsStat.style.display = 'flex';
    } else {
        if (viewsStat) viewsStat.style.display = 'none';
    }

    // Update button to "Now Playing"
    if (playHeroBtn) {
        playHeroBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
            Now Playing
        `;
        playHeroBtn.classList.add('now-playing');
    }
}

// Play song at a specific time
function playSongAtTime(index, startTime = 0) {
    if (!chartData || !chartData.chart[index]) return;

    const song = chartData.chart[index];

    if (!song.youtube_video_id) {
        return;
    }

    // Update UI
    updateNowPlaying(index);

    // Load video at specific time
    if (player && playerReady) {
        player.loadVideoById({
            videoId: song.youtube_video_id,
            startSeconds: startTime
        });
    } else if (playerReady) {
        // Create player if doesn't exist
        createPlayerWithVideo(song.youtube_video_id);
    }
}

// Play song
function playSong(index) {
    // Require authentication to play
    if (!requireAuth(() => playSong(index))) return;

    if (!chartData || !chartData.chart[index]) return;

    const song = chartData.chart[index];

    if (!song.youtube_video_id) {
        showPlayerError();
        return;
    }

    // Reset regional song flag and video ID when playing main chart song
    isRegionalSongPlaying = false;
    currentPlayingVideoId = null;

    // Track in history
    addToHistory(song);

    // Close theater mode if active (stops theater player, skip resume since new song will play)
    if (isTheaterMode) {
        closeTheaterMode(true);
    }

    updateNowPlaying(index);

    // Update favorite button state (after updateNowPlaying so currentSongIndex is correct)
    updateFavoriteButtons();

    const playlist = chartData.chart
        .slice(index)
        .map(s => s.youtube_video_id)
        .filter(id => id);

    if (player && playerReady) {
        player.loadPlaylist(playlist);
    } else if (playerReady) {
        createPlayer(playlist);
    } else {
        setTimeout(() => playSong(index), 100);
    }
}

// Create YouTube player
function createPlayer(playlist) {
    if (!document.getElementById('ytplayer')) {
        videoWrapper.innerHTML = '<div id="ytplayer"></div>';
    }

    player = new YT.Player('ytplayer', {
        height: '100%',
        width: '100%',
        playerVars: {
            autoplay: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            origin: window.location.origin,
        },
        events: {
            onReady: (event) => {
                console.log('YouTube player ready');
                event.target.loadPlaylist(playlist);
            },
            onStateChange: onPlayerStateChange,
            onError: (event) => {
                console.error('YouTube player error:', event.data);
            }
        }
    });
}

// Handle player state changes
function onPlayerStateChange(event) {
    // Update play/pause button state
    if (event.data === YT.PlayerState.PLAYING) {
        isPlaying = true;
        playPauseBtn?.classList.add('playing');
        updateCardPlayingState(true);
        updateHeroButtonState(true);
        heroProgress?.classList.add('visible');
        startProgressTracking();

        const playlistIndex = player.getPlaylistIndex();
        const newIndex = currentSongIndex + playlistIndex;

        if (playlistIndex > 0 && newIndex !== currentSongIndex) {
            const currentVideoUrl = player.getVideoUrl();
            const videoId = extractVideoId(currentVideoUrl);

            if (videoId) {
                const songIndex = chartData.chart.findIndex(s => s.youtube_video_id === videoId);
                if (songIndex !== -1 && songIndex !== currentSongIndex) {
                    updateNowPlaying(songIndex);
                }
            }
        }
    } else if (event.data === YT.PlayerState.PAUSED) {
        isPlaying = false;
        playPauseBtn?.classList.remove('playing');
        updateCardPlayingState(false);
        updateHeroButtonState(false);
        stopProgressTracking();
    } else if (event.data === YT.PlayerState.ENDED) {
        isPlaying = false;
        playPauseBtn?.classList.remove('playing');
        updateCardPlayingState(false);
        updateHeroButtonState(false);
        stopProgressTracking();

        // Handle repeat one - replay current song
        if (repeatMode === 'one' && currentSongIndex >= 0) {
            playSong(currentSongIndex);
            return;
        }

        // Auto play next (respects queue/shuffle/repeat-all)
        playNext();
    }
}

// Update hero button state based on playback
function updateHeroButtonState(playing) {
    const playHeroBtn = document.getElementById('playHeroBtn');
    if (!playHeroBtn) return;

    if (playing && heroSongIndex === currentSongIndex) {
        playHeroBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16"></rect>
                <rect x="14" y="4" width="4" height="16"></rect>
            </svg>
            Now Playing
        `;
        playHeroBtn.classList.add('now-playing');
    } else if (heroSongIndex === currentSongIndex) {
        // Paused but same song
        playHeroBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Resume
        `;
        playHeroBtn.classList.remove('now-playing');
    }
}

// Update playing state on song cards
function updateCardPlayingState(playing) {
    document.querySelectorAll('.song-card').forEach(el => el.classList.remove('playing'));
    if (playing) {
        if (currentSongIndex >= 0) {
            // India chart - use index
            const activeEl = document.querySelector(`.song-card[data-index="${currentSongIndex}"]:not([data-chart-mode="global"])`);
            if (activeEl) {
                activeEl.classList.add('playing');
            }
        } else if (currentPlayingVideoId) {
            // Global/Regional - use video ID
            const activeEl = document.querySelector(`.song-card[data-video-id="${currentPlayingVideoId}"]`);
            if (activeEl) {
                activeEl.classList.add('playing');
            }
        }
    }
}

// Progress tracking
function startProgressTracking() {
    stopProgressTracking();
    updateProgress();
    progressInterval = setInterval(updateProgress, 500);
}

function stopProgressTracking() {
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }
}

function updateProgress() {
    if (!player || typeof player.getCurrentTime !== 'function') return;

    try {
        const currentTime = player.getCurrentTime() || 0;
        const duration = player.getDuration() || 0;

        if (duration > 0) {
            const percent = (currentTime / duration) * 100;
            const currentTimeStr = formatTime(currentTime);
            const durationStr = formatTime(duration);

            // Update player bar progress
            const progressFillEl = document.getElementById('progressFill');
            const timeCurrentEl = document.getElementById('timeCurrent');
            const timeDurationEl = document.getElementById('timeDuration');
            if (progressFillEl) progressFillEl.style.width = `${percent}%`;
            if (timeCurrentEl) timeCurrentEl.textContent = currentTimeStr;
            if (timeDurationEl) timeDurationEl.textContent = durationStr;

            // Update hero progress bar
            if (heroProgressFill) heroProgressFill.style.width = `${percent}%`;
            if (heroTimeCurrent) heroTimeCurrent.textContent = currentTimeStr;
            if (heroTimeDuration) heroTimeDuration.textContent = durationStr;
        }
    } catch (e) {
        // Player not ready
    }
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function seekTo(percent) {
    // Use theater player if in theater mode
    const activePlayer = isTheaterMode && theaterPlayer ? theaterPlayer : player;
    if (!activePlayer || typeof activePlayer.getDuration !== 'function') return;

    try {
        const duration = activePlayer.getDuration();
        if (duration > 0) {
            const seekTime = (percent / 100) * duration;
            activePlayer.seekTo(seekTime, true);
            if (isTheaterMode) {
                updateTheaterProgress();
            } else {
                updateProgress();
            }
        }
    } catch (e) {
        // Player not ready
    }
}

// Extract video ID from URL
function extractVideoId(url) {
    if (!url) return null;
    const match = url.match(/[?&]v=([^&]+)/);
    return match ? match[1] : null;
}

// Show placeholders/errors
function showPlayerPlaceholder() {
    videoWrapper.innerHTML = `
        <div class="player-placeholder">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                <circle cx="12" cy="12" r="10"></circle>
                <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"></polygon>
            </svg>
            <p>Select a song to play</p>
        </div>
    `;
}

function showPlayerError() {
    // Array of witty messages for when video is unavailable
    const wittyMessages = [
        { emoji: '🎭', title: "YouTube's playing hide and seek", subtitle: "Our API quota ran away. It'll be back tomorrow!" },
        { emoji: '🔋', title: "We've run out of YouTube juice", subtitle: "Quota exceeded. Recharging at midnight PT..." },
        { emoji: '🎬', title: "The show must go on... tomorrow", subtitle: "YouTube API said 'see you later!' Try again after midnight PT." },
        { emoji: '☕', title: "YouTube needs a coffee break", subtitle: "API quota exhausted. Check back after 1:30 PM IST!" },
        { emoji: '🎪', title: "Intermission time!", subtitle: "We've used up today's YouTube passes. New ones at midnight PT." },
        { emoji: '🌙', title: "Waiting for the midnight reset", subtitle: "Our YouTube quota resets at midnight Pacific Time. Hang tight!" },
    ];

    const msg = wittyMessages[Math.floor(Math.random() * wittyMessages.length)];

    videoWrapper.innerHTML = `
        <div class="player-placeholder error-state">
            <span class="error-emoji">${msg.emoji}</span>
            <p class="error-title">${msg.title}</p>
            <p class="error-subtitle">${msg.subtitle}</p>
        </div>
    `;

    showToast(`${msg.emoji} ${msg.title}`);
}

function showError() {
    const errorMessages = [
        { emoji: '🎵', title: "The music got lost in the cloud", subtitle: "Our API is having a moment. Try refreshing!" },
        { emoji: '🔌', title: "Someone unplugged the jukebox", subtitle: "Can't reach our servers right now. Check back soon!" },
        { emoji: '🎸', title: "The band took an unscheduled break", subtitle: "Chart data unavailable. Refresh to try again." },
        { emoji: '📡', title: "Lost signal to the mothership", subtitle: "Our API server is unreachable. Give it another shot!" },
    ];

    const msg = errorMessages[Math.floor(Math.random() * errorMessages.length)];

    chartList.innerHTML = `
        <div class="chart-error">
            <span class="error-emoji">${msg.emoji}</span>
            <p class="error-title">${msg.title}</p>
            <p class="error-subtitle">${msg.subtitle}</p>
            <button class="retry-btn" onclick="location.reload()">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16"/>
                </svg>
                Try Again
            </button>
        </div>
    `;
}

// Setup hero visibility observer
function setupHeroObserver() {
    if (!heroSection) return;

    heroObserver = new IntersectionObserver(
        (entries) => {
            entries.forEach(entry => {
                isHeroVisible = entry.isIntersecting;
                updatePlayerBarVisibility();
            });
        },
        {
            threshold: 0.3, // Hero is considered visible if 30% is showing
            rootMargin: '-60px 0px 0px 0px' // Account for sticky header
        }
    );

    heroObserver.observe(heroSection);
}

// Update player bar visibility based on hero visibility
function updatePlayerBarVisibility() {
    if (!playerBar) return;

    // Only show player bar if:
    // 1. A song is playing or has been selected (currentSongIndex >= 0 OR regional song playing)
    // 2. Hero is NOT visible OR we're NOT in theater mode
    const hasSongSelected = currentSongIndex >= 0 || isRegionalSongPlaying;
    const shouldShowPlayerBar = hasSongSelected && !isHeroVisible && !isTheaterMode;

    if (shouldShowPlayerBar) {
        playerBar.classList.add('visible');
    } else if (hasSongSelected && (isHeroVisible || isTheaterMode)) {
        // Hide player bar when hero is visible (song plays in hero)
        playerBar.classList.remove('visible');
    } else if (isRegionalSongPlaying) {
        // Always show player bar for regional songs (they don't play in hero)
        playerBar.classList.add('visible');
    }
}

// Event listeners
function setupEventListeners() {
    shareBtn?.addEventListener('click', shareChart);

    // Chart toggle
    chartToggle?.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const mode = btn.dataset.chart;
            if (mode !== currentChartMode) {
                switchChartMode(mode);
            }
        });
    });

    // Setup hero visibility observer
    setupHeroObserver();

    const playHeroBtn = document.getElementById('playHeroBtn');
    playHeroBtn?.addEventListener('click', () => {
        // If already playing, toggle pause
        if (player && isPlaying) {
            togglePlayPause();
            return;
        }

        // Play based on current chart mode
        if (currentChartMode === 'global') {
            // Play from global chart
            const song = chartData?.global_chart?.[0];
            if (song && song.youtube_video_id) {
                playRegionalSongDirect(song.title, song.artist, song.youtube_video_id, song.artwork_url, song.score);
            }
        } else {
            // Play from India chart
            playSong(heroSongIndex);
        }
    });

    // Player bar controls
    playPauseBtn?.addEventListener('click', togglePlayPause);
    prevBtn?.addEventListener('click', playPrevious);
    nextBtn?.addEventListener('click', playNext);
    videoToggleBtn?.addEventListener('click', toggleVideo);
    videoClose?.addEventListener('click', closeTheaterMode);
    theaterClose?.addEventListener('click', closeTheaterMode);

    // Lyrics panel controls
    lyricsToggleBtn?.addEventListener('click', toggleLyrics);
    lyricsClose?.addEventListener('click', () => {
        lyricsPanel?.classList.remove('visible');
        lyricsToggleBtn?.classList.remove('active');
        isLyricsVisible = false;
    });

    // Progress bar seek
    progressBar?.addEventListener('click', (e) => {
        const rect = progressBar.getBoundingClientRect();
        const percent = ((e.clientX - rect.left) / rect.width) * 100;
        seekTo(Math.max(0, Math.min(100, percent)));
    });

    // Hero progress bar seek
    heroProgressBar?.addEventListener('click', (e) => {
        const rect = heroProgressBar.getBoundingClientRect();
        const percent = ((e.clientX - rect.left) / rect.width) * 100;
        seekTo(Math.max(0, Math.min(100, percent)));
    });

    // Hero action buttons
    heroLyricsBtn?.addEventListener('click', toggleLyrics);
    heroVideoBtn?.addEventListener('click', toggleVideo);

    // New feature buttons
    document.getElementById('favoriteBtn')?.addEventListener('click', () => toggleFavorite());
    document.getElementById('shuffleBtn')?.addEventListener('click', toggleShuffle);
    document.getElementById('repeatBtn')?.addEventListener('click', cycleRepeat);
    document.getElementById('queueToggleBtn')?.addEventListener('click', toggleQueue);
    document.getElementById('queueClose')?.addEventListener('click', toggleQueue);
    document.getElementById('queueClear')?.addEventListener('click', clearQueue);

    document.addEventListener('keydown', handleKeyboard);
}

// Toggle play/pause
function togglePlayPause() {
    // Use theater player if in theater mode
    const activePlayer = isTheaterMode && theaterPlayer ? theaterPlayer : player;

    if (!activePlayer) {
        console.log('No active player');
        return;
    }

    try {
        // Check actual player state, not just our tracked state
        const playerState = activePlayer.getPlayerState?.();
        const actuallyPlaying = playerState === YT.PlayerState.PLAYING || playerState === YT.PlayerState.BUFFERING;

        if (actuallyPlaying) {
            activePlayer.pauseVideo();
        } else {
            activePlayer.playVideo();
        }
    } catch (e) {
        console.error('Error toggling play/pause:', e);
        // Fallback to our tracked state
        if (isPlaying) {
            activePlayer.pauseVideo?.();
        } else {
            activePlayer.playVideo?.();
        }
    }
}

// Play previous song
function playPrevious() {
    if (currentSongIndex > 0) {
        playSong(currentSongIndex - 1);
    }
}

// Play next song
function playNext() {
    // Check queue first
    const queuedSong = playFromQueue();
    if (queuedSong) {
        playRegionalSongDirect(queuedSong.title, queuedSong.artist, queuedSong.videoId, queuedSong.artwork);
        return;
    }

    // Handle repeat one (handled in onPlayerStateChange for auto-next)
    // For manual next, skip to next song

    // Handle shuffle
    if (isShuffleOn && chartData?.chart) {
        const randomIndex = Math.floor(Math.random() * chartData.chart.length);
        playSong(randomIndex);
        return;
    }

    // Normal next
    if (chartData && currentSongIndex < chartData.chart.length - 1) {
        playSong(currentSongIndex + 1);
    } else if (repeatMode === 'all' && chartData?.chart?.length > 0) {
        playSong(0); // Loop back to start
    }
}

// Toggle video visibility - switches to theater mode
function toggleVideo() {
    if (currentSongIndex < 0 && !player) {
        showToast('Play a song first to view video');
        return;
    }

    isTheaterMode = !isTheaterMode;
    isVideoVisible = isTheaterMode;

    if (isTheaterMode) {
        // Enter theater mode
        heroSection?.classList.add('theater-mode');
        videoToggleBtn?.classList.add('active');
        heroVideoBtn?.classList.add('active');

        // Update theater info with current song
        if (currentSongIndex >= 0 && chartData?.chart[currentSongIndex]) {
            const song = chartData.chart[currentSongIndex];
            if (theaterTitle) theaterTitle.textContent = song.title;
            if (theaterArtist) theaterArtist.textContent = song.artist;
        }

        // Move YouTube player to theater container
        movePlayerToTheater();

        // Scroll hero into view
        heroSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        closeTheaterMode();
    }
}

// Move YouTube player to theater container
let theaterPlayer = null;

function movePlayerToTheater() {
    if (!player || !theaterVideo) return;

    // Get current video ID and time
    let videoUrl, videoId, currentTime;
    try {
        videoUrl = player.getVideoUrl?.();
        videoId = extractVideoId(videoUrl);
        currentTime = player.getCurrentTime?.() || 0;
    } catch (e) {
        console.error('Error getting player state:', e);
        return;
    }

    // Stop the original player (not just pause) to free up resources
    try {
        player.stopVideo();
    } catch (e) {}

    if (videoId) {
        // Create new player in theater container
        theaterVideo.innerHTML = '<div id="theaterPlayer"></div>';

        // Create theater player
        theaterPlayer = new YT.Player('theaterPlayer', {
            height: '100%',
            width: '100%',
            videoId: videoId,
            playerVars: {
                autoplay: 1,
                modestbranding: 1,
                rel: 0,
                playsinline: 1,
                start: Math.floor(currentTime),
                origin: window.location.origin,
            },
            events: {
                onReady: (event) => {
                    // Seek to current time for precision
                    event.target.seekTo(currentTime, true);
                    event.target.playVideo();
                },
                onStateChange: onTheaterPlayerStateChange,
            }
        });
    }
}

// Handle theater player state changes
function onTheaterPlayerStateChange(event) {
    if (event.data === YT.PlayerState.PLAYING) {
        isPlaying = true;
        playPauseBtn?.classList.add('playing');
        updateCardPlayingState(true);
        startTheaterProgressTracking();
    } else if (event.data === YT.PlayerState.PAUSED) {
        isPlaying = false;
        playPauseBtn?.classList.remove('playing');
        updateCardPlayingState(false);
        stopProgressTracking();
    } else if (event.data === YT.PlayerState.ENDED) {
        isPlaying = false;
        playPauseBtn?.classList.remove('playing');
        updateCardPlayingState(false);
        stopProgressTracking();
    }
}

// Progress tracking for theater player
function startTheaterProgressTracking() {
    stopProgressTracking();
    updateTheaterProgress();
    progressInterval = setInterval(updateTheaterProgress, 500);
}

function updateTheaterProgress() {
    if (!theaterPlayer || typeof theaterPlayer.getCurrentTime !== 'function') return;

    try {
        const currentTime = theaterPlayer.getCurrentTime() || 0;
        const duration = theaterPlayer.getDuration() || 0;

        if (duration > 0) {
            const percent = (currentTime / duration) * 100;
            const currentTimeStr = formatTime(currentTime);
            const durationStr = formatTime(duration);

            // Update player bar progress
            const progressFillEl = document.getElementById('progressFill');
            const timeCurrentEl = document.getElementById('timeCurrent');
            const timeDurationEl = document.getElementById('timeDuration');
            if (progressFillEl) progressFillEl.style.width = `${percent}%`;
            if (timeCurrentEl) timeCurrentEl.textContent = currentTimeStr;
            if (timeDurationEl) timeDurationEl.textContent = durationStr;

            // Also update hero progress bar (keep in sync)
            if (heroProgressFill) heroProgressFill.style.width = `${percent}%`;
            if (heroTimeCurrent) heroTimeCurrent.textContent = currentTimeStr;
            if (heroTimeDuration) heroTimeDuration.textContent = durationStr;
        }
    } catch (e) {
        // Player not ready
    }
}

// Close theater mode
// skipResume: if true, don't resume original player (used when switching songs)
function closeTheaterMode(skipResume = false) {
    // Handle case where event object is passed from click handler
    if (typeof skipResume !== 'boolean') {
        skipResume = false;
    }

    // Get current position from theater player before destroying
    let currentTime = 0;
    let wasPlaying = isPlaying;

    if (theaterPlayer && typeof theaterPlayer.getCurrentTime === 'function') {
        try {
            currentTime = theaterPlayer.getCurrentTime() || 0;
            const state = theaterPlayer.getPlayerState?.();
            wasPlaying = state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING;
            console.log('Theater close - time:', currentTime, 'wasPlaying:', wasPlaying, 'skipResume:', skipResume);
        } catch (e) {
            console.log('Error getting theater state:', e);
        }
    }

    // Stop and destroy theater player
    if (theaterPlayer) {
        try {
            if (typeof theaterPlayer.stopVideo === 'function') {
                theaterPlayer.stopVideo();
            }
            if (typeof theaterPlayer.destroy === 'function') {
                theaterPlayer.destroy();
            }
        } catch (e) {}
    }
    theaterPlayer = null;

    // Update state
    isTheaterMode = false;
    isVideoVisible = false;

    heroSection?.classList.remove('theater-mode');
    videoContainer?.classList.remove('visible');
    videoToggleBtn?.classList.remove('active');
    heroVideoBtn?.classList.remove('active');

    // Clear theater video container
    if (theaterVideo) {
        theaterVideo.innerHTML = '';
    }

    stopProgressTracking();

    // Resume playback (unless skipping for new song)
    if (!skipResume && currentSongIndex >= 0 && chartData?.chart[currentSongIndex]?.youtube_video_id) {
        const resumeTime = currentTime;
        const resumeIndex = currentSongIndex;
        const shouldPlay = wasPlaying;
        const videoId = chartData.chart[resumeIndex].youtube_video_id;

        console.log('Resuming playback - videoId:', videoId, 'time:', resumeTime, 'shouldPlay:', shouldPlay);

        // Destroy and recreate the main player to ensure clean state
        if (player) {
            try {
                player.destroy();
            } catch (e) {}
            player = null;
        }

        // Recreate the player element
        videoWrapper.innerHTML = '<div id="ytplayer"></div>';

        // Create new player with the video
        setTimeout(() => {
            player = new YT.Player('ytplayer', {
                height: '100%',
                width: '100%',
                videoId: videoId,
                playerVars: {
                    autoplay: shouldPlay ? 1 : 0,
                    modestbranding: 1,
                    rel: 0,
                    playsinline: 1,
                    start: Math.floor(resumeTime),
                    origin: window.location.origin,
                },
                events: {
                    onReady: (event) => {
                        console.log('Resume player ready');
                        // Seek to exact time for precision
                        event.target.seekTo(resumeTime, true);
                        if (shouldPlay) {
                            event.target.playVideo();
                        }
                        // Start tracking progress
                        startProgressTracking();
                    },
                    onStateChange: onPlayerStateChange,
                    onError: (event) => {
                        console.error('Resume player error:', event.data);
                    }
                }
            });
        }, 100);
    }

    // Update player bar visibility (may show now that theater is closed)
    updatePlayerBarVisibility();
}

// Toggle lyrics panel
function toggleLyrics() {
    isLyricsVisible = !isLyricsVisible;
    if (isLyricsVisible) {
        lyricsPanel?.classList.add('visible');
        lyricsToggleBtn?.classList.add('active');
        heroLyricsBtn?.classList.add('active');
        // Update lyrics for current song
        if (currentSongIndex >= 0) {
            updateLyrics(currentSongIndex);
        }
    } else {
        lyricsPanel?.classList.remove('visible');
        lyricsToggleBtn?.classList.remove('active');
        heroLyricsBtn?.classList.remove('active');
    }
}

// Update lyrics display
function updateLyrics(index) {
    if (!chartData || !chartData.chart[index]) return;

    const song = chartData.chart[index];

    // Update header
    if (lyricsSongTitle) lyricsSongTitle.textContent = song.title;
    if (lyricsSongArtist) lyricsSongArtist.textContent = song.artist;

    // Check if lyrics are available
    const lyrics = song.lyrics_plain || song.lyrics_synced;

    if (!lyrics) {
        const lyricsMessages = [
            { emoji: '🤐', text: "This song's keeping its lyrics a secret" },
            { emoji: '🎤', text: "The lyrics are on a karaoke break" },
            { emoji: '📝', text: "Oops, someone forgot to write down the words" },
            { emoji: '🔇', text: "Lyrics went silent. Time to freestyle!" },
            { emoji: '🎧', text: "Just vibe to the music - lyrics unavailable" },
        ];
        const msg = lyricsMessages[Math.floor(Math.random() * lyricsMessages.length)];

        lyricsContent.innerHTML = `
            <div class="lyrics-unavailable">
                <span class="error-emoji">${msg.emoji}</span>
                <p class="error-title">${msg.text}</p>
                <p class="error-subtitle">Try a different song or check back later</p>
            </div>
        `;
        return;
    }

    // Parse and display lyrics
    const lyricsText = song.lyrics_plain || parseSyncedLyrics(song.lyrics_synced);

    // Split into lines and wrap each line for potential synced highlighting
    const lines = lyricsText.split('\n');
    const linesHtml = lines.map((line, i) =>
        `<span class="lyrics-line" data-line="${i}">${escapeHtml(line) || '&nbsp;'}</span>`
    ).join('');

    lyricsContent.innerHTML = `<div class="lyrics-text">${linesHtml}</div>`;
}

// Parse synced lyrics (LRC format) to plain text
function parseSyncedLyrics(syncedLyrics) {
    if (!syncedLyrics) return '';

    // Remove timestamps like [00:00.00] from LRC format
    return syncedLyrics
        .split('\n')
        .map(line => line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim())
        .join('\n');
}

// Share
async function shareChart() {
    const url = window.location.href;
    const text = "Check out India's Top 25 Music Chart on TLDR Music!";

    if (navigator.share) {
        try {
            await navigator.share({ title: 'TLDR Music - India Top 25', text, url });
            return;
        } catch (err) {}
    }

    try {
        await navigator.clipboard.writeText(url);
        showToast('Link copied to clipboard!');
    } catch (err) {
        showToast('Unable to copy link');
    }
}

// Keyboard navigation
function handleKeyboard(e) {
    // Skip if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Skip if modifier keys are pressed (allow browser shortcuts like CMD+SHIFT+R)
    if (e.metaKey || e.ctrlKey || e.altKey) return;

    if (!chartData) return;

    const maxIndex = chartData.chart.length - 1;

    switch (e.key) {
        case 'ArrowDown':
        case 'j':
            e.preventDefault();
            if (currentSongIndex < maxIndex) {
                playSong(currentSongIndex + 1);
            }
            break;
        case 'ArrowUp':
        case 'k':
            e.preventDefault();
            if (currentSongIndex > 0) {
                playSong(currentSongIndex - 1);
            }
            break;
        case 'Enter':
        case ' ':
            if (e.target.tagName === 'BUTTON') return; // Let button handle it
            if (player) {
                e.preventDefault();
                togglePlayPause();
            } else if (currentSongIndex === -1 && chartData.chart.length > 0) {
                e.preventDefault();
                playSong(0);
            }
            break;
        case 'l':
        case 'L':
            e.preventDefault();
            toggleLyrics();
            break;
        case 'h':
        case 'H':
            e.preventDefault();
            toggleFavorite();
            break;
        case 's':
        case 'S':
            e.preventDefault();
            toggleShuffle();
            break;
        case 'r':
        case 'R':
            e.preventDefault();
            cycleRepeat();
            break;
        case 'q':
        case 'Q':
            e.preventDefault();
            toggleQueue();
            break;
        case 'p':
        case 'P':
            e.preventDefault();
            togglePlaylistPanel();
            break;
        case 'Escape':
            if (isPlaylistPanelVisible) {
                e.preventDefault();
                togglePlaylistPanel();
            } else if (isQueueVisible) {
                e.preventDefault();
                toggleQueue();
            } else if (isTheaterMode) {
                e.preventDefault();
                closeTheaterMode();
            } else if (isLyricsVisible) {
                e.preventDefault();
                toggleLyrics();
            }
            break;
    }
}

// Toast
function showToast(message) {
    toastMessage.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// Utilities
function formatDate(date) {
    return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
}

function formatViews(views) {
    if (views >= 1000000000) return (views / 1000000000).toFixed(1) + 'B';
    if (views >= 1000000) return (views / 1000000).toFixed(1) + 'M';
    if (views >= 1000) return (views / 1000).toFixed(1) + 'K';
    return views.toString();
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ============================================================
// localStorage Functions
// ============================================================

function loadUserData() {
    try {
        favorites = JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES)) || [];
        playHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY)) || [];
        queue = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUEUE)) || [];
        playlists = JSON.parse(localStorage.getItem(STORAGE_KEYS.PLAYLISTS)) || [];

        // Ensure all playlists have required fields
        playlists = playlists.map(p => ({
            ...p,
            songs: p.songs || [],
            song_count: p.song_count ?? p.songs?.length ?? 0,
            cover_urls: p.cover_urls || [],
            is_public: p.is_public ?? false,
            is_owner: p.is_owner ?? true
        }));

        isShuffleOn = localStorage.getItem(STORAGE_KEYS.SHUFFLE) === 'true';
        repeatMode = localStorage.getItem(STORAGE_KEYS.REPEAT) || 'off';
        console.log(`Loaded user data: ${favorites.length} favorites, ${playlists.length} playlists`);
    } catch (e) {
        console.warn('Error loading user data:', e);
    }
}

function saveFavorites() {
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
    // Sync to cloud if authenticated
    if (typeof debouncedSyncFavorites === 'function') debouncedSyncFavorites();
}

function saveHistory() {
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(playHistory.slice(0, 50)));
    // Sync to cloud if authenticated
    if (typeof debouncedSyncHistory === 'function') debouncedSyncHistory();
}

function saveQueue() {
    localStorage.setItem(STORAGE_KEYS.QUEUE, JSON.stringify(queue));
    // Sync to cloud if authenticated
    if (typeof debouncedSyncQueue === 'function') debouncedSyncQueue();
}

function savePlaybackSettings() {
    localStorage.setItem(STORAGE_KEYS.SHUFFLE, isShuffleOn);
    localStorage.setItem(STORAGE_KEYS.REPEAT, repeatMode);
    // Sync to cloud if authenticated
    if (typeof debouncedSyncPreferences === 'function') debouncedSyncPreferences();
}

function savePlaylists() {
    localStorage.setItem(STORAGE_KEYS.PLAYLISTS, JSON.stringify(playlists));
    // Sync to cloud if authenticated
    if (typeof debouncedSyncPlaylists === 'function') debouncedSyncPlaylists();
    // Update UI
    updatePlaylistCount();
}

// ============================================================
// Favorites Functions
// ============================================================

function toggleFavorite(song = null) {
    // Get current song if not provided
    if (!song) {
        if (currentSongIndex >= 0 && chartData?.chart[currentSongIndex]) {
            song = chartData.chart[currentSongIndex];
        } else if (isRegionalSongPlaying) {
            // Get from player bar info
            song = {
                title: playerBarTitle?.textContent,
                artist: playerBarArtist?.textContent,
                youtube_video_id: currentPlayingVideoId,
                artwork_url: playerBarArtwork?.src
            };
        }
    }
    if (!song || !song.title) return;

    const songId = `${song.title}-${song.artist}`.toLowerCase();
    const index = favorites.findIndex(f => `${f.title}-${f.artist}`.toLowerCase() === songId);

    if (index >= 0) {
        favorites.splice(index, 1);
        showToast('Removed from favorites');
    } else {
        favorites.push({
            title: song.title,
            artist: song.artist,
            videoId: song.youtube_video_id || song.videoId,
            artwork: song.artwork_url || song.artwork,
            addedAt: Date.now()
        });
        showToast('Added to favorites');
    }

    saveFavorites();
    updateFavoriteButtons();
    renderFavoritesSection();
}

function isSongFavorite(song) {
    if (!song) return false;
    const songId = `${song.title}-${song.artist}`.toLowerCase();
    return favorites.some(f => `${f.title}-${f.artist}`.toLowerCase() === songId);
}

function updateFavoriteButtons() {
    const btn = document.getElementById('favoriteBtn');
    let currentSong = null;

    if (currentSongIndex >= 0 && chartData?.chart[currentSongIndex]) {
        currentSong = chartData.chart[currentSongIndex];
    } else if (isRegionalSongPlaying && playerBarTitle?.textContent) {
        currentSong = {
            title: playerBarTitle.textContent,
            artist: playerBarArtist?.textContent
        };
    }

    const isFav = currentSong ? isSongFavorite(currentSong) : false;
    btn?.classList.toggle('active', isFav);
}

function renderFavoritesSection() {
    // Update the library card count
    const countEl = document.getElementById('favoritesCardCount');
    if (countEl) {
        countEl.textContent = `${favorites.length} song${favorites.length !== 1 ? 's' : ''}`;
    }
}

function showFavoritesDetail() {
    // Hide other views
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('playlistsView').style.display = 'none';
    document.getElementById('playlistDetailView').style.display = 'none';
    document.getElementById('historyDetailView').style.display = 'none';

    // Show favorites detail
    const detailView = document.getElementById('favoritesDetailView');
    detailView.style.display = 'block';

    // Render header
    const header = document.getElementById('favoritesDetailHeader');
    header.innerHTML = `
        <button class="back-btn" onclick="showPlaylistsView()">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
        </button>
        <div class="detail-header-content">
            <div class="detail-cover favorites-cover">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
            </div>
            <div class="detail-info">
                <h1>Liked Songs</h1>
                <p class="detail-meta">${favorites.length} song${favorites.length !== 1 ? 's' : ''}</p>
                <div class="detail-actions">
                    <button class="btn-primary" onclick="playAllFavorites()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        Play All
                    </button>
                </div>
            </div>
        </div>
    `;

    // Render songs
    const songsContainer = document.getElementById('favoritesDetailSongs');
    if (favorites.length === 0) {
        songsContainer.innerHTML = `
            <div class="detail-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
                <p>No liked songs yet</p>
                <span>Songs you like will appear here</span>
            </div>
        `;
        return;
    }

    songsContainer.innerHTML = favorites.map((fav, index) => `
        <div class="detail-song" data-index="${index}" data-video-id="${fav.videoId || ''}" data-title="${escapeHtml(fav.title)}" data-artist="${escapeHtml(fav.artist)}" data-artwork="${fav.artwork || ''}">
            <span class="detail-song-num">${index + 1}</span>
            <div class="detail-song-artwork">
                ${fav.artwork
                    ? `<img src="${fav.artwork}" alt="${escapeHtml(fav.title)}">`
                    : `<div class="detail-song-placeholder"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8" fill="currentColor"></polygon></svg></div>`}
            </div>
            <div class="detail-song-info">
                <span class="detail-song-title">${escapeHtml(fav.title)}</span>
                <span class="detail-song-artist">${escapeHtml(fav.artist)}</span>
            </div>
            <button class="detail-song-remove" title="Remove from favorites" onclick="event.stopPropagation(); removeFavoriteByIndex(${index})">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
        </div>
    `).join('');

    // Add click handlers
    songsContainer.querySelectorAll('.detail-song').forEach(song => {
        song.addEventListener('click', () => {
            const videoId = song.dataset.videoId;
            if (videoId) {
                playRegionalSongDirect(song.dataset.title, song.dataset.artist, videoId, song.dataset.artwork);
            }
        });
    });
}

function removeFavoriteByIndex(index) {
    if (index >= 0 && index < favorites.length) {
        const fav = favorites[index];
        toggleFavorite({ title: fav.title, artist: fav.artist });
        showFavoritesDetail(); // Re-render
    }
}

function playAllFavorites() {
    if (favorites.length === 0) return;

    // Clear queue and add all favorites
    queue.length = 0;
    favorites.forEach(fav => {
        queue.push({
            title: fav.title,
            artist: fav.artist,
            videoId: fav.videoId,
            artwork: fav.artwork
        });
    });

    // Play first song
    const first = queue.shift();
    if (first && first.videoId) {
        playRegionalSongDirect(first.title, first.artist, first.videoId, first.artwork);
    }

    updateQueueBadge();
    showToast(`Playing ${favorites.length} songs`);
}

// ============================================================
// History Functions
// ============================================================

function addToHistory(song) {
    if (!song || !song.title) return;

    const historyItem = {
        title: song.title,
        artist: song.artist,
        videoId: song.youtube_video_id || song.videoId,
        artwork: song.artwork_url || song.artwork,
        playedAt: Date.now()
    };

    // Remove duplicate if exists
    const songId = `${song.title}-${song.artist}`.toLowerCase();
    playHistory = playHistory.filter(h =>
        `${h.title}-${h.artist}`.toLowerCase() !== songId
    );

    // Add to front
    playHistory.unshift(historyItem);

    // Keep only last 50
    playHistory = playHistory.slice(0, 50);

    saveHistory();
    renderHistorySection();
}

function renderHistorySection() {
    // Update the library card count
    const countEl = document.getElementById('historyCardCount');
    if (countEl) {
        countEl.textContent = `${playHistory.length} song${playHistory.length !== 1 ? 's' : ''}`;
    }
}

function showHistoryDetail() {
    // Hide other views
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('playlistsView').style.display = 'none';
    document.getElementById('playlistDetailView').style.display = 'none';
    document.getElementById('favoritesDetailView').style.display = 'none';

    // Show history detail
    const detailView = document.getElementById('historyDetailView');
    detailView.style.display = 'block';

    // Render header
    const header = document.getElementById('historyDetailHeader');
    header.innerHTML = `
        <button class="back-btn" onclick="showPlaylistsView()">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
        </button>
        <div class="detail-header-content">
            <div class="detail-cover history-cover">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
            </div>
            <div class="detail-info">
                <h1>Recently Played</h1>
                <p class="detail-meta">${playHistory.length} song${playHistory.length !== 1 ? 's' : ''}</p>
                <div class="detail-actions">
                    <button class="btn-primary" onclick="playAllHistory()">
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        Play All
                    </button>
                </div>
            </div>
        </div>
    `;

    // Render songs
    const songsContainer = document.getElementById('historyDetailSongs');
    if (playHistory.length === 0) {
        songsContainer.innerHTML = `
            <div class="detail-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <p>No play history yet</p>
                <span>Songs you play will appear here</span>
            </div>
        `;
        return;
    }

    songsContainer.innerHTML = playHistory.map((item, index) => `
        <div class="detail-song" data-index="${index}" data-video-id="${item.videoId || ''}" data-title="${escapeHtml(item.title)}" data-artist="${escapeHtml(item.artist)}" data-artwork="${item.artwork || ''}">
            <span class="detail-song-num">${index + 1}</span>
            <div class="detail-song-artwork">
                ${item.artwork
                    ? `<img src="${item.artwork}" alt="${escapeHtml(item.title)}">`
                    : `<div class="detail-song-placeholder"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1"><circle cx="12" cy="12" r="10"></circle><polygon points="10 8 16 12 10 16 10 8" fill="currentColor"></polygon></svg></div>`}
            </div>
            <div class="detail-song-info">
                <span class="detail-song-title">${escapeHtml(item.title)}</span>
                <span class="detail-song-artist">${escapeHtml(item.artist)}</span>
            </div>
        </div>
    `).join('');

    // Add click handlers
    songsContainer.querySelectorAll('.detail-song').forEach(song => {
        song.addEventListener('click', () => {
            const videoId = song.dataset.videoId;
            if (videoId) {
                playRegionalSongDirect(song.dataset.title, song.dataset.artist, videoId, song.dataset.artwork);
            }
        });
    });
}

function playAllHistory() {
    if (playHistory.length === 0) return;

    // Clear queue and add all history
    queue.length = 0;
    playHistory.forEach(item => {
        queue.push({
            title: item.title,
            artist: item.artist,
            videoId: item.videoId,
            artwork: item.artwork
        });
    });

    // Play first song
    const first = queue.shift();
    if (first && first.videoId) {
        playRegionalSongDirect(first.title, first.artist, first.videoId, first.artwork);
    }

    updateQueueBadge();
    showToast(`Playing ${playHistory.length} songs`);
}

// ============================================================
// Queue Functions
// ============================================================

function addToQueue(song, playNext = false) {
    if (!song || !song.title) return;

    const queueItem = {
        title: song.title,
        artist: song.artist,
        videoId: song.youtube_video_id || song.videoId,
        artwork: song.artwork_url || song.artwork,
        id: Date.now()
    };

    if (playNext) {
        queue.unshift(queueItem);
        showToast(`"${song.title}" will play next`);
    } else {
        queue.push(queueItem);
        showToast(`Added "${song.title}" to queue`);
    }

    saveQueue();
    renderQueuePanel();
    updateQueueBadge();
}

function playFromQueue() {
    if (queue.length === 0) return null;

    const next = queue.shift();
    saveQueue();
    renderQueuePanel();
    updateQueueBadge();

    return next;
}

function clearQueue() {
    queue = [];
    saveQueue();
    renderQueuePanel();
    updateQueueBadge();
    showToast('Queue cleared');
}

function removeFromQueue(id) {
    queue = queue.filter(q => q.id !== id);
    saveQueue();
    renderQueuePanel();
    updateQueueBadge();
}

function updateQueueBadge() {
    const badge = document.getElementById('queueBadge');
    if (!badge) return;

    if (queue.length > 0) {
        badge.textContent = queue.length;
        badge.classList.add('visible');
    } else {
        badge.classList.remove('visible');
    }
}

function toggleQueue() {
    isQueueVisible = !isQueueVisible;
    const panel = document.getElementById('queuePanel');
    const btn = document.getElementById('queueToggleBtn');

    if (isQueueVisible) {
        panel?.classList.add('visible');
        btn?.classList.add('active');
        renderQueuePanel();
    } else {
        panel?.classList.remove('visible');
        btn?.classList.remove('active');
    }
}

function renderQueuePanel() {
    const content = document.getElementById('queueContent');
    const countEl = document.getElementById('queuePanelCount');
    if (!content) return;

    if (countEl) countEl.textContent = `${queue.length} song${queue.length !== 1 ? 's' : ''}`;

    if (queue.length === 0) {
        content.innerHTML = `
            <div class="queue-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <line x1="8" y1="6" x2="21" y2="6"></line>
                    <line x1="8" y1="12" x2="21" y2="12"></line>
                    <line x1="8" y1="18" x2="21" y2="18"></line>
                    <line x1="3" y1="6" x2="3.01" y2="6"></line>
                    <line x1="3" y1="12" x2="3.01" y2="12"></line>
                    <line x1="3" y1="18" x2="3.01" y2="18"></line>
                </svg>
                <p>Your queue is empty</p>
                <p class="queue-hint">Click the + on song cards to add them</p>
            </div>
        `;
        return;
    }

    content.innerHTML = `
        <div class="queue-list">
            ${queue.map((item, index) => `
                <div class="queue-item" data-id="${item.id}" data-video-id="${item.videoId || ''}" data-title="${escapeHtml(item.title)}" data-artist="${escapeHtml(item.artist)}" data-artwork="${item.artwork || ''}">
                    <span class="queue-item-number">${index + 1}</span>
                    <div class="queue-item-artwork">
                        ${item.artwork
                            ? `<img src="${item.artwork}" alt="" loading="lazy">`
                            : `<div class="queue-item-placeholder"></div>`}
                    </div>
                    <div class="queue-item-info">
                        <div class="queue-item-title">${escapeHtml(item.title)}</div>
                        <div class="queue-item-artist">${escapeHtml(item.artist)}</div>
                    </div>
                    <button class="queue-item-remove" title="Remove">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            `).join('')}
        </div>
    `;

    // Add click handlers
    content.querySelectorAll('.queue-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (e.target.closest('.queue-item-remove')) {
                removeFromQueue(parseInt(item.dataset.id));
                return;
            }
            // Play and remove from queue
            const videoId = item.dataset.videoId;
            if (videoId) {
                removeFromQueue(parseInt(item.dataset.id));
                playRegionalSongDirect(item.dataset.title, item.dataset.artist, videoId, item.dataset.artwork);
            }
        });
    });
}

// ============================================================
// Playlist Functions
// ============================================================

function generatePlaylistId() {
    return 'pl_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

function createPlaylist(name, description = '') {
    if (!name || !name.trim()) {
        showToast('Please enter a playlist name');
        return null;
    }

    const now = Date.now();
    const playlist = {
        id: generatePlaylistId(),
        name: name.trim(),
        description: description.trim(),
        songs: [],
        song_count: 0,
        cover_urls: [],
        is_public: false,
        is_owner: true,
        created_at: now,
        updated_at: now
    };

    playlists.unshift(playlist);
    savePlaylists();
    showToast(`Created "${playlist.name}"`);
    renderPlaylistPanel();
    return playlist;
}

async function deletePlaylist(playlistId) {
    const index = playlists.findIndex(p => p.id === playlistId);
    if (index === -1) return false;

    const playlist = playlists[index];

    // Delete from server first if authenticated
    if (typeof isAuthenticated !== 'undefined' && isAuthenticated) {
        try {
            const response = await fetchWithAuth(`/playlists/${playlistId}`, {
                method: 'DELETE'
            });
            if (!response.ok) {
                console.error('Failed to delete playlist from server:', response.status);
            }
        } catch (error) {
            console.error('Error deleting playlist from server:', error);
            if (error.message === 'Session expired, please login again') {
                showToast('Session expired. Please login again.');
            }
        }
    }

    // Remove from local state
    playlists.splice(index, 1);
    savePlaylists();
    showToast(`Deleted "${playlist.name}"`);
    renderPlaylistPanel();

    // Close detail view if this playlist was open
    if (currentPlaylistId === playlistId) {
        currentPlaylistId = null;
        hidePlaylistDetail();
    }
    return true;
}

function renamePlaylist(playlistId, newName) {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist || !newName || !newName.trim()) return false;

    playlist.name = newName.trim();
    playlist.updated_at = Date.now();
    savePlaylists();
    renderPlaylistPanel();
    return true;
}

function addToPlaylist(playlistId, song) {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist || !song) return false;

    // Check if song already in playlist
    const songId = `${song.title}-${song.artist}`.toLowerCase();
    const exists = playlist.songs.some(s =>
        `${s.title}-${s.artist}`.toLowerCase() === songId
    );

    if (exists) {
        showToast('Song already in playlist');
        return false;
    }

    playlist.songs.push({
        title: song.title,
        artist: song.artist,
        videoId: song.youtube_video_id || song.videoId,
        artwork: song.artwork_url || song.artwork,
        added_at: Date.now()
    });
    playlist.song_count = playlist.songs.length;
    playlist.cover_urls = playlist.songs.slice(0, 4).map(s => s.artwork).filter(Boolean);
    playlist.updated_at = Date.now();
    savePlaylists();
    showToast(`Added to "${playlist.name}"`);
    return true;
}

function removeFromPlaylist(playlistId, songIndex) {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist || songIndex < 0 || songIndex >= playlist.songs.length) return false;

    playlist.songs.splice(songIndex, 1);
    playlist.song_count = playlist.songs.length;
    playlist.cover_urls = playlist.songs.slice(0, 4).map(s => s.artwork).filter(Boolean);
    playlist.updated_at = Date.now();
    savePlaylists();
    renderPlaylistDetail(playlistId);
    return true;
}

function reorderPlaylistSongs(playlistId, fromIndex, toIndex) {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return false;

    const [song] = playlist.songs.splice(fromIndex, 1);
    playlist.songs.splice(toIndex, 0, song);
    playlist.updated_at = Date.now();
    savePlaylists();
    return true;
}

function playPlaylist(playlistId, startIndex = 0) {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist || !playlist.songs || !playlist.songs.length) {
        showToast('Playlist is empty');
        return;
    }

    // Track this playlist as recently played
    trackPlaylistPlayed(playlistId);

    // Load remaining songs into queue
    queue = playlist.songs.slice(startIndex + 1).map((s, i) => ({
        id: Date.now() + i,
        title: s.title,
        artist: s.artist,
        videoId: s.videoId,
        artwork: s.artwork
    }));
    saveQueue();
    renderQueuePanel();

    // Play first song
    const firstSong = playlist.songs[startIndex];
    playRegionalSongDirect(firstSong.title, firstSong.artist, firstSong.videoId, firstSong.artwork);
    showToast(`Playing "${playlist.name}"`);
}

function shufflePlaylist(playlistId) {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist || !playlist.songs.length) {
        showToast('Playlist is empty');
        return;
    }

    // Shuffle songs
    const shuffled = [...playlist.songs].sort(() => Math.random() - 0.5);

    // Load all but first into queue
    queue = shuffled.slice(1).map((s, i) => ({
        id: Date.now() + i,
        title: s.title,
        artist: s.artist,
        videoId: s.videoId,
        artwork: s.artwork
    }));
    saveQueue();
    renderQueuePanel();

    // Play first shuffled song
    const firstSong = shuffled[0];
    playRegionalSongDirect(firstSong.title, firstSong.artist, firstSong.videoId, firstSong.artwork);
    showToast(`Shuffling "${playlist.name}"`);
}

function updatePlaylistCount() {
    const countEl = document.getElementById('playlistPanelCount');
    if (countEl) {
        countEl.textContent = `${playlists.length} playlist${playlists.length !== 1 ? 's' : ''}`;
    }
    // Update sidebar badge if exists
    const badge = document.getElementById('playlistBadge');
    if (badge) {
        badge.textContent = playlists.length || '';
        badge.style.display = playlists.length ? 'inline' : 'none';
    }
}

// Show playlists view in main content
function showPlaylistsView() {
    isPlaylistPanelVisible = true;

    // Hide main content (charts, regional)
    const mainContent = document.getElementById('mainContent');
    const heroSection = document.getElementById('heroSection');
    const playlistsView = document.getElementById('playlistsView');
    const playlistDetailView = document.getElementById('playlistDetailView');

    if (mainContent) mainContent.style.display = 'none';
    if (heroSection) heroSection.style.display = 'none';
    if (playlistDetailView) playlistDetailView.style.display = 'none';
    if (playlistsView) playlistsView.style.display = 'block';

    // Update sidebar active state
    document.querySelectorAll('.sidebar-nav-item').forEach(btn => btn.classList.remove('active'));
    const playlistsBtn = document.getElementById('sidebarPlaylistsBtn');
    if (playlistsBtn) playlistsBtn.classList.add('active');

    // Restore sort dropdown value
    const sortSelect = document.getElementById('playlistsSortSelect');
    if (sortSelect) sortSelect.value = playlistSortOrder;

    renderPlaylistsView();
}

// Hide playlists view, return to charts
function hidePlaylistsView() {
    isPlaylistPanelVisible = false;
    currentPlaylistId = null;

    const mainContent = document.getElementById('mainContent');
    const heroSection = document.getElementById('heroSection');
    const playlistsView = document.getElementById('playlistsView');
    const playlistDetailView = document.getElementById('playlistDetailView');

    if (mainContent) mainContent.style.display = 'block';
    if (heroSection) heroSection.style.display = 'block';
    if (playlistsView) playlistsView.style.display = 'none';
    if (playlistDetailView) playlistDetailView.style.display = 'none';

    // Update sidebar active state back to current chart
    document.querySelectorAll('.sidebar-nav-item').forEach(btn => btn.classList.remove('active'));
    const chartBtn = document.querySelector(`[data-chart="${currentChart}"]`);
    if (chartBtn) chartBtn.classList.add('active');
}

// Legacy function name for compatibility
function togglePlaylistPanel() {
    if (isPlaylistPanelVisible) {
        hidePlaylistsView();
    } else {
        showPlaylistsView();
    }
}

// Playlist sorting preference
let playlistSortOrder = localStorage.getItem('playlistSortOrder') || 'recent';

// Recently played playlists (stored by ID with timestamp)
let recentlyPlayedPlaylists = JSON.parse(localStorage.getItem('recentlyPlayedPlaylists') || '[]');

function renderPlaylistsView() {
    const grid = document.getElementById('playlistsGrid');
    const countEl = document.getElementById('playlistsViewCount');
    const recentSection = document.getElementById('recentlyPlayedSection');
    const recentScroll = document.getElementById('recentlyPlayedScroll');
    const divider = document.getElementById('allPlaylistsDivider');

    if (countEl) {
        countEl.textContent = playlists.length;
    }

    if (!grid) return;

    // Hide recently played and divider if no playlists
    if (recentSection) recentSection.style.display = 'none';
    if (divider) divider.style.display = 'none';

    if (playlists.length === 0) {
        grid.innerHTML = `
            <div class="playlists-empty">
                <div class="playlists-empty-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 18V5l12-2v13"></path>
                        <circle cx="6" cy="18" r="3"></circle>
                        <circle cx="18" cy="16" r="3"></circle>
                    </svg>
                </div>
                <h3>Start Your Collection</h3>
                <p>Create playlists to organize your favorite songs and discover new music</p>
                <button class="btn-primary" onclick="showCreatePlaylistModal()">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Create Your First Playlist
                </button>
            </div>
        `;
        return;
    }

    // Render Recently Played section
    renderRecentlyPlayedPlaylists();

    // Sort playlists
    const sortedPlaylists = getSortedPlaylists();

    const cards = sortedPlaylists.map(playlist => {
        // Get artwork: custom artwork > grid of song artworks > placeholder
        let artworkHtml = '';
        let isMulti = false;

        if (playlist.artwork_url) {
            artworkHtml = `<img src="${playlist.artwork_url}" alt="${escapeHtml(playlist.name)}" crossorigin="anonymous">`;
        } else {
            const artworks = playlist.cover_urls?.length > 0
                ? playlist.cover_urls.map(url => ({ artwork: url }))
                : (playlist.songs || []).slice(0, 4);

            if (artworks.length === 0) {
                artworkHtml = `
                    <div class="playlist-grid-placeholder">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M9 18V5l12-2v13"></path>
                            <circle cx="6" cy="18" r="3"></circle>
                            <circle cx="18" cy="16" r="3"></circle>
                        </svg>
                    </div>
                `;
            } else if (artworks.length === 1) {
                artworkHtml = `<img src="${artworks[0].artwork}" alt="" crossorigin="anonymous">`;
            } else {
                artworkHtml = artworks.map(s => `<img src="${s.artwork}" alt="" crossorigin="anonymous">`).join('');
                isMulti = true;
            }
        }

        // Public/Private badge
        const isPublic = playlist.is_public;
        const badgeHtml = `
            <div class="playlist-grid-badge ${isPublic ? 'public' : 'private'}">
                ${isPublic ? `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                    </svg>
                    Public
                ` : `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                    </svg>
                    Private
                `}
            </div>
        `;

        const songCount = playlist.song_count ?? playlist.songs?.length ?? 0;

        return `
            <div class="playlist-grid-card" data-id="${playlist.id}" onclick="showPlaylistDetail('${playlist.id}')">
                <div class="playlist-grid-artwork ${isMulti ? 'multi' : ''}">
                    ${artworkHtml}
                </div>
                <div class="playlist-grid-info">
                    <div class="playlist-grid-name">${escapeHtml(playlist.name)}</div>
                    <div class="playlist-grid-meta">${songCount} song${songCount !== 1 ? 's' : ''}</div>
                    ${badgeHtml}
                </div>
                <button class="playlist-grid-play" onclick="event.stopPropagation(); playPlaylist('${playlist.id}')" title="Play">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                </button>
            </div>
        `;
    }).join('');

    grid.innerHTML = cards;

    // Extract colors from artwork and apply gradients
    applyArtworkGradients();
}

// Vibrant color palette for fallback gradients
const gradientColorPalette = [
    { r: 239, g: 68, b: 68 },    // Red
    { r: 249, g: 115, b: 22 },   // Orange
    { r: 245, g: 158, b: 11 },   // Amber
    { r: 34, g: 197, b: 94 },    // Green
    { r: 20, g: 184, b: 166 },   // Teal
    { r: 59, g: 130, b: 246 },   // Blue
    { r: 99, g: 102, b: 241 },   // Indigo
    { r: 139, g: 92, b: 246 },   // Purple
    { r: 236, g: 72, b: 153 },   // Pink
    { r: 244, g: 63, b: 94 },    // Rose
];

// Apply color gradients to playlist cards
function applyArtworkGradients() {
    const cards = document.querySelectorAll('.playlist-grid-card');

    cards.forEach(card => {
        const info = card.querySelector('.playlist-grid-info');
        const img = card.querySelector('.playlist-grid-artwork img');
        const playlistId = card.dataset.id;

        if (!info || !playlistId) return;

        // Try to extract color from image
        if (img) {
            if (img.complete && img.naturalWidth > 0) {
                extractColorFromImage(img, info, playlistId);
            } else {
                img.addEventListener('load', () => {
                    extractColorFromImage(img, info, playlistId);
                }, { once: true });

                // Fallback if image fails to load
                img.addEventListener('error', () => {
                    applyFallbackGradient(info, playlistId);
                }, { once: true });
            }
        } else {
            // No image, use fallback
            applyFallbackGradient(info, playlistId);
        }
    });
}

// Extract color from image and apply gradient
function extractColorFromImage(img, infoElement, playlistId) {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        canvas.width = 50;
        canvas.height = 50;

        ctx.drawImage(img, 0, 0, 50, 50);

        // Sample from bottom portion of image
        const imageData = ctx.getImageData(0, 30, 50, 20);
        const data = imageData.data;

        let r = 0, g = 0, b = 0, count = 0;

        for (let i = 0; i < data.length; i += 16) { // Sample every 4th pixel for speed
            const pr = data[i];
            const pg = data[i + 1];
            const pb = data[i + 2];

            const brightness = (pr + pg + pb) / 3;
            if (brightness > 25 && brightness < 230) {
                r += pr;
                g += pg;
                b += pb;
                count++;
            }
        }

        if (count > 0) {
            r = Math.round(r / count);
            g = Math.round(g / count);
            b = Math.round(b / count);

            // Boost saturation slightly for more vibrant colors
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const satBoost = 1.2;

            if (max !== min) {
                r = Math.min(255, Math.round(r + (r - (r + g + b) / 3) * (satBoost - 1)));
                g = Math.min(255, Math.round(g + (g - (r + g + b) / 3) * (satBoost - 1)));
                b = Math.min(255, Math.round(b + (b - (r + g + b) / 3) * (satBoost - 1)));
            }

            applyGradientColor(infoElement, r, g, b);
        } else {
            applyFallbackGradient(infoElement, playlistId);
        }
    } catch (e) {
        // CORS error - use fallback
        applyFallbackGradient(infoElement, playlistId);
    }
}

// Apply gradient with given color
function applyGradientColor(infoElement, r, g, b) {
    infoElement.style.background = `linear-gradient(
        135deg,
        rgba(${r}, ${g}, ${b}, 0.25) 0%,
        rgba(${r}, ${g}, ${b}, 0.1) 50%,
        rgba(20, 20, 24, 0.95) 100%
    )`;
}

// Apply fallback gradient based on playlist ID hash
function applyFallbackGradient(infoElement, playlistId) {
    const hash = playlistId.split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);

    const colorIndex = Math.abs(hash) % gradientColorPalette.length;
    const color = gradientColorPalette[colorIndex];

    applyGradientColor(infoElement, color.r, color.g, color.b);
}

// Sort playlists based on current sort order
function getSortedPlaylists() {
    const sorted = [...playlists];

    switch (playlistSortOrder) {
        case 'name':
            sorted.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'name-desc':
            sorted.sort((a, b) => b.name.localeCompare(a.name));
            break;
        case 'songs':
            sorted.sort((a, b) => {
                const countA = a.song_count ?? a.songs?.length ?? 0;
                const countB = b.song_count ?? b.songs?.length ?? 0;
                return countB - countA;
            });
            break;
        case 'created':
            sorted.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
            break;
        case 'recent':
        default:
            sorted.sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
            break;
    }

    return sorted;
}

// Sort playlists handler
function sortPlaylists(order) {
    playlistSortOrder = order;
    localStorage.setItem('playlistSortOrder', order);
    renderPlaylistsView();
}

// Render recently played playlists
function renderRecentlyPlayedPlaylists() {
    const recentSection = document.getElementById('recentlyPlayedSection');
    const recentScroll = document.getElementById('recentlyPlayedScroll');
    const divider = document.getElementById('allPlaylistsDivider');

    if (!recentSection || !recentScroll) return;

    // Get recently played playlists that still exist
    const recentPlaylists = recentlyPlayedPlaylists
        .map(r => playlists.find(p => p.id === r.id))
        .filter(Boolean)
        .slice(0, 6);

    if (recentPlaylists.length === 0) {
        recentSection.style.display = 'none';
        if (divider) divider.style.display = 'none';
        return;
    }

    recentSection.style.display = 'block';
    if (divider) divider.style.display = 'flex';

    const cards = recentPlaylists.map(playlist => {
        const artwork = playlist.artwork_url
            || playlist.cover_urls?.[0]
            || playlist.songs?.[0]?.artwork
            || '';

        return `
            <div class="recently-played-card" onclick="showPlaylistDetail('${playlist.id}')">
                <div class="recently-played-artwork">
                    ${artwork
                        ? `<img src="${artwork}" alt="${escapeHtml(playlist.name)}">`
                        : `<div class="playlist-grid-placeholder">
                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M9 18V5l12-2v13"></path>
                                <circle cx="6" cy="18" r="3"></circle>
                                <circle cx="18" cy="16" r="3"></circle>
                            </svg>
                        </div>`
                    }
                </div>
                <div class="recently-played-info">
                    <div class="recently-played-name">${escapeHtml(playlist.name)}</div>
                    <div class="recently-played-meta">${playlist.song_count ?? playlist.songs?.length ?? 0} songs</div>
                </div>
            </div>
        `;
    }).join('');

    recentScroll.innerHTML = cards;
}

// Track when a playlist is played
function trackPlaylistPlayed(playlistId) {
    // Remove existing entry for this playlist
    recentlyPlayedPlaylists = recentlyPlayedPlaylists.filter(r => r.id !== playlistId);

    // Add to beginning
    recentlyPlayedPlaylists.unshift({ id: playlistId, playedAt: Date.now() });

    // Keep only last 10
    recentlyPlayedPlaylists = recentlyPlayedPlaylists.slice(0, 10);

    // Save to localStorage
    localStorage.setItem('recentlyPlayedPlaylists', JSON.stringify(recentlyPlayedPlaylists));
}

// Toggle playlist actions menu
function togglePlaylistActionsMenu(playlistId) {
    const menu = document.getElementById(`playlistActionsMenu-${playlistId}`);
    if (!menu) return;

    const isVisible = menu.classList.contains('visible');

    // Close all other menus first
    closeAllActionMenus();

    if (!isVisible) {
        menu.classList.add('visible');
        // Close menu when clicking outside
        setTimeout(() => {
            document.addEventListener('click', closeAllActionMenus, { once: true });
        }, 0);
    }
}

// Close all action menus
function closeAllActionMenus() {
    document.querySelectorAll('.playlist-actions-menu.visible').forEach(menu => {
        menu.classList.remove('visible');
    });
}

// Edit playlist name
function editPlaylistName(playlistId) {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    const newName = prompt('Enter new playlist name:', playlist.name);
    if (newName && newName.trim() && newName.trim() !== playlist.name) {
        playlist.name = newName.trim();
        playlist.updated_at = Date.now();
        savePlaylists();
        renderPlaylistsView();
        showToast('Playlist renamed');
    }
}

// Confirm delete playlist
function confirmDeletePlaylist(playlistId) {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    if (confirm(`Delete "${playlist.name}"? This cannot be undone.`)) {
        deletePlaylist(playlistId);
    }
}

// Keep old function name for backward compatibility
function renderPlaylistPanel() {
    renderPlaylistsView();
}

function showCreatePlaylistModal() {
    const modal = document.getElementById('createPlaylistModal');
    if (modal) {
        modal.classList.add('visible');
        const input = modal.querySelector('#newPlaylistName');
        if (input) {
            input.value = '';
            input.focus();
        }
    }
}

function hideCreatePlaylistModal() {
    const modal = document.getElementById('createPlaylistModal');
    if (modal) {
        modal.classList.remove('visible');
    }
}

function handleCreatePlaylist() {
    const input = document.getElementById('newPlaylistName');
    const name = input?.value?.trim();
    if (name) {
        createPlaylist(name);
        hideCreatePlaylistModal();
    }
}

function showAddToPlaylistModal(song) {
    const modal = document.getElementById('addToPlaylistModal');
    if (!modal) return;

    modal.dataset.song = JSON.stringify(song);
    modal.classList.add('visible');

    const list = document.getElementById('playlistSelectList');
    if (list) {
        if (playlists.length === 0) {
            list.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No playlists yet. Create one below!</p>';
        } else {
            list.innerHTML = playlists.map(p => {
                const artworkUrl = p.cover_urls?.[0] || p.songs?.[0]?.artwork;
                const songCount = p.song_count ?? p.songs?.length ?? 0;
                return `
                <div class="playlist-select-item" onclick="addSongToSelectedPlaylist('${p.id}')">
                    <div class="playlist-select-artwork">
                        ${artworkUrl
                            ? `<img src="${artworkUrl}" alt="">`
                            : `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin:auto;display:block;color:var(--text-muted);">
                                <path d="M9 18V5l12-2v13"></path>
                                <circle cx="6" cy="18" r="3"></circle>
                                <circle cx="18" cy="16" r="3"></circle>
                            </svg>`
                        }
                    </div>
                    <div class="playlist-select-info">
                        <div class="playlist-select-name">${escapeHtml(p.name)}</div>
                        <div class="playlist-select-count">${songCount} song${songCount !== 1 ? 's' : ''}</div>
                    </div>
                </div>
            `}).join('');
        }
    }
}

function hideAddToPlaylistModal() {
    const modal = document.getElementById('addToPlaylistModal');
    if (modal) {
        modal.classList.remove('visible');
        delete modal.dataset.song;
    }
}

function addSongToSelectedPlaylist(playlistId) {
    const modal = document.getElementById('addToPlaylistModal');
    if (!modal?.dataset.song) return;

    try {
        const song = JSON.parse(modal.dataset.song);
        addToPlaylist(playlistId, song);
        hideAddToPlaylistModal();
    } catch (e) {
        console.error('Error adding song to playlist:', e);
    }
}

function showPlaylistDetail(playlistId) {
    currentPlaylistId = playlistId;
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    // Hide playlists grid, show detail view
    const playlistsView = document.getElementById('playlistsView');
    const detailView = document.getElementById('playlistDetailView');

    if (playlistsView) playlistsView.style.display = 'none';
    if (detailView) detailView.style.display = 'block';

    renderPlaylistDetail(playlistId);
}

function hidePlaylistDetail() {
    currentPlaylistId = null;

    // Show playlists grid, hide detail view
    const playlistsView = document.getElementById('playlistsView');
    const detailView = document.getElementById('playlistDetailView');

    if (detailView) detailView.style.display = 'none';
    if (playlistsView) playlistsView.style.display = 'block';

    renderPlaylistsView();
}

function renderPlaylistDetail(playlistId) {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    const content = document.getElementById('playlistDetailSongs');
    if (!content) return;

    const header = document.getElementById('playlistDetailHeader');
    if (header) {
        // Get cover image (custom artwork > grid of song artworks > placeholder)
        let coverArt;
        let coverArtUrl = null;
        let isMulti = false;

        if (playlist.artwork_url) {
            coverArtUrl = playlist.artwork_url;
            coverArt = `<img src="${playlist.artwork_url}" alt="${escapeHtml(playlist.name)}" crossorigin="anonymous" id="detailCoverImg">`;
        } else {
            // Use cover_urls or first 4 songs' artworks for collage
            const artworks = playlist.cover_urls?.length > 0
                ? playlist.cover_urls.map(url => ({ artwork: url }))
                : (playlist.songs || []).slice(0, 4).filter(s => s.artwork);

            if (artworks.length === 0) {
                coverArt = null; // Will use placeholder below
            } else if (artworks.length === 1) {
                coverArtUrl = artworks[0].artwork;
                coverArt = `<img src="${artworks[0].artwork}" alt="${escapeHtml(playlist.name)}" crossorigin="anonymous" id="detailCoverImg">`;
            } else {
                // Multiple artworks - create collage
                coverArtUrl = artworks[0].artwork; // Use first for gradient
                coverArt = artworks.map(s => `<img src="${s.artwork}" alt="" crossorigin="anonymous">`).join('');
                isMulti = true;
            }
        }

        if (!coverArt) {
            coverArt = `<div class="detail-cover-placeholder">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 18V5l12-2v13"></path>
                    <circle cx="6" cy="18" r="3"></circle>
                    <circle cx="18" cy="16" r="3"></circle>
                </svg>
            </div>`;
        }

        header.innerHTML = `
            <button class="detail-back-btn" onclick="hidePlaylistDetail()" title="Back to Playlists">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
            </button>
            <div class="detail-hero">
                <div class="detail-cover ${isMulti ? 'multi' : ''}" onclick="showArtworkModal('${playlist.id}')" title="Click to change artwork">
                    ${coverArt}
                    <div class="detail-cover-edit-overlay">
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                        <span>Edit</span>
                    </div>
                </div>
                <div class="detail-info">
                    <span class="detail-type">Playlist</span>
                    <h1 class="detail-name">${escapeHtml(playlist.name)}</h1>
                    <div class="detail-meta-row">
                        <span class="detail-meta">${playlist.songs.length} song${playlist.songs.length !== 1 ? 's' : ''}</span>
                        <button class="visibility-toggle ${playlist.is_public ? 'public' : 'private'}" onclick="togglePlaylistVisibility('${playlist.id}')" title="${playlist.is_public ? 'Public - Anyone with the link can view' : 'Private - Only you can view'}">
                            ${playlist.is_public ? `
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="12" cy="12" r="10"/>
                                    <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
                                </svg>
                                Public
                            ` : `
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                                </svg>
                                Private
                            `}
                        </button>
                    </div>
                    <div class="detail-buttons">
                        <button class="btn-primary" onclick="playPlaylist('${playlist.id}')" ${playlist.songs.length === 0 ? 'disabled' : ''}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                            Play
                        </button>
                        <button class="btn-secondary" onclick="shufflePlaylist('${playlist.id}')" ${playlist.songs.length === 0 ? 'disabled' : ''}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="16 3 21 3 21 8"></polyline>
                                <line x1="4" y1="20" x2="21" y2="3"></line>
                                <polyline points="21 16 21 21 16 21"></polyline>
                                <line x1="15" y1="15" x2="21" y2="21"></line>
                                <line x1="4" y1="4" x2="9" y2="9"></line>
                            </svg>
                            Shuffle
                        </button>
                        <button class="btn-secondary" onclick="sharePlaylist('${playlist.id}')">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="18" cy="5" r="3"></circle>
                                <circle cx="6" cy="12" r="3"></circle>
                                <circle cx="18" cy="19" r="3"></circle>
                                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                            </svg>
                            Share
                        </button>
                        <button class="btn-secondary" onclick="showExportModal('${playlist.id}')">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="17 8 12 3 7 8"></polyline>
                                <line x1="12" y1="3" x2="12" y2="15"></line>
                            </svg>
                            Export
                        </button>
                        <button class="btn-danger" onclick="confirmDeletePlaylist('${playlist.id}')">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polyline points="3 6 5 6 21 6"></polyline>
                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            </svg>
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    if (playlist.songs.length === 0) {
        content.innerHTML = `
            <div class="detail-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 18V5l12-2v13"></path>
                    <circle cx="6" cy="18" r="3"></circle>
                    <circle cx="18" cy="16" r="3"></circle>
                </svg>
                <h3>This playlist is empty</h3>
                <p>Add songs from the chart using the + button on song cards</p>
                <button class="btn-secondary" onclick="hidePlaylistsView()">Browse Charts</button>
            </div>
        `;
        // Apply gradient even for empty playlist
        applyDetailViewGradient(playlistId);
        return;
    }

    content.innerHTML = `
        <div class="detail-song-list">
            ${playlist.songs.map((song, index) => `
                <div class="detail-song" onclick="playPlaylist('${playlist.id}', ${index})">
                    <span class="detail-song-num">${index + 1}</span>
                    <div class="detail-song-artwork">
                        ${song.artwork
                            ? `<img src="${song.artwork}" alt="${escapeHtml(song.title)}">`
                            : '<div class="placeholder"></div>'
                        }
                        <div class="detail-song-play-overlay">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                        </div>
                    </div>
                    <div class="detail-song-info">
                        <div class="detail-song-title">${escapeHtml(song.title)}</div>
                        <div class="detail-song-artist">${escapeHtml(song.artist)}</div>
                    </div>
                    <button class="detail-song-remove" onclick="event.stopPropagation(); removeFromPlaylist('${playlist.id}', ${index})" title="Remove from playlist">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>
            `).join('')}
        </div>
    `;

    // Apply gradient based on cover art
    applyDetailViewGradient(playlistId);
}

// Apply gradient to playlist detail view based on cover artwork
function applyDetailViewGradient(playlistId) {
    const detailView = document.getElementById('playlistDetailView');
    const coverImg = document.getElementById('detailCoverImg');

    if (!detailView) return;

    if (coverImg) {
        if (coverImg.complete && coverImg.naturalWidth > 0) {
            extractDetailViewColor(coverImg, detailView, playlistId);
        } else {
            coverImg.addEventListener('load', () => {
                extractDetailViewColor(coverImg, detailView, playlistId);
            }, { once: true });

            coverImg.addEventListener('error', () => {
                applyFallbackDetailGradient(detailView, playlistId);
            }, { once: true });
        }
    } else {
        applyFallbackDetailGradient(detailView, playlistId);
    }
}

// Extract color from cover image and apply to detail view
function extractDetailViewColor(img, detailView, playlistId) {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        canvas.width = 50;
        canvas.height = 50;

        ctx.drawImage(img, 0, 0, 50, 50);

        const imageData = ctx.getImageData(0, 0, 50, 50);
        const data = imageData.data;

        let r = 0, g = 0, b = 0, count = 0;

        for (let i = 0; i < data.length; i += 16) {
            const pr = data[i];
            const pg = data[i + 1];
            const pb = data[i + 2];

            const brightness = (pr + pg + pb) / 3;
            if (brightness > 25 && brightness < 230) {
                r += pr;
                g += pg;
                b += pb;
                count++;
            }
        }

        if (count > 0) {
            r = Math.round(r / count);
            g = Math.round(g / count);
            b = Math.round(b / count);

            // Boost saturation
            const avg = (r + g + b) / 3;
            const satBoost = 1.3;
            r = Math.min(255, Math.round(avg + (r - avg) * satBoost));
            g = Math.min(255, Math.round(avg + (g - avg) * satBoost));
            b = Math.min(255, Math.round(avg + (b - avg) * satBoost));

            applyDetailGradientColor(detailView, r, g, b);
        } else {
            applyFallbackDetailGradient(detailView, playlistId);
        }
    } catch (e) {
        applyFallbackDetailGradient(detailView, playlistId);
    }
}

// Apply gradient color to detail view
function applyDetailGradientColor(detailView, r, g, b) {
    detailView.style.background = `
        radial-gradient(ellipse at top left, rgba(${r}, ${g}, ${b}, 0.25) 0%, transparent 50%),
        radial-gradient(ellipse at bottom right, rgba(${r}, ${g}, ${b}, 0.15) 0%, transparent 50%),
        linear-gradient(180deg, rgba(30, 30, 35, 0.9) 0%, rgba(18, 18, 22, 0.95) 100%)
    `;
}

// Apply fallback gradient to detail view
function applyFallbackDetailGradient(detailView, playlistId) {
    const hash = playlistId.split('').reduce((acc, char) => {
        return char.charCodeAt(0) + ((acc << 5) - acc);
    }, 0);

    const colorIndex = Math.abs(hash) % gradientColorPalette.length;
    const color = gradientColorPalette[colorIndex];

    applyDetailGradientColor(detailView, color.r, color.g, color.b);
}

function showPlaylistMenu(playlistId, event) {
    event.preventDefault();
    event.stopPropagation();

    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    currentContextPlaylistId = playlistId;
    const menu = document.getElementById('playlistContextMenu');

    // Position near the button
    const rect = event.target.closest('button').getBoundingClientRect();
    menu.style.top = `${rect.bottom + 5}px`;
    menu.style.left = `${Math.min(rect.left, window.innerWidth - 200)}px`;
    menu.classList.add('visible');

    // Close when clicking outside
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.classList.remove('visible');
            currentContextPlaylistId = null;
            document.removeEventListener('click', closeMenu);
        }
    };

    setTimeout(() => {
        document.addEventListener('click', closeMenu);
    }, 0);
}

function hidePlaylistContextMenu() {
    const menu = document.getElementById('playlistContextMenu');
    if (menu) menu.classList.remove('visible');
}

function promptRenamePlaylist(playlistId) {
    hidePlaylistContextMenu();
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    const newName = prompt('Enter new playlist name:', playlist.name);
    if (newName && newName.trim() && newName.trim() !== playlist.name) {
        renamePlaylist(playlistId, newName);
    }
}

function confirmDeletePlaylist(playlistId) {
    hidePlaylistContextMenu();
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    if (confirm(`Delete "${playlist.name}"? This cannot be undone.`)) {
        deletePlaylist(playlistId);
    }
}

async function togglePlaylistVisibility(playlistId) {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    const newVisibility = !playlist.is_public;

    try {
        const response = await fetchWithAuth(`/playlists/${playlistId}/publish`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ is_public: newVisibility })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            console.error('Visibility toggle error:', response.status, errorData);
            throw new Error(errorData.detail || 'Failed to update visibility');
        }

        // Update local state
        playlist.is_public = newVisibility;

        // Re-render the playlist detail
        renderPlaylistDetail(playlistId);

        showToast(newVisibility ? 'Playlist is now public' : 'Playlist is now private');
    } catch (error) {
        console.error('Error toggling visibility:', error);
        if (error.message === 'Session expired, please login again') {
            showToast('Session expired. Please login again.');
        } else {
            showToast(error.message || 'Failed to update visibility');
        }
    }
}

async function sharePlaylist(playlistId) {
    hidePlaylistContextMenu();
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    // Check if playlist is public before allowing share
    if (!playlist.is_public) {
        showToast('Make this playlist public to share it');
        // Show playlist detail so user can toggle visibility
        showPlaylistDetail(playlistId);
        return;
    }

    showShareModal(playlist);
}

// ============================================================
// Share Modal Functions
// ============================================================

let currentSharePlaylist = null;

function showShareModal(playlist) {
    currentSharePlaylist = playlist;
    const shareUrl = `${window.location.origin}/share/playlist/${playlist.id}`;

    document.getElementById('sharePlaylistName').textContent = playlist.name;
    document.getElementById('shareUrlInput').value = shareUrl;

    // Update visibility badge
    const badge = document.getElementById('shareVisibilityBadge');
    if (badge) {
        if (playlist.is_public) {
            badge.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> Public';
            badge.className = 'share-visibility-badge public';
        } else {
            badge.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Private';
            badge.className = 'share-visibility-badge private';
        }
    }

    document.getElementById('sharePlaylistModal').classList.add('visible');
}

function hideShareModal() {
    document.getElementById('sharePlaylistModal').classList.remove('visible');
    currentSharePlaylist = null;
}

function copyShareUrl() {
    const input = document.getElementById('shareUrlInput');
    navigator.clipboard.writeText(input.value).then(() => {
        showToast('Link copied to clipboard');
    }).catch(() => {
        // Fallback for older browsers
        input.select();
        document.execCommand('copy');
        showToast('Link copied to clipboard');
    });
}

function shareToTwitter() {
    if (!currentSharePlaylist) return;
    const shareUrl = document.getElementById('shareUrlInput').value;
    const text = `Check out "${currentSharePlaylist.name}" on TLDR Music!`;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
}

function shareToFacebook() {
    const shareUrl = document.getElementById('shareUrlInput').value;
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(facebookUrl, '_blank', 'width=550,height=420');
}

function shareToWhatsApp() {
    if (!currentSharePlaylist) return;
    const shareUrl = document.getElementById('shareUrlInput').value;
    const text = `Check out "${currentSharePlaylist.name}" on TLDR Music!\n${shareUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(whatsappUrl, '_blank');
}

function shareToInstagram() {
    copyShareUrl();
    showToast('Link copied! Paste it in your Instagram story or bio.');
}

async function shareNative() {
    if (!currentSharePlaylist) return;
    const shareUrl = document.getElementById('shareUrlInput').value;

    if (navigator.share) {
        try {
            await navigator.share({
                title: currentSharePlaylist.name,
                text: `Check out "${currentSharePlaylist.name}" on TLDR Music!`,
                url: shareUrl
            });
        } catch (e) {
            if (e.name !== 'AbortError') {
                copyShareUrl();
            }
        }
    } else {
        copyShareUrl();
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast('Copied to clipboard');
    }).catch(() => {
        showToast('Failed to copy');
    });
}

function showExportModal(playlistId) {
    document.querySelectorAll('.playlist-context-menu').forEach(m => m.remove());
    const modal = document.getElementById('exportPlaylistModal');
    if (modal) {
        modal.dataset.playlistId = playlistId;
        modal.classList.add('visible');
    }
}

function hideExportModal() {
    const modal = document.getElementById('exportPlaylistModal');
    if (modal) {
        modal.classList.remove('visible');
        delete modal.dataset.playlistId;
    }
}

// ============================================================
// Artwork Customization
// ============================================================

let pendingArtwork = null;

function showArtworkModal(playlistId) {
    const playlist = playlists.find(p => p.id === playlistId);
    if (!playlist) return;

    const modal = document.getElementById('artworkModal');
    if (!modal) return;

    modal.dataset.playlistId = playlistId;
    pendingArtwork = playlist.artwork_url || null;

    // Update preview
    updateArtworkPreview(pendingArtwork || (playlist.songs.length > 0 ? playlist.songs[0].artwork : null));

    // Populate song artworks
    const grid = document.getElementById('artworkSongsGrid');
    const songsSection = document.getElementById('artworkFromSongs');

    if (playlist.songs.length > 0) {
        songsSection.style.display = 'block';
        const uniqueArtworks = [...new Set(playlist.songs.map(s => s.artwork).filter(Boolean))];
        grid.innerHTML = uniqueArtworks.slice(0, 8).map(artwork => `
            <button class="artwork-song-option ${pendingArtwork === artwork ? 'selected' : ''}" onclick="selectSongArtwork('${artwork}')">
                <img src="${artwork}" alt="Song artwork">
            </button>
        `).join('');
    } else {
        songsSection.style.display = 'none';
    }

    modal.classList.add('visible');
}

function hideArtworkModal() {
    const modal = document.getElementById('artworkModal');
    if (modal) {
        modal.classList.remove('visible');
        delete modal.dataset.playlistId;
        pendingArtwork = null;
    }
}

function updateArtworkPreview(artworkUrl) {
    const preview = document.getElementById('artworkPreview');
    if (!preview) return;

    if (artworkUrl) {
        preview.innerHTML = `<img src="${artworkUrl}" alt="Playlist artwork">`;
    } else {
        preview.innerHTML = `
            <div class="artwork-preview-placeholder">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 18V5l12-2v13"></path>
                    <circle cx="6" cy="18" r="3"></circle>
                    <circle cx="18" cy="16" r="3"></circle>
                </svg>
            </div>
        `;
    }
}

function handleArtworkUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
        showToast('Please select an image file', 'error');
        return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        showToast('Image must be less than 5MB', 'error');
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        pendingArtwork = e.target.result;
        updateArtworkPreview(pendingArtwork);

        // Deselect song options
        document.querySelectorAll('.artwork-song-option').forEach(btn => btn.classList.remove('selected'));
    };
    reader.readAsDataURL(file);
}

function selectSongArtwork(artworkUrl) {
    pendingArtwork = artworkUrl;
    updateArtworkPreview(pendingArtwork);

    // Update selection state
    document.querySelectorAll('.artwork-song-option').forEach(btn => {
        btn.classList.toggle('selected', btn.querySelector('img')?.src === artworkUrl);
    });
}

function removeCustomArtwork() {
    const modal = document.getElementById('artworkModal');
    const playlistId = modal?.dataset.playlistId;
    const playlist = playlists.find(p => p.id === playlistId);

    pendingArtwork = null;
    updateArtworkPreview(playlist?.songs.length > 0 ? playlist.songs[0].artwork : null);

    // Deselect song options
    document.querySelectorAll('.artwork-song-option').forEach(btn => btn.classList.remove('selected'));
}

function savePlaylistArtwork() {
    const modal = document.getElementById('artworkModal');
    const playlistId = modal?.dataset.playlistId;
    const playlist = playlists.find(p => p.id === playlistId);

    if (!playlist) return;

    if (pendingArtwork) {
        playlist.artwork_url = pendingArtwork;
        playlist.custom_artwork = true;
    } else {
        delete playlist.artwork_url;
        playlist.custom_artwork = false;
    }

    savePlaylists();
    hideArtworkModal();

    // Refresh views
    if (currentPlaylistId === playlistId) {
        renderPlaylistDetail(playlistId);
    }
    renderPlaylistsView();

    showToast('Artwork updated!', 'success');
}

// ============================================================
// Export Functions
// ============================================================

function getExportPlaylistId() {
    const modal = document.getElementById('exportPlaylistModal');
    return modal?.dataset.playlistId || currentPlaylistId;
}

async function exportToSpotify() {
    hideExportModal();
    const playlistId = getExportPlaylistId();
    const playlist = playlists.find(p => p.id === playlistId);

    if (!playlist || playlist.songs.length === 0) {
        showToast('Playlist is empty');
        return;
    }

    showToast('Opening Spotify...');

    // Generate a Spotify search URL for the playlist
    // This creates a shareable text that users can use to recreate the playlist
    const songList = playlist.songs.map(s => `${s.title} ${s.artist}`).join('\n');

    // Copy songs to clipboard for easy addition
    try {
        await navigator.clipboard.writeText(songList);
        showToast('Song list copied! Paste into Spotify search');
    } catch (e) {
        // Fallback
    }

    // Open Spotify with search for the first song
    const firstSong = playlist.songs[0];
    const searchQuery = encodeURIComponent(`${firstSong.title} ${firstSong.artist}`);
    window.open(`https://open.spotify.com/search/${searchQuery}`, '_blank');
}

async function exportToYouTube() {
    hideExportModal();
    const playlistId = getExportPlaylistId();
    const playlist = playlists.find(p => p.id === playlistId);

    if (!playlist || playlist.songs.length === 0) {
        showToast('Playlist is empty');
        return;
    }

    showToast('Opening YouTube Music...');

    // Copy songs to clipboard
    const songList = playlist.songs.map(s => `${s.title} - ${s.artist}`).join('\n');

    try {
        await navigator.clipboard.writeText(songList);
        showToast('Song list copied! Add to YouTube Music');
    } catch (e) {
        // Fallback
    }

    // If we have video IDs, open a YouTube Mix based on first song
    const firstSong = playlist.songs[0];
    if (firstSong.videoId) {
        window.open(`https://music.youtube.com/watch?v=${firstSong.videoId}&list=RD${firstSong.videoId}`, '_blank');
    } else {
        const searchQuery = encodeURIComponent(`${firstSong.title} ${firstSong.artist}`);
        window.open(`https://music.youtube.com/search?q=${searchQuery}`, '_blank');
    }
}

async function exportToAppleMusic() {
    hideExportModal();
    const playlistId = getExportPlaylistId();
    const playlist = playlists.find(p => p.id === playlistId);

    if (!playlist || playlist.songs.length === 0) {
        showToast('Playlist is empty');
        return;
    }

    showToast('Opening Apple Music...');

    // Copy songs to clipboard
    const songList = playlist.songs.map(s => `${s.title} - ${s.artist}`).join('\n');

    try {
        await navigator.clipboard.writeText(songList);
        showToast('Song list copied! Add to Apple Music');
    } catch (e) {
        // Fallback
    }

    // Open Apple Music with search for first song
    const firstSong = playlist.songs[0];
    const searchQuery = encodeURIComponent(`${firstSong.title} ${firstSong.artist}`);
    window.open(`https://music.apple.com/search?term=${searchQuery}`, '_blank');
}

// ============================================================
// Shuffle & Repeat Functions
// ============================================================

function toggleShuffle() {
    isShuffleOn = !isShuffleOn;
    savePlaybackSettings();

    document.getElementById('shuffleBtn')?.classList.toggle('active', isShuffleOn);
    showToast(isShuffleOn ? 'Shuffle on' : 'Shuffle off');
}

function cycleRepeat() {
    const modes = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode);
    repeatMode = modes[(currentIndex + 1) % modes.length];
    savePlaybackSettings();

    updateRepeatButton();

    const messages = {
        'off': 'Repeat off',
        'all': 'Repeat all',
        'one': 'Repeat one'
    };
    showToast(messages[repeatMode]);
}

function updateRepeatButton() {
    const btn = document.getElementById('repeatBtn');
    if (!btn) return;

    btn.classList.remove('repeat-one', 'repeat-all');
    if (repeatMode === 'one') {
        btn.classList.add('active', 'repeat-one');
    } else if (repeatMode === 'all') {
        btn.classList.add('active', 'repeat-all');
    } else {
        btn.classList.remove('active');
    }
}

// Initialize UI state from loaded settings
function initializePlaybackUI() {
    document.getElementById('shuffleBtn')?.classList.toggle('active', isShuffleOn);
    updateRepeatButton();
    updateQueueBadge();
    renderFavoritesSection();
    renderHistorySection();
}

// ============================================================
// Sidebar Functions
// ============================================================

function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarToggle = document.getElementById('sidebarToggle');
    const headerMenuBtn = document.getElementById('headerMenuBtn');
    const sidebarIndiaBtn = document.getElementById('sidebarIndiaBtn');
    const sidebarGlobalBtn = document.getElementById('sidebarGlobalBtn');
    const sidebarProfileBtn = document.getElementById('sidebarProfileBtn');

    if (!sidebar) return;

    // Close button inside sidebar
    sidebarToggle?.addEventListener('click', () => {
        sidebar.classList.remove('open');
    });

    // Header menu button toggles sidebar
    headerMenuBtn?.addEventListener('click', () => {
        sidebar.classList.toggle('open');
    });

    // Chart navigation buttons
    sidebarIndiaBtn?.addEventListener('click', () => {
        // Hide playlists view if visible
        if (isPlaylistPanelVisible) {
            hidePlaylistsView();
        }
        if (currentChartMode !== 'india') {
            switchChartMode('india');
        }
        updateSidebarActiveState('india');
        sidebar.classList.remove('open'); // Close sidebar on mobile
    });

    sidebarGlobalBtn?.addEventListener('click', () => {
        // Hide playlists view if visible
        if (isPlaylistPanelVisible) {
            hidePlaylistsView();
        }
        if (currentChartMode !== 'global') {
            switchChartMode('global');
        }
        updateSidebarActiveState('global');
        sidebar.classList.remove('open'); // Close sidebar on mobile
    });

    // Profile button - opens profile panel
    sidebarProfileBtn?.addEventListener('click', () => {
        sidebar.classList.remove('open');
        if (typeof showProfilePanel === 'function') {
            showProfilePanel();
        }
    });

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
        if (!sidebar.classList.contains('open')) return;

        // Check if click is outside sidebar and not on the menu button
        const isClickInsideSidebar = sidebar.contains(e.target);
        const isClickOnMenuBtn = headerMenuBtn?.contains(e.target);

        if (!isClickInsideSidebar && !isClickOnMenuBtn) {
            sidebar.classList.remove('open');
        }
    });

    // Sync with initial chart mode
    updateSidebarActiveState(currentChartMode);
}

function updateSidebarActiveState(mode) {
    const sidebarIndiaBtn = document.getElementById('sidebarIndiaBtn');
    const sidebarGlobalBtn = document.getElementById('sidebarGlobalBtn');

    sidebarIndiaBtn?.classList.toggle('active', mode === 'india');
    sidebarGlobalBtn?.classList.toggle('active', mode === 'global');
}

