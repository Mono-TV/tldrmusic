/**
 * Sidebar Feature Tests
 * Tests for the collapsible sidebar with liquid glass design
 */

describe('Sidebar', () => {

    // ========================================
    // DOM Structure Tests
    // ========================================

    describe('DOM Structure', () => {
        test('sidebar element exists', () => {
            const sidebar = document.getElementById('sidebar');
            expect(sidebar).not.toBeNull();
            expect(sidebar.tagName).toBe('ASIDE');
            expect(sidebar.classList.contains('sidebar')).toBe(true);
        });

        test('sidebar has inner container with glass styling', () => {
            const sidebarInner = document.querySelector('.sidebar-inner');
            expect(sidebarInner).not.toBeNull();
        });

        test('sidebar has close/toggle button', () => {
            const toggleBtn = document.getElementById('sidebarToggle');
            expect(toggleBtn).not.toBeNull();
            expect(toggleBtn.tagName).toBe('BUTTON');
        });

        test('sidebar has navigation section', () => {
            const nav = document.querySelector('.sidebar-nav');
            expect(nav).not.toBeNull();
        });

        test('sidebar has India Top 25 button', () => {
            const indiaBtn = document.getElementById('sidebarIndiaBtn');
            expect(indiaBtn).not.toBeNull();
            expect(indiaBtn.dataset.chart).toBe('india');
            expect(indiaBtn.textContent).toContain('India Top 25');
        });

        test('sidebar has Global Top 25 button', () => {
            const globalBtn = document.getElementById('sidebarGlobalBtn');
            expect(globalBtn).not.toBeNull();
            expect(globalBtn.dataset.chart).toBe('global');
            expect(globalBtn.textContent).toContain('Global Top 25');
        });

        test('sidebar has footer section', () => {
            const footer = document.querySelector('.sidebar-footer');
            expect(footer).not.toBeNull();
        });

        test('sidebar footer has "Refer to a friend" button', () => {
            const shareBtn = document.getElementById('shareBtn');
            expect(shareBtn).not.toBeNull();
            expect(shareBtn.closest('.sidebar-footer')).not.toBeNull();
            expect(shareBtn.textContent).toContain('Refer to a friend');
        });

        test('sidebar footer has About link', () => {
            const aboutLink = document.querySelector('.sidebar-footer a[href="about.html"]');
            expect(aboutLink).not.toBeNull();
            expect(aboutLink.textContent).toContain('About');
        });
    });

    // ========================================
    // Header Menu Button Tests
    // ========================================

    describe('Header Menu Button', () => {
        test('hamburger menu button exists in header', () => {
            const menuBtn = document.getElementById('headerMenuBtn');
            expect(menuBtn).not.toBeNull();
            expect(menuBtn.tagName).toBe('BUTTON');
        });

        test('hamburger menu button is inside header brand section', () => {
            const menuBtn = document.getElementById('headerMenuBtn');
            const brand = menuBtn.closest('.brand');
            expect(brand).not.toBeNull();
        });

        test('hamburger menu button has menu icon (SVG)', () => {
            const menuBtn = document.getElementById('headerMenuBtn');
            const svg = menuBtn.querySelector('svg');
            expect(svg).not.toBeNull();
        });
    });

    // ========================================
    // Toggle Functionality Tests
    // ========================================

    describe('Toggle Functionality', () => {
        let sidebar;
        let headerMenuBtn;
        let sidebarToggle;

        beforeEach(() => {
            sidebar = document.getElementById('sidebar');
            headerMenuBtn = document.getElementById('headerMenuBtn');
            sidebarToggle = document.getElementById('sidebarToggle');
            // Reset sidebar state
            sidebar.classList.remove('open');
        });

        test('sidebar is closed by default (no "open" class)', () => {
            expect(sidebar.classList.contains('open')).toBe(false);
        });

        test('clicking header menu button opens sidebar', () => {
            headerMenuBtn.click();
            expect(sidebar.classList.contains('open')).toBe(true);
        });

        test('clicking header menu button toggles sidebar (open -> close)', () => {
            sidebar.classList.add('open');
            headerMenuBtn.click();
            expect(sidebar.classList.contains('open')).toBe(false);
        });

        test('clicking header menu button toggles sidebar (close -> open)', () => {
            sidebar.classList.remove('open');
            headerMenuBtn.click();
            expect(sidebar.classList.contains('open')).toBe(true);
        });

        test('clicking close button inside sidebar closes it', () => {
            sidebar.classList.add('open');
            sidebarToggle.click();
            expect(sidebar.classList.contains('open')).toBe(false);
        });
    });

    // ========================================
    // Chart Navigation Tests
    // ========================================

    describe('Chart Navigation', () => {
        let indiaBtn;
        let globalBtn;

        beforeEach(() => {
            indiaBtn = document.getElementById('sidebarIndiaBtn');
            globalBtn = document.getElementById('sidebarGlobalBtn');
        });

        test('India button has active class by default', () => {
            expect(indiaBtn.classList.contains('active')).toBe(true);
        });

        test('Global button does not have active class by default', () => {
            expect(globalBtn.classList.contains('active')).toBe(false);
        });

        test('clicking Global button updates active state', () => {
            globalBtn.click();
            // Wait for state update
            expect(globalBtn.classList.contains('active')).toBe(true);
            expect(indiaBtn.classList.contains('active')).toBe(false);
        });

        test('clicking India button updates active state', () => {
            // First switch to global
            globalBtn.click();
            // Then switch back to India
            indiaBtn.click();
            expect(indiaBtn.classList.contains('active')).toBe(true);
            expect(globalBtn.classList.contains('active')).toBe(false);
        });

        test('sidebar stays open after selecting chart option', () => {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.add('open');
            globalBtn.click();
            expect(sidebar.classList.contains('open')).toBe(true);
        });
    });

    // ========================================
    // Styling Tests
    // ========================================

    describe('Styling', () => {
        test('sidebar has correct z-index (below header)', () => {
            const sidebar = document.getElementById('sidebar');
            const computedStyle = window.getComputedStyle(sidebar);
            const zIndex = parseInt(computedStyle.zIndex);
            expect(zIndex).toBeLessThan(100); // Header z-index is 100
        });

        test('sidebar is positioned below header (top: 80px)', () => {
            const sidebar = document.getElementById('sidebar');
            const computedStyle = window.getComputedStyle(sidebar);
            expect(computedStyle.top).toBe('80px');
        });

        test('sidebar inner has backdrop-filter for glass effect', () => {
            const sidebarInner = document.querySelector('.sidebar-inner');
            const computedStyle = window.getComputedStyle(sidebarInner);
            expect(computedStyle.backdropFilter).toContain('blur');
        });

        test('sidebar inner has border-radius', () => {
            const sidebarInner = document.querySelector('.sidebar-inner');
            const computedStyle = window.getComputedStyle(sidebarInner);
            expect(computedStyle.borderRadius).toBe('20px');
        });

        test('sidebar is hidden off-screen when closed', () => {
            const sidebar = document.getElementById('sidebar');
            sidebar.classList.remove('open');
            const computedStyle = window.getComputedStyle(sidebar);
            expect(computedStyle.transform).toContain('translateX');
        });
    });

    // ========================================
    // Accessibility Tests
    // ========================================

    describe('Accessibility', () => {
        test('sidebar toggle button has title attribute', () => {
            const toggleBtn = document.getElementById('sidebarToggle');
            expect(toggleBtn.hasAttribute('title')).toBe(true);
        });

        test('header menu button has title attribute', () => {
            const menuBtn = document.getElementById('headerMenuBtn');
            expect(menuBtn.hasAttribute('title')).toBe(true);
        });

        test('navigation buttons are focusable', () => {
            const indiaBtn = document.getElementById('sidebarIndiaBtn');
            const globalBtn = document.getElementById('sidebarGlobalBtn');
            expect(indiaBtn.tabIndex).toBeGreaterThanOrEqual(0);
            expect(globalBtn.tabIndex).toBeGreaterThanOrEqual(0);
        });
    });
});

