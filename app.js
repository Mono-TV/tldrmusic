// TLDR Music - Frontend Application

const API_BASE = 'https://tldrmusic-api-401132033262.asia-south1.run.app';
const CHART_API_BASE = 'https://music-harvester-401132033262.asia-south1.run.app/api';
const CURATED_API_BASE = 'https://tldrmusic-api-701102808610.asia-south1.run.app';
const AI_PLAYLIST_API_BASE = 'https://harvester.lumiolabs.in';
const DATA_PATH = './current.json'; // Fallback for local development

// localStorage keys
const STORAGE_KEYS = {
    FAVORITES: 'tldr-favorites',
    HISTORY: 'tldr-history',
    SHUFFLE: 'tldr-shuffle',
    REPEAT: 'tldr-repeat',
    QUEUE: 'tldr-queue',
    PLAYLISTS: 'tldr-playlists',
    CHART_CACHE: 'tldr-chart-cache',
    CHART_CACHE_TIME: 'tldr-chart-cache-time',
    RECENT_SEARCHES: 'tldr-recent-searches'
};

// Cache TTL: 30 minutes (in milliseconds)
const CACHE_TTL = 30 * 60 * 1000;

// Get artwork URL with YouTube thumbnail fallback
// Harvester API uses image_url, legacy API uses artwork_url
function getArtworkUrl(song) {
    if (song.image_url) return song.image_url;
    if (song.artwork_url) return song.artwork_url;
    if (song.youtube_video_id) {
        return `https://i.ytimg.com/vi/${song.youtube_video_id}/maxresdefault.jpg`;
    }
    return '';
}

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

// India Catalog (Discover India) state
const INDIA_CATALOG_API = 'https://music-harvester-401132033262.asia-south1.run.app/api/india';
let currentDiscoverGenre = 'Indian Pop';
let discoverIndiaSongs = [];
const DISCOVER_GENRES = [
    { key: 'Indian Pop', label: 'Indian Pop' },
    { key: 'Bollywood', label: 'Bollywood' },
    { key: 'Pop', label: 'Pop' },
    { key: 'Hip-Hop/Rap', label: 'Hip-Hop' },
    { key: 'Electronic', label: 'Electronic' },
    { key: 'Rock', label: 'Rock' },
    { key: 'Punjabi', label: 'Punjabi' },
    { key: 'Tamil', label: 'Tamil' },
    { key: 'Telugu', label: 'Telugu' },
    { key: 'Discover', label: 'Discover' }
];

// Helper to check if a song is currently playing
function isCurrentlyPlaying(videoId) {
    if (!videoId) return false;
    return currentPlayingVideoId === videoId;
}

// Helper to generate now-playing equalizer HTML
function getNowPlayingEqHtml() {
    return '<div class="now-playing-eq"><span></span><span></span><span></span></div>';
}

// Update now-playing indicators across all visible song lists
function updateNowPlayingIndicators() {
    // Remove existing now-playing class from all items
    document.querySelectorAll('.detail-song.now-playing, .chart-song-item.now-playing').forEach(el => {
        el.classList.remove('now-playing');
    });

    if (!currentPlayingVideoId) return;

    // Add now-playing class to matching items with data-video-id attribute
    document.querySelectorAll('[data-video-id]').forEach(el => {
        if (el.dataset.videoId === currentPlayingVideoId) {
            el.classList.add('now-playing');
        }
    });
}

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

// Search state
let searchDebounceTimer = null;
const SEARCH_DEBOUNCE_MS = 300;
const SEARCH_API_BASE = 'https://harvester.lumiolabs.in/api/tldr';
const MAX_RECENT_SEARCHES = 10;
let recentSearches = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECENT_SEARCHES) || '[]');
let currentSearchQuery = '';
let isSearchViewActive = false;
window.currentSearchResults = [];

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
const globalSpotlightsSection = document.getElementById('globalSpotlightsSection');
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
    initSearch();       // Initialize search functionality
    renderSkeletons(); // Show skeletons immediately
    await loadChartData();
    initDiscoverIndia(); // Initialize Discover India section
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

    // Handle ?song={id} - play a specific song
    const songId = urlParams.get('song');
    if (songId) {
        loadSongFromUrl(songId);
        return;
    }

    // Handle ?artist={id} - show artist (future feature)
    const artistId = urlParams.get('artist');
    if (artistId) {
        // TODO: Implement artist detail view
        console.log('Artist view not yet implemented:', artistId);
        return;
    }

    // Handle ?chart={type} - switch to specific chart
    const chartType = urlParams.get('chart');
    if (chartType) {
        handleChartUrlParam(chartType);
        return;
    }
}

// Load and play a song from URL parameter
async function loadSongFromUrl(videoId) {
    try {
        // Try to find song in chart data first
        let song = null;

        if (chartData && chartData.chart) {
            song = chartData.chart.find(s => s.youtube_video_id === videoId);
        }

        if (!song && chartData && chartData.global_chart) {
            song = chartData.global_chart.find(s => s.youtube_video_id === videoId);
        }

        // If found in charts, play it
        if (song) {
            playRegionalSongDirect(
                song.title,
                song.artist,
                song.youtube_video_id,
                getArtworkUrl(song),
                song.score
            );
            return;
        }

        // Try to fetch from API
        const response = await fetch(`${API_BASE}/songs/${videoId}`);
        if (response.ok) {
            const songData = await response.json();
            playRegionalSongDirect(
                songData.title,
                songData.artist,
                videoId,
                getArtworkUrl(songData) || songData.artwork,
                songData.score
            );
        } else {
            // Just try to play the video ID directly
            playRegionalSongDirect('Unknown Song', 'Unknown Artist', videoId, null, null);
        }
    } catch (error) {
        console.error('Error loading song from URL:', error);
        showToast('Could not load song');
    }

    // Clear URL param after loading
    history.replaceState(null, '', window.location.pathname);
}

// Handle chart URL parameter
function handleChartUrlParam(chartType) {
    const supportedCharts = ['india', 'global', 'hindi', 'punjabi', 'tamil', 'telugu', 'kannada', 'malayalam', 'bengali', 'marathi', 'gujarati'];

    if (chartType === 'india' || chartType === 'global') {
        // Switch to main chart mode
        selectHomeChart(chartType);
        // Show the chart detail view
        showChartDetail(chartType);
    } else if (supportedCharts.includes(chartType.toLowerCase())) {
        // Regional chart - select the language
        selectRegionalLanguage(chartType.toLowerCase());
    }

    // Clear URL param after handling
    history.replaceState(null, '', window.location.pathname);
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
    const homeView = document.getElementById('homeView');
    const mainContent = document.getElementById('mainContent');
    const heroSection = document.getElementById('heroSection');
    const playlistsView = document.getElementById('playlistsView');
    const playlistDetailView = document.getElementById('playlistDetailView');

    if (homeView) homeView.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
    if (heroSection) heroSection.style.display = 'none';
    if (playlistsView) playlistsView.style.display = 'none';
    if (playlistDetailView) {
        playlistDetailView.style.display = 'block';
        playlistDetailView.scrollTop = 0;
    }

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
            ${playlist.songs.map((song, index) => {
                const isPlaying = isCurrentlyPlaying(song.videoId);
                return `
                <div class="detail-song${isPlaying ? ' now-playing' : ''}" data-video-id="${song.videoId || ''}" onclick="playSharedPlaylistFromIndex(${index})">
                    <span class="detail-song-num">${index + 1}</span>
                    <div class="detail-song-artwork">
                        ${song.artwork
                            ? `<img src="${song.artwork}" alt="${escapeHtml(song.title)}">`
                            : '<div class="placeholder"></div>'
                        }
                        ${getNowPlayingEqHtml()}
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
            `}).join('')}
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

    // Shuffle songs and set up queue
    const shuffled = [...playlist.songs].sort(() => Math.random() - 0.5);

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
    if (firstSong && firstSong.videoId) {
        playRegionalSongDirect(firstSong.title, firstSong.artist, firstSong.videoId, firstSong.artwork);
    }
    showToast(`Shuffling "${playlist.name}"`);
}

function playSharedPlaylistFromIndex(index) {
    const playlist = window.currentSharedPlaylist;
    if (!playlist || !playlist.songs) return;

    const song = playlist.songs[index];
    if (!song || !song.videoId) return;

    // Set up queue with remaining songs
    queue = playlist.songs.slice(index + 1).map((s, i) => ({
        id: Date.now() + i,
        title: s.title,
        artist: s.artist,
        videoId: s.videoId,
        artwork: s.artwork
    }));
    saveQueue();
    renderQueuePanel();

    // Play the song using proper playback function
    playRegionalSongDirect(song.title, song.artist, song.videoId, song.artwork);
    showToast(`Playing "${playlist.name}"`);
}

