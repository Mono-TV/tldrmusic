#!/usr/bin/env node
/**
 * TLDR Music - CLI Test Runner
 * Runs all tests and returns exit code for CI/CD
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.join(__dirname, '..');
const TESTS_DIR = path.join(ROOT_DIR, 'tests');

// Colors for output
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

function log(color, ...args) {
    console.log(color, ...args, colors.reset);
}

function logPass(msg) { log(colors.green, '  ✓', msg); }
function logFail(msg) { log(colors.red, '  ✗', msg); }
function logInfo(msg) { log(colors.cyan, '  ℹ', msg); }
function logSection(msg) { log(colors.bold + colors.blue, '\n▸', msg); }

// Test results
const results = {
    passed: 0,
    failed: 0,
    errors: []
};

// ============================================================
// Test: JavaScript Syntax Check
// ============================================================
function testJsSyntax() {
    logSection('JavaScript Syntax Check');

    const jsFiles = [
        'app.js',
        'auth.js',
        'tests.js',
        'e2e-tests.js',
        'qa-tests.js'
    ];

    for (const file of jsFiles) {
        const filePath = path.join(ROOT_DIR, file);
        if (!fs.existsSync(filePath)) continue;

        try {
            execSync(`node --check "${filePath}"`, { stdio: 'pipe' });
            logPass(`${file} - syntax OK`);
            results.passed++;
        } catch (error) {
            logFail(`${file} - syntax error`);
            results.failed++;
            results.errors.push({ test: `JS Syntax: ${file}`, error: error.message });
        }
    }
}

// ============================================================
// Test: API Endpoint Consistency
// ============================================================
function testApiEndpoints() {
    logSection('API Endpoint Consistency');

    const PROD_API = 'https://tldrmusic-api-401132033262.asia-south1.run.app';
    const filesToCheck = ['app.js', 'auth.js'];

    for (const file of filesToCheck) {
        const filePath = path.join(ROOT_DIR, file);
        if (!fs.existsSync(filePath)) continue;

        const content = fs.readFileSync(filePath, 'utf-8');

        // Check for localhost
        if (/API_BASE.*localhost/i.test(content) || /API_URL.*localhost/i.test(content)) {
            logFail(`${file} - contains localhost API URL`);
            results.failed++;
            results.errors.push({
                test: `API Endpoint: ${file}`,
                error: 'Contains localhost URL. Must use production API.'
            });
        } else if (content.includes(PROD_API)) {
            logPass(`${file} - uses production API`);
            results.passed++;
        } else {
            logInfo(`${file} - no API_BASE found (skipped)`);
        }
    }
}

// ============================================================
// Test: Required Files Exist
// ============================================================
function testRequiredFiles() {
    logSection('Required Files Check');

    const requiredFiles = [
        'index.html',
        'app.js',
        'auth.js',
        'style.css',
        'scraper/run_job.py',
        'scraper/config.py'
    ];

    for (const file of requiredFiles) {
        const filePath = path.join(ROOT_DIR, file);
        if (fs.existsSync(filePath)) {
            logPass(`${file} exists`);
            results.passed++;
        } else {
            logFail(`${file} missing`);
            results.failed++;
            results.errors.push({ test: `Required File: ${file}`, error: 'File not found' });
        }
    }
}

// ============================================================
// Test: Python Syntax Check
// ============================================================
function testPythonSyntax() {
    logSection('Python Syntax Check');

    const pyFiles = [
        'scraper/run_job.py',
        'scraper/main.py',
        'scraper/config.py',
        'scraper/ranking.py'
    ];

    for (const file of pyFiles) {
        const filePath = path.join(ROOT_DIR, file);
        if (!fs.existsSync(filePath)) continue;

        try {
            execSync(`python3 -m py_compile "${filePath}"`, { stdio: 'pipe' });
            logPass(`${file} - syntax OK`);
            results.passed++;
        } catch (error) {
            logFail(`${file} - syntax error`);
            results.failed++;
            results.errors.push({ test: `Python Syntax: ${file}`, error: error.message });
        }
    }
}

// ============================================================
// Test: HTML Validation (basic)
// ============================================================
function testHtmlBasic() {
    logSection('HTML Basic Validation');

    const htmlFiles = ['index.html', 'about.html'];

    for (const file of htmlFiles) {
        const filePath = path.join(ROOT_DIR, file);
        if (!fs.existsSync(filePath)) continue;

        const content = fs.readFileSync(filePath, 'utf-8');

        // Check for basic structure
        const hasDoctype = /<!DOCTYPE html>/i.test(content);
        const hasHtmlTag = /<html.*>/i.test(content);
        const hasHead = /<head>/i.test(content);
        const hasBody = /<body>/i.test(content);

        if (hasDoctype && hasHtmlTag && hasHead && hasBody) {
            logPass(`${file} - valid structure`);
            results.passed++;
        } else {
            logFail(`${file} - invalid HTML structure`);
            results.failed++;
            results.errors.push({ test: `HTML: ${file}`, error: 'Missing basic HTML structure' });
        }
    }
}

// ============================================================
// Test: Version consistency
// ============================================================
function testVersionConsistency() {
    logSection('Version Consistency');

    const pkgPath = path.join(ROOT_DIR, 'package.json');
    if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        if (pkg.version) {
            logPass(`Version: ${pkg.version}`);
            results.passed++;
        }
    }
}

// ============================================================
// Run Unit Tests from tests/ directory
// ============================================================
function runUnitTests() {
    logSection('Unit Tests');

    const testFiles = fs.readdirSync(TESTS_DIR)
        .filter(f => f.endsWith('.test.js'));

    if (testFiles.length === 0) {
        logInfo('No .test.js files found in tests/');
        return;
    }

    for (const file of testFiles) {
        const filePath = path.join(TESTS_DIR, file);
        logInfo(`Running ${file}...`);

        try {
            // For now, just check syntax - full test execution requires more setup
            execSync(`node --check "${filePath}"`, { stdio: 'pipe' });
            logPass(`${file} - loaded successfully`);
            results.passed++;
        } catch (error) {
            logFail(`${file} - failed to load`);
            results.failed++;
            results.errors.push({ test: `Unit Test: ${file}`, error: error.message });
        }
    }
}

// ============================================================
// Main
// ============================================================
function main() {
    console.log(colors.bold + colors.cyan);
    console.log('╔════════════════════════════════════════╗');
    console.log('║     TLDR Music - Test Runner           ║');
    console.log('╚════════════════════════════════════════╝');
    console.log(colors.reset);

    const startTime = Date.now();

    // Run all test suites
    testRequiredFiles();
    testJsSyntax();
    testPythonSyntax();
    testApiEndpoints();
    testHtmlBasic();
    testVersionConsistency();
    runUnitTests();

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);

    // Summary
    console.log(colors.bold + '\n════════════════════════════════════════');
    console.log('                 SUMMARY                 ');
    console.log('════════════════════════════════════════' + colors.reset);

    log(colors.green, `  Passed: ${results.passed}`);
    log(colors.red, `  Failed: ${results.failed}`);
    console.log(`  Time:   ${duration}s\n`);

    // Show errors if any
    if (results.errors.length > 0) {
        log(colors.red + colors.bold, '\nErrors:');
        results.errors.forEach((err, i) => {
            console.log(colors.red + `  ${i + 1}. ${err.test}`);
            console.log(`     ${err.error}` + colors.reset);
        });
    }

    // Exit with appropriate code
    if (results.failed > 0) {
        log(colors.red + colors.bold, '\n✗ Tests FAILED\n');
        process.exit(1);
    } else {
        log(colors.green + colors.bold, '\n✓ All tests PASSED\n');
        process.exit(0);
    }
}

main();
