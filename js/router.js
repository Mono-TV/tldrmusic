// TLDR Music - Page Router
// Auto-shows the correct view based on URL path
// Works with existing app.js functions

(function() {
    'use strict';

    // Player state persistence keys
    const PLAYER_STATE_KEY = 'tldr-player-state';

    // Route definitions
    const routes = {
        '/': 'home',
        '/index.html': 'home',
        '/charts/': 'charts',
        '/charts/index.html': 'charts',
        '/charts/india': 'charts-india',
        '/charts/india.html': 'charts-india',
        '/charts/global': 'charts-global',
        '/charts/global.html': 'charts-global',
        '/library/': 'library',
        '/library/index.html': 'library',
        '/library/favorites': 'favorites',
        '/library/favorites.html': 'favorites',
        '/library/history': 'history',
        '/library/history.html': 'history',
        '/library/playlist': 'playlist',
        '/library/playlist.html': 'playlist',
        '/search/': 'search',
        '/search/index.html': 'search',
        '/ai/': 'ai',
        '/ai/index.html': 'ai',
        '/ai/playlist': 'ai-playlist',
        '/ai/playlist.html': 'ai-playlist'
    };

    // Regional chart routes
    const regionalLanguages = ['hindi', 'tamil', 'telugu', 'punjabi', 'bengali', 'marathi', 'kannada', 'malayalam', 'bhojpuri', 'haryanvi', 'gujarati'];
    regionalLanguages.forEach(lang => {
        routes[`/charts/${lang}`] = `charts-regional-${lang}`;
        routes[`/charts/${lang}.html`] = `charts-regional-${lang}`;
    });

    // Save player state before page unload
    function savePlayerState() {
        if (typeof player === 'undefined' || !player) return;

        try {
            const state = {
                videoId: typeof currentPlayingVideoId !== 'undefined' ? currentPlayingVideoId : null,
                title: document.getElementById('playerBarTitle')?.textContent || '',
                artist: document.getElementById('playerBarArtist')?.textContent || '',
                artwork: document.getElementById('playerBarArtwork')?.src || '',
                position: player.getCurrentTime ? player.getCurrentTime() : 0,
                isPlaying: typeof isPlaying !== 'undefined' ? isPlaying : false,
                queue: typeof queue !== 'undefined' ? queue : [],
                queueIndex: typeof currentSongIndex !== 'undefined' ? currentSongIndex : -1,
                timestamp: Date.now()
            };
            localStorage.setItem(PLAYER_STATE_KEY, JSON.stringify(state));
        } catch (e) {
            console.warn('Failed to save player state:', e);
        }
    }

    // Restore player state on page load
    function restorePlayerState() {
        try {
            const stateStr = localStorage.getItem(PLAYER_STATE_KEY);
            if (!stateStr) return;

            const state = JSON.parse(stateStr);

            // Only restore if state is recent (within 5 minutes)
            if (Date.now() - state.timestamp > 5 * 60 * 1000) {
                localStorage.removeItem(PLAYER_STATE_KEY);
                return;
            }

            // Clear the saved state immediately to prevent loops
            localStorage.removeItem(PLAYER_STATE_KEY);

            if (!state.videoId || !state.isPlaying) return;

            // Wait for player to be ready, then restore
            const checkPlayer = setInterval(() => {
                if (typeof playerReady !== 'undefined' && playerReady && typeof player !== 'undefined') {
                    clearInterval(checkPlayer);

                    // Update player bar UI
                    const playerBarTitle = document.getElementById('playerBarTitle');
                    const playerBarArtist = document.getElementById('playerBarArtist');
                    const playerBarArtwork = document.getElementById('playerBarArtwork');

                    if (playerBarTitle) playerBarTitle.textContent = state.title;
                    if (playerBarArtist) playerBarArtist.textContent = state.artist;
                    if (playerBarArtwork) playerBarArtwork.src = state.artwork;

                    // Restore queue if available
                    if (state.queue && state.queue.length > 0 && typeof queue !== 'undefined') {
                        window.queue = state.queue;
                    }

                    // Load and play the video
                    if (typeof playRegionalSongDirect === 'function') {
                        playRegionalSongDirect(state.title, state.artist, state.videoId, state.artwork);

                        // Seek to position after a short delay
                        setTimeout(() => {
                            if (player && player.seekTo) {
                                player.seekTo(state.position, true);
                            }
                        }, 1000);
                    }
                }
            }, 100);

            // Clear interval after 10 seconds if player never becomes ready
            setTimeout(() => clearInterval(checkPlayer), 10000);
        } catch (e) {
            console.warn('Failed to restore player state:', e);
        }
    }

    // Route to the appropriate view
    function routeToView() {
        const path = window.location.pathname;
        const route = routes[path] || routes[path + '/'] || 'home';

        console.log(`[Router] Path: ${path}, Route: ${route}`);

        // Wait for app.js to be ready
        const checkReady = setInterval(() => {
            if (typeof showHomeView === 'function') {
                clearInterval(checkReady);
                executeRoute(route);
            }
        }, 50);

        // Timeout after 5 seconds
        setTimeout(() => clearInterval(checkReady), 5000);
    }

    // Execute the route
    function executeRoute(route) {
        switch (route) {
            case 'home':
                if (typeof showHomeView === 'function') showHomeView();
                break;

            case 'charts':
                if (typeof showChartsView === 'function') showChartsView();
                break;

            case 'charts-india':
                if (typeof showChartsView === 'function') showChartsView();
                // Show India chart detail after charts view loads
                setTimeout(() => {
                    if (typeof renderChartDetailFromChartsView === 'function') {
                        const chartMeta = { name: 'India Top 25', region: 'india', gradient: ['#f97316', '#ea580c'] };
                        if (typeof chartData !== 'undefined' && chartData?.chart) {
                            renderChartDetailFromChartsView(chartMeta, chartData);
                        }
                    }
                }, 500);
                break;

            case 'charts-global':
                if (typeof showChartsView === 'function') showChartsView();
                setTimeout(() => {
                    if (typeof renderChartDetailFromChartsView === 'function') {
                        const chartMeta = { name: 'Global Top 25', region: 'global', gradient: ['#3b82f6', '#2563eb'] };
                        if (typeof chartData !== 'undefined' && chartData?.global_chart) {
                            renderChartDetailFromChartsView(chartMeta, { chart: chartData.global_chart });
                        }
                    }
                }, 500);
                break;

            case 'library':
                if (typeof showPlaylistsView === 'function') showPlaylistsView();
                break;

            case 'favorites':
                if (typeof showFavoritesDetail === 'function') showFavoritesDetail();
                break;

            case 'history':
                if (typeof showHistoryDetail === 'function') showHistoryDetail();
                break;

            case 'playlist':
                const playlistId = new URLSearchParams(window.location.search).get('id');
                if (playlistId && typeof showPlaylistDetail === 'function') {
                    showPlaylistDetail(playlistId);
                } else if (typeof showPlaylistsView === 'function') {
                    showPlaylistsView();
                }
                break;

            case 'search':
                if (typeof showSearchView === 'function') showSearchView();
                break;

            case 'ai':
                if (typeof showAIGeneratedView === 'function') showAIGeneratedView();
                break;

            case 'ai-playlist':
                const aiPlaylistId = new URLSearchParams(window.location.search).get('id');
                if (aiPlaylistId && typeof showAIPlaylistDetailView === 'function') {
                    showAIPlaylistDetailView(aiPlaylistId);
                } else if (typeof showAIGeneratedView === 'function') {
                    showAIGeneratedView();
                }
                break;

            default:
                // Handle regional charts
                if (route.startsWith('charts-regional-')) {
                    const lang = route.replace('charts-regional-', '');
                    if (typeof showChartsView === 'function') showChartsView();
                    // Regional chart handling would go here
                } else {
                    if (typeof showHomeView === 'function') showHomeView();
                }
        }

        // Update sidebar active state
        updateSidebarForRoute(route);
    }

    // Update sidebar active state based on route
    function updateSidebarForRoute(route) {
        // Remove all active states
        document.querySelectorAll('.sidebar-nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // Determine which sidebar item should be active
        let activeId = 'sidebarHomeBtn';
        if (route.startsWith('charts')) {
            activeId = 'sidebarChartsBtn';
        } else if (route.startsWith('library') || route === 'favorites' || route === 'history' || route === 'playlist') {
            activeId = 'sidebarPlaylistsBtn';
        } else if (route === 'search') {
            activeId = 'sidebarSearchBtn';
        } else if (route.startsWith('ai')) {
            activeId = 'sidebarAIGeneratedBtn';
        }

        // Add active class
        const activeBtn = document.getElementById(activeId);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }

    // Initialize router
    function init() {
        // Save state before leaving
        window.addEventListener('beforeunload', savePlayerState);

        // Also save on visibility change (for mobile)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                savePlayerState();
            }
        });

        // Route to view after DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                routeToView();
                restorePlayerState();
            });
        } else {
            routeToView();
            restorePlayerState();
        }
    }

    // Start router
    init();
})();