async function saveSharedPlaylistToLibrary(playlistId) {
    if (!isAuthenticated) {
        showLoginModal();
        return;
    }

    try {
        const response = await fetchWithAuth(`/api/me/playlists/${playlistId}/follow`, {
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
    // Chart skeleton - 10 cards directly in chartList
    const chartList = document.getElementById('chartList');
    if (chartList) {
        let skeletonHTML = '';
        for (let i = 0; i < 10; i++) {
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

    // Regional skeleton - show skeleton cards in grid format
    const regionalChartGrid = document.getElementById('regionalChartGrid');
    if (regionalChartGrid) {
        let regionalHTML = '';
        for (let i = 0; i < 10; i++) {
            regionalHTML += `
                <div class="skeleton-card" data-skeleton="true">
                    <div class="skeleton skeleton-artwork"></div>
                    <div class="skeleton-info">
                        <div class="skeleton skeleton-title"></div>
                        <div class="skeleton skeleton-artist"></div>
                    </div>
                </div>
            `;
        }
        regionalChartGrid.innerHTML = regionalHTML;
    }
}

// Check if cached data is still valid
function isCacheValid() {
    const cacheTime = localStorage.getItem(STORAGE_KEYS.CHART_CACHE_TIME);
    if (!cacheTime) return false;
    return (Date.now() - parseInt(cacheTime)) < CACHE_TTL;
}

// Load chart data from cache or API
async function loadChartData() {
    // Try cache first for instant load
    if (isCacheValid()) {
        try {
            const cached = localStorage.getItem(STORAGE_KEYS.CHART_CACHE);
            if (cached) {
                chartData = JSON.parse(cached);
                console.log('Loaded chart data from cache');
                consolidateGlobalChart();
                renderHero();
                renderChart();
                renderRegionalCharts();
                updateMetadata();

                // Refresh cache in background (don't await)
                refreshChartCache();
                return;
            }
        } catch (e) {
            console.warn('Cache read failed:', e);
        }
    }

    // No valid cache, fetch from harvester API
    try {
        // Fetch India and Global charts in parallel
        const [indiaResponse, globalResponse] = await Promise.all([
            fetch(`${CHART_API_BASE}/chart/current`),
            fetch(`${CHART_API_BASE}/chart/current?chart_type=global`)
        ]);

        if (!indiaResponse.ok) throw new Error('India chart API request failed');

        const indiaData = await indiaResponse.json();
        const globalData = globalResponse.ok ? await globalResponse.json() : null;

        // Build chartData in expected format
        chartData = {
            generated_at: indiaData.generated_at,
            week: indiaData.week,
            chart: indiaData.chart || [],
            global_chart: globalData?.chart || [],
            regional: indiaData.regional || {}
        };

        console.log('Loaded chart data from harvester API');

        // Cache the data
        try {
            localStorage.setItem(STORAGE_KEYS.CHART_CACHE, JSON.stringify(chartData));
            localStorage.setItem(STORAGE_KEYS.CHART_CACHE_TIME, Date.now().toString());
        } catch (e) {
            console.warn('Cache write failed:', e);
        }

        renderHero();
        renderChart();
        renderRegionalCharts();
        updateMetadata();
    } catch (apiError) {
        console.warn('Harvester API unavailable, trying local fallback:', apiError.message);
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

// Refresh cache in background without blocking UI
async function refreshChartCache() {
    try {
        // Fetch India and Global charts in parallel
        const [indiaResponse, globalResponse] = await Promise.all([
            fetch(`${CHART_API_BASE}/chart/current`),
            fetch(`${CHART_API_BASE}/chart/current?chart_type=global`)
        ]);

        if (!indiaResponse.ok) return;

        const indiaData = await indiaResponse.json();
        const globalData = globalResponse.ok ? await globalResponse.json() : null;

        const freshData = {
            generated_at: indiaData.generated_at,
            week: indiaData.week,
            chart: indiaData.chart || [],
            global_chart: globalData?.chart || [],
            regional: indiaData.regional || {}
        };

        localStorage.setItem(STORAGE_KEYS.CHART_CACHE, JSON.stringify(freshData));
        localStorage.setItem(STORAGE_KEYS.CHART_CACHE_TIME, Date.now().toString());
        console.log('Cache refreshed in background from harvester API');

        // Update in-memory data and re-render regional if new data available
        const hadRegional = chartData?.regional && Object.keys(chartData.regional).length > 0;
        const hasRegional = freshData.regional && Object.keys(freshData.regional).length > 0;
        if (!hadRegional && hasRegional) {
            chartData = freshData;
            renderRegionalCharts();
            console.log('Regional charts updated with fresh data');
        }
    } catch (e) {
        // Silent fail for background refresh
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
    const heroRatingIcon1 = document.getElementById('heroRatingIcon');
    if (heroRatingIcon1) heroRatingIcon1.style.display = 'inline';

    // Hero artwork
    const heroArtwork = document.getElementById('heroArtwork');
    const artworkUrl = getArtworkUrl(song);
    if (heroArtwork && artworkUrl) {
        heroArtwork.src = artworkUrl;
        heroArtwork.alt = `${song.title} album art`;
        heroArtwork.style.display = 'block';
    }

    // Hero background from album artwork
    const heroBg = document.getElementById('heroBg');
    if (heroBg && artworkUrl) {
        heroBg.style.backgroundImage = `url(${artworkUrl})`;
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

    // Show only first 10 songs on home page
    const displayCount = 10;
    chartData.chart.slice(0, displayCount).forEach((song, index) => {
        const songEl = createSongElement(song, index);
        chartList.appendChild(songEl);
    });

    // Update Quick Picks count badge
    const quickPicksCount = document.getElementById('quickPicksCount');
    if (quickPicksCount) {
        quickPicksCount.textContent = displayCount;
    }
}

// Current selected regional language
let currentRegionalLanguage = 'hindi';

// Render regional charts
function renderRegionalCharts() {
    const regionalSection = document.getElementById('regionalSection');
    const languageSelector = document.getElementById('regionalLanguageSelector');
    const chartGrid = document.getElementById('regionalChartGrid');

    if (!chartData || !chartData.regional || !languageSelector || !chartGrid) {
        if (regionalSection) regionalSection.style.display = 'none';
        return;
    }

    // Show section
    if (regionalSection) regionalSection.style.display = 'block';

    // Language configuration with colors
    const languages = [
        { key: 'hindi', name: 'Hindi', color: '#FF6B35' },
        { key: 'punjabi', name: 'Punjabi', color: '#FFB833' },
        { key: 'tamil', name: 'Tamil', color: '#C41E3A' },
        { key: 'telugu', name: 'Telugu', color: '#E6B800' },
        { key: 'bengali', name: 'Bengali', color: '#228B22' },
        { key: 'marathi', name: 'Marathi', color: '#FF7F00' },
        { key: 'kannada', name: 'Kannada', color: '#E31837' },
        { key: 'malayalam', name: 'Malayalam', color: '#00A86B' },
        { key: 'bhojpuri', name: 'Bhojpuri', color: '#FF8C00' },
        { key: 'haryanvi', name: 'Haryanvi', color: '#2E8B57' },
        { key: 'gujarati', name: 'Gujarati', color: '#DC143C' }
    ];

    // Music note icon for regional buttons
    const musicIcon = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>`;

    // Filter to only languages that have data
    const availableLanguages = languages.filter(lang =>
        chartData.regional[lang.key]?.songs?.length > 0
    );

    // Set default language if current doesn't have data
    if (!chartData.regional[currentRegionalLanguage]?.songs?.length && availableLanguages.length > 0) {
        currentRegionalLanguage = availableLanguages[0].key;
    }

    // Render language selector buttons
    languageSelector.innerHTML = availableLanguages.map(lang => `
        <button class="platform-btn ${lang.key === currentRegionalLanguage ? 'active' : ''}"
                data-lang="${lang.key}"
                style="--platform-color: ${lang.color}"
                onclick="selectRegionalLanguage('${lang.key}')">
            <span class="platform-btn-logo">${musicIcon}</span>
            <span class="platform-btn-name">${lang.name}</span>
        </button>
    `).join('');

    // Update count badge
    const regionalCount = document.getElementById('regionalCount');
    if (regionalCount) {
        regionalCount.textContent = availableLanguages.length;
    }

    // Render songs for selected language
    renderRegionalSongs(currentRegionalLanguage);
}

// Select a regional language
function selectRegionalLanguage(langKey) {
    currentRegionalLanguage = langKey;

    // Update active button
    document.querySelectorAll('#regionalLanguageSelector .platform-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === langKey);
    });

    // Re-render songs
    renderRegionalSongs(langKey);
}

// Render songs for a specific language
function renderRegionalSongs(langKey) {
    const chartGrid = document.getElementById('regionalChartGrid');
    if (!chartGrid || !chartData?.regional?.[langKey]) return;

    const region = chartData.regional[langKey];
    const songs = region.songs || [];

    chartGrid.innerHTML = '';

    songs.slice(0, 10).forEach((song, index) => {
        const songEl = createRegionalSongCard(song, index);
        chartGrid.appendChild(songEl);
    });
}

// Create a regional song card (same style as Quick Picks)
function createRegionalSongCard(song, index) {
    const card = document.createElement('div');
    card.className = 'song-card';
    card.dataset.title = song.title;
    card.dataset.artist = song.artist;
    card.dataset.videoId = song.youtube_video_id || '';
    const foundSong = findSongInMainChart(song.title, song.artist);
    const artworkUrl = getArtworkUrl(song) || (foundSong ? getArtworkUrl(foundSong) : '');
    card.dataset.artwork = artworkUrl;
    const rank = index + 1;

    const placeholderSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"></polygon>
        </svg>
    `;

    card.innerHTML = `
        <div class="song-card-artwork">
            ${artworkUrl
                ? `<img src="${artworkUrl}" alt="${escapeHtml(song.title)}" loading="lazy">`
                : `<div class="song-card-artwork-placeholder">${placeholderSvg}</div>`}
            <span class="song-card-rank ${rank <= 3 ? 'top-3' : ''}">#${rank}</span>
            <div class="song-card-play">
                <div class="song-card-play-btn">
                    <svg class="icon-play" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="6 3 20 12 6 21 6 3"></polygon>
                    </svg>
                    <svg class="icon-pause" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16"></rect>
                        <rect x="14" y="4" width="4" height="16"></rect>
                    </svg>
                </div>
            </div>
            <div class="song-card-equalizer">
                <span></span><span></span><span></span>
            </div>
        </div>
        <div class="song-card-info">
            <div class="song-card-title">${escapeHtml(song.title)}</div>
            <div class="song-card-artist">${escapeHtml(song.artist)}</div>
        </div>
    `;

    // Click handler
    card.addEventListener('click', () => {
        playRegionalSong(song.title, song.artist, song.youtube_video_id, artworkUrl);
    });

    return card;
}

// ============================================================
// DISCOVER INDIA (India Catalog Playlists)
// ============================================================

// Initialize Discover India section
function initDiscoverIndia() {
    const genreSelector = document.getElementById('discoverIndiaGenreSelector');
    if (!genreSelector) return;

    // Render genre buttons
    genreSelector.innerHTML = DISCOVER_GENRES.map(genre => `
        <button class="platform-btn ${genre.key === currentDiscoverGenre ? 'active' : ''}"
                data-genre="${genre.key}"
                onclick="selectDiscoverGenre('${genre.key}')">
            ${genre.label}
        </button>
    `).join('');

    // Load initial genre
    loadDiscoverIndiaSongs(currentDiscoverGenre);
}

// Select a genre in Discover India
function selectDiscoverGenre(genreKey) {
    currentDiscoverGenre = genreKey;

    // Update active button
    document.querySelectorAll('#discoverIndiaGenreSelector .platform-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.genre === genreKey);
    });

    // Load songs for this genre
    loadDiscoverIndiaSongs(genreKey);
}

// Load songs from India Catalog API
async function loadDiscoverIndiaSongs(genreKey) {
    const grid = document.getElementById('discoverIndiaGrid');
    if (!grid) return;

    // Show loading skeleton
    grid.innerHTML = Array(10).fill().map(() => `
        <div class="song-card skeleton">
            <div class="song-card-artwork skeleton-box"></div>
            <div class="song-card-info">
                <div class="skeleton-text"></div>
                <div class="skeleton-text short"></div>
            </div>
        </div>
    `).join('');

    try {
        let url;
        if (genreKey === 'Discover') {
            // Random discovery playlist
            url = `${INDIA_CATALOG_API}/playlist/discover?limit=10`;
        } else if (['Punjabi', 'Tamil', 'Telugu'].includes(genreKey)) {
            // Language-based playlist
            const langCode = genreKey === 'Punjabi' ? 'pa' : genreKey === 'Tamil' ? 'ta' : 'te';
            url = `${INDIA_CATALOG_API}/playlist/language/${langCode}?limit=10&shuffle=true`;
        } else {
            // Genre-based playlist
            url = `${INDIA_CATALOG_API}/playlist/genre/${encodeURIComponent(genreKey)}?limit=10`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch');

        const data = await response.json();
        discoverIndiaSongs = data.songs || [];

        renderDiscoverIndiaSongs();
    } catch (error) {
        console.error('Error loading Discover India songs:', error);
        grid.innerHTML = `<div class="error-message">Failed to load songs. <button onclick="loadDiscoverIndiaSongs('${genreKey}')">Retry</button></div>`;
    }
}

// Render Discover India songs grid
function renderDiscoverIndiaSongs() {
    const grid = document.getElementById('discoverIndiaGrid');
    if (!grid) return;

    grid.innerHTML = '';

    discoverIndiaSongs.slice(0, 10).forEach((song, index) => {
        const card = createDiscoverIndiaSongCard(song, index);
        grid.appendChild(card);
    });
}

// Create a song card for Discover India
function createDiscoverIndiaSongCard(song, index) {
    const card = document.createElement('div');
    card.className = 'song-card';

    // Extract data from India Catalog format
    const title = song.title || song.name || '';
    const artist = song.artist || song.artist_name || '';
    const artworkUrl = song.artwork_url || song.image_url || '';
    const videoId = song.youtube_video_id || '';

    card.dataset.title = title;
    card.dataset.artist = artist;
    card.dataset.videoId = videoId;
    card.dataset.artwork = artworkUrl;

    const rank = index + 1;
    const placeholderSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"></polygon>
        </svg>
    `;

    card.innerHTML = `
        <div class="song-card-artwork">
            ${artworkUrl
                ? `<img src="${artworkUrl}" alt="${escapeHtml(title)}" loading="lazy" onerror="this.style.display='none'">`
                : `<div class="song-card-artwork-placeholder">${placeholderSvg}</div>`}
            <span class="song-card-rank ${rank <= 3 ? 'top-3' : ''}">#${rank}</span>
            <div class="song-card-play">
                <div class="song-card-play-btn">
                    <svg class="icon-play" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="6 3 20 12 6 21 6 3"></polygon>
                    </svg>
                    <svg class="icon-pause" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16"></rect>
                        <rect x="14" y="4" width="4" height="16"></rect>
                    </svg>
                </div>
            </div>
            <div class="song-card-equalizer">
                <span></span><span></span><span></span>
            </div>
        </div>
        <div class="song-card-info">
            <div class="song-card-title">${escapeHtml(title)}</div>
            <div class="song-card-artist clickable" onclick="event.stopPropagation(); showArtistPage('${escapeHtml(artist).replace(/'/g, "\\'")}')">${escapeHtml(artist)}</div>
        </div>
    `;

    // Click handler - play the song
    card.addEventListener('click', () => {
        playDiscoverIndiaSong(song, index);
    });

    return card;
}

// Play a song from Discover India
function playDiscoverIndiaSong(song, index) {
    const title = song.title || song.name || '';
    const artist = song.artist || song.artist_name || '';
    const artworkUrl = song.artwork_url || song.image_url || '';
    const videoId = song.youtube_video_id || '';

    if (videoId) {
        // Play directly with YouTube video ID
        playRegionalSongDirect(title, artist, videoId, artworkUrl);
    } else {
        // Search for the song on YouTube
        searchAndPlaySong({ title, artist, artwork_url: artworkUrl });
    }

    // Add remaining songs to queue
    const remainingSongs = discoverIndiaSongs.slice(index + 1);
    remainingSongs.forEach(s => {
        const sTitle = s.title || s.name || '';
        const sArtist = s.artist || s.artist_name || '';
        const sArtwork = s.artwork_url || s.image_url || '';
        const sVideoId = s.youtube_video_id || '';

        addToQueue({
            title: sTitle,
            artist: sArtist,
            videoId: sVideoId,
            artwork: sArtwork
        });
    });

    showToast(`Playing ${currentDiscoverGenre} playlist`);
}

// ============================================================
// ARTIST PAGE
// ============================================================

let currentArtistData = null;
let currentArtistSongs = [];
let currentArtistAlbums = [];

// Navigate to artist page
function showArtistPage(artistName) {
    if (!artistName) return;

    // Hide all other views
    const homeView = document.getElementById('homeView');
    const heroSection = document.getElementById('heroSection');
    const mainContent = document.getElementById('mainContent');
    const playlistsView = document.getElementById('playlistsView');
    const playlistDetailView = document.getElementById('playlistDetailView');
    const favoritesDetailView = document.getElementById('favoritesDetailView');
    const historyDetailView = document.getElementById('historyDetailView');
    const chartDetailView = document.getElementById('chartDetailView');
    const searchView = document.getElementById('searchView');
    const discoverView = document.getElementById('discoverView');
    const curatedDetailView = document.getElementById('curatedDetailView');

    if (homeView) homeView.style.display = 'none';
    if (heroSection) heroSection.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
    if (playlistsView) playlistsView.style.display = 'none';
    if (playlistDetailView) playlistDetailView.style.display = 'none';
    if (favoritesDetailView) favoritesDetailView.style.display = 'none';
    if (historyDetailView) historyDetailView.style.display = 'none';
    if (chartDetailView) chartDetailView.style.display = 'none';
    if (searchView) searchView.style.display = 'none';
    if (discoverView) discoverView.style.display = 'none';
    if (curatedDetailView) curatedDetailView.style.display = 'none';

    // Show artist detail view
    const artistView = document.getElementById('artistDetailView');
    if (artistView) {
        artistView.style.display = 'block';
        artistView.scrollTop = 0;
    }

    // Load artist data
    loadArtistData(artistName);
}

// Hide artist page
function hideArtistPage() {
    const artistView = document.getElementById('artistDetailView');
    if (artistView) artistView.style.display = 'none';

    // Show home view
    showHomeView();
}

// Load artist data from search API
async function loadArtistData(artistName) {
    const header = document.getElementById('artistDetailHeader');
    const content = document.getElementById('artistDetailContent');

    if (!header || !content) return;

    // Show loading state
    header.innerHTML = `
        <button class="detail-back-btn" onclick="hideArtistPage()" title="Back">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
        </button>
        <div class="detail-hero">
            <div class="artist-cover skeleton-box"></div>
            <div class="detail-info">
                <span class="detail-type">Artist</span>
                <h1 class="detail-name">${escapeHtml(artistName)}</h1>
                <p class="detail-meta">Loading songs...</p>
            </div>
        </div>
    `;

    content.innerHTML = `
        <div class="detail-song-list">
            ${Array(10).fill().map(() => `
                <div class="detail-song skeleton">
                    <div class="skeleton-box" style="width: 24px; height: 24px;"></div>
                    <div class="detail-song-artwork skeleton-box"></div>
                    <div class="detail-song-info">
                        <div class="skeleton-text"></div>
                        <div class="skeleton-text short"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;

    try {
        // Search for songs by this artist
        const response = await fetch(`${INDIA_CATALOG_API.replace('/india', '/tldr')}/search?q=${encodeURIComponent(artistName)}&limit=50`);

        if (!response.ok) throw new Error('Failed to load artist songs');

        const data = await response.json();
        const songs = data.songs || [];

        // Filter songs that actually match this artist
        currentArtistSongs = songs.filter(song => {
            const songArtist = (song.artist || '').toLowerCase();
            const searchArtist = artistName.toLowerCase();
            return songArtist.includes(searchArtist) || searchArtist.includes(songArtist);
        });

        // Extract unique albums from songs
        const albumMap = new Map();
        currentArtistSongs.forEach(song => {
            const albumName = song.album || song.album_name;
            if (albumName && albumName.trim()) {
                if (!albumMap.has(albumName)) {
                    albumMap.set(albumName, {
                        name: albumName,
                        artwork: song.artwork_url || song.image_url || '',
                        songs: []
                    });
                }
                albumMap.get(albumName).songs.push(song);
            }
        });
        currentArtistAlbums = Array.from(albumMap.values())
            .filter(album => album.songs.length > 0)
            .sort((a, b) => b.songs.length - a.songs.length); // Sort by song count

        // Get first song's artwork for artist image
        const artistImage = currentArtistSongs[0]?.artwork_url || currentArtistSongs[0]?.image_url || '';

        // Store artist data
        currentArtistData = {
            name: artistName,
            image: artistImage,
            songCount: currentArtistSongs.length,
            totalInCatalog: data.total || currentArtistSongs.length
        };

        // Render artist page
        renderArtistPage();

    } catch (error) {
        console.error('Error loading artist data:', error);
        content.innerHTML = `
            <div class="detail-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <p>Failed to load artist</p>
                <button class="btn-secondary" onclick="loadArtistData('${escapeHtml(artistName).replace(/'/g, "\\'")}')">Try Again</button>
            </div>
        `;
    }
}

// Render artist page with data
function renderArtistPage() {
    if (!currentArtistData) return;

    const header = document.getElementById('artistDetailHeader');
    const content = document.getElementById('artistDetailContent');

    if (!header || !content) return;

    // Render header
    header.innerHTML = `
        <button class="detail-back-btn" onclick="hideArtistPage()" title="Back">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
        </button>
        <div class="detail-hero">
            <div class="artist-cover ${currentArtistData.image ? '' : 'no-image'}">
                ${currentArtistData.image
                    ? `<img src="${currentArtistData.image}" alt="${escapeHtml(currentArtistData.name)}" crossorigin="anonymous">`
                    : `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                       </svg>`
                }
            </div>
            <div class="detail-info">
                <span class="detail-type">Artist</span>
                <h1 class="detail-name">${escapeHtml(currentArtistData.name)}</h1>
                <p class="detail-meta">${currentArtistSongs.length} songs${currentArtistData.totalInCatalog > currentArtistSongs.length ? ` • ${currentArtistData.totalInCatalog.toLocaleString()} in catalog` : ''}</p>
                <div class="detail-buttons">
                    <button class="btn-primary" onclick="playAllArtistSongs()" ${currentArtistSongs.length === 0 ? 'disabled' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        Play
                    </button>
                    <button class="btn-secondary" onclick="shuffleArtistSongs()" ${currentArtistSongs.length === 0 ? 'disabled' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="16 3 21 3 21 8"></polyline>
                            <line x1="4" y1="20" x2="21" y2="3"></line>
                            <polyline points="21 16 21 21 16 21"></polyline>
                            <line x1="15" y1="15" x2="21" y2="21"></line>
                            <line x1="4" y1="4" x2="9" y2="9"></line>
                        </svg>
                        Shuffle
                    </button>
                </div>
            </div>
        </div>
    `;

    // Render songs
    if (currentArtistSongs.length === 0) {
        content.innerHTML = `
            <div class="detail-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 18V5l12-2v13"></path>
                    <circle cx="6" cy="18" r="3"></circle>
                    <circle cx="18" cy="16" r="3"></circle>
                </svg>
                <p>No songs found</p>
                <span>We couldn't find songs by this artist</span>
            </div>
        `;
        return;
    }

    // Build albums section HTML
    let albumsHtml = '';
    if (currentArtistAlbums.length > 0) {
        albumsHtml = `
            <div class="artist-albums-section">
                <h3 class="artist-section-title">Albums</h3>
                <div class="artist-albums-grid">
                    ${currentArtistAlbums.map((album, index) => `
                        <div class="artist-album-card" onclick="playArtistAlbum(${index})">
                            <div class="artist-album-artwork">
                                ${album.artwork
                                    ? `<img src="${album.artwork}" alt="${escapeHtml(album.name)}" loading="lazy">`
                                    : `<div class="artist-album-placeholder">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                                            <circle cx="12" cy="12" r="3"></circle>
                                        </svg>
                                       </div>`
                                }
                                <div class="artist-album-play-overlay">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                    </svg>
                                </div>
                            </div>
                            <div class="artist-album-info">
                                <div class="artist-album-name">${escapeHtml(album.name)}</div>
                                <div class="artist-album-meta">${album.songs.length} song${album.songs.length !== 1 ? 's' : ''}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    content.innerHTML = `
        ${albumsHtml}
        <div class="artist-songs-section">
            ${currentArtistAlbums.length > 0 ? '<h3 class="artist-section-title">Songs</h3>' : ''}
            <div class="detail-song-list">
            ${currentArtistSongs.map((song, index) => {
                const videoId = song.youtube_video_id || '';
                const isPlaying = isCurrentlyPlaying(videoId);
                const isFavorite = favorites.some(f => f.title === song.title && f.artist === song.artist);
                const artworkUrl = song.artwork_url || song.image_url || '';

                return `
                <div class="detail-song${isPlaying ? ' now-playing' : ''}" data-video-id="${videoId}" onclick="playArtistSongByIndex(${index})">
                    <span class="detail-song-num">${index + 1}</span>
                    ${getNowPlayingEqHtml()}
                    <div class="detail-song-artwork">
                        ${artworkUrl
                            ? `<img src="${artworkUrl}" alt="${escapeHtml(song.title)}">`
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
                        <div class="detail-song-artist">${escapeHtml(song.album || song.genre || '')}</div>
                    </div>
                    <div class="detail-song-actions">
                        <button class="detail-song-action ${isFavorite ? 'liked' : ''}" onclick="event.stopPropagation(); toggleFavorite({title: '${escapeHtml(song.title).replace(/'/g, "\\'")}', artist: '${escapeHtml(song.artist).replace(/'/g, "\\'")}', videoId: '${videoId}', artwork: '${artworkUrl.replace(/'/g, "\\'")}'}); renderArtistPage();" title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                        </button>
                        <button class="detail-song-action" onclick="event.stopPropagation(); showAddToPlaylistModal({videoId: '${videoId}', title: '${escapeHtml(song.title).replace(/'/g, "\\'")}', artist: '${escapeHtml(song.artist).replace(/'/g, "\\'")}', artwork: '${artworkUrl.replace(/'/g, "\\'")}'});" title="Add to playlist">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 12H3"></path>
                                <path d="M16 6H3"></path>
                                <path d="M16 18H3"></path>
                                <path d="M18 9v6"></path>
                                <path d="M21 12h-6"></path>
                            </svg>
                        </button>
                        <button class="detail-song-action" onclick="event.stopPropagation(); addToQueue({title: '${escapeHtml(song.title).replace(/'/g, "\\'")}', artist: '${escapeHtml(song.artist).replace(/'/g, "\\'")}', videoId: '${videoId}', artwork: '${artworkUrl.replace(/'/g, "\\'")}'})" title="Add to queue">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            `}).join('')}
            </div>
        </div>
    `;

    // Apply gradient based on artist image
    applyArtistGradient();
}

// Play album from artist page
function playArtistAlbum(albumIndex) {
    if (albumIndex < 0 || albumIndex >= currentArtistAlbums.length) return;

    const album = currentArtistAlbums[albumIndex];
    if (!album.songs || album.songs.length === 0) return;

    // Play first song
    const firstSong = album.songs[0];
    const videoId = firstSong.youtube_video_id || '';
    const title = firstSong.title || '';
    const artist = firstSong.artist || '';
    const artwork = firstSong.artwork_url || firstSong.image_url || '';

    if (videoId) {
        playRegionalSongDirect(title, artist, videoId, artwork);
    } else {
        searchAndPlaySong({ title, artist, artwork_url: artwork });
    }

    // Add remaining album songs to queue
    queue.length = 0;
    album.songs.slice(1).forEach(s => {
        addToQueue({
            title: s.title || '',
            artist: s.artist || '',
            videoId: s.youtube_video_id || '',
            artwork: s.artwork_url || s.image_url || ''
        });
    });

    showToast(`Playing ${album.name}`);
}

// Apply gradient to artist page
function applyArtistGradient() {
    const artistView = document.getElementById('artistDetailView');
    const coverImg = artistView?.querySelector('.artist-cover img');

    if (!artistView) return;

    if (coverImg && coverImg.complete && coverImg.naturalWidth > 0) {
        extractArtistColor(coverImg, artistView);
    } else if (coverImg) {
        coverImg.onload = () => extractArtistColor(coverImg, artistView);
        coverImg.onerror = () => {
            artistView.style.background = 'linear-gradient(180deg, rgba(147, 51, 234, 0.3) 0%, var(--bg-primary) 300px)';
        };
    } else {
        // Default purple gradient for artists without image
        artistView.style.background = 'linear-gradient(180deg, rgba(147, 51, 234, 0.3) 0%, var(--bg-primary) 300px)';
    }
}

// Extract dominant color from artist image
function extractArtistColor(img, container) {
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 50;
        canvas.height = 50;
        ctx.drawImage(img, 0, 0, 50, 50);

        const imageData = ctx.getImageData(0, 0, 50, 50).data;
        let r = 0, g = 0, b = 0, count = 0;

        for (let i = 0; i < imageData.length; i += 16) {
            r += imageData[i];
            g += imageData[i + 1];
            b += imageData[i + 2];
            count++;
        }

        r = Math.floor(r / count);
        g = Math.floor(g / count);
        b = Math.floor(b / count);

        container.style.background = `linear-gradient(180deg, rgba(${r}, ${g}, ${b}, 0.4) 0%, var(--bg-primary) 300px)`;
    } catch (e) {
        container.style.background = 'linear-gradient(180deg, rgba(147, 51, 234, 0.3) 0%, var(--bg-primary) 300px)';
    }
}

// Play song from artist page
function playArtistSongByIndex(index) {
    if (index < 0 || index >= currentArtistSongs.length) return;

    const song = currentArtistSongs[index];
    const videoId = song.youtube_video_id || '';
    const title = song.title || '';
    const artist = song.artist || '';
    const artwork = song.artwork_url || song.image_url || '';

    if (videoId) {
        playRegionalSongDirect(title, artist, videoId, artwork);
    } else {
        searchAndPlaySong({ title, artist, artwork_url: artwork });
    }

    // Add remaining songs to queue
    const remainingSongs = currentArtistSongs.slice(index + 1);
    queue.length = 0;
    remainingSongs.forEach(s => {
        addToQueue({
            title: s.title || '',
            artist: s.artist || '',
            videoId: s.youtube_video_id || '',
            artwork: s.artwork_url || s.image_url || ''
        });
    });

    showToast(`Playing from ${currentArtistData?.name || 'Artist'}`);
}

// Play all artist songs
function playAllArtistSongs() {
    if (currentArtistSongs.length === 0) return;
    playArtistSongByIndex(0);
}

// Shuffle artist songs
function shuffleArtistSongs() {
    if (currentArtistSongs.length === 0) return;

    // Shuffle the songs array
    const shuffled = [...currentArtistSongs].sort(() => Math.random() - 0.5);
    currentArtistSongs = shuffled;

    // Play first song
    playArtistSongByIndex(0);
    showToast(`Shuffling ${currentArtistData?.name || 'Artist'}`);
}

// Current selected global platform
let currentGlobalPlatform = 'spotify_global';

// Render global platform spotlights (Spotify, Billboard, Apple Music)
function renderGlobalSpotlights() {
    const spotlightsSection = document.getElementById('globalSpotlightsSection');
    const platformSelector = document.getElementById('globalPlatformSelector');
    const chartGrid = document.getElementById('globalPlatformGrid');

    if (!chartData || !chartData.global_chart || !platformSelector || !chartGrid) {
        if (spotlightsSection) spotlightsSection.style.display = 'none';
        return;
    }

    // Platform configuration with logos and colors
    const platforms = [
        {
            key: 'spotify_global',
            name: 'Spotify',
            color: '#1DB954',
            logo: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>`
        },
        {
            key: 'billboard_hot100',
            name: 'Billboard',
            color: '#D4AF37',
            logo: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h10v2H7V7zm0 4h10v2H7v-2zm0 4h6v2H7v-2z"/></svg>`
        },
        {
            key: 'apple_global',
            name: 'Apple Music',
            color: '#FC3C44',
            logo: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.994 6.124a9.23 9.23 0 00-.24-2.19c-.317-1.31-1.062-2.31-2.18-3.043a5.022 5.022 0 00-1.877-.726 10.496 10.496 0 00-1.564-.15c-.04-.003-.083-.01-.124-.013H5.986c-.152.01-.303.017-.455.026-.747.043-1.49.123-2.193.4-1.336.53-2.3 1.452-2.865 2.78-.192.448-.292.925-.363 1.408-.056.392-.088.785-.1 1.18 0 .032-.007.062-.01.093v12.223c.01.14.017.283.027.424.05.815.154 1.624.497 2.373.65 1.42 1.738 2.353 3.234 2.802.42.127.856.187 1.293.228.555.053 1.11.06 1.667.06h11.03c.525 0 1.048-.034 1.57-.1.823-.106 1.597-.35 2.296-.81a5.046 5.046 0 001.88-2.207c.186-.42.293-.87.37-1.324.113-.675.138-1.358.137-2.04-.002-3.8 0-7.595-.003-11.393zm-6.423 3.99v5.712c0 .417-.058.827-.244 1.206-.29.59-.76.962-1.388 1.14-.35.1-.706.157-1.07.173-.95.042-1.785-.404-2.17-1.256-.34-.752-.137-1.69.553-2.264.387-.323.85-.513 1.34-.618.492-.106.99-.183 1.485-.27.303-.055.416-.17.418-.48V9.62c0-.06-.003-.12-.015-.18-.04-.19-.157-.298-.355-.276-.16.018-.318.053-.476.086-1.14.235-2.278.47-3.416.708-.083.017-.164.042-.243.074-.133.054-.18.14-.18.285.004.96 0 1.92.002 2.88v5.09c0 .42-.054.834-.234 1.218-.283.6-.76.985-1.397 1.168-.34.1-.69.155-1.044.172-.95.046-1.793-.4-2.18-1.248-.34-.743-.15-1.672.52-2.26.387-.337.857-.53 1.36-.635.39-.082.784-.143 1.176-.21.262-.047.524-.09.78-.156.165-.042.266-.152.286-.32.007-.06.01-.12.01-.18V6.076c0-.088.006-.177.022-.264.04-.216.167-.336.38-.386.083-.02.166-.035.25-.05l4.44-.916c.655-.134 1.31-.27 1.966-.402.32-.064.643-.122.964-.18.073-.013.15-.015.223-.01.2.015.342.14.378.34.014.065.018.133.018.2v5.707z"/></svg>`
        }
    ];

    // Filter to platforms that have songs
    const availablePlatforms = platforms.filter(platform => {
        return chartData.global_chart.some(song =>
            song.platform_ranks?.some(pr => pr.platform === platform.key)
        );
    });

    if (availablePlatforms.length === 0) {
        if (spotlightsSection) spotlightsSection.style.display = 'none';
        return;
    }

    // Set default platform if current doesn't have data
    const currentHasData = chartData.global_chart.some(song =>
        song.platform_ranks?.some(pr => pr.platform === currentGlobalPlatform)
    );
    if (!currentHasData && availablePlatforms.length > 0) {
        currentGlobalPlatform = availablePlatforms[0].key;
    }

    // Render platform selector buttons
    platformSelector.innerHTML = availablePlatforms.map(platform => `
        <button class="platform-btn ${platform.key === currentGlobalPlatform ? 'active' : ''}"
                data-platform="${platform.key}"
                style="--platform-color: ${platform.color}"
                onclick="selectGlobalPlatform('${platform.key}')">
            <span class="platform-btn-logo">${platform.logo}</span>
            <span class="platform-btn-name">${platform.name}</span>
        </button>
    `).join('');

    // Update count badge
    const countBadge = document.getElementById('globalSpotlightsCount');
    if (countBadge) {
        countBadge.textContent = availablePlatforms.length;
    }

    // Render songs for selected platform
    renderGlobalPlatformSongs(currentGlobalPlatform);
}

// Select a global platform
function selectGlobalPlatform(platformKey) {
    currentGlobalPlatform = platformKey;

    // Update active button
    document.querySelectorAll('#globalPlatformSelector .platform-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.platform === platformKey);
    });

    // Re-render songs
    renderGlobalPlatformSongs(platformKey);
}

// Render songs for a specific platform
function renderGlobalPlatformSongs(platformKey) {
    const chartGrid = document.getElementById('globalPlatformGrid');
    if (!chartGrid || !chartData?.global_chart) return;

    // Extract songs for this platform
    const platformSongs = chartData.global_chart
        .filter(song => song.platform_ranks?.some(pr => pr.platform === platformKey))
        .map(song => {
            const platformRank = song.platform_ranks.find(pr => pr.platform === platformKey);
            return { ...song, platformRank: platformRank?.rank || 999 };
        })
        .sort((a, b) => a.platformRank - b.platformRank)
        .slice(0, 10);

    chartGrid.innerHTML = '';

    platformSongs.forEach((song, index) => {
        const songEl = createGlobalPlatformSongCard(song, index);
        chartGrid.appendChild(songEl);
    });
}

// Create a global platform song card (same style as Quick Picks)
function createGlobalPlatformSongCard(song, index) {
    const card = document.createElement('div');
    card.className = 'song-card';
    const artworkUrl = getArtworkUrl(song);
    card.dataset.title = song.title;
    card.dataset.artist = song.artist;
    card.dataset.videoId = song.youtube_video_id || '';
    card.dataset.artwork = artworkUrl;
    const rank = song.platformRank;

    const placeholderSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
            <circle cx="12" cy="12" r="10"></circle>
            <polygon points="10 8 16 12 10 16 10 8" fill="currentColor"></polygon>
        </svg>
    `;

    card.innerHTML = `
        <div class="song-card-artwork">
            ${artworkUrl
                ? `<img src="${artworkUrl}" alt="${escapeHtml(song.title)}" loading="lazy">`
                : `<div class="song-card-artwork-placeholder">${placeholderSvg}</div>`}
            <span class="song-card-rank ${rank <= 3 ? 'top-3' : ''}">#${rank}</span>
            <div class="song-card-play">
                <div class="song-card-play-btn">
                    <svg class="icon-play" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <polygon points="6 3 20 12 6 21 6 3"></polygon>
                    </svg>
                    <svg class="icon-pause" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                        <rect x="6" y="4" width="4" height="16"></rect>
                        <rect x="14" y="4" width="4" height="16"></rect>
                    </svg>
                </div>
            </div>
            <div class="song-card-equalizer">
                <span></span><span></span><span></span>
            </div>
        </div>
        <div class="song-card-info">
            <div class="song-card-title">${escapeHtml(song.title)}</div>
            <div class="song-card-artist">${escapeHtml(song.artist)}</div>
        </div>
    `;

    // Click handler
    card.addEventListener('click', () => {
        playRegionalSong(song.title, song.artist, song.youtube_video_id, artworkUrl);
    });

    return card;
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

    // Update now-playing indicators in song lists
    updateNowPlayingIndicators();

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
    const heroRatingIcon2 = document.getElementById('heroRatingIcon');
    if (heroRatingIcon2) heroRatingIcon2.style.display = score ? 'inline' : 'none';

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
    const artworkUrl = getArtworkUrl(song);
    el.dataset.artwork = artworkUrl;

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
            ${artworkUrl
                ? `<img src="${artworkUrl}" alt="${escapeHtml(song.title)}" loading="lazy">`
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
                <span class="score"><img src="✦.png" alt="" class="rating-icon">${song.score.toFixed(2)}</span>
                ${rankMovement}
                ${viewsText ? `<span>${viewsText} views</span>` : ''}
            </div>
        </div>
        <div class="song-card-actions">
            <button class="song-add-playlist" title="Add to playlist">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 12H3"></path>
                    <path d="M16 6H3"></path>
                    <path d="M16 18H3"></path>
                    <path d="M18 9v6"></path>
                    <path d="M21 12h-6"></path>
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
    const heroRatingIcon3 = document.getElementById('heroRatingIcon');
    if (heroRatingIcon3) heroRatingIcon3.style.display = 'inline';

    const heroArtwork = document.getElementById('heroArtwork');
    const artworkUrl = getArtworkUrl(song);
    if (heroArtwork && artworkUrl) {
        heroArtwork.src = artworkUrl;
        heroArtwork.alt = `${song.title} album art`;
        heroArtwork.style.display = 'block';
    }

    const heroBg = document.getElementById('heroBg');
    if (heroBg && artworkUrl) {
        heroBg.style.backgroundImage = `url(${artworkUrl})`;
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

    // Show only first 10 songs on home page
    const displayCount = 10;
    chartData.global_chart.slice(0, displayCount).forEach((song, index) => {
        const songEl = createSongElement(song, index, 'global');
        chartList.appendChild(songEl);
    });

    // Update Quick Picks count badge
    const quickPicksCount = document.getElementById('quickPicksCount');
    if (quickPicksCount) {
        quickPicksCount.textContent = displayCount;
    }
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
    const artworkUrl = getArtworkUrl(song);
    if (playerBarTitle) playerBarTitle.textContent = song.title;
    if (playerBarArtist) playerBarArtist.textContent = song.artist;
    if (playerBarArtwork && artworkUrl) {
        playerBarArtwork.src = artworkUrl;
    }

    // Update player bar visibility based on hero visibility
    updatePlayerBarVisibility();

    // Apply artwork as gradient background
    if (artworkUrl && mainGradient) {
        mainGradient.style.backgroundImage = `url(${artworkUrl})`;
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
    const heroRatingIcon4 = document.getElementById('heroRatingIcon');
    if (heroRatingIcon4) heroRatingIcon4.style.display = 'inline';

    // Update rank number
    if (heroRankNum) heroRankNum.textContent = index + 1;

    // Update artwork
    const artworkUrl = getArtworkUrl(song);
    if (heroArtwork && artworkUrl) {
        heroArtwork.src = artworkUrl;
        heroArtwork.alt = `${song.title} album art`;
        heroArtwork.style.display = 'block';
    }

    // Update hero background
    if (heroBg && artworkUrl) {
        heroBg.style.backgroundImage = `url(${artworkUrl})`;
    }

    // Update header background
    const headerBg = document.getElementById('headerBg');
    if (headerBg && artworkUrl) {
        headerBg.style.backgroundImage = `url(${artworkUrl})`;
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
                playRegionalSongDirect(song.title, song.artist, song.youtube_video_id, getArtworkUrl(song), song.score);
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
            artwork: getArtworkUrl(song) || song.artwork,
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
    const homeView = document.getElementById('homeView');
    const heroSection = document.getElementById('heroSection');
    if (homeView) homeView.style.display = 'none';
    if (heroSection) heroSection.style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('playlistsView').style.display = 'none';
    document.getElementById('playlistDetailView').style.display = 'none';
    document.getElementById('historyDetailView').style.display = 'none';

    // Show favorites detail
    const detailView = document.getElementById('favoritesDetailView');
    detailView.style.display = 'block';
    detailView.scrollTop = 0;

    // Render header
    const header = document.getElementById('favoritesDetailHeader');
    header.innerHTML = `
        <button class="detail-back-btn" onclick="showPlaylistsView()" title="Back to Library">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
        </button>
        <div class="detail-hero">
            <div class="detail-cover favorites-cover">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                </svg>
            </div>
            <div class="detail-info">
                <span class="detail-type">Library</span>
                <h1 class="detail-name">Liked Songs</h1>
                <p class="detail-meta">${favorites.length} song${favorites.length !== 1 ? 's' : ''}</p>
                <div class="detail-buttons">
                    <button class="btn-primary" onclick="playAllFavorites()" ${favorites.length === 0 ? 'disabled' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        Play
                    </button>
                    <button class="btn-secondary" onclick="shuffleFavorites()" ${favorites.length === 0 ? 'disabled' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="16 3 21 3 21 8"></polyline>
                            <line x1="4" y1="20" x2="21" y2="3"></line>
                            <polyline points="21 16 21 21 16 21"></polyline>
                            <line x1="15" y1="15" x2="21" y2="21"></line>
                            <line x1="4" y1="4" x2="9" y2="9"></line>
                        </svg>
                        Shuffle
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

    songsContainer.innerHTML = `
        <div class="detail-song-list">
            ${favorites.map((fav, index) => {
                const isPlaying = isCurrentlyPlaying(fav.videoId);
                const artworkUrl = fav.artwork || '';
                return `
                <div class="detail-song${isPlaying ? ' now-playing' : ''}" data-video-id="${fav.videoId || ''}" onclick="playFavoriteByIndex(${index})">
                    <span class="detail-song-num">${index + 1}</span>
                    <div class="detail-song-artwork">
                        ${fav.artwork
                            ? `<img src="${fav.artwork}" alt="${escapeHtml(fav.title)}">`
                            : '<div class="placeholder"></div>'
                        }
                        ${getNowPlayingEqHtml()}
                        <div class="detail-song-play-overlay">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                        </div>
                    </div>
                    <div class="detail-song-info">
                        <div class="detail-song-title">${escapeHtml(fav.title)}</div>
                        <div class="detail-song-artist">${escapeHtml(fav.artist)}</div>
                    </div>
                    <div class="detail-song-actions">
                        <button class="detail-song-action" onclick="event.stopPropagation(); showAddToPlaylistModal({videoId: '${fav.videoId || ''}', title: '${escapeHtml(fav.title).replace(/'/g, "\\'")}', artist: '${escapeHtml(fav.artist).replace(/'/g, "\\'")}', artwork: '${artworkUrl.replace(/'/g, "\\'")}'});" title="Add to playlist">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 12H3"></path>
                                <path d="M16 6H3"></path>
                                <path d="M16 18H3"></path>
                                <path d="M18 9v6"></path>
                                <path d="M21 12h-6"></path>
                            </svg>
                        </button>
                        <button class="detail-song-action" onclick="event.stopPropagation(); addToQueue({title: '${escapeHtml(fav.title).replace(/'/g, "\\'")}', artist: '${escapeHtml(fav.artist).replace(/'/g, "\\'")}', videoId: '${fav.videoId || ''}', artwork: '${artworkUrl.replace(/'/g, "\\'")}'})" title="Add to queue">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                        <button class="detail-song-action remove" onclick="event.stopPropagation(); removeFavoriteByIndex(${index})" title="Remove from favorites">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            `}).join('')}
        </div>
    `;
}

function removeFavoriteByIndex(index) {
    if (index >= 0 && index < favorites.length) {
        const fav = favorites[index];
        toggleFavorite({ title: fav.title, artist: fav.artist });
        showFavoritesDetail(); // Re-render
    }
}

function playFavoriteByIndex(index) {
    if (index >= 0 && index < favorites.length) {
        const fav = favorites[index];
        if (fav.videoId) {
            // Set up queue with remaining songs
            queue = favorites.slice(index + 1).map((f, i) => ({
                id: Date.now() + i,
                title: f.title,
                artist: f.artist,
                videoId: f.videoId,
                artwork: f.artwork
            }));
            saveQueue();
            renderQueuePanel();

            playRegionalSongDirect(fav.title, fav.artist, fav.videoId, fav.artwork);
        }
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

function shuffleFavorites() {
    if (favorites.length === 0) return;

    // Create shuffled copy
    const shuffled = [...favorites].sort(() => Math.random() - 0.5);

    // Clear queue and add shuffled favorites
    queue.length = 0;
    shuffled.forEach(fav => {
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
    showToast(`Shuffling ${favorites.length} songs`);
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
        artwork: getArtworkUrl(song) || song.artwork,
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
    const homeView = document.getElementById('homeView');
    const heroSection = document.getElementById('heroSection');
    if (homeView) homeView.style.display = 'none';
    if (heroSection) heroSection.style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('playlistsView').style.display = 'none';
    document.getElementById('playlistDetailView').style.display = 'none';
    document.getElementById('favoritesDetailView').style.display = 'none';

    // Show history detail
    const detailView = document.getElementById('historyDetailView');
    detailView.style.display = 'block';
    detailView.scrollTop = 0;

    // Render header
    const header = document.getElementById('historyDetailHeader');
    header.innerHTML = `
        <button class="detail-back-btn" onclick="showPlaylistsView()" title="Back to Library">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
        </button>
        <div class="detail-hero">
            <div class="detail-cover history-cover">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"></circle>
                    <polyline points="12 6 12 12 16 14"></polyline>
                </svg>
            </div>
            <div class="detail-info">
                <span class="detail-type">Library</span>
                <h1 class="detail-name">Recently Played</h1>
                <p class="detail-meta">${playHistory.length} song${playHistory.length !== 1 ? 's' : ''}</p>
                <div class="detail-buttons">
                    <button class="btn-primary" onclick="playAllHistory()" ${playHistory.length === 0 ? 'disabled' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        Play
                    </button>
                    <button class="btn-secondary" onclick="shuffleHistory()" ${playHistory.length === 0 ? 'disabled' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="16 3 21 3 21 8"></polyline>
                            <line x1="4" y1="20" x2="21" y2="3"></line>
                            <polyline points="21 16 21 21 16 21"></polyline>
                            <line x1="15" y1="15" x2="21" y2="21"></line>
                            <line x1="4" y1="4" x2="9" y2="9"></line>
                        </svg>
                        Shuffle
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

    songsContainer.innerHTML = `
        <div class="detail-song-list">
            ${playHistory.map((item, index) => {
                const isPlaying = isCurrentlyPlaying(item.videoId);
                const isFavorite = favorites.some(f => f.title === item.title && f.artist === item.artist);
                const artworkUrl = item.artwork || '';
                return `
                <div class="detail-song${isPlaying ? ' now-playing' : ''}" data-video-id="${item.videoId || ''}" onclick="playHistoryByIndex(${index})">
                    <span class="detail-song-num">${index + 1}</span>
                    <div class="detail-song-artwork">
                        ${item.artwork
                            ? `<img src="${item.artwork}" alt="${escapeHtml(item.title)}">`
                            : '<div class="placeholder"></div>'
                        }
                        ${getNowPlayingEqHtml()}
                        <div class="detail-song-play-overlay">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                        </div>
                    </div>
                    <div class="detail-song-info">
                        <div class="detail-song-title">${escapeHtml(item.title)}</div>
                        <div class="detail-song-artist">${escapeHtml(item.artist)}</div>
                    </div>
                    <div class="detail-song-actions">
                        <button class="detail-song-action ${isFavorite ? 'liked' : ''}" onclick="event.stopPropagation(); toggleFavorite({title: '${escapeHtml(item.title).replace(/'/g, "\\'")}', artist: '${escapeHtml(item.artist).replace(/'/g, "\\'")}', videoId: '${item.videoId || ''}', artwork: '${artworkUrl.replace(/'/g, "\\'")}'}); showHistoryDetail();" title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                        </button>
                        <button class="detail-song-action" onclick="event.stopPropagation(); showAddToPlaylistModal({videoId: '${item.videoId || ''}', title: '${escapeHtml(item.title).replace(/'/g, "\\'")}', artist: '${escapeHtml(item.artist).replace(/'/g, "\\'")}', artwork: '${artworkUrl.replace(/'/g, "\\'")}'});" title="Add to playlist">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 12H3"></path>
                                <path d="M16 6H3"></path>
                                <path d="M16 18H3"></path>
                                <path d="M18 9v6"></path>
                                <path d="M21 12h-6"></path>
                            </svg>
                        </button>
                        <button class="detail-song-action" onclick="event.stopPropagation(); addToQueue({title: '${escapeHtml(item.title).replace(/'/g, "\\'")}', artist: '${escapeHtml(item.artist).replace(/'/g, "\\'")}', videoId: '${item.videoId || ''}', artwork: '${artworkUrl.replace(/'/g, "\\'")}'})" title="Add to queue">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            `}).join('')}
        </div>
    `;
}

function playHistoryByIndex(index) {
    if (index >= 0 && index < playHistory.length) {
        const item = playHistory[index];
        if (item.videoId) {
            // Set up queue with remaining songs
            queue = playHistory.slice(index + 1).map((h, i) => ({
                id: Date.now() + i,
                title: h.title,
                artist: h.artist,
                videoId: h.videoId,
                artwork: h.artwork
            }));
            saveQueue();
            renderQueuePanel();

            playRegionalSongDirect(item.title, item.artist, item.videoId, item.artwork);
        }
    }
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

function shuffleHistory() {
    if (playHistory.length === 0) return;

    // Create shuffled copy
    const shuffled = [...playHistory].sort(() => Math.random() - 0.5);

    // Clear queue and add shuffled history
    queue.length = 0;
    shuffled.forEach(item => {
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
    showToast(`Shuffling ${playHistory.length} songs`);
}

// ============================================================
// Chart Detail View Functions
// ============================================================

let currentChartDetailData = null;
let currentChartDetailType = null;

function showChartDetail(chartType) {
    currentChartDetailType = chartType;

    // Hide other views
    const homeView = document.getElementById('homeView');
    const heroSection = document.getElementById('heroSection');
    if (homeView) homeView.style.display = 'none';
    if (heroSection) heroSection.style.display = 'none';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('playlistsView').style.display = 'none';
    document.getElementById('playlistDetailView').style.display = 'none';
    document.getElementById('favoritesDetailView').style.display = 'none';
    document.getElementById('historyDetailView').style.display = 'none';

    // Show chart detail view
    const detailView = document.getElementById('chartDetailView');
    detailView.style.display = 'block';
    detailView.scrollTop = 0;

    // Get chart data based on type
    let detailData, chartName, chartCoverClass, chartIcon, chartMeta;

    if (chartType === 'india') {
        detailData = chartData?.chart || [];
        chartName = 'India Top 25';
        chartCoverClass = 'india';
        chartIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
        </svg>`;
        chartMeta = 'Updated weekly • Aggregated from 9 platforms';
    } else if (chartType === 'global') {
        detailData = chartData?.global_chart || [];
        chartName = 'Global Top 25';
        chartCoverClass = 'global';
        chartIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
        </svg>`;
        chartMeta = 'Updated weekly • Spotify, Billboard, Apple Music';
    } else {
        // Regional chart - get from chartData.regional
        const regionalData = chartData?.regional?.[chartType];
        detailData = regionalData?.songs || [];
        chartName = chartType.charAt(0).toUpperCase() + chartType.slice(1) + ' Top 10';
        chartCoverClass = 'regional';
        chartIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 18V5l12-2v13"></path>
            <circle cx="6" cy="18" r="3"></circle>
            <circle cx="18" cy="16" r="3"></circle>
        </svg>`;
        chartMeta = `Updated weekly • ${chartType.charAt(0).toUpperCase() + chartType.slice(1)} music`;
    }

    currentChartDetailData = detailData;
    renderChartDetail(detailData, chartName, chartCoverClass, chartIcon, chartMeta);
}

function renderChartDetail(chartData, chartName, chartCoverClass, chartIcon, chartMeta) {
    const header = document.getElementById('chartDetailHeader');
    const songsContainer = document.getElementById('chartDetailSongs');

    // Render header
    header.innerHTML = `
        <button class="chart-detail-back" onclick="hideChartDetail()" title="Back">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
        </button>
        <div class="chart-detail-hero">
            <div class="chart-detail-cover ${chartCoverClass}">
                <div class="chart-detail-cover-icon">
                    ${chartIcon}
                    <span class="chart-detail-cover-badge">TOP ${chartData.length}</span>
                </div>
            </div>
            <div class="chart-detail-info">
                <span class="chart-detail-type">Chart</span>
                <h1 class="chart-detail-name">${chartName}</h1>
                <div class="chart-detail-meta">
                    <span class="chart-detail-meta-item">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                            <line x1="16" y1="2" x2="16" y2="6"></line>
                            <line x1="8" y1="2" x2="8" y2="6"></line>
                            <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        ${chartMeta}
                    </span>
                </div>
                <div class="chart-detail-buttons">
                    <button class="chart-detail-btn primary" onclick="playChartDetailAll()" ${chartData.length === 0 ? 'disabled' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        Play All
                    </button>
                    <button class="chart-detail-btn secondary" onclick="shuffleChartDetail()" ${chartData.length === 0 ? 'disabled' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="16 3 21 3 21 8"></polyline>
                            <line x1="4" y1="20" x2="21" y2="3"></line>
                            <polyline points="21 16 21 21 16 21"></polyline>
                            <line x1="15" y1="15" x2="21" y2="21"></line>
                            <line x1="4" y1="4" x2="9" y2="9"></line>
                        </svg>
                        Shuffle
                    </button>
                </div>
            </div>
        </div>
    `;

    // Render songs
    if (!chartData || chartData.length === 0) {
        songsContainer.innerHTML = `
            <div class="detail-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 18V5l12-2v13"></path>
                    <circle cx="6" cy="18" r="3"></circle>
                    <circle cx="18" cy="16" r="3"></circle>
                </svg>
                <p>No chart data available</p>
                <span>Check back later</span>
            </div>
        `;
        return;
    }

    songsContainer.innerHTML = `
        <div class="chart-detail-songs-header">
            <span>#</span>
            <span>Title</span>
            <span></span>
        </div>
        ${chartData.map((song, index) => {
            const rank = song.rank || index + 1;
            const rankChange = song.rank_change || 0;
            const isNew = song.is_new || false;
            const isPlaying = isCurrentlyPlaying(song.youtube_video_id);
            const artworkUrl = getArtworkUrl(song);

            let changeHtml = '';
            if (isNew) {
                changeHtml = '<span class="chart-song-change new">NEW</span>';
            } else if (rankChange > 0) {
                changeHtml = `<span class="chart-song-change up"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M18 15l-6-6-6 6"/></svg>${rankChange}</span>`;
            } else if (rankChange < 0) {
                changeHtml = `<span class="chart-song-change down"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M6 9l6 6 6-6"/></svg>${Math.abs(rankChange)}</span>`;
            } else {
                changeHtml = '<span class="chart-song-change same">—</span>';
            }

            const isFavorite = favorites.some(f => f.title === song.title && f.artist === song.artist);

            return `
                <div class="chart-song-item ${isPlaying ? 'now-playing' : ''}" data-index="${index}" data-video-id="${song.youtube_video_id || ''}" data-title="${escapeHtml(song.title)}" data-artist="${escapeHtml(song.artist)}" data-artwork="${artworkUrl}">
                    <div class="chart-song-rank">
                        <span class="chart-song-rank-number">${rank}</span>
                        ${changeHtml}
                    </div>
                    <div class="chart-song-info">
                        <div class="chart-song-artwork">
                            ${artworkUrl
                                ? `<img src="${artworkUrl}" alt="${escapeHtml(song.title)}">`
                                : `<div class="chart-song-placeholder"></div>`}
                            ${getNowPlayingEqHtml()}
                        </div>
                        <div class="chart-song-details">
                            <span class="chart-song-title">${escapeHtml(song.title)}</span>
                            <span class="chart-song-artist clickable" onclick="event.stopPropagation(); showArtistPage('${escapeHtml(song.artist).replace(/'/g, "\\'")}')">${escapeHtml(song.artist)}</span>
                        </div>
                    </div>
                    <div class="chart-song-actions">
                        <button class="chart-song-action-btn ${isFavorite ? 'liked' : ''}" onclick="event.stopPropagation(); toggleChartSongFavorite(${index})" title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                        </button>
                        <button class="chart-song-action-btn" onclick="event.stopPropagation(); showAddToPlaylistModal({videoId: '${song.youtube_video_id || ''}', title: '${escapeHtml(song.title).replace(/'/g, "\\'")}', artist: '${escapeHtml(song.artist).replace(/'/g, "\\'")}', artwork: '${artworkUrl.replace(/'/g, "\\'")}'});" title="Add to playlist">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 12H3"></path>
                                <path d="M16 6H3"></path>
                                <path d="M16 18H3"></path>
                                <path d="M18 9v6"></path>
                                <path d="M21 12h-6"></path>
                            </svg>
                        </button>
                        <button class="chart-song-action-btn" onclick="event.stopPropagation(); addChartSongToQueue(${index})" title="Add to queue">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('')}
    `;

    // Add click handlers for playing songs
    songsContainer.querySelectorAll('.chart-song-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            playChartDetailFromIndex(index);
        });
    });
}

function hideChartDetail() {
    currentChartDetailData = null;
    currentChartDetailType = null;

    // Hide chart detail view
    const detailView = document.getElementById('chartDetailView');
    if (detailView) detailView.style.display = 'none';

    // Show main content
    const mainContent = document.getElementById('mainContent');
    const heroSection = document.getElementById('heroSection');
    if (mainContent) mainContent.style.display = 'block';
    if (heroSection) heroSection.style.display = 'block';
}

function playChartDetailAll() {
    if (!currentChartDetailData || currentChartDetailData.length === 0) return;
    playChartDetailFromIndex(0);
}

function playChartDetailFromIndex(startIndex) {
    if (!currentChartDetailData || currentChartDetailData.length === 0) return;

    // Clear queue and add all songs from startIndex
    queue.length = 0;
    for (let i = startIndex + 1; i < currentChartDetailData.length; i++) {
        const song = currentChartDetailData[i];
        if (song.youtube_video_id) {
            queue.push({
                title: song.title,
                artist: song.artist,
                videoId: song.youtube_video_id,
                artwork: getArtworkUrl(song)
            });
        }
    }

    // Play first song
    const firstSong = currentChartDetailData[startIndex];
    if (firstSong && firstSong.youtube_video_id) {
        playRegionalSongDirect(firstSong.title, firstSong.artist, firstSong.youtube_video_id, getArtworkUrl(firstSong));
    }

    updateQueueBadge();
}

function shuffleChartDetail() {
    if (!currentChartDetailData || currentChartDetailData.length === 0) return;

    // Create shuffled copy
    const shuffled = [...currentChartDetailData].sort(() => Math.random() - 0.5);

    // Clear queue and add shuffled songs
    queue.length = 0;
    shuffled.forEach(song => {
        if (song.youtube_video_id) {
            queue.push({
                title: song.title,
                artist: song.artist,
                videoId: song.youtube_video_id,
                artwork: getArtworkUrl(song)
            });
        }
    });

    // Play first song from queue
    const first = queue.shift();
    if (first && first.videoId) {
        playRegionalSongDirect(first.title, first.artist, first.videoId, first.artwork);
    }

    updateQueueBadge();
    showToast(`Shuffling ${currentChartDetailData.length} songs`);
}

function toggleChartSongFavorite(index) {
    if (!currentChartDetailData || !currentChartDetailData[index]) return;

    const song = currentChartDetailData[index];
    const existingIndex = favorites.findIndex(f => f.title === song.title && f.artist === song.artist);

    if (existingIndex >= 0) {
        favorites.splice(existingIndex, 1);
        showToast('Removed from favorites');
    } else {
        favorites.push({
            title: song.title,
            artist: song.artist,
            videoId: song.youtube_video_id,
            artwork: getArtworkUrl(song),
            addedAt: Date.now()
        });
        showToast('Added to favorites');
    }

    saveFavorites();

    // Re-render the chart detail to update heart icons
    if (currentChartDetailType) {
        const detailData = currentChartDetailData;
        let chartName, chartCoverClass, chartIcon, chartMeta;

        if (currentChartDetailType === 'india') {
            chartName = 'India Top 25';
            chartCoverClass = 'india';
            chartIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M3 18v-6a9 9 0 0 1 18 0v6"></path>
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path>
            </svg>`;
            chartMeta = 'Updated weekly • Aggregated from 9 platforms';
        } else if (currentChartDetailType === 'global') {
            chartName = 'Global Top 25';
            chartCoverClass = 'global';
            chartIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
            </svg>`;
            chartMeta = 'Updated weekly • Spotify, Billboard, Apple Music';
        } else {
            chartName = currentChartDetailType.charAt(0).toUpperCase() + currentChartDetailType.slice(1) + ' Top 10';
            chartCoverClass = 'regional';
            chartIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 18V5l12-2v13"></path>
                <circle cx="6" cy="18" r="3"></circle>
                <circle cx="18" cy="16" r="3"></circle>
            </svg>`;
            chartMeta = `Updated weekly • ${currentChartDetailType.charAt(0).toUpperCase() + currentChartDetailType.slice(1)} music`;
        }

        renderChartDetail(detailData, chartName, chartCoverClass, chartIcon, chartMeta);
    }
}

function addChartSongToQueue(index) {
    if (!currentChartDetailData || !currentChartDetailData[index]) return;

    const song = currentChartDetailData[index];
    if (song.youtube_video_id) {
        queue.push({
            title: song.title,
            artist: song.artist,
            videoId: song.youtube_video_id,
            artwork: getArtworkUrl(song)
        });
        updateQueueBadge();
        showToast(`Added "${song.title}" to queue`);
    }
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
        artwork: getArtworkUrl(song) || song.artwork,
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
            const response = await fetchWithAuth(`/api/me/playlists/${playlistId}`, {
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
        artwork: getArtworkUrl(song) || song.artwork,
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
    isHomeViewVisible = false;
    isSearchViewActive = false;

    // Hide main content (charts, regional) and home view
    const homeView = document.getElementById('homeView');
    const mainContent = document.getElementById('mainContent');
    const heroSection = document.getElementById('heroSection');
    const playlistsView = document.getElementById('playlistsView');
    const playlistDetailView = document.getElementById('playlistDetailView');
    const discoverView = document.getElementById('discoverView');
    const aiGeneratedView = document.getElementById('aiGeneratedView');
    const searchView = document.getElementById('searchView');

    if (homeView) homeView.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
    if (heroSection) heroSection.style.display = 'none';
    if (playlistDetailView) playlistDetailView.style.display = 'none';
    if (discoverView) discoverView.style.display = 'none';
    if (aiGeneratedView) aiGeneratedView.style.display = 'none';
    if (searchView) searchView.style.display = 'none';
    if (playlistsView) playlistsView.style.display = 'block';

    // Update sidebar active state
    updateSidebarActiveState('playlists');

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
    const favoritesDetailView = document.getElementById('favoritesDetailView');
    const chartDetailView = document.getElementById('chartDetailView');
    const historyDetailView = document.getElementById('historyDetailView');

    if (mainContent) mainContent.style.display = 'block';
    if (heroSection) heroSection.style.display = 'block';
    if (playlistsView) playlistsView.style.display = 'none';
    if (playlistDetailView) playlistDetailView.style.display = 'none';
    if (favoritesDetailView) favoritesDetailView.style.display = 'none';
    if (chartDetailView) chartDetailView.style.display = 'none';
    if (historyDetailView) historyDetailView.style.display = 'none';

    // Update sidebar active state back to current chart
    document.querySelectorAll('.sidebar-nav-item').forEach(btn => btn.classList.remove('active'));
    const chartBtn = document.querySelector(`[data-chart="${currentChartMode}"]`);
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

    // Hide other views
    const homeView = document.getElementById('homeView');
    const heroSection = document.getElementById('heroSection');
    const playlistsView = document.getElementById('playlistsView');
    const detailView = document.getElementById('playlistDetailView');

    if (homeView) homeView.style.display = 'none';
    if (heroSection) heroSection.style.display = 'none';
    if (playlistsView) playlistsView.style.display = 'none';
    if (detailView) {
        detailView.style.display = 'block';
        detailView.scrollTop = 0;
    }

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
            ${playlist.songs.map((song, index) => {
                const isPlaying = isCurrentlyPlaying(song.videoId);
                const isFavorite = favorites.some(f => f.title === song.title && f.artist === song.artist);
                const artworkUrl = song.artwork || '';
                return `
                <div class="detail-song${isPlaying ? ' now-playing' : ''}" data-video-id="${song.videoId || ''}" onclick="playPlaylist('${playlist.id}', ${index})">
                    <span class="detail-song-num">${index + 1}</span>
                    ${getNowPlayingEqHtml()}
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
                    <div class="detail-song-actions">
                        <button class="detail-song-action ${isFavorite ? 'liked' : ''}" onclick="event.stopPropagation(); toggleFavorite({title: '${escapeHtml(song.title).replace(/'/g, "\\'")}', artist: '${escapeHtml(song.artist).replace(/'/g, "\\'")}', videoId: '${song.videoId || ''}', artwork: '${artworkUrl.replace(/'/g, "\\'")}'}); renderPlaylistDetail('${playlist.id}');" title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                        </button>
                        <button class="detail-song-action" onclick="event.stopPropagation(); showAddToPlaylistModal({videoId: '${song.videoId || ''}', title: '${escapeHtml(song.title).replace(/'/g, "\\'")}', artist: '${escapeHtml(song.artist).replace(/'/g, "\\'")}', artwork: '${artworkUrl.replace(/'/g, "\\'")}'});" title="Add to playlist">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M11 12H3"></path>
                                <path d="M16 6H3"></path>
                                <path d="M16 18H3"></path>
                                <path d="M18 9v6"></path>
                                <path d="M21 12h-6"></path>
                            </svg>
                        </button>
                        <button class="detail-song-action" onclick="event.stopPropagation(); addToQueue({title: '${escapeHtml(song.title).replace(/'/g, "\\'")}', artist: '${escapeHtml(song.artist).replace(/'/g, "\\'")}', videoId: '${song.videoId || ''}', artwork: '${artworkUrl.replace(/'/g, "\\'")}'})" title="Add to queue">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="5" x2="12" y2="19"></line>
                                <line x1="5" y1="12" x2="19" y2="12"></line>
                            </svg>
                        </button>
                        <button class="detail-song-action remove" onclick="event.stopPropagation(); removeFromPlaylist('${playlist.id}', ${index})" title="Remove from playlist">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>
                </div>
            `}).join('')}
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
        const response = await fetchWithAuth(`/api/me/playlists/${playlistId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ visibility: newVisibility ? 'public' : 'private' })
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

    // Sync with initial state (home view)
    updateSidebarActiveState('home');
}

function updateSidebarActiveState(mode) {
    const sidebarHomeBtn = document.getElementById('sidebarHomeBtn');
    const sidebarPlaylistsBtn = document.getElementById('sidebarPlaylistsBtn');
    const sidebarDiscoverBtn = document.getElementById('sidebarDiscoverBtn');
    const sidebarAIGeneratedBtn = document.getElementById('sidebarAIGeneratedBtn');
    const sidebarSearchBtn = document.getElementById('sidebarSearchBtn');

    // Remove active from all nav items
    sidebarHomeBtn?.classList.remove('active');
    sidebarPlaylistsBtn?.classList.remove('active');
    sidebarDiscoverBtn?.classList.remove('active');
    sidebarAIGeneratedBtn?.classList.remove('active');
    sidebarSearchBtn?.classList.remove('active');

    // Set active based on mode
    if (mode === 'home') {
        sidebarHomeBtn?.classList.add('active');
    } else if (mode === 'playlists') {
        sidebarPlaylistsBtn?.classList.add('active');
    } else if (mode === 'discover') {
        sidebarDiscoverBtn?.classList.add('active');
    } else if (mode === 'ai-generated') {
        sidebarAIGeneratedBtn?.classList.add('active');
    } else if (mode === 'search') {
        sidebarSearchBtn?.classList.add('active');
    }
}

// ============================================================
// SEARCH FUNCTIONS
// ============================================================

function initSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchClearBtn = document.getElementById('searchClearBtn');
    const searchDropdown = document.getElementById('searchDropdown');
    const searchSeeAll = document.getElementById('searchSeeAll');
    const mobileSearchBtn = document.getElementById('mobileSearchBtn');

    if (!searchInput) return;

    // Input handler with debounce
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        handleSearchInput(query);
    });

    // Focus handler - show dropdown if there's a query
    searchInput.addEventListener('focus', () => {
        if (searchInput.value.trim()) {
            showSearchDropdown();
        }
    });

    // Clear button
    searchClearBtn?.addEventListener('click', () => {
        searchInput.value = '';
        hideSearchDropdown();
        currentSearchQuery = '';
        searchInput.focus();
    });

    // See all results
    searchSeeAll?.addEventListener('click', () => {
        showSearchView(currentSearchQuery);
    });

    // Close dropdown on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            hideSearchDropdown();
        }
    });

    // Keyboard navigation
    searchInput.addEventListener('keydown', handleSearchKeydown);

    // Mobile search button
    mobileSearchBtn?.addEventListener('click', () => {
        showSearchView('');
    });

    // Search view input handlers
    const searchViewInput = document.getElementById('searchViewInput');
    const searchViewClearBtn = document.getElementById('searchViewClearBtn');
    const clearSearchHistory = document.getElementById('clearSearchHistory');

    searchViewInput?.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        handleSearchViewInput(query);
    });

    searchViewClearBtn?.addEventListener('click', () => {
        searchViewInput.value = '';
        renderSearchEmptyState();
    });

    clearSearchHistory?.addEventListener('click', () => {
        clearAllRecentSearches();
    });
}

function handleSearchInput(query) {
    currentSearchQuery = query;

    // Clear previous timer
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }

    if (!query) {
        hideSearchDropdown();
        return;
    }

    // Debounce API call
    searchDebounceTimer = setTimeout(() => {
        performQuickSearch(query);
    }, SEARCH_DEBOUNCE_MS);
}

async function performQuickSearch(query) {
    if (!query) return;

    try {
        // Use /search endpoint instead of /suggest for full artwork data
        const response = await fetch(
            `${SEARCH_API_BASE}/search?q=${encodeURIComponent(query)}&limit=5`
        );

        if (!response.ok) throw new Error('Search failed');

        const data = await response.json();
        renderSearchDropdown(data.songs || []);
        showSearchDropdown();

    } catch (error) {
        console.error('Quick search error:', error);
        renderSearchDropdownError();
    }
}

function renderSearchDropdown(suggestions) {
    const content = document.getElementById('searchDropdownContent');
    const seeAllBtn = document.getElementById('searchSeeAll');

    if (!content) return;

    if (suggestions.length === 0) {
        content.innerHTML = `
            <div class="search-dropdown-empty">
                <p>No results found</p>
            </div>
        `;
        if (seeAllBtn) seeAllBtn.style.display = 'none';
        return;
    }

    content.innerHTML = suggestions.map((song, index) => {
        // Get artwork URL with YouTube thumbnail fallback
        const artworkUrl = song.artwork_url ||
            (song.youtube_video_id ? `https://i.ytimg.com/vi/${song.youtube_video_id}/mqdefault.jpg` : '');

        return `
            <div class="search-dropdown-item"
                 data-index="${index}"
                 onclick="playSearchResult(${index})">
                <div class="search-dropdown-item-artwork">
                    ${artworkUrl
                        ? `<img src="${artworkUrl}" alt="${escapeHtml(song.title)}" loading="lazy">`
                        : '<div class="placeholder"></div>'}
                </div>
                <div class="search-dropdown-item-info">
                    <div class="search-dropdown-item-title">${escapeHtml(song.title)}</div>
                    <div class="search-dropdown-item-artist">${escapeHtml(song.artist)}</div>
                </div>
            </div>
        `;
    }).join('');

    // Store suggestions for playback
    window.currentDropdownSuggestions = suggestions;

    if (seeAllBtn) seeAllBtn.style.display = 'flex';
}

function renderSearchDropdownError() {
    const content = document.getElementById('searchDropdownContent');
    if (!content) return;

    content.innerHTML = `
        <div class="search-dropdown-empty">
            <p>Search failed. Try again.</p>
        </div>
    `;
}

function showSearchDropdown() {
    const dropdown = document.getElementById('searchDropdown');
    dropdown?.classList.add('visible');
}

function hideSearchDropdown() {
    const dropdown = document.getElementById('searchDropdown');
    dropdown?.classList.remove('visible');
}

function handleSearchKeydown(e) {
    const dropdown = document.getElementById('searchDropdown');
    if (!dropdown?.classList.contains('visible')) {
        if (e.key === 'Enter' && currentSearchQuery) {
            showSearchView(currentSearchQuery);
        }
        return;
    }

    const items = dropdown?.querySelectorAll('.search-dropdown-item');
    if (!items?.length) return;

    const currentIndex = Array.from(items).findIndex(item =>
        item.classList.contains('selected')
    );

    switch(e.key) {
        case 'ArrowDown':
            e.preventDefault();
            const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
            selectDropdownItem(items, nextIndex);
            break;

        case 'ArrowUp':
            e.preventDefault();
            const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
            selectDropdownItem(items, prevIndex);
            break;

        case 'Enter':
            e.preventDefault();
            if (currentIndex >= 0) {
                items[currentIndex].click();
            } else {
                showSearchView(currentSearchQuery);
            }
            break;

        case 'Escape':
            hideSearchDropdown();
            document.getElementById('searchInput')?.blur();
            break;
    }
}

function selectDropdownItem(items, index) {
    items.forEach((item, i) => {
        item.classList.toggle('selected', i === index);
    });
}

// ============================================================
// SEARCH VIEW (Full Page)
// ============================================================

function showSearchView(initialQuery = '') {
    isSearchViewActive = true;
    isHomeViewVisible = false;
    isPlaylistPanelVisible = false;

    // Update sidebar active state
    updateSidebarActiveState('search');

    // Hide all other views
    const homeView = document.getElementById('homeView');
    const heroSection = document.getElementById('heroSection');
    const mainContent = document.getElementById('mainContent');
    const playlistsView = document.getElementById('playlistsView');
    const playlistDetailView = document.getElementById('playlistDetailView');
    const favoritesDetailView = document.getElementById('favoritesDetailView');
    const historyDetailView = document.getElementById('historyDetailView');
    const chartDetailView = document.getElementById('chartDetailView');
    const discoverView = document.getElementById('discoverView');
    const aiGeneratedView = document.getElementById('aiGeneratedView');
    const curatedDetailView = document.getElementById('curatedDetailView');
    const aiPlaylistDetailView = document.getElementById('aiPlaylistDetailView');

    if (homeView) homeView.style.display = 'none';
    if (heroSection) heroSection.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
    if (playlistsView) playlistsView.style.display = 'none';
    if (playlistDetailView) playlistDetailView.style.display = 'none';
    if (favoritesDetailView) favoritesDetailView.style.display = 'none';
    if (historyDetailView) historyDetailView.style.display = 'none';
    if (chartDetailView) chartDetailView.style.display = 'none';
    if (discoverView) discoverView.style.display = 'none';
    if (aiGeneratedView) aiGeneratedView.style.display = 'none';
    if (curatedDetailView) curatedDetailView.style.display = 'none';
    if (aiPlaylistDetailView) aiPlaylistDetailView.style.display = 'none';

    // Show search view
    const searchView = document.getElementById('searchView');
    if (searchView) {
        searchView.style.display = 'block';
        searchView.scrollTop = 0;
    }

    // Set initial query and focus
    const searchViewInput = document.getElementById('searchViewInput');
    if (searchViewInput) {
        searchViewInput.value = initialQuery;
        setTimeout(() => searchViewInput.focus(), 100);
    }

    // Hide header dropdown
    hideSearchDropdown();

    // Clear header search input
    const headerSearchInput = document.getElementById('searchInput');
    if (headerSearchInput) headerSearchInput.value = '';

    if (initialQuery) {
        performFullSearch(initialQuery);
    } else {
        renderSearchEmptyState();
    }

    // Close sidebar on mobile
    const sidebar = document.getElementById('sidebar');
    sidebar?.classList.remove('open');
}

function closeSearchView() {
    isSearchViewActive = false;

    const searchView = document.getElementById('searchView');
    if (searchView) searchView.style.display = 'none';

    // Return to home view
    showHomeView();
}

function handleSearchViewInput(query) {
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }

    if (!query) {
        renderSearchEmptyState();
        return;
    }

    searchDebounceTimer = setTimeout(() => {
        performFullSearch(query);
    }, SEARCH_DEBOUNCE_MS);
}

async function performFullSearch(query) {
    if (!query) {
        renderSearchEmptyState();
        return;
    }

    // Show loading
    const resultsSection = document.getElementById('searchResults');
    const emptyState = document.getElementById('searchEmptyState');
    const loading = document.getElementById('searchLoading');
    const resultsList = document.getElementById('searchResultsList');
    const noResults = document.getElementById('searchNoResults');

    if (emptyState) emptyState.style.display = 'none';
    if (resultsSection) resultsSection.style.display = 'block';
    if (loading) loading.style.display = 'flex';
    if (resultsList) resultsList.innerHTML = '';
    if (noResults) noResults.style.display = 'none';

    try {
        const response = await fetch(
            `${SEARCH_API_BASE}/search?q=${encodeURIComponent(query)}&limit=50`
        );

        if (!response.ok) throw new Error('Search failed');

        const data = await response.json();

        // Save to recent searches
        addToRecentSearches(query);

        renderSearchResults(data.songs || [], data.total || 0);

    } catch (error) {
        console.error('Full search error:', error);
        renderSearchError();
    } finally {
        if (loading) loading.style.display = 'none';
    }
}

function renderSearchResults(songs, total) {
    const countEl = document.getElementById('searchResultsCount');
    const listEl = document.getElementById('searchResultsList');
    const noResults = document.getElementById('searchNoResults');

    if (countEl) {
        countEl.textContent = `${total} result${total !== 1 ? 's' : ''}`;
    }

    if (!listEl) return;

    if (songs.length === 0) {
        listEl.innerHTML = '';
        if (noResults) noResults.style.display = 'flex';
        return;
    }

    if (noResults) noResults.style.display = 'none';

    listEl.innerHTML = songs.map((song, index) => {
        const artworkUrl = song.artwork_url ||
                          (song.youtube_video_id ? `https://i.ytimg.com/vi/${song.youtube_video_id}/maxresdefault.jpg` : '');
        const isPlaying = isCurrentlyPlaying(song.youtube_video_id);

        return `
            <div class="detail-song search-result-item${isPlaying ? ' now-playing' : ''}"
                 data-video-id="${song.youtube_video_id || ''}"
                 onclick="playSearchResultFromList(${index})">
                <span class="detail-song-num">${index + 1}</span>
                <div class="detail-song-artwork">
                    ${artworkUrl
                        ? `<img src="${artworkUrl}" alt="${escapeHtml(song.title)}" loading="lazy">`
                        : '<div class="placeholder"></div>'
                    }
                    ${getNowPlayingEqHtml()}
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
                <button class="detail-song-add" onclick="event.stopPropagation(); showAddToPlaylistModal({videoId: '${song.youtube_video_id || ''}', title: '${escapeHtml(song.title).replace(/'/g, "\\'")}', artist: '${escapeHtml(song.artist).replace(/'/g, "\\'")}', artwork: '${artworkUrl.replace(/'/g, "\\'")}'})" title="Add to playlist">
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M11 12H3"></path>
                        <path d="M16 6H3"></path>
                        <path d="M16 18H3"></path>
                        <path d="M18 9v6"></path>
                        <path d="M21 12h-6"></path>
                    </svg>
                </button>
            </div>
        `;
    }).join('');

    // Store results for playback
    window.currentSearchResults = songs;
}

function renderSearchError() {
    const listEl = document.getElementById('searchResultsList');
    if (listEl) {
        listEl.innerHTML = `
            <div class="search-no-results">
                <h3>Search failed</h3>
                <p>Please try again</p>
            </div>
        `;
    }
}

// ============================================================
// SEARCH EMPTY STATE
// ============================================================

function renderSearchEmptyState() {
    const emptyState = document.getElementById('searchEmptyState');
    const resultsSection = document.getElementById('searchResults');

    if (resultsSection) resultsSection.style.display = 'none';
    if (emptyState) emptyState.style.display = 'block';

    renderRecentSearches();
    renderTrendingSongs();
    renderBrowseMoods();
}

function renderRecentSearches() {
    const section = document.getElementById('recentSearchesSection');
    const list = document.getElementById('recentSearchesList');

    if (!list) return;

    if (recentSearches.length === 0) {
        if (section) section.style.display = 'none';
        return;
    }

    if (section) section.style.display = 'block';

    list.innerHTML = recentSearches.map(query => `
        <div class="recent-search-item" onclick="performSearchFromRecent('${escapeHtml(query).replace(/'/g, "\\'")}')">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
            <span>${escapeHtml(query)}</span>
            <span class="recent-search-remove" onclick="event.stopPropagation(); removeRecentSearch('${escapeHtml(query).replace(/'/g, "\\'")}')">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </span>
        </div>
    `).join('');
}

function addToRecentSearches(query) {
    if (!query) return;

    // Remove if exists (to move to front)
    recentSearches = recentSearches.filter(q => q.toLowerCase() !== query.toLowerCase());

    // Add to front
    recentSearches.unshift(query);

    // Limit size
    recentSearches = recentSearches.slice(0, MAX_RECENT_SEARCHES);

    // Save locally
    localStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(recentSearches));

    // Sync to cloud if authenticated
    if (typeof debouncedSyncRecentSearches === 'function') {
        debouncedSyncRecentSearches();
    }
}

function removeRecentSearch(query) {
    recentSearches = recentSearches.filter(q => q !== query);
    localStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(recentSearches));
    renderRecentSearches();

    // Sync to cloud if authenticated
    if (typeof debouncedSyncRecentSearches === 'function') {
        debouncedSyncRecentSearches();
    }
}

