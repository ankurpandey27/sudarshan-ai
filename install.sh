#!/usr/bin/env bash
# Copyright (c) 2026 Ankur Pandey. Licensed under the MIT License.
# SPDX-License-Identifier: MIT
#
# Sudarshan AI installer for macOS and Linux:
#   curl -fsSL https://raw.githubusercontent.com/ankurpandey27/sudarshan-ai/master/install.sh | bash
# Installs Node.js if needed (Homebrew on macOS), puts Sudarshan AI in ~/sudarshan-ai, adds a launcher and starts it.
# Run it again any time to update. Your data stays in ~/.job-apply-agent.
set -euo pipefail

REPO="${SUDARSHAN_REPO:-https://github.com/ankurpandey27/sudarshan-ai.git}"
TARBALL="https://github.com/ankurpandey27/sudarshan-ai/archive/refs/heads/master.tar.gz"
DIR="${SUDARSHAN_HOME:-$HOME/sudarshan-ai}"

say() { printf '  %s\n' "$1"; }
node_ok() {
  command -v node >/dev/null 2>&1 &&
    node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=13)?0:1)'
}

printf '\n'
say 'Sudarshan AI - goes out, finishes the task, returns.'
printf '\n'

# 1. Node.js 22.13 or newer.
if ! node_ok; then
  if [ "$(uname)" = "Darwin" ] && command -v brew >/dev/null 2>&1; then
    say 'Installing Node.js with Homebrew...'
    brew install node >/dev/null
  fi
fi
if ! node_ok; then
  say 'Sudarshan AI needs Node.js 22.13 or newer: https://nodejs.org (or "nvm install --lts"), then run this again.'
  exit 1
fi
say "Node.js $(node -v) - ok"

# 2. The code: a git clone keeps itself up to date; without git, a tarball (run this again to update).
if [ -d "$DIR/.git" ]; then
  say "Updating $DIR..."
  git -C "$DIR" pull --ff-only --quiet
elif command -v git >/dev/null 2>&1; then
  say "Downloading Sudarshan AI to $DIR..."
  git clone --depth 1 --quiet "$REPO" "$DIR"
else
  say "Downloading Sudarshan AI to $DIR (no Git found - using the tarball)..."
  tmp="$(mktemp -d)"
  curl -fsSL "$TARBALL" | tar xz -C "$tmp"
  mkdir -p "$DIR"
  cp -R "$tmp"/sudarshan-ai-master/. "$DIR"/
  rm -rf "$tmp"
fi
[ -d "$DIR/.git" ] && touch "$DIR/.sudarshan-auto-update"

# 3. A launcher.
if [ "$(uname)" = "Darwin" ]; then
  launcher="${SUDARSHAN_SHORTCUT_DIR:-$HOME/Desktop}/Sudarshan AI.command"
  printf '#!/bin/bash\ncd "%s" && npm start\n' "$DIR" >"$launcher"
  chmod +x "$launcher"
  say "Launcher added: $launcher"
else
  apps="${SUDARSHAN_SHORTCUT_DIR:-$HOME/.local/share/applications}"
  mkdir -p "$apps"
  cat >"$apps/sudarshan.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Sudarshan AI
Comment=Job application agent
Exec=bash -c 'cd "$DIR" && npm start'
Icon=$DIR/apps/web/public/sudarshan.svg
Terminal=true
Categories=Office;
EOF
  say "Launcher added to your applications menu"
fi

# 4. Start it (the first start installs and builds - a few minutes).
if [ "${SUDARSHAN_NO_START:-0}" != "1" ]; then
  say 'Starting Sudarshan AI - it opens in your browser when ready.'
  cd "$DIR" && npm start
fi
