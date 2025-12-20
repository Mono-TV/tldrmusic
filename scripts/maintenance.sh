#!/bin/bash
# TLDR Music - Maintenance Mode Script
# Usage: ./scripts/maintenance.sh [on|off|status]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

cd "$PROJECT_DIR"

show_status() {
    if [ -f ".maintenance" ]; then
        echo -e "${YELLOW}Status: MAINTENANCE MODE${NC}"
        echo "The site is currently showing the maintenance page."
    else
        echo -e "${GREEN}Status: NORMAL${NC}"
        echo "The site is running normally."
    fi
}

enable_maintenance() {
    echo -e "${BLUE}Enabling maintenance mode...${NC}"

    # Create backup of index.html if not already in maintenance mode
    if [ ! -f ".maintenance" ]; then
        cp index.html index.html.backup
        echo "Created backup: index.html.backup"
    fi

    # Copy maintenance page to index.html
    cp maintenance.html index.html

    # Create marker file
    touch .maintenance

    # Commit and push
    git add index.html .maintenance
    git commit -m "Enable maintenance mode

🤖 Generated with [Claude Code](https://claude.com/claude-code)" || true
    git push

    echo -e "${GREEN}Maintenance mode enabled!${NC}"
    echo "The maintenance page is now live."
}

disable_maintenance() {
    echo -e "${BLUE}Disabling maintenance mode...${NC}"

    if [ ! -f ".maintenance" ]; then
        echo -e "${YELLOW}Site is not in maintenance mode.${NC}"
        return 0
    fi

    # Restore original index.html
    if [ -f "index.html.backup" ]; then
        cp index.html.backup index.html
        rm index.html.backup
        echo "Restored index.html from backup"
    else
        echo -e "${RED}Error: No backup found. Please restore index.html manually.${NC}"
        exit 1
    fi

    # Remove marker file
    rm .maintenance

    # Commit and push
    git add index.html
    git rm -f .maintenance 2>/dev/null || true
    git commit -m "Disable maintenance mode - site is back online

🤖 Generated with [Claude Code](https://claude.com/claude-code)" || true
    git push

    echo -e "${GREEN}Maintenance mode disabled!${NC}"
    echo "The site is back online."
}

# Main
case "${1:-status}" in
    on|enable)
        enable_maintenance
        ;;
    off|disable)
        disable_maintenance
        ;;
    status)
        show_status
        ;;
    *)
        echo "TLDR Music - Maintenance Mode"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  on, enable    Enable maintenance mode"
        echo "  off, disable  Disable maintenance mode"
        echo "  status        Show current status (default)"
        echo ""
        show_status
        ;;
esac