function clearAllRecentSearches() {
    recentSearches = [];
    localStorage.removeItem(STORAGE_KEYS.RECENT_SEARCHES);
    renderRecentSearches();

    // Sync to cloud if authenticated
    if (typeof debouncedSyncRecentSearches === 'function') {
        debouncedSyncRecentSearches();
    }
}

function performSearchFromRecent(query) {
    const input = document.getElementById('searchViewInput');
    if (input) input.value = query;
    performFullSearch(query);
}

function renderTrendingSongs() {
    const grid = document.getElementById('trendingSongsGrid');
    if (!grid || !chartData?.chart) return;

    // Use top 6 songs from current chart
    const trendingSongs = chartData.chart.slice(0, 6);

    grid.innerHTML = trendingSongs.map((song, index) => {
        const artworkUrl = getArtworkUrl(song);
        const isPlaying = isCurrentlyPlaying(song.youtube_video_id);

        return `
            <div class="detail-song${isPlaying ? ' now-playing' : ''}"
                 data-video-id="${song.youtube_video_id || ''}"
                 onclick="playFromChart(${index})">
                <span class="detail-song-num">${index + 1}</span>
                <div class="detail-song-artwork">
                    ${artworkUrl
                        ? `<img src="${artworkUrl}" alt="${escapeHtml(song.title)}" loading="lazy">`
                        : '<div class="placeholder"></div>'
                    }
                    ${getNowPlayingEqHtml()}
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
        `;
    }).join('');
}

