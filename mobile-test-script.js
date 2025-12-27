/**
 * TLDR Music - Mobile Responsive Testing Script
 * Run this in Chrome DevTools Console to verify mobile fixes
 *
 * Usage:
 * 1. Open http://localhost:8080 in Chrome
 * 2. Open DevTools (Cmd+Option+I)
 * 3. Enable Device Toolbar (Cmd+Shift+M)
 * 4. Copy and paste this entire script
 * 5. Call runMobileTests()
 */

const MobileTests = {
    results: [],

    // Test configurations
    viewports: {
        'iPhone SE': { width: 375, height: 667 },
        'iPhone 14 Pro': { width: 393, height: 852 },
        'Galaxy S20': { width: 360, height: 800 },
        'Pixel 6': { width: 412, height: 915 }
    },

    // Helper: Log test result
    logResult(test, passed, expected, actual, notes = '') {
        const result = {
            test,
            passed,
            expected,
            actual,
            notes,
            timestamp: new Date().toISOString()
        };
        this.results.push(result);

        const icon = passed ? '✅' : '❌';
        const color = passed ? 'color: green' : 'color: red';

        console.log(
            `%c${icon} ${test}`,
            color + '; font-weight: bold'
        );
        console.log(`   Expected: ${expected}`);
        console.log(`   Actual: ${actual}`);
        if (notes) console.log(`   Notes: ${notes}`);
        console.log('');
    },

    // Test 1: Touch Target Sizes
    testTouchTargets() {
        console.log('%c🎯 Test 1: Touch Target Sizes', 'font-size: 16px; font-weight: bold; color: #f59e0b');
        console.log('Checking regional filter buttons...\n');

        const regionalBtn = document.querySelector('.regional-lang-btn');

        if (!regionalBtn) {
            this.logResult(
                'Touch Targets',
                false,
                '≥44px height',
                'Button not found',
                'Navigate to home page to see regional filters'
            );
            return;
        }

        const height = regionalBtn.offsetHeight;
        const passed = height >= 44;

        this.logResult(
            'Regional Filter Button Height',
            passed,
            '≥44px (WCAG minimum)',
            `${height}px`,
            passed ? 'Meets accessibility standard' : 'Below WCAG minimum'
        );

        // Check computed styles
        const styles = window.getComputedStyle(regionalBtn);
        const minHeight = styles.minHeight;

        this.logResult(
            'Regional Filter Min-Height Property',
            minHeight === '44px',
            '44px',
            minHeight,
            'CSS min-height enforces minimum'
        );
    },

    // Test 2: Player Bar Text Truncation
    testPlayerBarText() {
        console.log('%c📱 Test 2: Player Bar Text Truncation', 'font-size: 16px; font-weight: bold; color: #f59e0b');
        console.log('Checking player bar text width...\n');

        const playerText = document.querySelector('.player-bar-text');

        if (!playerText) {
            this.logResult(
                'Player Bar Text',
                false,
                'min(40vw, 160px)',
                'Element not found',
                'Play a song to show player bar'
            );
            return;
        }

        const styles = window.getComputedStyle(playerText);
        const maxWidth = styles.maxWidth;
        const viewportWidth = window.innerWidth;
        const expected40vw = viewportWidth * 0.4;
        const expectedWidth = Math.min(expected40vw, 160);

        // Parse actual width (remove 'px')
        const actualWidth = parseFloat(maxWidth);
        const passed = Math.abs(actualWidth - expectedWidth) < 2; // Allow 2px tolerance

        this.logResult(
            'Player Bar Text Max-Width',
            passed,
            `${expectedWidth.toFixed(1)}px (40vw or 160px max)`,
            maxWidth,
            `Viewport: ${viewportWidth}px → 40vw = ${expected40vw.toFixed(1)}px`
        );

        // Visual width check
        const visualWidth = playerText.offsetWidth;
        this.logResult(
            'Player Bar Text Visual Width',
            visualWidth <= expectedWidth + 5,
            `≤${expectedWidth.toFixed(1)}px`,
            `${visualWidth}px`,
            'Actual rendered width'
        );
    },

    // Test 3: Scroll Indicators
    testScrollIndicators() {
        console.log('%c➡️ Test 3: Horizontal Scroll Indicators', 'font-size: 16px; font-weight: bold; color: #f59e0b');
        console.log('Checking gradient fade indicators...\n');

        const scrollContainer = document.querySelector('.discover-scroll-container');

        if (!scrollContainer) {
            this.logResult(
                'Scroll Indicators',
                false,
                'Gradient visible',
                'Container not found',
                'Navigate to Discover page to test'
            );
            return;
        }

        // Check ::after pseudo-element
        const afterStyles = window.getComputedStyle(scrollContainer, '::after');
        const width = afterStyles.width;
        const background = afterStyles.backgroundImage;
        const position = afterStyles.position;
        const right = afterStyles.right;

        const hasGradient = background.includes('linear-gradient');
        const isPositioned = position === 'absolute' && right === '0px';
        const hasWidth = width === '60px';

        this.logResult(
            'Scroll Indicator Width',
            hasWidth,
            '60px',
            width,
            'Gradient fade width'
        );

        this.logResult(
            'Scroll Indicator Gradient',
            hasGradient,
            'linear-gradient present',
            hasGradient ? 'Present' : 'Missing',
            'Creates fade effect'
        );

        this.logResult(
            'Scroll Indicator Position',
            isPositioned,
            'absolute, right: 0',
            `${position}, right: ${right}`,
            'Positioned on right edge'
        );
    },

    // Test 4: Modal Optimization
    testModalOptimization() {
        console.log('%c📦 Test 4: Modal Small Screen Optimization', 'font-size: 16px; font-weight: bold; color: #f59e0b');
        console.log('Checking modal styles at current viewport...\n');

        const modal = document.querySelector('.modal-content');

        if (!modal) {
            this.logResult(
                'Modal Optimization',
                false,
                'Optimized for small screens',
                'Modal not found',
                'Open any modal to test (e.g., Create Playlist)'
            );
            return;
        }

        const styles = window.getComputedStyle(modal);
        const viewportWidth = window.innerWidth;

        // At 420px and below, should have specific optimizations
        const isSmallScreen = viewportWidth <= 420;

        if (isSmallScreen) {
            const padding = styles.padding;
            const maxHeight = styles.maxHeight;
            const overflowY = styles.overflowY;

            // Check padding (should be 1.25rem = 20px)
            const expectedPadding = '20px'; // 1.25rem
            const hasPadding = padding.includes('20px');

            this.logResult(
                'Modal Padding (≤420px)',
                hasPadding,
                '1.25rem (20px)',
                padding,
                'Reduced padding for small screens'
            );

            this.logResult(
                'Modal Max-Height (≤420px)',
                maxHeight === '85vh',
                '85vh',
                maxHeight,
                'Prevents overflow'
            );

            this.logResult(
                'Modal Overflow (≤420px)',
                overflowY === 'auto',
                'auto',
                overflowY,
                'Enables scrolling if needed'
            );
        } else {
            this.logResult(
                'Modal Optimization',
                true,
                'Standard styles (>420px)',
                `Viewport: ${viewportWidth}px`,
                'Small screen optimizations not applied'
            );
        }

        // Check modal buttons
        const modalButtons = modal.querySelector('.modal-buttons');
        if (modalButtons && isSmallScreen) {
            const buttonsStyles = window.getComputedStyle(modalButtons);
            const flexDirection = buttonsStyles.flexDirection;

            this.logResult(
                'Modal Buttons Layout (≤420px)',
                flexDirection === 'column',
                'column (stacked)',
                flexDirection,
                'Full-width buttons'
            );
        }
    },

    // Test 5: Grid Responsiveness
    testGridResponsiveness() {
        console.log('%c🔲 Test 5: Grid Responsiveness', 'font-size: 16px; font-weight: bold; color: #f59e0b');
        console.log('Checking grid column sizing...\n');

        const grid = document.querySelector('.chart-list') ||
                    document.querySelector('.regional-chart-grid');

        if (!grid) {
            this.logResult(
                'Grid Responsiveness',
                false,
                'Explicit minmax values',
                'Grid not found',
                'Scroll to Quick Picks or Regional Charts'
            );
            return;
        }

        const styles = window.getComputedStyle(grid);
        const gridTemplate = styles.gridTemplateColumns;
        const viewportWidth = window.innerWidth;

        // Expected minmax based on viewport
        let expectedMin;
        if (viewportWidth <= 360) {
            expectedMin = '130px';
        } else if (viewportWidth <= 420) {
            expectedMin = '140px';
        } else {
            expectedMin = 'auto-fill with minmax';
        }

        const hasMinmax = gridTemplate.includes('minmax');

        this.logResult(
            'Grid Template Columns',
            hasMinmax,
            `Contains minmax(${expectedMin}, 1fr)`,
            gridTemplate,
            `Viewport: ${viewportWidth}px`
        );

        // Check actual card sizes
        const cards = grid.querySelectorAll('.song-card');
        if (cards.length > 0) {
            const firstCard = cards[0];
            const cardWidth = firstCard.offsetWidth;

            let minExpectedWidth;
            if (viewportWidth <= 360) {
                minExpectedWidth = 130;
            } else if (viewportWidth <= 420) {
                minExpectedWidth = 140;
            } else {
                minExpectedWidth = 100; // Varies by breakpoint
            }

            this.logResult(
                'Actual Card Width',
                cardWidth >= minExpectedWidth - 5,
                `≥${minExpectedWidth}px`,
                `${cardWidth}px`,
                `${cards.length} cards in grid`
            );
        }
    },

    // Test 6: No Horizontal Scroll
    testHorizontalScroll() {
        console.log('%c⬅️➡️ Test 6: No Horizontal Page Scroll', 'font-size: 16px; font-weight: bold; color: #f59e0b');
        console.log('Checking for unwanted horizontal scroll...\n');

        const bodyWidth = document.body.scrollWidth;
        const windowWidth = window.innerWidth;
        const hasHorizontalScroll = bodyWidth > windowWidth;

        this.logResult(
            'Horizontal Page Scroll',
            !hasHorizontalScroll,
            'No horizontal scroll',
            hasHorizontalScroll ? `${bodyWidth}px > ${windowWidth}px` : 'None',
            hasHorizontalScroll ? '⚠️ Page is wider than viewport!' : 'Page fits viewport'
        );
    },

    // Run all tests
    async runAllTests() {
        console.clear();
        console.log(
            '%c🧪 TLDR Music - Mobile Responsive Testing',
            'font-size: 20px; font-weight: bold; color: #f59e0b; background: #0a0a0b; padding: 10px; border-radius: 5px;'
        );
        console.log('%cViewport: ' + window.innerWidth + 'x' + window.innerHeight, 'color: #9ca3af');
        console.log('%cUser Agent: ' + navigator.userAgent.split(' ').pop(), 'color: #9ca3af');
        console.log('\n');

        this.results = [];

        // Run all tests
        this.testTouchTargets();
        this.testPlayerBarText();
        this.testScrollIndicators();
        this.testModalOptimization();
        this.testGridResponsiveness();
        this.testHorizontalScroll();

        // Summary
        this.printSummary();
    },

    // Print summary
    printSummary() {
        console.log('\n');
        console.log('%c📊 Test Summary', 'font-size: 18px; font-weight: bold; color: #f59e0b');
        console.log('═'.repeat(60) + '\n');

        const total = this.results.length;
        const passed = this.results.filter(r => r.passed).length;
        const failed = total - passed;
        const passRate = ((passed / total) * 100).toFixed(1);

        console.log(`%cTotal Tests: ${total}`, 'font-weight: bold');
        console.log(`%c✅ Passed: ${passed}`, 'color: green; font-weight: bold');
        console.log(`%c❌ Failed: ${failed}`, 'color: red; font-weight: bold');
        console.log(`%c📈 Pass Rate: ${passRate}%`, 'color: ' + (passRate >= 80 ? 'green' : 'orange') + '; font-weight: bold');

        console.log('\n' + '═'.repeat(60));

        if (failed > 0) {
            console.log('\n%c⚠️ Failed Tests:', 'color: red; font-weight: bold');
            this.results.filter(r => !r.passed).forEach(r => {
                console.log(`  • ${r.test}: ${r.notes || r.actual}`);
            });
        }

        console.log('\n%c💡 Tips:', 'font-weight: bold');
        console.log('  • Resize viewport using Device Toolbar (Cmd+Shift+M)');
        console.log('  • Test at: 375px (iPhone SE), 393px (iPhone 14 Pro), 360px (Galaxy S20)');
        console.log('  • Play a song to test player bar');
        console.log('  • Open modals to test small screen optimization');
        console.log('  • Visit /discover/ to test scroll indicators');
        console.log('\n');

        // Return results for programmatic access
        return {
            total,
            passed,
            failed,
            passRate: parseFloat(passRate),
            results: this.results
        };
    },

    // Quick viewport setter
    setViewport(deviceName) {
        const viewport = this.viewports[deviceName];
        if (!viewport) {
            console.error('Unknown device. Available:', Object.keys(this.viewports));
            return;
        }

        console.log(`%cSetting viewport to ${deviceName} (${viewport.width}x${viewport.height})`, 'color: #3b82f6');
        console.log('Note: Use Chrome DevTools Device Toolbar to manually resize');
        console.log(`Set to: ${viewport.width}px × ${viewport.height}px\n`);
    }
};

// Export to global scope
window.MobileTests = MobileTests;

// Convenience functions
window.runMobileTests = () => MobileTests.runAllTests();
window.setViewport = (device) => MobileTests.setViewport(device);

// Auto-run instructions
console.log('%c📱 Mobile Testing Script Loaded!', 'font-size: 16px; font-weight: bold; color: #10b981; background: #0a0a0b; padding: 8px;');
console.log('\n%cQuick Start:', 'font-weight: bold; font-size: 14px');
console.log('  1. runMobileTests()           - Run all tests');
console.log('  2. setViewport("iPhone SE")   - View available viewports');
console.log('  3. MobileTests.testTouchTargets() - Run specific test\n');

console.log('%cAvailable Viewports:', 'font-weight: bold');
Object.entries(MobileTests.viewports).forEach(([name, size]) => {
    console.log(`  • ${name}: ${size.width}×${size.height}`);
});
console.log('\n%c→ Type: runMobileTests()', 'color: #f59e0b; font-size: 14px; font-weight: bold');
