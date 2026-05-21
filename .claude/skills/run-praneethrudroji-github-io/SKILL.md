---
name: run-praneethrudroji-github-io
description: Build, serve, test, and screenshot the Jekyll/Chirpy blog at praneethrudroji.github.io. Use when asked to run the blog locally, preview a post, take a screenshot of the site, build the site, or run html-proofer.
---

A Jekyll personal blog using the **Chirpy** theme (`jekyll-theme-chirpy ~> 7.2`).
Static site, no backend. The agent path is the smoke script in this directory:
it builds, background-launches `jekyll serve` on `127.0.0.1:4000`, smoke-checks
the HTML, and screenshots two pages with headless Chrome.

All paths below are relative to the repo root.

## Prerequisites

System Ruby on macOS is 2.6, which is **too old** for Chirpy 7.2 — it
needs Ruby 3.x. Install Ruby 3.3 (matches CI) via Homebrew:

```bash
brew install ruby@3.3
export PATH="/opt/homebrew/opt/ruby@3.3/bin:$PATH"   # for the current shell
```

`ruby@3.3` is keg-only, so it won't shadow system Ruby globally. The smoke
script and the commands below add it to `PATH` themselves, but you'll need
the export above if you run `bundle` / `jekyll` directly.

Chrome is used for screenshots — the script expects it at
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`. Override
with `CHROME=/path/to/chrome ./smoke.sh` if it's elsewhere.

## Setup

Install Ruby gems into `vendor/bundle` (keeps them out of system paths and
matches what CI does):

```bash
bundle config set --local path vendor/bundle
bundle install
```

This pulls in `jekyll 4.4`, `jekyll-theme-chirpy 7.5`, `html-proofer 5.2`,
and ~60 transitive gems. First run takes a minute or two; afterwards
`vendor/bundle/` is gitignored and reused.

## Build

```bash
JEKYLL_ENV=production bundle exec jekyll build -d _site
```

Output goes to `_site/`. Build is ~2.5s on a clean tree.

## Run (agent path)

```bash
.claude/skills/run-praneethrudroji-github-io/smoke.sh
```

What it does in order:

1. Builds the site (`jekyll build`, production env) → log in `/tmp/jekyll-build.log`.
2. Starts `jekyll serve -H 127.0.0.1 -P 4000 --skip-initial-build --no-watch`
   in the background → log in `/tmp/jekyll-serve.log`.
3. Polls `GET /` until it returns 200 (≤30s).
4. Greps the HTML for the expected `<title>` and a post heading.
5. Screenshots two pages with headless Chrome into `/tmp/blog-shots/`:
   - `home.png` — the post-list home page.
   - `post.png` — the "Clustered vs Non-Clustered Index" article.
6. Kills the server. Exits 0 on success.

Override the port with `PORT=4001 ./smoke.sh`.

Screenshots → `/tmp/blog-shots/`. Logs → `/tmp/jekyll-serve.log`, `/tmp/jekyll-build.log`.

### Just serve (no screenshots, keep it running)

If you only want the server up so you can `curl` it or browse to it:

```bash
export PATH="/opt/homebrew/opt/ruby@3.3/bin:$PATH"
JEKYLL_ENV=production bundle exec jekyll build -d _site
nohup bundle exec jekyll serve -H 127.0.0.1 -P 4000 \
  --skip-initial-build --no-watch > /tmp/jekyll-serve.log 2>&1 &
for i in {1..30}; do
  curl -sf -o /dev/null http://127.0.0.1:4000/ && break
  sleep 1
done
curl -s http://127.0.0.1:4000/ | grep -o '<title>[^<]*</title>'
# → <title>Praneeth Rudroji</title>

# Stop:
pkill -f "jekyll serve"
```

`--skip-initial-build --no-watch` is deliberate — the watcher both slows
startup and re-runs builds on every `vendor/bundle/` touch, which adds
noise to the log. Build first, then serve the static tree.

## Run (human path)

The repo ships a helper at `tools/run.sh` that runs `bundle exec jekyll s -l`
with live-reload. It blocks the shell and is fine for interactive editing,
but not for an agent loop:

```bash
bash tools/run.sh             # → blocks, http://127.0.0.1:4000, Ctrl-C to stop
bash tools/run.sh -p          # → JEKYLL_ENV=production
```

## Test

The CI check is html-proofer over the built site. Matches `.github/workflows/pages-deploy.yml`:

```bash
JEKYLL_ENV=production bundle exec jekyll build -d _site
bundle exec htmlproofer _site \
  --disable-external \
  --ignore-urls "/^http:\/\/127.0.0.1/,/^http:\/\/0.0.0.0/,/^http:\/\/localhost/"
# → "HTML-Proofer finished successfully." in <1s
```

The repo's own `tools/test.sh` does the same thing.

## Gotchas

- **System Ruby (2.6) won't work.** `bundle install` will look like it's
  going but fail on a transitive native-gem build (typically `google-protobuf`
  or `sass-embedded`). Always check `ruby --version` reads 3.x before
  running bundler. Chirpy 7.2 needs Ruby ≥3.0 — CI pins 3.3.
- **Chirpy version drift.** `Gemfile` asks for `jekyll-theme-chirpy ~> 7.2,
  >= 7.2.4`, but `bundle install` actually resolves 7.5.x. The `~>` is
  intentionally loose — don't tighten it without checking against `pages-deploy.yml`.
- **`Gemfile.lock` is gitignored** (see `.gitignore`). Every clean clone re-resolves
  versions, so build output and reproducibility depend on the live RubyGems index,
  not a lockfile. If a build was working yesterday and breaks today, suspect a
  gem update before suspecting the code.
- **`tools/run.sh` injects `--force_polling`** when it detects it's running
  inside Docker. The smoke script always runs on the host, so it skips
  polling and starts faster.
- **`baseurl` is empty** in `_config.yml` — site is served at `/`, not under
  a subpath. CI's GitHub Pages action computes `base_path` separately. If
  `tools/test.sh` is changed to set `baseurl`, the smoke script's grep
  assertions will need updating.

## Troubleshooting

- **`bundle install` fails compiling `google-protobuf` / `sass-embedded`**:
  almost always system Ruby 2.6 sneaking onto PATH. `which ruby` should
  point at `/opt/homebrew/opt/ruby@3.3/bin/ruby`. Re-export PATH and retry.
- **`jekyll serve` exits immediately with `Address already in use`**: an
  earlier serve didn't shut down cleanly. `pkill -f "jekyll serve"` then
  re-run. The smoke script's `trap` should prevent this, but a SIGKILL'd
  run can leak.
- **Screenshots are blank / Chrome errors about `web_applications`**: harmless
  noise from headless Chrome's first-run. The PNG still writes. Check
  `ls -lh /tmp/blog-shots/*.png` — if size > 50KB it rendered fine.
- **html-proofer flags a broken link after editing a post**: run with
  `--log-level :debug` to see which file/URL. External links aren't
  checked (CI ignores them with `--disable-external`); only internal
  links and asset paths matter.
