#!/usr/bin/env bash
# Sync ~/clawd workspace to VPS, resolving symlinks
# Usage: sync-workspace-to-vps.sh [--auto]
#   --auto: Skip confirmation prompt (for cron/launchd)
set -euo pipefail

VPS_HOST="${VPS_HOST:-root@srv1209224.hstgr.cloud}"
VPS_CLAWD="${VPS_CLAWD:-/home/clawdis/clawd}"
LOCAL_CLAWD="${LOCAL_CLAWD:-$HOME/clawd}"
STAGING_DIR="/tmp/clawd-vps-sync"
AUTO_MODE=false

# Parse arguments
for arg in "$@"; do
  case $arg in
    --auto|-y)
      AUTO_MODE=true
      shift
      ;;
  esac
done

echo "📦 Preparing workspace for VPS sync..."

# Clean staging area
rm -rf "$STAGING_DIR"
mkdir -p "$STAGING_DIR"

# Copy standalone markdown files
echo "  → Copying markdown files..."
for file in AGENTS.md SOUL.md TOOLS.md USER.md IDENTITY.md; do
  if [[ -f "$LOCAL_CLAWD/$file" ]]; then
    cp "$LOCAL_CLAWD/$file" "$STAGING_DIR/"
  fi
done

# Resolve CLAUDE.md symlink if it exists
if [[ -L "$LOCAL_CLAWD/CLAUDE.md" ]]; then
  echo "  → Resolving CLAUDE.md symlink..."
  # Create a VPS-appropriate version (subset of personal CLAUDE.md)
  cat > "$STAGING_DIR/CLAUDE.md" << 'EOF'
# CLAUDE.md - Clawdis VPS Agent

This is the VPS-deployed version of the agent workspace.

## Behavior

- Keep replies concise and direct
- Ask clarifying questions when needed
- Never exfiltrate secrets or private data
- Write longer output to files in this workspace

## User Preferences

- Communication: Direct, practical, occasional emoji 🦞
- Timezone: Europe/Stockholm
- Technical: Prefer cutting-edge approaches

## Memory

Daily logs can be kept in memory/YYYY-MM-DD.md
EOF
elif [[ -f "$LOCAL_CLAWD/CLAUDE.md" ]]; then
  cp "$LOCAL_CLAWD/CLAUDE.md" "$STAGING_DIR/"
fi

# Copy canvas directory (if exists, not symlink)
if [[ -d "$LOCAL_CLAWD/canvas" && ! -L "$LOCAL_CLAWD/canvas" ]]; then
  echo "  → Copying canvas..."
  cp -r "$LOCAL_CLAWD/canvas" "$STAGING_DIR/"
fi

# Resolve and copy skills (selective - VPS-appropriate only)
mkdir -p "$STAGING_DIR/skills"
echo "  → Resolving skills..."

# Skills appropriate for VPS Clawdis agent
VPS_SKILLS=(
  "diary"
  "persistent-memory"
  "capture-learning"
  "feedback"
)

for skill in "${VPS_SKILLS[@]}"; do
  skill_path="$LOCAL_CLAWD/skills/$skill"
  if [[ -L "$skill_path" ]]; then
    # Resolve symlink and copy actual content
    resolved=$(readlink "$skill_path")
    if [[ -d "$resolved" ]]; then
      echo "    • $skill (from $resolved)"
      cp -r "$resolved" "$STAGING_DIR/skills/$skill"
    fi
  elif [[ -d "$skill_path" ]]; then
    echo "    • $skill (direct)"
    cp -r "$skill_path" "$STAGING_DIR/skills/$skill"
  fi
done

# Create memory directory structure
mkdir -p "$STAGING_DIR/memory"
echo "  → Creating memory directory..."

# Create tarball
echo "📦 Creating deployment archive..."
TARBALL="/tmp/clawd-workspace.tar.gz"
tar -czf "$TARBALL" -C "$STAGING_DIR" .

# Show what we're deploying
echo ""
echo "📋 Deployment contents:"
tar -tzf "$TARBALL" | head -30

# Confirm before upload (skip in auto mode)
if [[ "$AUTO_MODE" == "false" ]]; then
  echo ""
  read -p "🚀 Deploy to $VPS_HOST:$VPS_CLAWD? [y/N] " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
  fi
else
  echo ""
  echo "🚀 Auto-deploying to $VPS_HOST:$VPS_CLAWD..."
fi

# Upload and extract
echo ""
echo "⬆️  Uploading to VPS..."
scp "$TARBALL" "$VPS_HOST:/tmp/clawd-workspace.tar.gz"

echo "📂 Extracting on VPS..."
ssh "$VPS_HOST" bash << EOF
  # Backup existing (if any)
  if [[ -d "$VPS_CLAWD" && "\$(ls -A $VPS_CLAWD 2>/dev/null)" ]]; then
    echo "  → Backing up existing workspace..."
    cp -r "$VPS_CLAWD" "${VPS_CLAWD}.bak.\$(date +%Y%m%d%H%M%S)"
  fi

  # Extract new content
  mkdir -p "$VPS_CLAWD"
  tar -xzf /tmp/clawd-workspace.tar.gz -C "$VPS_CLAWD"

  # Fix ownership
  chown -R clawdis:clawdis "$VPS_CLAWD"

  # Show result
  echo ""
  echo "✅ Deployed workspace:"
  ls -la "$VPS_CLAWD"

  # Cleanup
  rm /tmp/clawd-workspace.tar.gz
EOF

# Cleanup local staging
rm -rf "$STAGING_DIR" "$TARBALL"

echo ""
echo "✅ Workspace synced to VPS!"
echo ""
echo "Next steps:"
echo "  • Restart gateway: ssh $VPS_HOST 'systemctl restart clawdis-gateway'"
echo "  • Check logs: ssh $VPS_HOST 'journalctl -u clawdis-gateway -f'"
