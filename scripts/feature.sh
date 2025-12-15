#!/bin/bash
# TLDR Music - Feature Branch Helper
# Usage: ./scripts/feature.sh <command> [options]

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

show_help() {
    echo -e "${BOLD}${CYAN}TLDR Music - Feature Branch Helper${NC}"
    echo ""
    echo "Usage: ./scripts/feature.sh <command> [options]"
    echo ""
    echo "Commands:"
    echo "  start <name>    Create a new feature branch"
    echo "  test            Run all tests"
    echo "  finish          Merge current feature branch to main"
    echo "  status          Show current branch and test status"
    echo "  version <type>  Bump version (patch|minor|major)"
    echo ""
    echo "Examples:"
    echo "  ./scripts/feature.sh start add-lyrics-sync"
    echo "  ./scripts/feature.sh test"
    echo "  ./scripts/feature.sh finish"
    echo "  ./scripts/feature.sh version patch"
    echo ""
}

cmd_start() {
    local name=$1
    if [ -z "$name" ]; then
        echo -e "${RED}Error: Branch name required${NC}"
        echo "Usage: ./scripts/feature.sh start <name>"
        exit 1
    fi

    local branch="feature/$name"

    echo -e "${CYAN}Creating feature branch: ${branch}${NC}"

    # Check for uncommitted changes
    if ! git diff --quiet || ! git diff --cached --quiet; then
        echo -e "${YELLOW}You have uncommitted changes. Stashing...${NC}"
        git stash
        git checkout -b "$branch"
        git stash pop
    else
        git checkout -b "$branch"
    fi

    echo -e "${GREEN}✓ Now on branch: ${branch}${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Make your changes"
    echo "  2. Run tests: ./scripts/feature.sh test"
    echo "  3. Commit: git add . && git commit -m 'your message'"
    echo "  4. When ready: ./scripts/feature.sh finish"
}

cmd_test() {
    echo -e "${CYAN}Running tests...${NC}"
    echo ""

    if [ -f "scripts/run-tests.js" ]; then
        node scripts/run-tests.js
    else
        echo -e "${RED}Test runner not found${NC}"
        exit 1
    fi
}

cmd_finish() {
    local current_branch=$(git rev-parse --abbrev-ref HEAD)

    if [ "$current_branch" = "main" ] || [ "$current_branch" = "master" ]; then
        echo -e "${RED}Error: Already on main branch${NC}"
        exit 1
    fi

    echo -e "${CYAN}Finishing feature branch: ${current_branch}${NC}"
    echo ""

    # Run tests first
    echo -e "${BOLD}Step 1: Running tests...${NC}"
    if ! node scripts/run-tests.js; then
        echo -e "${RED}✗ Tests failed. Fix issues before merging.${NC}"
        exit 1
    fi

    echo -e "\n${BOLD}Step 2: Merging to main...${NC}"
    git checkout main
    git pull origin main 2>/dev/null || true
    git merge "$current_branch" --no-ff -m "Merge $current_branch into main"

    echo -e "\n${BOLD}Step 3: Cleaning up...${NC}"
    git branch -d "$current_branch"

    echo -e "\n${GREEN}${BOLD}✓ Feature branch merged successfully!${NC}"
    echo ""
    echo "Don't forget to push: git push origin main"
}

cmd_status() {
    local branch=$(git rev-parse --abbrev-ref HEAD)
    local version=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")

    echo -e "${BOLD}${CYAN}═══════════════════════════════════${NC}"
    echo -e "${BOLD}${CYAN}  TLDR Music - Status${NC}"
    echo -e "${BOLD}${CYAN}═══════════════════════════════════${NC}"
    echo ""
    echo -e "  Branch:  ${CYAN}${branch}${NC}"
    echo -e "  Version: ${CYAN}${version}${NC}"
    echo ""

    # Show uncommitted changes
    if ! git diff --quiet || ! git diff --cached --quiet; then
        echo -e "  ${YELLOW}⚠ Uncommitted changes${NC}"
    else
        echo -e "  ${GREEN}✓ Working tree clean${NC}"
    fi

    echo ""
}

cmd_version() {
    local type=$1

    if [ -z "$type" ]; then
        local version=$(node -p "require('./package.json').version" 2>/dev/null || echo "unknown")
        echo -e "Current version: ${CYAN}${version}${NC}"
        echo ""
        echo "Usage: ./scripts/feature.sh version <patch|minor|major>"
        exit 0
    fi

    case $type in
        patch|minor|major)
            npm version $type --no-git-tag-version
            local new_version=$(node -p "require('./package.json').version")
            echo -e "${GREEN}✓ Version bumped to: ${new_version}${NC}"
            echo ""
            echo "Don't forget to commit: git add package.json && git commit -m 'Bump version to ${new_version}'"
            ;;
        *)
            echo -e "${RED}Error: Invalid version type. Use patch, minor, or major.${NC}"
            exit 1
            ;;
    esac
}

# Main
case "${1:-help}" in
    start)
        cmd_start "$2"
        ;;
    test)
        cmd_test
        ;;
    finish)
        cmd_finish
        ;;
    status)
        cmd_status
        ;;
    version)
        cmd_version "$2"
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo -e "${RED}Unknown command: $1${NC}"
        show_help
        exit 1
        ;;
esac