function renderBrowseMoods() {
    const grid = document.getElementById('browseMoodsGrid');
    if (!grid) return;

    const moods = [
        { id: 'chill', name: 'Chill', color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
        { id: 'workout', name: 'Workout', color: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
        { id: 'party', name: 'Party', color: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
        { id: 'romance', name: 'Romance', color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)' },
        { id: 'focus', name: 'Focus', color: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)' },
        { id: 'sad', name: 'Sad', color: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)' }
    ];

    grid.innerHTML = moods.map(mood => `
        <div class="mood-browse-card"
             style="background: ${mood.color}"
             onclick="openMoodPlaylist('${mood.id}')">
            <h4>${mood.name}</h4>
        </div>
    `).join('');
}

function openMoodPlaylist(moodId) {
    // Navigate to Discover view
    if (typeof showDiscoverView === 'function') {
        showDiscoverView();
    }
}

// ============================================================
// SEARCH PLAYBACK
// ============================================================

function playSearchResult(index) {
    const suggestions = window.currentDropdownSuggestions;
    if (!suggestions || !suggestions[index]) return;

    const song = suggestions[index];

    // Add to recent searches
    addToRecentSearches(currentSearchQuery);

    // Hide dropdown
    hideSearchDropdown();

    // Clear header input
    const headerInput = document.getElementById('searchInput');
    if (headerInput) headerInput.value = '';

    // Play the song
    if (song.youtube_video_id) {
        playSong(
            song.youtube_video_id,
            song.title,
            song.artist,
            song.artwork_url || `https://i.ytimg.com/vi/${song.youtube_video_id}/maxresdefault.jpg`
        );
    } else {
        // Search for video ID if not available
        searchAndPlayOnYouTube(song.title, song.artist);
    }
}

function playSearchResultFromList(index) {
    const songs = window.currentSearchResults;
    if (!songs || !songs[index]) return;

    const song = songs[index];

    // Build queue from search results
    const queueData = songs.map(s => ({
        title: s.title,
        artist: s.artist,
        videoId: s.youtube_video_id,
        artwork: s.artwork_url || (s.youtube_video_id ? `https://i.ytimg.com/vi/${s.youtube_video_id}/maxresdefault.jpg` : '')
    })).filter(s => s.videoId);

    // Set queue and play
    queue = queueData;
    currentSongIndex = queueData.findIndex(s => s.videoId === song.youtube_video_id);
    if (currentSongIndex === -1) currentSongIndex = 0;

    if (song.youtube_video_id) {
        playRegionalSongDirect(
            song.title,
            song.artist,
            song.youtube_video_id,
            song.artwork_url || `https://i.ytimg.com/vi/${song.youtube_video_id}/maxresdefault.jpg`
        );
    } else {
        searchAndPlayOnYouTube(song.title, song.artist);
    }
}

// ============================================================
// HOME VIEW FUNCTIONS
// ============================================================

let isHomeViewVisible = true;

function showHomeView() {
    isHomeViewVisible = true;
    isPlaylistPanelVisible = false;
    isSearchViewActive = false;

    // Show home view with chart content
    const homeView = document.getElementById('homeView');
    const mainContent = document.getElementById('mainContent');
    const heroSection = document.getElementById('heroSection');
    const playlistsView = document.getElementById('playlistsView');
    const playlistDetailView = document.getElementById('playlistDetailView');
    const favoritesDetailView = document.getElementById('favoritesDetailView');
    const historyDetailView = document.getElementById('historyDetailView');
    const chartDetailView = document.getElementById('chartDetailView');
    const discoverView = document.getElementById('discoverView');
    const curatedDetailView = document.getElementById('curatedDetailView');
    const aiGeneratedView = document.getElementById('aiGeneratedView');
    const aiPlaylistDetailView = document.getElementById('aiPlaylistDetailView');
    const searchView = document.getElementById('searchView');

    if (homeView) homeView.style.display = 'block';
    if (mainContent) mainContent.style.display = 'block';
    if (heroSection) heroSection.style.display = 'block';
    if (playlistsView) playlistsView.style.display = 'none';
    if (playlistDetailView) playlistDetailView.style.display = 'none';
    if (favoritesDetailView) favoritesDetailView.style.display = 'none';
    if (historyDetailView) historyDetailView.style.display = 'none';
    if (chartDetailView) chartDetailView.style.display = 'none';
    if (discoverView) discoverView.style.display = 'none';
    if (curatedDetailView) curatedDetailView.style.display = 'none';
    if (aiGeneratedView) aiGeneratedView.style.display = 'none';
    if (aiPlaylistDetailView) aiPlaylistDetailView.style.display = 'none';
    if (searchView) searchView.style.display = 'none';

    // Update sidebar active state
    updateSidebarActiveState('home');

    // Close sidebar on mobile
    const sidebar = document.getElementById('sidebar');
    sidebar?.classList.remove('open');
}

function hideHomeView() {
    isHomeViewVisible = false;
    const homeView = document.getElementById('homeView');
    if (homeView) homeView.style.display = 'none';
}

// Select chart from home page cards (switches chart without hiding content)
function selectHomeChart(mode) {
    // Update active state on cards
    const indiaCard = document.getElementById('homeIndiaCard');
    const globalCard = document.getElementById('homeGlobalCard');

    if (indiaCard) indiaCard.classList.toggle('active', mode === 'india');
    if (globalCard) globalCard.classList.toggle('active', mode === 'global');

    // Switch chart mode
    if (currentChartMode !== mode) {
        switchChartMode(mode);
    }

    // Update sidebar active state
    updateSidebarActiveState('home');
}

// Legacy function for direct chart navigation (from sidebar)
function selectChart(mode) {
    showHomeView();
    selectHomeChart(mode);
}

// ============================================================
// DISCOVER VIEW FUNCTIONS
// ============================================================

// Curated playlist data (will be fetched from API later)
const CURATED_PLAYLISTS = {
    moods: [
        { id: 'mood-chill', name: 'Chill Vibes', mood: 'chill', songCount: 3215, icon: 'chill' },
        { id: 'mood-workout', name: 'Workout Beats', mood: 'workout', songCount: 1597, icon: 'workout' },
        { id: 'mood-party', name: 'Party Anthems', mood: 'party', songCount: 1770, icon: 'party' },
        { id: 'mood-romance', name: 'Love Songs', mood: 'romance', songCount: 1711, icon: 'romance' },
        { id: 'mood-sad', name: 'Sad Songs', mood: 'sad', songCount: 2015, icon: 'sad' },
        { id: 'mood-focus', name: 'Deep Focus', mood: 'focus', songCount: 2100, icon: 'focus' },
        { id: 'mood-gaming', name: 'Gaming Mode', mood: 'gaming', songCount: 1354, icon: 'gaming' },
        { id: 'mood-feel-good', name: 'Feel Good Hits', mood: 'feel-good', songCount: 2165, icon: 'feel-good' },
        { id: 'mood-sleep', name: 'Sleep Sounds', mood: 'sleep', songCount: 1735, icon: 'sleep' },
        { id: 'mood-commute', name: 'Road Trip Mix', mood: 'commute', songCount: 2924, icon: 'commute' },
        { id: 'mood-energize', name: 'Energy Boost', mood: 'energize', songCount: 2866, icon: 'energize' }
    ],
    languages: [
        { id: 'lang-hindi', name: 'Hindi Hits', lang: 'hindi', songCount: 13404 },
        { id: 'lang-tamil', name: 'Tamil Tracks', lang: 'tamil', songCount: 4858 },
        { id: 'lang-telugu', name: 'Telugu Tunes', lang: 'telugu', songCount: 3874 },
        { id: 'lang-punjabi', name: 'Punjabi Beats', lang: 'punjabi', songCount: 2491 },
        { id: 'lang-english', name: 'English Pop', lang: 'english', songCount: 2074 },
        { id: 'lang-bengali', name: 'Bengali Vibes', lang: 'bengali', songCount: 1495 },
        { id: 'lang-kannada', name: 'Kannada Hits', lang: 'kannada', songCount: 1438 },
        { id: 'lang-malayalam', name: 'Malayalam Melodies', lang: 'malayalam', songCount: 858 },
        { id: 'lang-bhojpuri', name: 'Bhojpuri Beats', lang: 'bhojpuri', songCount: 618 },
        { id: 'lang-marathi', name: 'Marathi Mix', lang: 'marathi', songCount: 268 },
        { id: 'lang-gujarati', name: 'Gujarati Grooves', lang: 'gujarati', songCount: 302 },
        { id: 'lang-haryanvi', name: 'Haryanvi Hits', lang: 'haryanvi', songCount: 157 }
    ],
    artists: [
        { id: 'artist-arijit', name: 'Arijit Singh', songCount: 108 },
        { id: 'artist-anirudh', name: 'Anirudh Ravichander', songCount: 99 },
        { id: 'artist-masoom', name: 'Masoom Sharma', songCount: 86 },
        { id: 'artist-kishore', name: 'Kishore Kumar', songCount: 77 },
        { id: 'artist-shreya', name: 'Shreya Ghoshal', songCount: 76 },
        { id: 'artist-sonu', name: 'Sonu Nigam', songCount: 75 },
        { id: 'artist-taylor', name: 'Taylor Swift', songCount: 74 },
        { id: 'artist-lata', name: 'Lata Mangeshkar', songCount: 70 },
        { id: 'artist-rafi', name: 'Mohammed Rafi', songCount: 57 },
        { id: 'artist-badshah', name: 'Badshah', songCount: 57 },
        { id: 'artist-udit', name: 'Udit Narayan', songCount: 56 },
        { id: 'artist-diljit', name: 'Diljit Dosanjh', songCount: 55 },
        { id: 'artist-ed', name: 'Ed Sheeran', songCount: 52 },
        { id: 'artist-karan', name: 'Karan Aujla', songCount: 51 },
        { id: 'artist-kumar', name: 'Kumar Sanu', songCount: 50 },
        { id: 'artist-chris', name: 'Chris Brown', songCount: 48 },
        { id: 'artist-drake', name: 'Drake', songCount: 47 },
        { id: 'artist-khesari', name: 'Khesari Lal Yadav', songCount: 47 },
        { id: 'artist-weeknd', name: 'The Weeknd', songCount: 45 },
        { id: 'artist-neha', name: 'Neha Kakkar', songCount: 40 }
    ],
    eras: [
        { id: 'era-2025', name: '2025 Fresh', era: '2025', songCount: 3187 },
        { id: 'era-2024', name: '2024 Top Picks', era: '2024', songCount: 3147 },
        { id: 'era-2023', name: '2023 Best Of', era: '2023', songCount: 2459 },
        { id: 'era-2022', name: '2022 Favorites', era: '2022', songCount: 2331 },
        { id: 'era-2010s', name: '2010s Throwback', era: '2010s', songCount: 5000 },
        { id: 'era-retro', name: 'Retro Classics', era: 'retro', songCount: 3000 }
    ]
};

// Mood icons SVG
const MOOD_ICONS = {
    chill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    workout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6.5 6.5L17.5 17.5M6.5 17.5L17.5 6.5M2 12h4M18 12h4M12 2v4M12 18v4"/></svg>',
    party: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5.8 11.3L2 22l10.7-3.8M15 3v4M3 9h4M21 9h-4M18 3l-2 2M6 3l2 2"/><circle cx="12" cy="12" r="4"/></svg>',
    romance: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
    sad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    focus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    gaming: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="12" rx="2"/><line x1="6" y1="12" x2="10" y2="12"/><line x1="8" y1="10" x2="8" y2="14"/><circle cx="16" cy="10" r="1"/><circle cx="18" cy="12" r="1"/></svg>',
    'feel-good': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    sleep: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    commute: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="3" width="15" height="13" rx="2"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
    energize: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>'
};

function showDiscoverView() {
    isHomeViewVisible = false;
    isPlaylistPanelVisible = false;
    isSearchViewActive = false;

    // Hide all other views
    const homeView = document.getElementById('homeView');
    const mainContent = document.getElementById('mainContent');
    const heroSection = document.getElementById('heroSection');
    const playlistsView = document.getElementById('playlistsView');
    const playlistDetailView = document.getElementById('playlistDetailView');
    const favoritesDetailView = document.getElementById('favoritesDetailView');
    const historyDetailView = document.getElementById('historyDetailView');
    const chartDetailView = document.getElementById('chartDetailView');
    const discoverView = document.getElementById('discoverView');
    const curatedDetailView = document.getElementById('curatedDetailView');
    const aiGeneratedView = document.getElementById('aiGeneratedView');
    const aiPlaylistDetailView = document.getElementById('aiPlaylistDetailView');
    const searchView = document.getElementById('searchView');

    if (homeView) homeView.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
    if (heroSection) heroSection.style.display = 'none';
    if (playlistsView) playlistsView.style.display = 'none';
    if (playlistDetailView) playlistDetailView.style.display = 'none';
    if (favoritesDetailView) favoritesDetailView.style.display = 'none';
    if (historyDetailView) historyDetailView.style.display = 'none';
    if (chartDetailView) chartDetailView.style.display = 'none';
    if (curatedDetailView) curatedDetailView.style.display = 'none';
    if (aiGeneratedView) aiGeneratedView.style.display = 'none';
    if (aiPlaylistDetailView) aiPlaylistDetailView.style.display = 'none';
    if (searchView) searchView.style.display = 'none';
    if (discoverView) discoverView.style.display = 'block';

    // Update sidebar active state
    updateSidebarActiveState('discover');

    // Close sidebar on mobile
    const sidebar = document.getElementById('sidebar');
    sidebar?.classList.remove('open');

    // Render discover playlists
    renderDiscoverPlaylists();
}

function renderDiscoverPlaylists() {
    renderFeaturedPlaylists();
    renderMoodPlaylists();
    renderLanguagePlaylists();
    renderArtistPlaylists();
    renderEraPlaylists();
}

// Featured Collection - India Catalog Genres
const FEATURED_PLAYLISTS = [
    { id: 'featured-indian-pop', name: 'Indian Pop', genre: 'Indian Pop', songCount: 8500, icon: '🎵' },
    { id: 'featured-bollywood', name: 'Bollywood', genre: 'Bollywood', songCount: 12000, icon: '🎬' },
    { id: 'featured-pop', name: 'Pop', genre: 'Pop', songCount: 6200, icon: '🎤' },
    { id: 'featured-hiphop', name: 'Hip-Hop', genre: 'Hip-Hop/Rap', songCount: 4800, icon: '🎧' },
    { id: 'featured-electronic', name: 'Electronic', genre: 'Electronic', songCount: 3500, icon: '🎹' },
    { id: 'featured-rock', name: 'Rock', genre: 'Rock', songCount: 2800, icon: '🎸' },
    { id: 'featured-punjabi', name: 'Punjabi', genre: 'Punjabi', songCount: 5200, icon: '💫' },
    { id: 'featured-tamil', name: 'Tamil', genre: 'Tamil', songCount: 4800, icon: '🎶' },
    { id: 'featured-telugu', name: 'Telugu', genre: 'Telugu', songCount: 3900, icon: '🎼' },
    { id: 'featured-discover', name: 'Discover', genre: 'Discover', songCount: 76000, icon: '✨' }
];

function renderFeaturedPlaylists() {
    const grid = document.getElementById('featuredPlaylistsGrid');
    if (!grid) return;

    grid.innerHTML = FEATURED_PLAYLISTS.map(playlist => `
        <div class="discover-card featured-card" data-genre="${playlist.genre}" onclick="openFeaturedPlaylist('${playlist.genre}')">
            <div class="discover-card-bg"></div>
            <div class="discover-card-content">
                <div class="discover-card-icon">${playlist.icon}</div>
                <h4 class="discover-card-title">${playlist.name}</h4>
                <span class="discover-card-meta">${playlist.songCount.toLocaleString()}+ songs</span>
            </div>
        </div>
    `).join('');
}

async function openFeaturedPlaylist(genreKey) {
    // Show loading state
    showToast('Loading playlist...');

    try {
        let url;
        if (genreKey === 'Discover') {
            url = `${INDIA_CATALOG_API}/playlist/discover?limit=50`;
        } else if (['Punjabi', 'Tamil', 'Telugu'].includes(genreKey)) {
            const langCode = genreKey === 'Punjabi' ? 'pa' : genreKey === 'Tamil' ? 'ta' : 'te';
            url = `${INDIA_CATALOG_API}/playlist/language/${langCode}?limit=50&shuffle=true`;
        } else {
            url = `${INDIA_CATALOG_API}/playlist/genre/${encodeURIComponent(genreKey)}?limit=50`;
        }

        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load playlist');

        const data = await response.json();
        const songs = (data.songs || []).map(song => ({
            youtube_video_id: song.youtube_video_id || song.video_id,
            title: song.title,
            artist: song.artist,
            artwork_url: song.artwork_url || song.artwork
        }));

        if (songs.length === 0) {
            showToast('No songs found');
            return;
        }

        // Get playlist metadata from FEATURED_PLAYLISTS
        const playlistMeta = FEATURED_PLAYLISTS.find(p => p.genre === genreKey) || {
            name: genreKey,
            songCount: songs.length
        };

        // Create playlist object in expected format
        const playlist = {
            type: 'featured',
            name: playlistMeta.name,
            genre: genreKey,
            total: playlistMeta.songCount || data.total || songs.length,
            songs: songs
        };

        currentCuratedPlaylist = playlist;
        currentCuratedType = 'featured';

        // Display the curated detail view
        showCuratedDetailView(playlist);

    } catch (error) {
        console.error('Error loading featured playlist:', error);
        showToast('Failed to load playlist');
    }
}

function renderMoodPlaylists() {
    const grid = document.getElementById('moodPlaylistsGrid');
    if (!grid) return;

    grid.innerHTML = CURATED_PLAYLISTS.moods.map(mood => `
        <div class="discover-card" data-mood="${mood.mood}" onclick="openCuratedPlaylist('mood', '${mood.id}')">
            <div class="discover-card-bg"></div>
            <div class="discover-card-content">
                <div class="discover-card-icon">${MOOD_ICONS[mood.mood] || ''}</div>
                <h4 class="discover-card-title">${mood.name}</h4>
                <span class="discover-card-meta">${mood.songCount.toLocaleString()} songs</span>
            </div>
        </div>
    `).join('');
}

function renderLanguagePlaylists() {
    const grid = document.getElementById('languagePlaylistsGrid');
    if (!grid) return;

    const musicIcon = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>';

    grid.innerHTML = CURATED_PLAYLISTS.languages.map(lang => `
        <div class="discover-card" data-lang="${lang.lang}" onclick="openCuratedPlaylist('language', '${lang.id}')">
            <div class="discover-card-bg"></div>
            <div class="discover-card-content">
                <div class="discover-card-icon">${musicIcon}</div>
                <h4 class="discover-card-title">${lang.name}</h4>
                <span class="discover-card-meta">${lang.songCount.toLocaleString()} songs</span>
            </div>
        </div>
    `).join('');
}

function renderArtistPlaylists() {
    const scroll = document.getElementById('artistPlaylistsScroll');
    if (!scroll) return;

    const personIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

    scroll.innerHTML = CURATED_PLAYLISTS.artists.map(artist => `
        <div class="artist-card" onclick="openCuratedPlaylist('artist', '${artist.id}')">
            <div class="artist-card-image">${personIcon}</div>
            <div class="artist-card-name">${artist.name}</div>
            <div class="artist-card-count">${artist.songCount} songs</div>
        </div>
    `).join('');
}

function renderEraPlaylists() {
    const grid = document.getElementById('eraPlaylistsGrid');
    if (!grid) return;

    const calendarIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>';

    grid.innerHTML = CURATED_PLAYLISTS.eras.map(era => `
        <div class="discover-card" data-era="${era.era}" onclick="openCuratedPlaylist('era', '${era.id}')">
            <div class="discover-card-bg"></div>
            <div class="discover-card-content">
                <div class="discover-card-icon">${calendarIcon}</div>
                <h4 class="discover-card-title">${era.name}</h4>
                <span class="discover-card-meta">${era.songCount.toLocaleString()} songs</span>
            </div>
        </div>
    `).join('');
}

// Current curated playlist state
let currentCuratedPlaylist = null;
let currentCuratedType = null;

async function openCuratedPlaylist(type, id) {
    // Extract the key from id (e.g., "mood-chill" -> "chill")
    const key = id.replace(`${type}-`, '').replace('lang-', '').replace('artist-', '').replace('era-', '');

    // Show loading state
    showToast('Loading playlist...');

    try {
        // Fetch from API
        const response = await fetch(`${CURATED_API_BASE}/api/curated/${type}/${key}`);

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Curated playlists API not deployed yet');
            }
            throw new Error(`Failed to load playlist: ${response.status}`);
        }

        const playlist = await response.json();
        currentCuratedPlaylist = playlist;
        currentCuratedType = type;

        // Show the curated detail view
        showCuratedDetailView(playlist);

    } catch (error) {
        console.error('Error loading curated playlist:', error);
        showToast(error.message || 'Failed to load playlist. Please try again.');
    }
}

function showCuratedDetailView(playlist) {
    // Hide all other views
    const homeView = document.getElementById('homeView');
    const mainContent = document.getElementById('mainContent');
    const heroSection = document.getElementById('heroSection');
    const playlistsView = document.getElementById('playlistsView');
    const playlistDetailView = document.getElementById('playlistDetailView');
    const favoritesDetailView = document.getElementById('favoritesDetailView');
    const historyDetailView = document.getElementById('historyDetailView');
    const chartDetailView = document.getElementById('chartDetailView');
    const discoverView = document.getElementById('discoverView');
    const curatedDetailView = document.getElementById('curatedDetailView');

    if (homeView) homeView.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
    if (heroSection) heroSection.style.display = 'none';
    if (playlistsView) playlistsView.style.display = 'none';
    if (playlistDetailView) playlistDetailView.style.display = 'none';
    if (favoritesDetailView) favoritesDetailView.style.display = 'none';
    if (historyDetailView) historyDetailView.style.display = 'none';
    if (chartDetailView) chartDetailView.style.display = 'none';
    if (discoverView) discoverView.style.display = 'none';
    if (curatedDetailView) {
        curatedDetailView.style.display = 'block';
        curatedDetailView.scrollTop = 0;
    }

    // Render the detail view
    renderCuratedDetailView(playlist);

    // Apply gradient based on type
    applyCuratedGradient(playlist);

    // Update sidebar
    updateSidebarActiveState('discover');
}

function hideCuratedDetailView() {
    currentCuratedPlaylist = null;
    currentCuratedType = null;

    const curatedDetailView = document.getElementById('curatedDetailView');
    const discoverView = document.getElementById('discoverView');

    if (curatedDetailView) curatedDetailView.style.display = 'none';
    if (discoverView) discoverView.style.display = 'block';

    // Reset gradient
    const mainGradient = document.getElementById('mainGradient');
    if (mainGradient) {
        mainGradient.style.background = 'linear-gradient(180deg, rgba(29, 185, 84, 0.3) 0%, var(--bg-primary) 40%)';
    }
}

function renderCuratedDetailView(playlist) {
    const header = document.getElementById('curatedDetailHeader');
    const content = document.getElementById('curatedDetailSongs');

    if (!header || !content) return;

    // Get icon based on type
    const icon = getCuratedPlaylistIcon(playlist.type, playlist.mood || playlist.language || playlist.era || playlist.genre);

    // Get type label
    const typeLabel = playlist.type.charAt(0).toUpperCase() + playlist.type.slice(1);

    header.innerHTML = `
        <button class="detail-back-btn" onclick="hideCuratedDetailView()" title="Back to Discover">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
        </button>
        <div class="curated-detail-hero">
            <div class="curated-detail-cover">
                ${icon}
            </div>
            <div class="curated-detail-info">
                <span class="curated-detail-type">${typeLabel} Playlist</span>
                <h1 class="curated-detail-name">${escapeHtml(playlist.name)}</h1>
                <p class="curated-detail-meta">${playlist.total.toLocaleString()} songs</p>
                <div class="curated-detail-buttons">
                    <button class="btn-primary" onclick="playCuratedPlaylist()" ${playlist.songs.length === 0 ? 'disabled' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        Play
                    </button>
                    <button class="btn-secondary" onclick="shuffleCuratedPlaylist()" ${playlist.songs.length === 0 ? 'disabled' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="16 3 21 3 21 8"></polyline>
                            <line x1="4" y1="20" x2="21" y2="3"></line>
                            <polyline points="21 16 21 21 16 21"></polyline>
                            <line x1="15" y1="15" x2="21" y2="21"></line>
                            <line x1="4" y1="4" x2="9" y2="9"></line>
                        </svg>
                        Shuffle
                    </button>
                </div>
            </div>
        </div>
    `;

    if (playlist.songs.length === 0) {
        content.innerHTML = `
            <div class="detail-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 18V5l12-2v13"></path>
                    <circle cx="6" cy="18" r="3"></circle>
                    <circle cx="18" cy="16" r="3"></circle>
                </svg>
                <h3>No playable songs found</h3>
                <p>This playlist doesn't have any songs with video IDs yet</p>
            </div>
        `;
        return;
    }

    // Filter to only show songs with video_id
    const playableSongs = playlist.songs.filter(s => s.youtube_video_id);

    content.innerHTML = `
        <div class="detail-song-list">
            ${playableSongs.map((song, index) => {
                const isPlaying = isCurrentlyPlaying(song.youtube_video_id);
                const artworkUrl = getArtworkUrl(song);
                return `
                <div class="detail-song${isPlaying ? ' now-playing' : ''}" data-video-id="${song.youtube_video_id || ''}" onclick="playCuratedSong(${index})">
                    <span class="detail-song-num">${index + 1}</span>
                    ${getNowPlayingEqHtml()}
                    <div class="detail-song-artwork">
                        ${artworkUrl
                            ? `<img src="${artworkUrl}" alt="${escapeHtml(song.title)}">`
                            : '<div class="placeholder"></div>'
                        }
                        <div class="detail-song-play-overlay">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                        </div>
                    </div>
                    <div class="detail-song-info">
                        <span class="detail-song-title">${escapeHtml(song.title)}</span>
                        <span class="detail-song-artist clickable" onclick="event.stopPropagation(); showArtistPage('${escapeHtml(song.artist).replace(/'/g, "\\'")}')">${escapeHtml(song.artist)}</span>
                    </div>
                    <button class="detail-song-add" onclick="event.stopPropagation(); showAddToPlaylistModal({videoId: '${song.youtube_video_id}', title: '${escapeHtml(song.title).replace(/'/g, "\\'")}', artist: '${escapeHtml(song.artist).replace(/'/g, "\\'")}', artwork: '${artworkUrl}'})" title="Add to playlist">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 12H3"></path>
                            <path d="M16 6H3"></path>
                            <path d="M16 18H3"></path>
                            <path d="M18 9v6"></path>
                            <path d="M21 12h-6"></path>
                        </svg>
                    </button>
                </div>
            `}).join('')}
        </div>
        ${playlist.songs.length > playableSongs.length ? `
            <p class="detail-meta" style="text-align: center; margin-top: 1rem; color: var(--text-muted);">
                Showing ${playableSongs.length} playable songs (${playlist.songs.length - playableSongs.length} without video)
            </p>
        ` : ''}
    `;
}

