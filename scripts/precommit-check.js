#!/usr/bin/env node
/**
 * TLDR Music - Pre-commit Check
 * Runs tests and enforces branching strategy
 */

const { execSync, spawnSync } = require('child_process');
const readline = require('readline');

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

function getCurrentBranch() {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
}

function getStagedFiles() {
    return execSync('git diff --cached --name-only', { encoding: 'utf-8' })
        .trim()
        .split('\n')
        .filter(f => f);
}

function runTests() {
    log(colors.cyan + colors.bold, '\n▸ Running tests...\n');

    const result = spawnSync('node', ['scripts/run-tests.js'], {
        stdio: 'inherit',
        cwd: process.cwd()
    });

    return result.status === 0;
}

function suggestFeatureBranch(stagedFiles) {
    log(colors.yellow + colors.bold, '\n╔════════════════════════════════════════════════════╗');
    log(colors.yellow + colors.bold, '║  Tests FAILED - Cannot commit to main branch       ║');
    log(colors.yellow + colors.bold, '╚════════════════════════════════════════════════════╝\n');

    log(colors.yellow, 'Options:');
    console.log('  1. Fix the issues and try again');
    console.log('  2. Create a feature branch for work-in-progress');
    console.log('');

    // Suggest branch name based on staged files
    let suggestedName = 'feature/';
    if (stagedFiles.some(f => f.includes('test'))) {
        suggestedName += 'add-tests';
    } else if (stagedFiles.some(f => f.endsWith('.py'))) {
        suggestedName += 'scraper-update';
    } else if (stagedFiles.some(f => f.endsWith('.js'))) {
        suggestedName += 'frontend-update';
    } else {
        suggestedName += 'wip-' + new Date().toISOString().slice(0, 10);
    }

    log(colors.cyan, 'To create a feature branch and commit there:\n');
    console.log(`  git checkout -b ${suggestedName}`);
    console.log('  git commit -m "WIP: your message"');
    console.log('');

    log(colors.cyan, 'To skip tests (not recommended):\n');
    console.log('  git commit --no-verify -m "your message"');
    console.log('');
}

function main() {
    const branch = getCurrentBranch();
    const stagedFiles = getStagedFiles();

    log(colors.bold + colors.blue, '\n╔════════════════════════════════════════╗');
    log(colors.bold + colors.blue, '║     TLDR Music - Pre-commit Check      ║');
    log(colors.bold + colors.blue, '╚════════════════════════════════════════╝\n');

    log(colors.cyan, `Branch: ${branch}`);
    log(colors.cyan, `Staged files: ${stagedFiles.length}`);

    // Always run tests
    const testsPass = runTests();

    if (testsPass) {
        log(colors.green + colors.bold, '\n✓ All checks passed! Proceeding with commit.\n');
        process.exit(0);
    } else {
        // Tests failed
        if (branch === 'main' || branch === 'master') {
            // On main branch - block commit
            suggestFeatureBranch(stagedFiles);
            process.exit(1);
        } else {
            // On feature branch - warn but allow
            log(colors.yellow + colors.bold, '\n⚠ Tests failed, but you are on a feature branch.');
            log(colors.yellow, 'Commit will proceed. Fix tests before merging to main.\n');
            process.exit(0);
        }
    }
}

main();
