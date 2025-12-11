// TLDR Music - Frontend Application

const API_BASE = 'https://tldrmusic-api-401132033262.asia-south1.run.app';
const DATA_PATH = './current.json'; // Fallback for local development

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
let progressInterval = null;
let isHeroVisible = true;
let heroObserver = null;
let currentChartMode = 'india';  // 'india' or 'global'
let currentPlayingVideoId = null;  // Track currently playing video ID for global/regional

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
    await loadChartData();
    setupEventListeners();
}

// Load chart data from API (with fallback to local JSON)
async function loadChartData() {
    try {
        // Try API first
        const response = await fetch(`${API_BASE}/chart/current`);
        if (!response.ok) throw new Error('API request failed');
        chartData = await response.json();
        console.log('Loaded chart data from API');
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

// Render hero section with #1 song
function renderHero() {
    if (!chartData || !chartData.chart || !chartData.chart[0]) return;

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
    // Mark that we're playing a regional song
    isRegionalSongPlaying = true;
    currentPlayingVideoId = videoId;  // Track the video ID
    currentSongIndex = -1; // Reset main chart index

    // Update player bar UI
    if (playerBarTitle) playerBarTitle.textContent = title;
    if (playerBarArtist) playerBarArtist.textContent = artist;
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
                <span class="score">${song.score.toFixed(1)}</span>
                ${rankMovement}
                ${viewsText ? `<span>${viewsText} views</span>` : ''}
            </div>
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

    // Update toggle button states
    chartToggle?.querySelectorAll('.toggle-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.chart === mode);
    });

    // Update badge label and page title
    if (badgeLabel) {
        badgeLabel.textContent = mode === 'india' ? 'India Top 25' : 'Global Top 25';
    }
    document.title = mode === 'india' ? "TLDR Music - India's Top 25" : "TLDR Music - Global Top 25";

    // Update hero label
    const heroLabel = document.querySelector('.hero-label');
    if (heroLabel && currentSongIndex < 0) {
        heroLabel.textContent = mode === 'india' ? "This Week's #1" : "Global #1";
    }

    // Update chart section header
    const chartHeader = document.querySelector('.chart-section .chart-header h3');
    if (chartHeader) {
        chartHeader.textContent = mode === 'india' ? 'Quick Picks' : 'Global Charts';
    }

    // Re-render chart with appropriate data
    if (mode === 'india') {
        renderHero();
        renderChart();
        // Show regional section for India mode
        if (regionalSection) regionalSection.style.display = 'block';
    } else {
        renderGlobalHero();
        renderGlobalMainChart();
        // Hide regional section for Global mode
        if (regionalSection) regionalSection.style.display = 'none';
    }
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
    if (!chartData || !chartData.chart[index]) return;

    const song = chartData.chart[index];

    if (!song.youtube_video_id) {
        showPlayerError();
        return;
    }

    // Reset regional song flag and video ID when playing main chart song
    isRegionalSongPlaying = false;
    currentPlayingVideoId = null;

    // Close theater mode if active (stops theater player, skip resume since new song will play)
    if (isTheaterMode) {
        closeTheaterMode(true);
    }

    updateNowPlaying(index);

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
        // Auto play next
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
    if (chartData && currentSongIndex < chartData.chart.length - 1) {
        playSong(currentSongIndex + 1);
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
            if (currentSongIndex === -1 && chartData.chart.length > 0) {
                e.preventDefault();
                playSong(0);
            }
            break;
        case 'l':
        case 'L':
            e.preventDefault();
            toggleLyrics();
            break;
        case 'Escape':
            if (isTheaterMode) {
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