function getCuratedPlaylistIcon(type, key) {
    // Return appropriate icon based on type
    if (type === 'mood' && MOOD_ICONS[key]) {
        return `<div class="curated-icon">${MOOD_ICONS[key]}</div>`;
    }

    // Featured playlist icons (emoji-based)
    if (type === 'featured') {
        const featuredPlaylist = FEATURED_PLAYLISTS.find(p => p.genre === key);
        if (featuredPlaylist) {
            return `<div class="curated-icon featured-emoji">${featuredPlaylist.icon}</div>`;
        }
    }

    // Default icons by type
    const defaultIcons = {
        mood: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
        language: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>',
        artist: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        era: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
        featured: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>',
    };

    return `<div class="curated-icon">${defaultIcons[type] || defaultIcons.featured}</div>`;
}

function applyCuratedGradient(playlist) {
    const mainGradient = document.getElementById('mainGradient');
    if (!mainGradient) return;

    // Color mappings for different types
    const moodColors = {
        'chill': '#4A90D9',
        'workout': '#E63946',
        'party': '#FF6B6B',
        'romance': '#E91E63',
        'sad': '#5C6BC0',
        'focus': '#00BCD4',
        'gaming': '#9C27B0',
        'feel-good': '#FFC107',
        'sleep': '#3F51B5',
        'commute': '#FF9800',
        'energize': '#FFEB3B',
    };

    const langColors = {
        'hindi': '#FF5722',
        'tamil': '#E91E63',
        'telugu': '#9C27B0',
        'punjabi': '#FF9800',
        'english': '#2196F3',
        'bengali': '#4CAF50',
        'kannada': '#673AB7',
        'malayalam': '#009688',
        'bhojpuri': '#795548',
        'marathi': '#FF5722',
        'gujarati': '#FFC107',
        'haryanvi': '#8BC34A',
    };

    const eraColors = {
        '2025': '#1DB954',
        '2024': '#1DB954',
        '2023': '#FF6B6B',
        '2022': '#9C27B0',
        '2010s': '#FF9800',
        'retro': '#795548',
    };

    const featuredColors = {
        'Indian Pop': '#FF6B6B',
        'Bollywood': '#E91E63',
        'Pop': '#2196F3',
        'Hip-Hop/Rap': '#9C27B0',
        'Electronic': '#00BCD4',
        'Rock': '#FF5722',
        'Punjabi': '#FF9800',
        'Tamil': '#E91E63',
        'Telugu': '#673AB7',
        'Discover': '#1DB954',
    };

    let color = '#1DB954'; // Default green

    if (playlist.type === 'mood' && moodColors[playlist.mood]) {
        color = moodColors[playlist.mood];
    } else if (playlist.type === 'language' && langColors[playlist.language]) {
        color = langColors[playlist.language];
    } else if (playlist.type === 'era' && eraColors[playlist.era]) {
        color = eraColors[playlist.era];
    } else if (playlist.type === 'artist') {
        color = '#E91E63'; // Pink for artists
    } else if (playlist.type === 'featured' && featuredColors[playlist.genre]) {
        color = featuredColors[playlist.genre];
    }

    mainGradient.style.background = `linear-gradient(180deg, ${color}40 0%, var(--bg-primary) 40%)`;
}