// ========================================
// Auth Button Tests
// ========================================

describe('Auth Button', () => {
    test('auth button uses correct font family', () => {
        const authBtn = document.querySelector('.auth-btn');
        if (authBtn) {
            const computedStyle = window.getComputedStyle(authBtn);
            expect(computedStyle.fontFamily).toContain('Red Hat Display');
        }
    });

    test('auth button has accent background color when not logged in', () => {
        const authBtn = document.querySelector('.auth-btn:not(.logged-in)');
        if (authBtn) {
            const computedStyle = window.getComputedStyle(authBtn);
            // Check for golden/accent color (RGB values for #D4AF37 or similar)
            expect(computedStyle.backgroundColor).not.toBe('transparent');
        }
    });

    test('auth button has appropriate border-radius', () => {
        const authBtn = document.querySelector('.auth-btn');
        if (authBtn) {
            const computedStyle = window.getComputedStyle(authBtn);
            expect(computedStyle.borderRadius).toBe('12px');
        }
    });
});

// ========================================
// Profile Button Tests
// ========================================

describe('Profile Button', () => {
    describe('DOM Structure', () => {
        test('profile button exists in sidebar', () => {
            const profileBtn = document.getElementById('sidebarProfileBtn');
            expect(profileBtn).not.toBeNull();
            expect(profileBtn.tagName).toBe('BUTTON');
        });

        test('profile button is inside sidebar nav section', () => {
            const profileBtn = document.getElementById('sidebarProfileBtn');
            const nav = profileBtn.closest('.sidebar-nav');
            expect(nav).not.toBeNull();
        });

        test('profile button has profile icon (SVG)', () => {
            const profileBtn = document.getElementById('sidebarProfileBtn');
            const svg = profileBtn.querySelector('svg');
            expect(svg).not.toBeNull();
        });

        test('profile button has "Profile" text', () => {
            const profileBtn = document.getElementById('sidebarProfileBtn');
            expect(profileBtn.textContent).toContain('Profile');
        });
    });

    describe('Visibility based on auth state', () => {
        test('profile button is hidden when not authenticated', () => {
            // When not logged in, profile button should be hidden
            const profileBtn = document.getElementById('sidebarProfileBtn');
            const computedStyle = window.getComputedStyle(profileBtn);
            // Button visibility is controlled by display property
            if (!window.isAuthenticated) {
                expect(computedStyle.display).toBe('none');
            }
        });

        test('profile button is visible when authenticated', () => {
            // Enable test mode to simulate logged in state
            if (typeof enableTestMode === 'function') {
                enableTestMode();
                const profileBtn = document.getElementById('sidebarProfileBtn');
                const computedStyle = window.getComputedStyle(profileBtn);
                expect(computedStyle.display).toBe('flex');
            }
        });
    });

    describe('Profile Panel Interaction', () => {
        let profilePanel;
        let sidebar;

        beforeEach(() => {
            profilePanel = document.getElementById('profilePanel');
            sidebar = document.getElementById('sidebar');
            // Reset states
            if (profilePanel) profilePanel.classList.remove('visible');
            if (sidebar) sidebar.classList.remove('open');
        });

        test('profile panel exists in DOM', () => {
            expect(profilePanel).not.toBeNull();
            expect(profilePanel.classList.contains('profile-page')).toBe(true);
        });

        test('profile panel is hidden by default', () => {
            expect(profilePanel.classList.contains('visible')).toBe(false);
        });

        test('clicking profile button opens profile panel (when authenticated)', () => {
            // Enable test mode to simulate logged in state
            if (typeof enableTestMode === 'function') {
                enableTestMode();
                sidebar.classList.add('open');

                const profileBtn = document.getElementById('sidebarProfileBtn');
                profileBtn.click();

                // Profile panel should be visible
                expect(profilePanel.classList.contains('visible')).toBe(true);
            }
        });

        test('clicking profile button closes sidebar', () => {
            if (typeof enableTestMode === 'function') {
                enableTestMode();
                sidebar.classList.add('open');

                const profileBtn = document.getElementById('sidebarProfileBtn');
                profileBtn.click();

                // Sidebar should be closed
                expect(sidebar.classList.contains('open')).toBe(false);
            }
        });

        test('profile panel has back button', () => {
            const backBtn = document.getElementById('profileClose');
            expect(backBtn).not.toBeNull();
            expect(backBtn.textContent).toContain('Back');
        });

        test('clicking back button closes profile panel', () => {
            profilePanel.classList.add('visible');
            const backBtn = document.getElementById('profileClose');
            backBtn.click();
            expect(profilePanel.classList.contains('visible')).toBe(false);
        });

        test('profile panel has sign out button', () => {
            const signOutBtn = document.getElementById('profileSignout');
            expect(signOutBtn).not.toBeNull();
            expect(signOutBtn.textContent).toContain('Sign Out');
        });
    });

    describe('Click Outside Behavior', () => {
        test('clicking outside profile panel closes it (but not on sidebar profile button)', () => {
            // This tests the fix for the click-outside handler
            // The profile panel should NOT close when clicking the sidebar profile button
            if (typeof enableTestMode === 'function') {
                enableTestMode();
                const profilePanel = document.getElementById('profilePanel');
                const profileBtn = document.getElementById('sidebarProfileBtn');

                // Simulate clicking the profile button
                profileBtn.click();

                // Panel should stay open (not immediately close)
                expect(profilePanel.classList.contains('visible')).toBe(true);
            }
        });
    });
});

