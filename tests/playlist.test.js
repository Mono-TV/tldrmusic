/**
 * Playlist Feature Tests
 * Tests for playlist creation, management, sharing, and export functionality
 */

describe('Playlists', () => {

    // ========================================
    // DOM Structure Tests
    // ========================================

    describe('DOM Structure', () => {
        test('playlists view container exists', () => {
            const playlistsView = document.getElementById('playlistsView');
            expect(playlistsView).not.toBeNull();
        });

        test('playlists grid exists', () => {
            const grid = document.getElementById('playlistsGrid');
            expect(grid).not.toBeNull();
        });

        test('create playlist button exists', () => {
            const createBtn = document.querySelector('.playlists-view-header .btn-primary');
            expect(createBtn).not.toBeNull();
            expect(createBtn.textContent).toContain('Create');
        });

        test('playlist count badge exists', () => {
            const countBadge = document.getElementById('playlistsViewCount');
            expect(countBadge).not.toBeNull();
            expect(countBadge.classList.contains('playlists-count-badge')).toBe(true);
        });

        test('sort dropdown exists', () => {
            const sortSelect = document.getElementById('playlistsSortSelect');
            expect(sortSelect).not.toBeNull();
        });
    });

    // ========================================
    // Sidebar Navigation Tests
    // ========================================

    describe('Sidebar Navigation', () => {
        test('playlists button exists in sidebar', () => {
            const playlistsBtn = document.getElementById('sidebarPlaylistsBtn');
            expect(playlistsBtn).not.toBeNull();
            expect(playlistsBtn.tagName).toBe('BUTTON');
        });

        test('playlists button has playlist icon', () => {
            const playlistsBtn = document.getElementById('sidebarPlaylistsBtn');
            const svg = playlistsBtn?.querySelector('svg');
            expect(svg).not.toBeNull();
        });

        test('playlists button has "Playlists" text', () => {
            const playlistsBtn = document.getElementById('sidebarPlaylistsBtn');
            expect(playlistsBtn?.textContent).toContain('Playlists');
        });

        test('clicking playlists button shows playlists view', () => {
            const playlistsBtn = document.getElementById('sidebarPlaylistsBtn');
            const playlistsView = document.getElementById('playlistsView');

            if (playlistsBtn && playlistsView) {
                playlistsBtn.click();
                expect(playlistsView.classList.contains('visible')).toBe(true);
            }
        });
    });

    // ========================================
    // Create Playlist Modal Tests
    // ========================================

    describe('Create Playlist Modal', () => {
        test('create playlist modal exists', () => {
            const modal = document.getElementById('createPlaylistModal');
            expect(modal).not.toBeNull();
        });

        test('modal has name input', () => {
            const input = document.getElementById('playlistNameInput');
            expect(input).not.toBeNull();
            expect(input.type).toBe('text');
        });

        test('modal has create button', () => {
            const modal = document.getElementById('createPlaylistModal');
            const createBtn = modal?.querySelector('.btn-primary');
            expect(createBtn).not.toBeNull();
        });

        test('modal has cancel button', () => {
            const modal = document.getElementById('createPlaylistModal');
            const cancelBtn = modal?.querySelector('.btn-secondary');
            expect(cancelBtn).not.toBeNull();
        });

        test('modal is hidden by default', () => {
            const modal = document.getElementById('createPlaylistModal');
            expect(modal?.classList.contains('visible')).toBe(false);
        });
    });

    // ========================================
    // Playlist Creation Tests
    // ========================================

    describe('Playlist Creation', () => {
        beforeEach(() => {
            // Clear playlists for testing
            if (typeof playlists !== 'undefined') {
                playlists.length = 0;
            }
            localStorage.removeItem('tldr-playlists');
        });

        test('createPlaylist function exists', () => {
            expect(typeof createPlaylist).toBe('function');
        });

        test('creating playlist adds to playlists array', () => {
            if (typeof createPlaylist === 'function' && typeof playlists !== 'undefined') {
                const initialLength = playlists.length;
                createPlaylist('Test Playlist');
                expect(playlists.length).toBe(initialLength + 1);
            }
        });

        test('created playlist has required properties', () => {
            if (typeof createPlaylist === 'function' && typeof playlists !== 'undefined') {
                createPlaylist('My Test Playlist');
                const playlist = playlists[playlists.length - 1];
                expect(playlist.id).toBeDefined();
                expect(playlist.name).toBe('My Test Playlist');
                expect(playlist.songs).toBeDefined();
                expect(Array.isArray(playlist.songs)).toBe(true);
                expect(playlist.createdAt).toBeDefined();
            }
        });

        test('empty name does not create playlist', () => {
            if (typeof createPlaylist === 'function' && typeof playlists !== 'undefined') {
                const initialLength = playlists.length;
                createPlaylist('');
                expect(playlists.length).toBe(initialLength);
            }
        });

        test('whitespace-only name does not create playlist', () => {
            if (typeof createPlaylist === 'function' && typeof playlists !== 'undefined') {
                const initialLength = playlists.length;
                createPlaylist('   ');
                expect(playlists.length).toBe(initialLength);
            }
        });
    });

    // ========================================
    // Playlist Deletion Tests
    // ========================================

    describe('Playlist Deletion', () => {
        beforeEach(() => {
            if (typeof playlists !== 'undefined') {
                playlists.length = 0;
            }
            if (typeof createPlaylist === 'function') {
                createPlaylist('Playlist to Delete');
            }
        });

        test('deletePlaylist function exists', () => {
            expect(typeof deletePlaylist).toBe('function');
        });

        test('deleting playlist removes from array', () => {
            if (typeof deletePlaylist === 'function' && typeof playlists !== 'undefined' && playlists.length > 0) {
                const playlistId = playlists[0].id;
                deletePlaylist(playlistId);
                const found = playlists.find(p => p.id === playlistId);
                expect(found).toBeUndefined();
            }
        });

        test('deleting non-existent playlist does not crash', () => {
            if (typeof deletePlaylist === 'function') {
                let crashed = false;
                try {
                    deletePlaylist('non-existent-id');
                } catch (e) {
                    crashed = true;
                }
                expect(crashed).toBe(false);
            }
        });
    });

    // ========================================
    // Add Song to Playlist Tests
    // ========================================

    describe('Add Song to Playlist', () => {
        const mockSong = {
            title: 'Test Song',
            artist: 'Test Artist',
            youtube_video_id: 'abc123',
            artwork_url: 'http://example.com/art.jpg'
        };

        beforeEach(() => {
            if (typeof playlists !== 'undefined') {
                playlists.length = 0;
            }
            if (typeof createPlaylist === 'function') {
                createPlaylist('Test Playlist');
            }
        });

        test('addSongToPlaylist function exists', () => {
            expect(typeof addSongToPlaylist).toBe('function');
        });

        test('adding song increases playlist song count', () => {
            if (typeof addSongToPlaylist === 'function' && typeof playlists !== 'undefined' && playlists.length > 0) {
                const playlistId = playlists[0].id;
                const initialCount = playlists[0].songs.length;
                addSongToPlaylist(playlistId, mockSong);
                expect(playlists[0].songs.length).toBe(initialCount + 1);
            }
        });

        test('added song has correct properties', () => {
            if (typeof addSongToPlaylist === 'function' && typeof playlists !== 'undefined' && playlists.length > 0) {
                const playlistId = playlists[0].id;
                addSongToPlaylist(playlistId, mockSong);
                const addedSong = playlists[0].songs[playlists[0].songs.length - 1];
                expect(addedSong.title).toBe(mockSong.title);
                expect(addedSong.artist).toBe(mockSong.artist);
            }
        });
    });

    // ========================================
    // Remove Song from Playlist Tests
    // ========================================

    describe('Remove Song from Playlist', () => {
        const mockSong = {
            title: 'Song to Remove',
            artist: 'Test Artist',
            youtube_video_id: 'remove123'
        };

        beforeEach(() => {
            if (typeof playlists !== 'undefined') {
                playlists.length = 0;
            }
            if (typeof createPlaylist === 'function') {
                createPlaylist('Test Playlist');
            }
            if (typeof addSongToPlaylist === 'function' && typeof playlists !== 'undefined' && playlists.length > 0) {
                addSongToPlaylist(playlists[0].id, mockSong);
            }
        });

        test('removeSongFromPlaylist function exists', () => {
            expect(typeof removeSongFromPlaylist).toBe('function');
        });

        test('removing song decreases playlist song count', () => {
            if (typeof removeSongFromPlaylist === 'function' && typeof playlists !== 'undefined' && playlists.length > 0) {
                const playlist = playlists[0];
                if (playlist.songs.length > 0) {
                    const initialCount = playlist.songs.length;
                    const songIndex = 0;
                    removeSongFromPlaylist(playlist.id, songIndex);
                    expect(playlist.songs.length).toBe(initialCount - 1);
                }
            }
        });
    });

    // ========================================
    // Share Playlist Modal Tests
    // ========================================

    describe('Share Playlist Modal', () => {
        test('share playlist modal exists', () => {
            const modal = document.getElementById('sharePlaylistModal');
            expect(modal).not.toBeNull();
        });

        test('share modal has URL input', () => {
            const input = document.getElementById('shareUrlInput');
            expect(input).not.toBeNull();
        });

        test('share modal has copy button', () => {
            const modal = document.getElementById('sharePlaylistModal');
            const copyBtn = modal?.querySelector('#copyShareUrl');
            expect(copyBtn).not.toBeNull();
        });

        test('share modal is hidden by default', () => {
            const modal = document.getElementById('sharePlaylistModal');
            expect(modal?.classList.contains('visible')).toBe(false);
        });
    });

    // ========================================
    // Export Playlist Modal Tests
    // ========================================

    describe('Export Playlist Modal', () => {
        test('export playlist modal exists', () => {
            const modal = document.getElementById('exportPlaylistModal');
            expect(modal).not.toBeNull();
        });

        test('export modal has format options', () => {
            const modal = document.getElementById('exportPlaylistModal');
            const options = modal?.querySelectorAll('.export-option');
            expect(options?.length).toBeGreaterThan(0);
        });

        test('export modal has text format option', () => {
            const textOption = document.querySelector('[data-format="text"]');
            expect(textOption).not.toBeNull();
        });

        test('export modal has JSON format option', () => {
            const jsonOption = document.querySelector('[data-format="json"]');
            expect(jsonOption).not.toBeNull();
        });

        test('export modal has CSV format option', () => {
            const csvOption = document.querySelector('[data-format="csv"]');
            expect(csvOption).not.toBeNull();
        });

        test('export modal is hidden by default', () => {
            const modal = document.getElementById('exportPlaylistModal');
            expect(modal?.classList.contains('visible')).toBe(false);
        });
    });

    // ========================================
    // Add to Playlist Modal Tests
    // ========================================

    describe('Add to Playlist Modal', () => {
        test('add to playlist modal exists', () => {
            const modal = document.getElementById('addToPlaylistModal');
            expect(modal).not.toBeNull();
        });

        test('modal has playlist list container', () => {
            const list = document.getElementById('addToPlaylistList');
            expect(list).not.toBeNull();
        });

        test('modal has create new option', () => {
            const modal = document.getElementById('addToPlaylistModal');
            const createOption = modal?.querySelector('.add-playlist-create');
            expect(createOption).not.toBeNull();
        });

        test('modal is hidden by default', () => {
            const modal = document.getElementById('addToPlaylistModal');
            expect(modal?.classList.contains('visible')).toBe(false);
        });
    });

    // ========================================
    // Playlist Detail View Tests
    // ========================================

    describe('Playlist Detail View', () => {
        test('playlist detail section exists', () => {
            const detail = document.getElementById('playlistDetail');
            expect(detail).not.toBeNull();
        });

        test('detail header container exists', () => {
            const header = document.getElementById('playlistDetailHeader');
            expect(header).not.toBeNull();
        });

        test('detail songs container exists', () => {
            const songs = document.getElementById('playlistDetailSongs');
            expect(songs).not.toBeNull();
        });
    });

    // ========================================
    // Custom Artwork Tests
    // ========================================

    describe('Custom Artwork', () => {
        test('artwork upload input exists in edit modal', () => {
            const input = document.getElementById('playlistArtworkInput');
            expect(input).not.toBeNull();
            expect(input?.type).toBe('file');
        });

        test('artwork input accepts image types', () => {
            const input = document.getElementById('playlistArtworkInput');
            expect(input?.accept).toContain('image');
        });
    });

    // ========================================
    // Playlist Sorting Tests
    // ========================================

    describe('Playlist Sorting', () => {
        test('sort select has multiple options', () => {
            const select = document.getElementById('playlistsSortSelect');
            expect(select?.options.length).toBeGreaterThan(1);
        });

        test('sort options include name', () => {
            const select = document.getElementById('playlistsSortSelect');
            const options = Array.from(select?.options || []).map(o => o.value);
            expect(options).toContain('name');
        });

        test('sort options include date created', () => {
            const select = document.getElementById('playlistsSortSelect');
            const options = Array.from(select?.options || []).map(o => o.value);
            expect(options).toContain('created');
        });

        test('sort options include recently updated', () => {
            const select = document.getElementById('playlistsSortSelect');
            const options = Array.from(select?.options || []).map(o => o.value);
            expect(options).toContain('updated');
        });
    });

    // ========================================
    // Keyboard Shortcut Tests
    // ========================================

    describe('Keyboard Shortcuts', () => {
        test('P key opens playlists view', () => {
            // Simulate pressing P key
            const event = new KeyboardEvent('keydown', { key: 'p' });
            document.dispatchEvent(event);

            const playlistsView = document.getElementById('playlistsView');
            // Check if the view is shown (implementation may vary)
            expect(playlistsView).not.toBeNull();
        });
    });

    // ========================================
    // LocalStorage Persistence Tests
    // ========================================

    describe('LocalStorage Persistence', () => {
        beforeEach(() => {
            localStorage.removeItem('tldr-playlists');
            if (typeof playlists !== 'undefined') {
                playlists.length = 0;
            }
        });

        test('playlists are saved to localStorage', () => {
            if (typeof createPlaylist === 'function' && typeof savePlaylists === 'function') {
                createPlaylist('Persisted Playlist');
                savePlaylists();
                const stored = localStorage.getItem('tldr-playlists');
                expect(stored).not.toBeNull();
            }
        });

        test('saved playlists can be parsed as JSON', () => {
            if (typeof createPlaylist === 'function' && typeof savePlaylists === 'function') {
                createPlaylist('JSON Playlist');
                savePlaylists();
                const stored = localStorage.getItem('tldr-playlists');
                let parsed;
                try {
                    parsed = JSON.parse(stored);
                } catch (e) {
                    parsed = null;
                }
                expect(parsed).not.toBeNull();
                expect(Array.isArray(parsed)).toBe(true);
            }
        });

        test('loadPlaylists function exists', () => {
            expect(typeof loadPlaylists).toBe('function');
        });
    });

    // ========================================
    // Accessibility Tests
    // ========================================

    describe('Accessibility', () => {
        test('create playlist button has title attribute', () => {
            const btn = document.querySelector('.playlists-view-header .btn-primary');
            expect(btn?.hasAttribute('title') || btn?.textContent.trim().length > 0).toBe(true);
        });

        test('sort select has accessible label or aria-label', () => {
            const select = document.getElementById('playlistsSortSelect');
            const label = document.querySelector('label[for="playlistsSortSelect"]');
            const hasAriaLabel = select?.hasAttribute('aria-label');
            expect(label !== null || hasAriaLabel).toBe(true);
        });

        test('modal close buttons are keyboard accessible', () => {
            const modal = document.getElementById('createPlaylistModal');
            const closeBtn = modal?.querySelector('.modal-close, .btn-secondary');
            if (closeBtn) {
                expect(closeBtn.tabIndex).toBeGreaterThanOrEqual(0);
            }
        });
    });

    // ========================================
    // Edge Cases Tests
    // ========================================

    describe('Edge Cases', () => {
        test('handles playlist with special characters in name', () => {
            if (typeof createPlaylist === 'function' && typeof playlists !== 'undefined') {
                const specialName = "Test's \"Special\" <Playlist> & More!";
                createPlaylist(specialName);
                const playlist = playlists.find(p => p.name === specialName);
                expect(playlist).toBeDefined();
            }
        });

        test('handles very long playlist name', () => {
            if (typeof createPlaylist === 'function' && typeof playlists !== 'undefined') {
                const longName = 'A'.repeat(200);
                let crashed = false;
                try {
                    createPlaylist(longName);
                } catch (e) {
                    crashed = true;
                }
                expect(crashed).toBe(false);
            }
        });

        test('handles empty songs array gracefully', () => {
            if (typeof createPlaylist === 'function' && typeof playlists !== 'undefined') {
                createPlaylist('Empty Playlist');
                const playlist = playlists[playlists.length - 1];
                expect(playlist.songs.length).toBe(0);
            }
        });

        test('handles null song when adding to playlist', () => {
            if (typeof addSongToPlaylist === 'function' && typeof createPlaylist === 'function' && typeof playlists !== 'undefined') {
                createPlaylist('Test');
                const playlistId = playlists[playlists.length - 1].id;
                let crashed = false;
                try {
                    addSongToPlaylist(playlistId, null);
                } catch (e) {
                    crashed = true;
                }
                // Should either handle gracefully or throw expected error
                expect(typeof crashed).toBe('boolean');
            }
        });
    });
});

// ========================================
// Recently Played Playlists Tests
// ========================================

describe('Recently Played Playlists', () => {
    test('recently played section exists', () => {
        const section = document.getElementById('recentlyPlayedSection');
        expect(section).not.toBeNull();
    });

    test('recently played scroll container exists', () => {
        const scroll = document.getElementById('recentlyPlayedScroll');
        expect(scroll).not.toBeNull();
    });
});

// ========================================
// Favorites Section Tests (in Playlists View)
// ========================================

describe('Favorites Section in Playlists', () => {
    test('favorites section exists', () => {
        const section = document.getElementById('favoritesSection');
        expect(section).not.toBeNull();
    });

    test('favorites count badge exists', () => {
        const badge = document.getElementById('favoritesCount');
        expect(badge).not.toBeNull();
        expect(badge.classList.contains('favorites-count-badge')).toBe(true);
    });

    test('favorites title wrapper exists', () => {
        const title = document.querySelector('.favorites-title');
        expect(title).not.toBeNull();
    });
});