function playCuratedPlaylist(startIndex = 0) {
    if (!currentCuratedPlaylist || !currentCuratedPlaylist.songs) return;

    const playableSongs = currentCuratedPlaylist.songs.filter(s => s.youtube_video_id);
    if (playableSongs.length === 0) return;

    // Set up queue with curated songs
    queue = playableSongs.map(song => ({
        title: song.title,
        artist: song.artist,
        videoId: song.youtube_video_id,
        artwork: getArtworkUrl(song),
    }));

    // Play starting from specified index
    currentSongIndex = startIndex;
    const song = queue[currentSongIndex];

    if (song) {
        playSongFromQueue(currentSongIndex);
    }
}

function shuffleCuratedPlaylist() {
    if (!currentCuratedPlaylist || !currentCuratedPlaylist.songs) return;

    const playableSongs = currentCuratedPlaylist.songs.filter(s => s.youtube_video_id);
    if (playableSongs.length === 0) return;

    // Shuffle the songs
    const shuffled = [...playableSongs].sort(() => Math.random() - 0.5);

    // Set up queue with shuffled songs
    queue = shuffled.map(song => ({
        title: song.title,
        artist: song.artist,
        videoId: song.youtube_video_id,
        artwork: getArtworkUrl(song),
    }));

    // Play first song
    currentSongIndex = 0;
    playSongFromQueue(0);

    showToast('Shuffling playlist...');
}

