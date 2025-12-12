/**
 * TLDR Music - localStorage Features Test Suite
 *
 * Test cases for: Favorites, Queue, History, Shuffle, Repeat
 *
 * Run in browser console or via test.html
 */

const TestRunner = {
    passed: 0,
    failed: 0,
    results: [],

    // Mock song data for testing
    mockSongs: [
        { title: 'Test Song 1', artist: 'Artist A', youtube_video_id: 'abc123', artwork_url: 'http://example.com/1.jpg' },
        { title: 'Test Song 2', artist: 'Artist B', youtube_video_id: 'def456', artwork_url: 'http://example.com/2.jpg' },
        { title: 'Test Song 3', artist: 'Artist C', youtube_video_id: 'ghi789', artwork_url: 'http://example.com/3.jpg' },
        { title: 'Test Song 4', artist: 'Artist D', youtube_video_id: 'jkl012', artwork_url: 'http://example.com/4.jpg' },
        { title: 'Test Song 5', artist: 'Artist E', youtube_video_id: 'mno345', artwork_url: 'http://example.com/5.jpg' }
    ],

    // Store original functions for restoration
    originalFunctions: {},

    // Clear all localStorage before tests
    setup() {
        console.log('🧪 Setting up test environment...');
        localStorage.removeItem(STORAGE_KEYS.FAVORITES);
        localStorage.removeItem(STORAGE_KEYS.HISTORY);
        localStorage.removeItem(STORAGE_KEYS.QUEUE);
        localStorage.removeItem(STORAGE_KEYS.SHUFFLE);
        localStorage.removeItem(STORAGE_KEYS.REPEAT);

        // Reset state variables
        favorites = [];
        playHistory = [];
        queue = [];
        isShuffleOn = false;
        repeatMode = 'off';
    },

    // Mock UI functions that would fail without DOM elements
    mockUIFunctions() {
        // Store originals
        this.originalFunctions = {
            showToast: typeof showToast !== 'undefined' ? showToast : null,
            updateFavoriteButtons: typeof updateFavoriteButtons !== 'undefined' ? updateFavoriteButtons : null,
            renderFavoritesSection: typeof renderFavoritesSection !== 'undefined' ? renderFavoritesSection : null,
            updateQueueBadge: typeof updateQueueBadge !== 'undefined' ? updateQueueBadge : null,
            renderQueuePanel: typeof renderQueuePanel !== 'undefined' ? renderQueuePanel : null,
            updateRepeatButton: typeof updateRepeatButton !== 'undefined' ? updateRepeatButton : null,
            renderHistoryPanel: typeof renderHistoryPanel !== 'undefined' ? renderHistoryPanel : null
        };

        // Replace with no-op mocks
        if (typeof window !== 'undefined') {
            window.showToast = () => {};
            window.updateFavoriteButtons = () => {};
            window.renderFavoritesSection = () => {};
            window.updateQueueBadge = () => {};
            window.renderQueuePanel = () => {};
            window.updateRepeatButton = () => {};
            window.renderHistoryPanel = () => {};
        }
    },

    // Restore original UI functions
    restoreUIFunctions() {
        if (typeof window !== 'undefined') {
            for (const [name, fn] of Object.entries(this.originalFunctions)) {
                if (fn) window[name] = fn;
            }
        }
    },

    // Assertion helpers
    assert(condition, testName) {
        if (condition) {
            this.passed++;
            this.results.push({ name: testName, status: 'PASS' });
            console.log(`  ✅ ${testName}`);
        } else {
            this.failed++;
            this.results.push({ name: testName, status: 'FAIL' });
            console.log(`  ❌ ${testName}`);
        }
    },

    assertEqual(actual, expected, testName) {
        const condition = JSON.stringify(actual) === JSON.stringify(expected);
        if (!condition) {
            console.log(`     Expected: ${JSON.stringify(expected)}`);
            console.log(`     Actual: ${JSON.stringify(actual)}`);
        }
        this.assert(condition, testName);
    },

    // Run all tests
    async runAll() {
        console.log('\n🎵 TLDR Music Test Suite\n' + '='.repeat(40));
        this.passed = 0;
        this.failed = 0;
        this.results = [];

        // Mock UI functions before running tests
        this.mockUIFunctions();

        try {
            this.testFavorites();
            this.testQueue();
            this.testHistory();
            this.testShuffle();
            this.testRepeat();
            this.testLocalStoragePersistence();
            this.testEdgeCases();
        } finally {
            // Restore original functions
            this.restoreUIFunctions();
        }

        console.log('\n' + '='.repeat(40));
        console.log(`📊 Results: ${this.passed} passed, ${this.failed} failed`);
        console.log('='.repeat(40) + '\n');

        return { passed: this.passed, failed: this.failed, results: this.results };
    },

    // ==================== FAVORITES TESTS ====================
    testFavorites() {
        console.log('\n📌 FAVORITES TESTS');
        this.setup();

        // Test 1: Add song to favorites
        const song1 = this.mockSongs[0];
        toggleFavorite(song1);
        this.assert(favorites.length === 1, 'Add song to favorites');
        this.assertEqual(favorites[0].title, song1.title, 'Favorite has correct title');
        this.assertEqual(favorites[0].artist, song1.artist, 'Favorite has correct artist');

        // Test 2: Check isSongFavorite returns true
        this.assert(isSongFavorite(song1) === true, 'isSongFavorite returns true for favorited song');

        // Test 3: Check isSongFavorite returns false for non-favorite
        this.assert(isSongFavorite(this.mockSongs[1]) === false, 'isSongFavorite returns false for non-favorited song');

        // Test 4: Toggle removes from favorites
        toggleFavorite(song1);
        this.assert(favorites.length === 0, 'Toggle removes song from favorites');
        this.assert(isSongFavorite(song1) === false, 'isSongFavorite returns false after removal');

        // Test 5: Multiple favorites
        toggleFavorite(this.mockSongs[0]);
        toggleFavorite(this.mockSongs[1]);
        toggleFavorite(this.mockSongs[2]);
        this.assert(favorites.length === 3, 'Can add multiple favorites');

        // Test 6: Remove middle favorite
        toggleFavorite(this.mockSongs[1]);
        this.assert(favorites.length === 2, 'Remove middle favorite reduces count');
        this.assert(isSongFavorite(this.mockSongs[0]) === true, 'First favorite still exists');
        this.assert(isSongFavorite(this.mockSongs[2]) === true, 'Third favorite still exists');

        // Test 7: Favorites saved to localStorage
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.FAVORITES));
        this.assert(stored.length === 2, 'Favorites persisted to localStorage');
    },

    // ==================== QUEUE TESTS ====================
    testQueue() {
        console.log('\n📋 QUEUE TESTS');
        this.setup();

        // Test 1: Add to queue (end)
        addToQueue(this.mockSongs[0], false);
        this.assert(queue.length === 1, 'Add song to queue');
        this.assertEqual(queue[0].title, this.mockSongs[0].title, 'Queue item has correct title');

        // Test 2: Add multiple to queue
        addToQueue(this.mockSongs[1], false);
        addToQueue(this.mockSongs[2], false);
        this.assert(queue.length === 3, 'Add multiple songs to queue');
        this.assertEqual(queue[2].title, this.mockSongs[2].title, 'Songs added in order');

        // Test 3: Play next (add to front)
        addToQueue(this.mockSongs[3], true);
        this.assertEqual(queue[0].title, this.mockSongs[3].title, 'Play next adds to front of queue');
        this.assert(queue.length === 4, 'Queue length increased');

        // Test 4: Play from queue
        const nextSong = playFromQueue();
        this.assertEqual(nextSong.title, this.mockSongs[3].title, 'playFromQueue returns first item');
        this.assert(queue.length === 3, 'playFromQueue removes item from queue');

        // Test 5: Play from empty queue
        this.setup();
        const emptyResult = playFromQueue();
        this.assert(emptyResult === null, 'playFromQueue returns null for empty queue');

        // Test 6: Clear queue
        addToQueue(this.mockSongs[0], false);
        addToQueue(this.mockSongs[1], false);
        clearQueue();
        this.assert(queue.length === 0, 'clearQueue empties the queue');

        // Test 7: Remove specific item from queue
        // Note: Date.now() ids may collide, so we set them manually
        queue = [
            { title: 'Song A', artist: 'Artist A', id: 1001 },
            { title: 'Song B', artist: 'Artist B', id: 1002 },
            { title: 'Song C', artist: 'Artist C', id: 1003 }
        ];
        removeFromQueue(1002);
        this.assert(queue.length === 2, 'removeFromQueue removes specific item');
        this.assertEqual(queue[0].title, 'Song A', 'First item unchanged');
        this.assertEqual(queue[1].title, 'Song C', 'Last item moved up');

        // Test 8: Queue saved to localStorage (removeFromQueue calls saveQueue)
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.QUEUE));
        this.assert(stored && stored.length === 2, 'Queue persisted to localStorage');
    },

    // ==================== HISTORY TESTS ====================
    testHistory() {
        console.log('\n📜 HISTORY TESTS');
        this.setup();

        // Test 1: Add to history
        addToHistory(this.mockSongs[0]);
        this.assert(playHistory.length === 1, 'Add song to history');
        this.assertEqual(playHistory[0].title, this.mockSongs[0].title, 'History item has correct title');

        // Test 2: History has playedAt timestamp
        this.assert(typeof playHistory[0].playedAt === 'number', 'History item has playedAt timestamp');

        // Test 3: Most recent at front
        addToHistory(this.mockSongs[1]);
        this.assertEqual(playHistory[0].title, this.mockSongs[1].title, 'Most recent song at front');
        this.assertEqual(playHistory[1].title, this.mockSongs[0].title, 'Previous song moved back');

        // Test 4: Duplicate moves to front (no duplicates)
        addToHistory(this.mockSongs[0]);
        this.assert(playHistory.length === 2, 'Duplicate does not increase count');
        this.assertEqual(playHistory[0].title, this.mockSongs[0].title, 'Duplicate moved to front');

        // Test 5: History limit (50 max)
        this.setup();
        for (let i = 0; i < 55; i++) {
            addToHistory({
                title: `Song ${i}`,
                artist: `Artist ${i}`,
                youtube_video_id: `vid${i}`,
                artwork_url: `http://example.com/${i}.jpg`
            });
        }
        this.assert(playHistory.length === 50, 'History capped at 50 items');
        this.assertEqual(playHistory[0].title, 'Song 54', 'Most recent song kept');
        this.assertEqual(playHistory[49].title, 'Song 5', 'Oldest songs removed');

        // Test 6: History saved to localStorage
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY));
        this.assert(stored.length === 50, 'History persisted to localStorage');
    },

    // ==================== SHUFFLE TESTS ====================
    testShuffle() {
        console.log('\n🔀 SHUFFLE TESTS');
        this.setup();

        // Test 1: Initial state is off
        this.assert(isShuffleOn === false, 'Shuffle initially off');

        // Test 2: Toggle on
        toggleShuffle();
        this.assert(isShuffleOn === true, 'Toggle turns shuffle on');

        // Test 3: Toggle off
        toggleShuffle();
        this.assert(isShuffleOn === false, 'Toggle turns shuffle off');

        // Test 4: Saved to localStorage
        toggleShuffle();
        this.assertEqual(localStorage.getItem(STORAGE_KEYS.SHUFFLE), 'true', 'Shuffle state saved to localStorage');

        toggleShuffle();
        this.assertEqual(localStorage.getItem(STORAGE_KEYS.SHUFFLE), 'false', 'Shuffle off state saved');
    },

    // ==================== REPEAT TESTS ====================
    testRepeat() {
        console.log('\n🔁 REPEAT TESTS');
        this.setup();

        // Test 1: Initial state is off
        this.assertEqual(repeatMode, 'off', 'Repeat initially off');

        // Test 2: Cycle to 'all'
        cycleRepeat();
        this.assertEqual(repeatMode, 'all', 'First cycle sets repeat all');

        // Test 3: Cycle to 'one'
        cycleRepeat();
        this.assertEqual(repeatMode, 'one', 'Second cycle sets repeat one');

        // Test 4: Cycle back to 'off'
        cycleRepeat();
        this.assertEqual(repeatMode, 'off', 'Third cycle returns to off');

        // Test 5: Saved to localStorage
        cycleRepeat();
        this.assertEqual(localStorage.getItem(STORAGE_KEYS.REPEAT), 'all', 'Repeat mode saved to localStorage');
    },

    // ==================== PERSISTENCE TESTS ====================
    testLocalStoragePersistence() {
        console.log('\n💾 PERSISTENCE TESTS');
        this.setup();

        // Set up some state
        toggleFavorite(this.mockSongs[0]);
        toggleFavorite(this.mockSongs[1]);
        addToQueue(this.mockSongs[2], false);
        addToHistory(this.mockSongs[3]);
        toggleShuffle();
        cycleRepeat();
        cycleRepeat(); // Now 'one'

        // Clear in-memory state
        favorites = [];
        playHistory = [];
        queue = [];
        isShuffleOn = false;
        repeatMode = 'off';

        // Test 1: Load from localStorage
        loadUserData();
        this.assert(favorites.length === 2, 'Favorites loaded from localStorage');
        this.assert(queue.length === 1, 'Queue loaded from localStorage');
        this.assert(playHistory.length === 1, 'History loaded from localStorage');
        this.assert(isShuffleOn === true, 'Shuffle loaded from localStorage');
        this.assertEqual(repeatMode, 'one', 'Repeat mode loaded from localStorage');
    },

    // ==================== EDGE CASES ====================
    testEdgeCases() {
        console.log('\n⚠️ EDGE CASE TESTS');
        this.setup();

        // Test 1: Toggle favorite with null song (should not crash)
        let crashed = false;
        try {
            toggleFavorite(null);
        } catch (e) {
            crashed = true;
        }
        this.assert(!crashed, 'toggleFavorite handles null gracefully');

        // Test 2: isSongFavorite with undefined
        this.assert(isSongFavorite(undefined) === false, 'isSongFavorite handles undefined');

        // Test 3: addToQueue with minimal song data
        addToQueue({ title: 'Minimal', artist: 'Test' }, false);
        this.assert(queue.length === 1, 'addToQueue handles minimal song data');

        // Test 4: Corrupted localStorage data
        localStorage.setItem(STORAGE_KEYS.FAVORITES, 'not-valid-json');
        loadUserData();
        this.assert(Array.isArray(favorites), 'loadUserData handles corrupted data');

        // Test 5: Empty string in localStorage
        localStorage.setItem(STORAGE_KEYS.QUEUE, '');
        loadUserData();
        this.assert(Array.isArray(queue), 'loadUserData handles empty string');

        // Test 6: Remove from empty queue
        this.setup();
        crashed = false;
        try {
            removeFromQueue(12345);
        } catch (e) {
            crashed = true;
        }
        this.assert(!crashed, 'removeFromQueue handles non-existent ID');

        // Test 7: Song with special characters in title
        const specialSong = { title: "Test's \"Special\" Song & More!", artist: 'Artist <script>' };
        toggleFavorite(specialSong);
        this.assert(isSongFavorite(specialSong), 'Handles special characters in song data');
    }
};

// Export for use in test.html
if (typeof window !== 'undefined') {
    window.TestRunner = TestRunner;
}