// ========================================
// Auth Dropdown Tests
// ========================================

describe('Auth Dropdown', () => {
    describe('DOM Structure', () => {
        test('auth dropdown exists when logged in', () => {
            if (typeof enableTestMode === 'function') {
                enableTestMode();
                const dropdown = document.querySelector('.auth-dropdown');
                expect(dropdown).not.toBeNull();
            }
        });

        test('dropdown has Profile option', () => {
            if (typeof enableTestMode === 'function') {
                enableTestMode();
                const profileOption = document.getElementById('authDropdownProfile');
                expect(profileOption).not.toBeNull();
                expect(profileOption.textContent).toContain('Profile');
            }
        });

        test('dropdown has Sign Out option', () => {
            if (typeof enableTestMode === 'function') {
                enableTestMode();
                const logoutOption = document.getElementById('authDropdownLogout');
                expect(logoutOption).not.toBeNull();
                expect(logoutOption.textContent).toContain('Sign Out');
            }
        });

        test('dropdown options have icons (SVG)', () => {
            if (typeof enableTestMode === 'function') {
                enableTestMode();
                const profileOption = document.getElementById('authDropdownProfile');
                const logoutOption = document.getElementById('authDropdownLogout');
                expect(profileOption?.querySelector('svg')).not.toBeNull();
                expect(logoutOption?.querySelector('svg')).not.toBeNull();
            }
        });
    });

    describe('Dropdown Interactions', () => {
        test('clicking Profile option opens profile panel', () => {
            if (typeof enableTestMode === 'function') {
                enableTestMode();
                const profileOption = document.getElementById('authDropdownProfile');
                const profilePanel = document.getElementById('profilePanel');

                profileOption?.click();

                expect(profilePanel?.classList.contains('visible')).toBe(true);
            }
        });

        test('clicking Sign Out option logs user out', () => {
            if (typeof enableTestMode === 'function') {
                enableTestMode();
                const logoutOption = document.getElementById('authDropdownLogout');

                logoutOption?.click();

                // After logout, isAuthenticated should be false
                expect(window.isAuthenticated).toBe(false);
            }
        });
    });
});

