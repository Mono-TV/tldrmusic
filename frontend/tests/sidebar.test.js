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
