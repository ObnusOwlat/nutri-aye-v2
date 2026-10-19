#!/usr/bin/env bash
# Builds NutriAye-Setup-<version>.exe (Windows x64) from Linux.
#   installer/build.sh [base-de-origen.sqlite]
# Needs: node/npm, makensis (dnf install mingw32-nsis), ImageMagick, curl, tar, unzip.
# The starting database is made from the given one (default backend/db/database.sqlite):
# catalog + recipes + templates, without users, patients or billing (make-seed-db.js).
set -euo pipefail

NODE_VERSION=22.23.1          # same major as development; ABI 127
SQLITE_VERSION=$(node -p "require('./backend/node_modules/better-sqlite3/package.json').version")
NODE_ABI=127

ROOT=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT"
SOURCE_DB=${1:-backend/db/database.sqlite}
CACHE=installer/.cache
STAGE=installer/.stage
OUT=installer/dist
VERSION=$(node -p "require('./backend/package.json').version")-$(git rev-parse --short HEAD)

mkdir -p "$CACHE" "$OUT"
rm -rf "$STAGE" && mkdir -p "$STAGE/app"

echo "== Node $NODE_VERSION para Windows"
NODE_ZIP=node-v$NODE_VERSION-win-x64.zip
if [ ! -f "$CACHE/$NODE_ZIP" ]; then
    curl -fsSL -o "$CACHE/$NODE_ZIP" "https://nodejs.org/dist/v$NODE_VERSION/$NODE_ZIP"
    curl -fsSL -o "$CACHE/SHASUMS256-$NODE_VERSION.txt" "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt"
fi
(cd "$CACHE" && grep " $NODE_ZIP\$" "SHASUMS256-$NODE_VERSION.txt" | sha256sum -c --quiet)
unzip -p "$CACHE/$NODE_ZIP" "node-v$NODE_VERSION-win-x64/node.exe" > "$STAGE/app/nutri-aye-server.exe"

echo "== better-sqlite3 $SQLITE_VERSION para Windows"
SQLITE_TGZ=better-sqlite3-v$SQLITE_VERSION-node-v$NODE_ABI-win32-x64.tar.gz
[ -f "$CACHE/$SQLITE_TGZ" ] || curl -fsSL -o "$CACHE/$SQLITE_TGZ" \
    "https://github.com/WiseLibs/better-sqlite3/releases/download/v$SQLITE_VERSION/$SQLITE_TGZ"

echo "== Programa"
mkdir -p "$STAGE/app/backend" "$STAGE/app/frontend" "$STAGE/app/seed"
cp -r backend/src backend/server.js backend/package.json backend/package-lock.json "$STAGE/app/backend/"
cp -r frontend/public "$STAGE/app/frontend/"
cp installer/launcher.js "$STAGE/app/"
# Data files the backend reads while running (exercises, allergens, Spanish names); not the USDA source
mkdir -p "$STAGE/app/foods-data"
cp -r foods-data/exercises foods-data/allergens foods-data/translations "$STAGE/app/foods-data/"
# Production dependencies only; no install scripts (they would build the Linux binary)
(cd "$STAGE/app/backend" && npm ci --omit=dev --ignore-scripts --no-audit --no-fund --loglevel=error)
mkdir -p "$STAGE/app/backend/node_modules/better-sqlite3/build/Release"
tar -xzf "$CACHE/$SQLITE_TGZ" -C "$STAGE/app/backend/node_modules/better-sqlite3" build/Release/better_sqlite3.node

echo "== Base inicial (desde $SOURCE_DB)"
node installer/make-seed-db.js "$SOURCE_DB" "$STAGE/app/seed/database.sqlite"

echo "== Ícono"
magick -background none -density 384 installer/icon.svg -define icon:auto-resize=256,64,48,32,16 "$STAGE/nutri-aye.ico"

echo "== Instalador"
makensis -V2 -DVERSION="$VERSION" -DSTAGE="$ROOT/$STAGE" -DOUTFILE="$ROOT/$OUT/NutriAye-Setup-$VERSION.exe" installer/nutri-aye.nsi
ls -lh "$OUT/NutriAye-Setup-$VERSION.exe"