// ========================================
// Logout Cleanup Tests
// ========================================

describe('Logout Cleanup', () => {
    beforeEach(() => {
        // Enable test mode to set up authenticated state
        if (typeof enableTestMode === 'function') {
            enableTestMode();
        }
    });

    test('logout clears favorites from localStorage', () => {
        // Add some test favorites first
        localStorage.setItem('tldr-favorites', JSON.stringify([
            { title: 'Test Song', artist: 'Test Artist', videoId: 'abc123' }
        ]));

        if (typeof logout === 'function') {
            logout();
        }

        const storedFavorites = localStorage.getItem('tldr-favorites');
        expect(storedFavorites).toBeNull();
    });

    test('logout clears history from localStorage', () => {
        // Add some test history first
        localStorage.setItem('tldr-history', JSON.stringify([
            { title: 'Test Song', artist: 'Test Artist', videoId: 'abc123', playedAt: Date.now() }
        ]));

        if (typeof logout === 'function') {
            logout();
        }

        const storedHistory = localStorage.getItem('tldr-history');
        expect(storedHistory).toBeNull();
    });

    test('logout clears auth tokens from localStorage', () => {
        if (typeof logout === 'function') {
            logout();
        }

        expect(localStorage.getItem('tldr-access-token')).toBeNull();
        expect(localStorage.getItem('tldr-refresh-token')).toBeNull();
        expect(localStorage.getItem('tldr-user')).toBeNull();
    });

    test('logout resets favorites array', () => {
        // Add favorites before logout
        if (typeof favorites !== 'undefined' && typeof toggleFavorite === 'function') {
            toggleFavorite({ title: 'Test', artist: 'Artist', videoId: 'test' });
        }

        if (typeof logout === 'function') {
            logout();
        }

        if (typeof favorites !== 'undefined') {
            expect(favorites.length).toBe(0);
        }
    });

    test('logout hides favorites section', () => {
        // Add favorites to make section visible
        localStorage.setItem('tldr-favorites', JSON.stringify([
            { title: 'Test Song', artist: 'Test Artist', videoId: 'abc123' }
        ]));

        if (typeof renderFavoritesSection === 'function') {
            renderFavoritesSection();
        }

        // Now logout
        if (typeof logout === 'function') {
            logout();
        }

        const favSection = document.getElementById('favoritesSection');
        if (favSection) {
            const computedStyle = window.getComputedStyle(favSection);
            expect(computedStyle.display).toBe('none');
        }
    });

    test('logout resets isAuthenticated to false', () => {
        if (typeof logout === 'function') {
            logout();
        }

        expect(window.isAuthenticated).toBe(false);
    });

    test('logout resets currentUser to null', () => {
        if (typeof logout === 'function') {
            logout();
        }

        expect(window.currentUser).toBeNull();
    });

    test('sidebar profile button is hidden after logout', () => {
        if (typeof logout === 'function') {
            logout();
        }

        const profileBtn = document.getElementById('sidebarProfileBtn');
        if (profileBtn) {
            const computedStyle = window.getComputedStyle(profileBtn);
            expect(computedStyle.display).toBe('none');
        }
    });
});

// ========================================
// Header Cleanup Tests
// ========================================

describe('Header Cleanup', () => {
    test('header does not contain duplicate About link', () => {
        const headerAboutLinks = document.querySelectorAll('.header .btn-about, .header a[href="about.html"]');
        expect(headerAboutLinks.length).toBe(0);
    });

    test('header does not contain Share button (moved to sidebar)', () => {
        const headerShareBtn = document.querySelector('.header .btn-share');
        expect(headerShareBtn).toBeNull();
    });

    test('header still contains update date', () => {
        const chartDate = document.getElementById('chartDate');
        expect(chartDate).not.toBeNull();
        expect(chartDate.closest('.header')).not.toBeNull();
    });
});
