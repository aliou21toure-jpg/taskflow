#!/bin/sh
# Assemble a Vercel-ready copy of TaskFlow in .vercel-build/ (git-ignored):
#   api/index.ts  → one serverless function running the Express app under /api
#   web/          → the React app, built to static files
# Then:  cd .vercel-build && vercel deploy --prod
set -eu
root=$(cd "$(dirname "$0")/../.." && pwd)
out="$root/.vercel-build"
rm -rf "$out"
mkdir -p "$out"
cp -R "$root/deploy/vercel/." "$out/"
rm "$out/prepare.sh" "$out/README.md"
cp -R "$root/api/src" "$out/server"
mkdir -p "$out/web"
cp -R "$root/web/index.html" "$root/web/src" "$out/web/"
rm -rf "$out/web/src/test" "$out/web/src/"*.test.tsx
rm "$out/server/server.ts"   # local entry point; Vercel uses api/index.ts
echo "Ready: $out"