function playCuratedSong(index) {
    if (!currentCuratedPlaylist || !currentCuratedPlaylist.songs) return;

    const playableSongs = currentCuratedPlaylist.songs.filter(s => s.youtube_video_id);
    if (index >= playableSongs.length) return;

    // Set up queue and play
    queue = playableSongs.map(song => ({
        title: song.title,
        artist: song.artist,
        videoId: song.youtube_video_id,
        artwork: getArtworkUrl(song),
    }));

    currentSongIndex = index;
    playSongFromQueue(index);
}

// ===========================================
// AI Generated Playlists
// ===========================================

let aiPlaylistPresets = [];
let currentAIPlaylist = null;

// Preset icons mapping
const AI_PRESET_ICONS = {
    // Moods
    'chill_vibes': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>',
    'workout_energy': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    'party_hits': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5.8 11.3L2 22l10.7-3.8"/><path d="M4 3h.01"/><path d="M22 8h.01"/><path d="M15 2h.01"/><path d="M22 20h.01"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10"/><path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11v0c-.11.7-.72 1.22-1.43 1.22H17"/><path d="m11 2 .33.82c.34.86-.2 1.82-1.11 1.98v0C9.52 4.9 9 5.52 9 6.23V7"/><path d="M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z"/></svg>',
    'focus_flow': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    'romantic_mood': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"/></svg>',
    'feel_good': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    'sleep_sounds': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
    'sad_songs': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
    // Genres
    'bollywood_hits': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    'kollywood_beats': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    'tollywood_vibes': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    'punjabi_power': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    'desi_hiphop': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="5.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="15.5" r="2.5"/><path d="M8 17V5l12-2v12"/></svg>',
    'electronic_essentials': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>',
    'pop_playlist': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></svg>',
    'rock_classics': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>',
    'rnb_soul': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"/></svg>',
    'latin_heat': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>',
    'classical_calm': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    // Sub-genres
    'lofi_beats': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>',
    'edm_bangers': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    'kpop_hits': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    // Combo playlists
    'chill_bollywood': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/></svg>',
    'workout_hindi': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
    'party_punjabi': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5.8 11.3L2 22l10.7-3.8"/><path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38"/></svg>',
    'romantic_bollywood': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z"/></svg>',
    'focus_electronic': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>',
    // Decades
    '90s_bollywood': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    '2000s_hits': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    '2010s_anthems': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
    'new_releases': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    // Languages
    'tamil_top': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>',
    'telugu_top': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>',
    'english_hits': '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>',
};

// Preset colors for gradients
const AI_PRESET_COLORS = {
    'chill_vibes': '#4A90D9',
    'workout_energy': '#E63946',
    'party_hits': '#FF6B6B',
    'focus_flow': '#00BCD4',
    'romantic_mood': '#E91E63',
    'feel_good': '#FFC107',
    'sleep_sounds': '#3F51B5',
    'sad_songs': '#5C6BC0',
    'bollywood_hits': '#FF5722',
    'kollywood_beats': '#E91E63',
    'tollywood_vibes': '#9C27B0',
    'punjabi_power': '#FF9800',
    'desi_hiphop': '#607D8B',
    'electronic_essentials': '#00BCD4',
    'pop_playlist': '#E91E63',
    'rock_classics': '#795548',
    'rnb_soul': '#9C27B0',
    'latin_heat': '#FF5722',
    'classical_calm': '#607D8B',
    'lofi_beats': '#9E9E9E',
    'edm_bangers': '#00BCD4',
    'kpop_hits': '#E91E63',
    'chill_bollywood': '#4A90D9',
    'workout_hindi': '#E63946',
    'party_punjabi': '#FF9800',
    'romantic_bollywood': '#E91E63',
    'focus_electronic': '#00BCD4',
    '90s_bollywood': '#FF9800',
    '2000s_hits': '#9C27B0',
    '2010s_anthems': '#2196F3',
    'new_releases': '#1DB954',
    'tamil_top': '#E91E63',
    'telugu_top': '#9C27B0',
    'english_hits': '#2196F3',
};

function showAIGeneratedView() {
    isHomeViewVisible = false;
    isPlaylistPanelVisible = false;
    isSearchViewActive = false;

    // Hide all other views
    const homeView = document.getElementById('homeView');
    const mainContent = document.getElementById('mainContent');
    const heroSection = document.getElementById('heroSection');
    const playlistsView = document.getElementById('playlistsView');
    const playlistDetailView = document.getElementById('playlistDetailView');
    const favoritesDetailView = document.getElementById('favoritesDetailView');
    const historyDetailView = document.getElementById('historyDetailView');
    const chartDetailView = document.getElementById('chartDetailView');
    const discoverView = document.getElementById('discoverView');
    const curatedDetailView = document.getElementById('curatedDetailView');
    const aiGeneratedView = document.getElementById('aiGeneratedView');
    const aiPlaylistDetailView = document.getElementById('aiPlaylistDetailView');
    const searchView = document.getElementById('searchView');

    if (homeView) homeView.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
    if (heroSection) heroSection.style.display = 'none';
    if (playlistsView) playlistsView.style.display = 'none';
    if (playlistDetailView) playlistDetailView.style.display = 'none';
    if (favoritesDetailView) favoritesDetailView.style.display = 'none';
    if (historyDetailView) historyDetailView.style.display = 'none';
    if (chartDetailView) chartDetailView.style.display = 'none';
    if (discoverView) discoverView.style.display = 'none';
    if (curatedDetailView) curatedDetailView.style.display = 'none';
    if (aiPlaylistDetailView) aiPlaylistDetailView.style.display = 'none';
    if (searchView) searchView.style.display = 'none';
    if (aiGeneratedView) aiGeneratedView.style.display = 'block';

    // Update sidebar active state
    updateSidebarActiveState('ai-generated');

    // Close sidebar on mobile
    const sidebar = document.getElementById('sidebar');
    sidebar?.classList.remove('open');

    // Render AI playlists
    renderAIGeneratedView();
}

async function renderAIGeneratedView() {
    const content = document.getElementById('aiGeneratedContent');
    if (!content) return;

    // Show loading state
    content.innerHTML = '<div class="ai-loading"><div class="spinner"></div><p>Loading AI playlists...</p></div>';

    try {
        // Fetch presets from API
        const response = await fetch(`${AI_PLAYLIST_API_BASE}/api/playlists/presets`);
        if (!response.ok) throw new Error('Failed to load presets');

        const data = await response.json();
        aiPlaylistPresets = data.presets || [];

        // Categorize presets
        const categories = categorizePresets(aiPlaylistPresets);

        // Render categories
        content.innerHTML = `
            <!-- Featured: AI Curated Collection -->
            <div class="ai-section ai-featured-section">
                <div class="ai-section-header">
                    <h3>Featured Collection</h3>
                    <span class="ai-section-badge">NEW</span>
                </div>
                <div class="ai-featured-card" onclick="openAICuratedCollection()">
                    <div class="ai-featured-gradient"></div>
                    <div class="ai-featured-content">
                        <div class="ai-featured-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                                <path d="M2 17l10 5 10-5"></path>
                                <path d="M2 12l10 5 10-5"></path>
                            </svg>
                        </div>
                        <div class="ai-featured-info">
                            <h4>AI Curated Collection</h4>
                            <p>525 songs enriched with Gemini AI - featuring genre, mood, era and style metadata</p>
                        </div>
                        <div class="ai-featured-meta">
                            <span class="ai-featured-count">525 songs</span>
                            <span class="ai-featured-arrow">
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M9 18l6-6-6-6"/>
                                </svg>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Mood Playlists -->
            <div class="ai-section">
                <div class="ai-section-header">
                    <h3>Moods & Vibes</h3>
                    <span class="ai-section-count">${categories.moods.length}</span>
                </div>
                <div class="ai-grid">
                    ${categories.moods.map(preset => renderAIPresetCard(preset)).join('')}
                </div>
            </div>

            <!-- Genre Playlists -->
            <div class="ai-section">
                <div class="ai-section-header">
                    <h3>By Genre</h3>
                    <span class="ai-section-count">${categories.genres.length}</span>
                </div>
                <div class="ai-grid">
                    ${categories.genres.map(preset => renderAIPresetCard(preset)).join('')}
                </div>
            </div>

            <!-- Combo Playlists -->
            <div class="ai-section">
                <div class="ai-section-header">
                    <h3>Smart Mixes</h3>
                    <span class="ai-section-count">${categories.combos.length}</span>
                </div>
                <div class="ai-grid">
                    ${categories.combos.map(preset => renderAIPresetCard(preset)).join('')}
                </div>
            </div>

            <!-- Era Playlists -->
            <div class="ai-section">
                <div class="ai-section-header">
                    <h3>By Era</h3>
                    <span class="ai-section-count">${categories.eras.length}</span>
                </div>
                <div class="ai-grid">
                    ${categories.eras.map(preset => renderAIPresetCard(preset)).join('')}
                </div>
            </div>

            <!-- Language Playlists -->
            <div class="ai-section">
                <div class="ai-section-header">
                    <h3>By Language</h3>
                    <span class="ai-section-count">${categories.languages.length}</span>
                </div>
                <div class="ai-grid">
                    ${categories.languages.map(preset => renderAIPresetCard(preset)).join('')}
                </div>
            </div>
        `;

    } catch (error) {
        console.error('Error loading AI playlists:', error);
        content.innerHTML = `
            <div class="ai-error">
                <p>Failed to load AI playlists</p>
                <button onclick="renderAIGeneratedView()">Try Again</button>
            </div>
        `;
    }
}

