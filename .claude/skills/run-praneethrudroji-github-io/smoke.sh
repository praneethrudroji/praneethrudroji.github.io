#!/usr/bin/env bash
# Build, serve, and screenshot the Jekyll blog end-to-end.
#
# What it does:
#   1. Builds the site with `bundle exec jekyll build` (production env).
#   2. Background-launches `jekyll serve` on 127.0.0.1:4000 with --skip-initial-build.
#   3. Polls until the home page responds 200.
#   4. Curls / and /posts/<slug>/ to verify HTML.
#   5. Uses headless Chrome to screenshot the home page and a post page
#      into /tmp/blog-shots/.
#   6. Stops the server.
#
# Exit codes:
#   0 — site built, served, screenshots written.
#   non-zero — something failed; the relevant log is in /tmp/jekyll-serve.log.
#
# Override the port with PORT=4001 ./smoke.sh

set -euo pipefail

PORT="${PORT:-4000}"
HOST="127.0.0.1"
SHOTS="/tmp/blog-shots"
LOG="/tmp/jekyll-serve.log"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

# Walk up to the repo root regardless of where the script is invoked from.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../../.." && pwd)"
cd "$REPO"

# Put Homebrew's Ruby 3.3 ahead of system Ruby 2.6 on PATH.
if [ -x /opt/homebrew/opt/ruby@3.3/bin/ruby ]; then
  export PATH="/opt/homebrew/opt/ruby@3.3/bin:$PATH"
fi

echo ">> Ruby: $(ruby --version)"
echo ">> Bundler: $(bundle --version)"

echo ">> Building site (JEKYLL_ENV=production)"
JEKYLL_ENV=production bundle exec jekyll build -d _site >/tmp/jekyll-build.log 2>&1
echo "   built. Log: /tmp/jekyll-build.log"

echo ">> Starting jekyll serve on $HOST:$PORT (background)"
rm -f "$LOG"
nohup bundle exec jekyll serve -H "$HOST" -P "$PORT" --skip-initial-build --no-watch >"$LOG" 2>&1 &
SERVE_PID=$!
trap 'kill "$SERVE_PID" 2>/dev/null || true' EXIT

echo ">> Waiting for readiness"
for i in $(seq 1 30); do
  if curl -sf -o /dev/null "http://$HOST:$PORT/"; then
    echo "   ready after ${i}s"
    break
  fi
  sleep 1
done

if ! curl -sf -o /dev/null "http://$HOST:$PORT/"; then
  echo "!! Server never came up. Tail of $LOG:" >&2
  tail -40 "$LOG" >&2
  exit 1
fi

echo ">> Smoke-checking HTML"
curl -sf "http://$HOST:$PORT/" | grep -q '<title>Praneeth Rudroji</title>' \
  || { echo "!! home page missing expected <title>" >&2; exit 1; }
curl -sf "http://$HOST:$PORT/posts/what-is-clustered-vs-non-clustered-index/" \
  | grep -q 'Clustered vs Non-Clustered Index' \
  || { echo "!! post page missing expected heading" >&2; exit 1; }
echo "   home + post HTML look good"

if [ -x "$CHROME" ]; then
  mkdir -p "$SHOTS"
  echo ">> Screenshotting via headless Chrome -> $SHOTS"
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --window-size=1280,1600 \
    --screenshot="$SHOTS/home.png" \
    "http://$HOST:$PORT/" >/dev/null 2>&1
  "$CHROME" --headless --disable-gpu --hide-scrollbars \
    --window-size=1280,1600 \
    --screenshot="$SHOTS/post.png" \
    "http://$HOST:$PORT/posts/what-is-clustered-vs-non-clustered-index/" >/dev/null 2>&1
  ls -lh "$SHOTS"/*.png
else
  echo "!! Chrome not found at: $CHROME"
  echo "   skipping screenshots; set CHROME=/path/to/chrome to enable"
fi

echo ">> Stopping server (pid $SERVE_PID)"
kill "$SERVE_PID" 2>/dev/null || true
wait "$SERVE_PID" 2>/dev/null || true
trap - EXIT

echo ">> DONE"
