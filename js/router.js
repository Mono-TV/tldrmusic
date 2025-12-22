// TLDR Music - Hash-Based SPA Router
// Enables seamless navigation without page reloads
// Player persists across all view changes

(function() {
    'use strict';

    // Route definitions (hash paths)
    const routes = {
        '': 'home',
        '/': 'home',
        '/charts': 'charts',
        '/charts/india': 'charts-india',
        '/charts/global': 'charts-global',
        '/library': 'library',
        '/library/favorites': 'favorites',
        '/library/history': 'history',
        '/library/playlist': 'playlist',
        '/search': 'search',
        '/discover': 'discover',
        '/discover/playlist': 'discover-playlist'
    };

    // Regional chart routes
    const regionalLanguages = ['hindi', 'tamil', 'telugu', 'punjabi', 'bengali', 'marathi', 'kannada', 'malayalam', 'bhojpuri', 'haryanvi', 'gujarati'];
    regionalLanguages.forEach(lang => {
        routes[`/charts/${lang}`] = `charts-regional-${lang}`;
    });

    // Current route state
    let currentRoute = null;

    // Parse hash into route and params
    function parseHash() {
        const hash = window.location.hash.slice(1) || '/'; // Remove # prefix
        const [path, queryString] = hash.split('?');
        const params = new URLSearchParams(queryString || '');

        return {
            path: path || '/',
            params: params,
            full: hash
        };
    }

    // Get route name from path
    function getRouteName(path) {
        // Exact match first
        if (routes[path]) {
            return routes[path];
        }

        // Check for parameterized routes
        // /library/playlist/abc123 -> playlist with id abc123
        if (path.startsWith('/library/playlist/')) {
            return 'playlist';
        }
        if (path.startsWith('/discover/playlist/')) {
            return 'discover-playlist';
        }

        // Regional charts: /charts/hindi, /charts/tamil, etc.
        const regionalMatch = path.match(/^\/charts\/([a-z]+)$/);
        if (regionalMatch && regionalLanguages.includes(regionalMatch[1])) {
            return `charts-regional-${regionalMatch[1]}`;
        }

        // Default to home
        return 'home';
    }

    // Extract ID from path
    function extractId(path) {
        // /library/playlist/abc123 -> abc123
        const playlistMatch = path.match(/^\/library\/playlist\/(.+)$/);
        if (playlistMatch) return playlistMatch[1];

        // /discover/playlist/chill-vibes -> chill-vibes
        const discoverMatch = path.match(/^\/discover\/playlist\/(.+)$/);
        if (discoverMatch) return discoverMatch[1];

        return null;
    }

    // Navigate to a hash route (call this from app.js)
    function navigate(path, replace = false) {
        const newHash = '#' + path;
        if (replace) {
            history.replaceState(null, '', newHash);
        } else {
            history.pushState(null, '', newHash);
        }
        handleRouteChange();
    }

    // Handle route changes
    function handleRouteChange() {
        const { path, params } = parseHash();
        const route = getRouteName(path);
        const id = extractId(path) || params.get('id');

        // Avoid re-executing same route
        const routeKey = `${route}:${id || ''}`;
        if (routeKey === currentRoute) {
            return;
        }
        currentRoute = routeKey;

        console.log(`[Router] Hash: ${path}, Route: ${route}, ID: ${id || 'none'}`);

        executeRoute(route, id, params);
    }

    // Execute the route
    function executeRoute(route, id, params) {
        // Wait for app.js to be ready
        if (typeof showHomeView !== 'function') {
            setTimeout(() => executeRoute(route, id, params), 50);
            return;
        }

        switch (route) {
            case 'home':
                showHomeView();
                break;

            case 'charts':
                showChartsView();
                break;

            case 'charts-india':
                showChartsView();
                setTimeout(() => {
                    if (typeof openChartFromChartsView === 'function') {
                        openChartFromChartsView('india');
                    } else if (typeof renderChartDetailFromChartsView === 'function' && typeof chartData !== 'undefined') {
                        const chartMeta = { name: 'India Top 25', region: 'india', gradient: ['#f97316', '#ea580c'] };
                        if (chartData?.chart) {
                            renderChartDetailFromChartsView(chartMeta, chartData);
                        }
                    }
                }, 300);
                break;

            case 'charts-global':
                showChartsView();
                setTimeout(() => {
                    if (typeof openChartFromChartsView === 'function') {
                        openChartFromChartsView('global');
                    } else if (typeof renderChartDetailFromChartsView === 'function' && typeof chartData !== 'undefined') {
                        const chartMeta = { name: 'Global Top 25', region: 'global', gradient: ['#3b82f6', '#2563eb'] };
                        if (chartData?.global_chart) {
                            renderChartDetailFromChartsView(chartMeta, { chart: chartData.global_chart });
                        }
                    }
                }, 300);
                break;

            case 'library':
                showPlaylistsView();
                break;

            case 'favorites':
                showFavoritesDetail();
                break;

            case 'history':
                showHistoryDetail();
                break;

            case 'playlist':
                if (id) {
                    showPlaylistDetail(id);
                } else {
                    showPlaylistsView();
                }
                break;

            case 'search':
                const query = params.get('q') || '';
                showSearchView(query);
                break;

            case 'discover':
                showAIGeneratedView();
                break;

            case 'discover-playlist':
                if (id) {
                    // Check if it's a preset key or playlist name
                    if (typeof showCuratedDetailView === 'function') {
                        // Try to find the playlist
                        showCuratedDetailView({ slug: id, name: id.replace(/-/g, ' ') });
                    } else if (typeof showAIPlaylistDetailView === 'function') {
                        showAIPlaylistDetailView(id);
                    }
                } else {
                    showAIGeneratedView();
                }
                break;

            default:
                // Handle regional charts
                if (route.startsWith('charts-regional-')) {
                    const lang = route.replace('charts-regional-', '');
                    showChartsView();
                    setTimeout(() => {
                        if (typeof openRegionalChartFromChartsView === 'function') {
                            openRegionalChartFromChartsView(lang);
                        }
                    }, 300);
                } else {
                    showHomeView();
                }
        }

        // Update sidebar active state
        updateSidebarActive(route);

        // Update document title
        updatePageTitle(route, id);
    }

    // Update sidebar active state based on route
    function updateSidebarActive(route) {
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
        } else if (route.startsWith('discover')) {
            activeId = 'sidebarDiscoverBtn';
        }

        // Add active class
        const activeBtn = document.getElementById(activeId);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }

    // Update page title based on route
    function updatePageTitle(route, id) {
        const titles = {
            'home': 'TLDR Music - India\'s Top Charts',
            'charts': 'Charts - TLDR Music',
            'charts-india': 'India Top 25 - TLDR Music',
            'charts-global': 'Global Top 25 - TLDR Music',
            'library': 'Library - TLDR Music',
            'favorites': 'Liked Songs - TLDR Music',
            'history': 'Recently Played - TLDR Music',
            'playlist': 'Playlist - TLDR Music',
            'search': 'Search - TLDR Music',
            'discover': 'Discover - TLDR Music',
            'discover-playlist': 'Playlist - TLDR Music'
        };

        let title = titles[route] || 'TLDR Music';

        // Add regional chart name
        if (route.startsWith('charts-regional-')) {
            const lang = route.replace('charts-regional-', '');
            title = `${lang.charAt(0).toUpperCase() + lang.slice(1)} Charts - TLDR Music`;
        }

        document.title = title;
    }

    // Intercept link clicks for SPA navigation
    function setupLinkInterception() {
        document.addEventListener('click', (e) => {
            // Find closest anchor tag
            const link = e.target.closest('a[href^="#/"]');
            if (!link) return;

            // Get the hash path
            const href = link.getAttribute('href');
            if (href && href.startsWith('#/')) {
                e.preventDefault();
                const path = href.slice(1); // Remove # prefix
                navigate(path);
            }
        });
    }

    // Handle browser back/forward
    function setupPopState() {
        window.addEventListener('popstate', () => {
            currentRoute = null; // Reset to allow re-execution
            handleRouteChange();
        });
    }

    // Handle hash changes (for direct hash modifications)
    function setupHashChange() {
        window.addEventListener('hashchange', () => {
            currentRoute = null; // Reset to allow re-execution
            handleRouteChange();
        });
    }

    // Redirect old paths to hash routes (for backward compatibility)
    function handleLegacyPaths() {
        const path = window.location.pathname;

        // If we're on a non-root path without hash, redirect to hash route
        if (path !== '/' && path !== '/index.html' && !window.location.hash) {
            // Map old paths to hash routes
            const pathMap = {
                '/charts/': '#/charts',
                '/charts/index.html': '#/charts',
                '/charts/india': '#/charts/india',
                '/charts/india.html': '#/charts/india',
                '/charts/global': '#/charts/global',
                '/charts/global.html': '#/charts/global',
                '/library/': '#/library',
                '/library/index.html': '#/library',
                '/search/': '#/search',
                '/search/index.html': '#/search',
                '/discover/': '#/discover',
                '/discover/index.html': '#/discover'
            };

            const hashRoute = pathMap[path];
            if (hashRoute) {
                // Redirect to hash route on index.html
                window.location.replace('/' + hashRoute);
                return true;
            }
        }
        return false;
    }

    // Initialize router
    function init() {
        // Check for legacy path redirects
        if (handleLegacyPaths()) {
            return; // Will redirect, don't continue
        }

        // Setup event handlers
        setupLinkInterception();
        setupPopState();
        setupHashChange();

        // Initial route
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', handleRouteChange);
        } else {
            handleRouteChange();
        }
    }

    // Expose navigate function globally
    window.navigate = navigate;

    // Expose parseHash for use in app.js if needed
    window.getHashParams = () => parseHash().params;
    window.getHashPath = () => parseHash().path;

    // Start router
    init();
})();