function categorizePresets(presets) {
    const categories = {
        moods: [],
        genres: [],
        combos: [],
        eras: [],
        languages: [],
    };

    const moodKeys = ['chill_vibes', 'workout_energy', 'party_hits', 'focus_flow', 'romantic_mood', 'feel_good', 'sleep_sounds', 'sad_songs'];
    const genreKeys = ['bollywood_hits', 'kollywood_beats', 'tollywood_vibes', 'punjabi_power', 'desi_hiphop', 'electronic_essentials', 'pop_playlist', 'rock_classics', 'rnb_soul', 'latin_heat', 'classical_calm', 'lofi_beats', 'edm_bangers', 'kpop_hits'];
    const eraKeys = ['90s_bollywood', '2000s_hits', '2010s_anthems', 'new_releases'];
    const languageKeys = ['tamil_top', 'telugu_top', 'english_hits'];

    presets.forEach(preset => {
        if (moodKeys.includes(preset.key)) {
            categories.moods.push(preset);
        } else if (genreKeys.includes(preset.key)) {
            categories.genres.push(preset);
        } else if (eraKeys.includes(preset.key)) {
            categories.eras.push(preset);
        } else if (languageKeys.includes(preset.key)) {
            categories.languages.push(preset);
        } else {
            categories.combos.push(preset);
        }
    });

    return categories;
}

function renderAIPresetCard(preset) {
    const icon = AI_PRESET_ICONS[preset.key] || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
    const color = AI_PRESET_COLORS[preset.key] || '#1DB954';

    return `
        <div class="ai-card" onclick="openAIPlaylist('${preset.key}')" style="--card-color: ${color}">
            <div class="ai-card-bg"></div>
            <div class="ai-card-content">
                <div class="ai-card-icon">${icon}</div>
                <h4 class="ai-card-title">${escapeHtml(preset.name)}</h4>
                <span class="ai-card-meta">${escapeHtml(preset.description)}</span>
            </div>
        </div>
    `;
}

async function openAIPlaylist(presetKey) {
    showToast('Generating playlist...');

    try {
        // First try to get existing playlist
        const preset = aiPlaylistPresets.find(p => p.key === presetKey);
        const playlistName = preset ? preset.name : presetKey;

        let playlist;

        // Try to fetch existing playlist first
        const existingResponse = await fetch(`${AI_PLAYLIST_API_BASE}/api/playlists/${encodeURIComponent(playlistName)}`);

        if (existingResponse.ok) {
            playlist = await existingResponse.json();
        } else {
            // Generate new playlist
            const generateResponse = await fetch(`${AI_PLAYLIST_API_BASE}/api/playlists/generate/${presetKey}?size=50`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({})
            });

            if (!generateResponse.ok) {
                throw new Error('Failed to generate playlist');
            }

            playlist = await generateResponse.json();
        }

        currentAIPlaylist = playlist;
        showAIPlaylistDetailView(playlist, presetKey);

    } catch (error) {
        console.error('Error opening AI playlist:', error);
        showToast('Failed to load playlist. Please try again.');
    }
}

// Open the special AI Curated Collection playlist
async function openAICuratedCollection() {
    showToast('Loading AI Curated Collection...');

    try {
        const response = await fetch(`${AI_PLAYLIST_API_BASE}/api/playlists/AI%20Curated%20Collection`);

        if (!response.ok) {
            throw new Error('Failed to load AI Curated Collection');
        }

        const playlist = await response.json();
        currentAIPlaylist = playlist;
        showAIPlaylistDetailView(playlist, 'ai_curated_collection');

    } catch (error) {
        console.error('Error opening AI Curated Collection:', error);
        showToast('Failed to load collection. Please try again.');
    }
}

function showAIPlaylistDetailView(playlist, presetKey) {
    // Save preset key for re-rendering
    currentAIPresetKey = presetKey;

    // Hide all other views
    const homeView = document.getElementById('homeView');
    const mainContent = document.getElementById('mainContent');
    const heroSection = document.getElementById('heroSection');
    const playlistsView = document.getElementById('playlistsView');
    const playlistDetailView = document.getElementById('playlistDetailView');
    const favoritesDetailView = document.getElementById('favoritesDetailView');
    const historyDetailView = document.getElementById('historyDetailView');
    const chartDetailView = document.getElementById('chartDetailView');
    const discoverView = document.getElementById('discoverView');
    const curatedDetailView = document.getElementById('curatedDetailView');
    const aiGeneratedView = document.getElementById('aiGeneratedView');
    const aiPlaylistDetailView = document.getElementById('aiPlaylistDetailView');

    if (homeView) homeView.style.display = 'none';
    if (mainContent) mainContent.style.display = 'none';
    if (heroSection) heroSection.style.display = 'none';
    if (playlistsView) playlistsView.style.display = 'none';
    if (playlistDetailView) playlistDetailView.style.display = 'none';
    if (favoritesDetailView) favoritesDetailView.style.display = 'none';
    if (historyDetailView) historyDetailView.style.display = 'none';
    if (chartDetailView) chartDetailView.style.display = 'none';
    if (discoverView) discoverView.style.display = 'none';
    if (curatedDetailView) curatedDetailView.style.display = 'none';
    if (aiGeneratedView) aiGeneratedView.style.display = 'none';
    if (aiPlaylistDetailView) {
        aiPlaylistDetailView.style.display = 'block';
        aiPlaylistDetailView.scrollTop = 0;
    }

    // Render the detail view
    renderAIPlaylistDetailView(playlist, presetKey);

    // Apply gradient
    const color = AI_PRESET_COLORS[presetKey] || '#1DB954';
    const mainGradient = document.getElementById('mainGradient');
    if (mainGradient) {
        mainGradient.style.background = `linear-gradient(180deg, ${color}40 0%, var(--bg-primary) 40%)`;
    }

    // Update sidebar
    updateSidebarActiveState('ai-generated');
}

function hideAIPlaylistDetailView() {
    currentAIPlaylist = null;

    const aiPlaylistDetailView = document.getElementById('aiPlaylistDetailView');
    const aiGeneratedView = document.getElementById('aiGeneratedView');

    if (aiPlaylistDetailView) aiPlaylistDetailView.style.display = 'none';
    if (aiGeneratedView) aiGeneratedView.style.display = 'block';

    // Reset gradient
    const mainGradient = document.getElementById('mainGradient');
    if (mainGradient) {
        mainGradient.style.background = 'linear-gradient(180deg, rgba(29, 185, 84, 0.3) 0%, var(--bg-primary) 40%)';
    }
}

function renderAIPlaylistDetailView(playlist, presetKey) {
    const header = document.getElementById('aiPlaylistDetailHeader');
    const content = document.getElementById('aiPlaylistDetailSongs');

    if (!header || !content) return;

    const icon = AI_PRESET_ICONS[presetKey] || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
    const songCount = playlist.songs ? playlist.songs.length : 0;
    const color = AI_PRESET_COLORS[presetKey] || '#1DB954';

    // Render header in chart-detail style
    header.innerHTML = `
        <button class="chart-detail-back" onclick="hideAIPlaylistDetailView()" title="Back to AI Playlists">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
        </button>
        <div class="chart-detail-hero">
            <div class="chart-detail-cover ai-cover" style="background: linear-gradient(135deg, ${color} 0%, color-mix(in srgb, ${color} 50%, #000) 100%);">
                <div class="chart-detail-cover-icon">
                    ${icon}
                    <span class="chart-detail-cover-badge">${songCount} SONGS</span>
                </div>
            </div>
            <div class="chart-detail-info">
                <span class="chart-detail-type">AI Generated Playlist</span>
                <h1 class="chart-detail-name">${escapeHtml(playlist.name)}</h1>
                <div class="chart-detail-meta">
                    <span class="chart-detail-meta-item">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 2L2 7l10 5 10-5-10-5z"></path>
                            <path d="M2 17l10 5 10-5"></path>
                            <path d="M2 12l10 5 10-5"></path>
                        </svg>
                        ${escapeHtml(playlist.description || 'Smart playlist powered by AI')}
                    </span>
                    ${playlist.total_duration_formatted ? `
                    <span class="chart-detail-meta-item">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="12" cy="12" r="10"></circle>
                            <polyline points="12 6 12 12 16 14"></polyline>
                        </svg>
                        ${playlist.total_duration_formatted}
                    </span>
                    ` : ''}
                </div>
                <div class="chart-detail-buttons">
                    <button class="chart-detail-btn primary" onclick="playAIPlaylist(0)" ${songCount === 0 ? 'disabled' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                            <polygon points="5 3 19 12 5 21 5 3"></polygon>
                        </svg>
                        Play All
                    </button>
                    <button class="chart-detail-btn secondary" onclick="shuffleAIPlaylist()" ${songCount === 0 ? 'disabled' : ''}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="16 3 21 3 21 8"></polyline>
                            <line x1="4" y1="20" x2="21" y2="3"></line>
                            <polyline points="21 16 21 21 16 21"></polyline>
                            <line x1="15" y1="15" x2="21" y2="21"></line>
                            <line x1="4" y1="4" x2="9" y2="9"></line>
                        </svg>
                        Shuffle
                    </button>
                </div>
            </div>
        </div>
    `;

    // Render songs in chart-detail style
    if (!playlist.songs || playlist.songs.length === 0) {
        content.innerHTML = `
            <div class="detail-empty">
                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 18V5l12-2v13"></path>
                    <circle cx="6" cy="18" r="3"></circle>
                    <circle cx="18" cy="16" r="3"></circle>
                </svg>
                <p>No songs in this playlist</p>
                <span>Try generating the playlist again</span>
            </div>
        `;
        return;
    }

    content.innerHTML = `
        <div class="chart-detail-songs-header">
            <span>#</span>
            <span>Title</span>
            <span></span>
        </div>
        ${playlist.songs.map((song, index) => {
            const isFavorite = favorites.some(f => f.title === song.title && f.artist === song.artist);
            const hasVideo = !!song.video_id;
            const isPlaying = isCurrentlyPlaying(song.video_id);

            return `
                <div class="chart-song-item${hasVideo ? '' : ' no-video'}${isPlaying ? ' now-playing' : ''}" data-index="${index}">
                    <div class="chart-song-rank">
                        <span class="chart-song-rank-number">${index + 1}</span>
                        ${getNowPlayingEqHtml()}
                    </div>
                    <div class="chart-song-info">
                        <div class="chart-song-artwork">
                            ${song.thumbnail_url
                                ? `<img src="${song.thumbnail_url}" alt="${escapeHtml(song.title)}" loading="lazy" />`
                                : '<div class="chart-song-placeholder"></div>'
                            }
                        </div>
                        <div class="chart-song-details">
                            <span class="chart-song-title">${escapeHtml(song.title)}</span>
                            <span class="chart-song-artist clickable" onclick="event.stopPropagation(); showArtistPage('${escapeHtml(song.artist).replace(/'/g, "\\'")}')">${escapeHtml(song.artist)}</span>
                        </div>
                    </div>
                    <div class="chart-song-actions">
                        <span class="chart-song-duration">${formatDuration(song.duration_seconds)}</span>
                        <button class="chart-song-action-btn ${isFavorite ? 'liked' : ''}" onclick="event.stopPropagation(); toggleAISongFavorite(${index})" title="${isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="${isFavorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2">
                                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
                            </svg>
                        </button>
                    </div>
                </div>
            `;
        }).join('')}
    `;

    // Add click handlers for playing songs
    content.querySelectorAll('.chart-song-item').forEach(item => {
        item.addEventListener('click', () => {
            const index = parseInt(item.dataset.index);
            playAISong(index);
        });
    });
}

// Toggle favorite for AI playlist song
function toggleAISongFavorite(index) {
    if (!currentAIPlaylist || !currentAIPlaylist.songs) return;

    const song = currentAIPlaylist.songs[index];
    if (!song) return;

    const favoriteData = {
        title: song.title,
        artist: song.artist,
        videoId: song.video_id || null,
        artwork: song.thumbnail_url || '',
        addedAt: new Date().toISOString()
    };

    const existingIndex = favorites.findIndex(f => f.title === song.title && f.artist === song.artist);

    if (existingIndex >= 0) {
        favorites.splice(existingIndex, 1);
        showToast('Removed from favorites');
    } else {
        favorites.unshift(favoriteData);
        showToast('Added to favorites');
    }

    saveFavorites();

    // Re-render the detail view to update heart icons
    renderAIPlaylistDetailView(currentAIPlaylist, currentAIPresetKey);
}

// Store current preset key for re-rendering
let currentAIPresetKey = null;

function formatDuration(seconds) {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Play a song from the queue by index (for AI playlists)
function playSongFromQueue(index) {
    if (!queue || !queue[index]) return;

    const song = queue[index];
    if (!song.videoId) {
        showToast('No video available for this song');
        return;
    }

    // Require authentication to play
    if (!requireAuth(() => playSongFromQueue(index))) return;

    currentSongIndex = index;
    isRegionalSongPlaying = true;
    currentPlayingVideoId = song.videoId;

    // Track in history
    addToHistory({ title: song.title, artist: song.artist, youtube_video_id: song.videoId, artwork_url: song.artwork });

    // Update player bar UI
    if (playerBarTitle) playerBarTitle.textContent = song.title;
    if (playerBarArtist) playerBarArtist.textContent = song.artist;
    if (playerBarArtwork && song.artwork) playerBarArtwork.src = song.artwork;

    // Update favorite button state
    updateFavoriteButtons();

    // Apply artwork as gradient background
    if (song.artwork && mainGradient) {
        mainGradient.style.backgroundImage = `url(${song.artwork})`;
        mainGradient.classList.add('active');
    }

    // Update player bar visibility
    updatePlayerBarVisibility();

    // Update now-playing indicators in song lists
    updateNowPlayingIndicators();

    // Play on YouTube
    if (player && playerReady) {
        player.loadVideoById(song.videoId);
    } else if (playerReady) {
        createPlayerWithVideo(song.videoId);
    } else {
        setTimeout(() => playSongFromQueue(index), 100);
    }
}

async function playAIPlaylist(startIndex = 0) {
    if (!currentAIPlaylist || !currentAIPlaylist.songs) return;

    const songs = currentAIPlaylist.songs;
    if (songs.length === 0) return;

    // Set up queue - use video_id from playlist if available
    queue = songs.map(song => ({
        title: song.title,
        artist: song.artist,
        videoId: song.video_id || null,
        artwork: song.thumbnail_url || '',
        needsSearch: !song.video_id,
    }));

    currentSongIndex = startIndex;

    // If song has video_id, play directly; otherwise search
    if (queue[startIndex].videoId) {
        playSongFromQueue(startIndex);
    } else {
        await playAISongBySearch(startIndex);
    }
}

async function shuffleAIPlaylist() {
    if (!currentAIPlaylist || !currentAIPlaylist.songs) return;

    const songs = currentAIPlaylist.songs;
    if (songs.length === 0) return;

    // Shuffle the songs
    const shuffled = [...songs].sort(() => Math.random() - 0.5);

    // Set up queue - use video_id from playlist if available
    queue = shuffled.map(song => ({
        title: song.title,
        artist: song.artist,
        videoId: song.video_id || null,
        artwork: song.thumbnail_url || '',
        needsSearch: !song.video_id,
    }));

    currentSongIndex = 0;
    showToast('Shuffling playlist...');

    // If song has video_id, play directly; otherwise search
    if (queue[0].videoId) {
        playSongFromQueue(0);
    } else {
        await playAISongBySearch(0);
    }
}

async function playAISong(index) {
    if (!currentAIPlaylist || !currentAIPlaylist.songs) return;
    if (index >= currentAIPlaylist.songs.length) return;

    // Set up queue - use video_id from playlist if available
    queue = currentAIPlaylist.songs.map(song => ({
        title: song.title,
        artist: song.artist,
        videoId: song.video_id || null,
        artwork: song.thumbnail_url || '',
        needsSearch: !song.video_id,
    }));

    currentSongIndex = index;

    // If song has video_id, play directly; otherwise search
    if (queue[index].videoId) {
        playSongFromQueue(index);
    } else {
        await playAISongBySearch(index);
    }
}

async function playAISongBySearch(index) {
    const song = queue[index];
    if (!song) return;

    showToast(`Searching for "${song.title}"...`);

    try {
        // First try searching Music Harvester catalog (has video IDs)
        const catalogQuery = `${song.title} ${song.artist}`;
        const catalogResponse = await fetch(`${AI_PLAYLIST_API_BASE}/api/catalog/songs?q=${encodeURIComponent(catalogQuery)}&per_page=5`);

        if (catalogResponse.ok) {
            const catalogData = await catalogResponse.json();
            if (catalogData.songs && catalogData.songs.length > 0) {
                // Find best match by comparing titles
                const matchedSong = catalogData.songs.find(s =>
                    s.title.toLowerCase().includes(song.title.toLowerCase().substring(0, 10)) ||
                    song.title.toLowerCase().includes(s.title.toLowerCase().substring(0, 10))
                ) || catalogData.songs[0];

                if (matchedSong.platforms?.youtube_music?.video_id) {
                    song.videoId = matchedSong.platforms.youtube_music.video_id;
                    song.artwork = matchedSong.platforms.youtube_music.thumbnails?.[1]?.url ||
                                   matchedSong.platforms.youtube_music.thumbnails?.[0]?.url || '';

                    // Update queue
                    queue[index] = song;

                    // Play the song
                    playSongFromQueue(index);
                    return;
                }
            }
        }

        // Fallback: Try TLDR Music API search
        const response = await fetch(`${API_BASE}/search?q=${encodeURIComponent(catalogQuery)}&limit=1`);

        if (response.ok) {
            const results = await response.json();
            if (results.songs && results.songs.length > 0) {
                const found = results.songs[0];
                song.videoId = found.youtube_video_id || found.video_id;
                song.artwork = getArtworkUrl(found);

                // Update queue
                queue[index] = song;

                // Play the song
                if (song.videoId) {
                    playSongFromQueue(index);
                    return;
                }
            }
        }

        // If all searches fail, use YouTube iframe search
        showToast(`Playing "${song.title}"...`);
        searchAndPlayOnYouTube(song.title, song.artist);

    } catch (error) {
        console.error('Error searching for song:', error);
        showToast('Failed to find song. Trying YouTube...');
        searchAndPlayOnYouTube(song.title, song.artist);
    }
}

function searchAndPlayOnYouTube(title, artist) {
    // Open YouTube Music search as fallback
    const searchQuery = encodeURIComponent(`${title} ${artist}`);

    // Update player bar to show the song info
    if (playerBarTitle) playerBarTitle.textContent = title;
    if (playerBarArtist) playerBarArtist.textContent = artist;

    // Open YouTube Music search in new tab
    window.open(`https://music.youtube.com/search?q=${searchQuery}`, '_blank');
    showToast(`Opening YouTube Music to play "${title}"`);
}

