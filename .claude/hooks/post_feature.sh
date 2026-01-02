#!/bin/bash
# Post-Feature Development Hook for TLDR Music Frontend
# Checks deployment status after git operations

PROJECT_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MC_ROOT="/Users/mono/Documents/Programs/Lumio/music-conductor"

echo ""
echo "🚀 Post-Feature Deployment Check (Frontend)"
echo "============================================"

# Check tldrmusic status
cd "$PROJECT_ROOT"
TLDR_STATUS=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
TLDR_UNPUSHED=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')

echo ""
echo "📊 Repository Status:"
echo "   tldrmusic (Frontend):"
echo "      - Uncommitted changes: $TLDR_STATUS"
echo "      - Unpushed commits: $TLDR_UNPUSHED"

echo ""
echo "📋 Deployment Status:"

if [ "$TLDR_STATUS" -gt 0 ] || [ "$TLDR_UNPUSHED" -gt 0 ]; then
    echo "   ⚠️  Frontend needs attention:"
    [ "$TLDR_STATUS" -gt 0 ] && echo "      - Commit pending changes"
    [ "$TLDR_UNPUSHED" -gt 0 ] && echo "      - Push to origin (auto-deploys to GitHub Pages)"
else
    echo "   ✅ Frontend: Deployed to GitHub Pages"
fi

# Check if backend might need update too
if [ -d "$MC_ROOT" ]; then
    cd "$MC_ROOT"
    MC_UNPUSHED=$(git log origin/main..HEAD --oneline 2>/dev/null | wc -l | tr -d ' ')
    if [ "$MC_UNPUSHED" -gt 0 ]; then
        echo "   ⚠️  Backend (music-conductor) has unpushed commits"
        echo "      - Run: cd $MC_ROOT && ./scripts/maintenance.sh"
    fi
fi

echo ""
