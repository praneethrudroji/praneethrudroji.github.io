# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A personal blog (Praneeth Rudroji, Senior Software Engineer) built with Jekyll using the **Chirpy** theme (`jekyll-theme-chirpy ~> 7.2`, resolves to 7.5.x). Static site, no backend/build tooling beyond Jekyll. Hosted on GitHub Pages via `.github/workflows/pages-deploy.yml`.

## Setup and commands

**A dedicated project skill (`run-praneethrudroji-github-io`) covers build/serve/test/screenshot in full detail — read it before running anything here.** Key points it documents that aren't obvious from the files alone:

- System Ruby on macOS is 2.6 — too old for Chirpy 7.2. Install and use `ruby@3.3` via Homebrew (matches CI), and `export PATH="/opt/homebrew/opt/ruby@3.3/bin:$PATH"` before running `bundle`/`jekyll` directly.
- Gems install into `vendor/bundle` (`bundle config set --local path vendor/bundle && bundle install`).
- `Gemfile.lock` is gitignored, so gem versions are re-resolved on every clean clone — if a build that worked yesterday breaks today, suspect a gem update before the code.
- Build: `JEKYLL_ENV=production bundle exec jekyll build -d _site`
- Test (matches CI exactly): `bash tools/test.sh`, which builds then runs `htmlproofer _site --disable-external --ignore-urls "..."`
- Human-interactive serve with live-reload: `bash tools/run.sh` (add `-p` for production env). This blocks the shell.
- Agent-driven serve/build/screenshot (backgrounded, non-blocking, includes headless-Chrome screenshots): `.claude/skills/run-praneethrudroji-github-io/smoke.sh`

There is no JS/npm build step for the site itself — `assets/lib` is the `chirpy-static-assets` git submodule (theme's vendored JS/fonts/icons), not a package built from source here.

## Architecture

Standard Jekyll/Chirpy content-over-convention layout — there's no custom app code, just content and theme configuration:

- `_config.yml` — single source of truth for site metadata, analytics, comments, PWA, and Jekyll build options (permalinks, kramdown/sass/compress-html settings, `exclude` list). Read this before changing anything that looks like a "setting."
- `_posts/` — blog posts, one file per post, named `YYYY-MM-DD-slug.md`. Frontmatter convention: `layout: post`, `date`, `categories: [..]`, `tags: [..]`. Permalink pattern is fixed to `/posts/:title/` in `_config.yml` — **do not change this** without updating every existing inbound post link (per the comment in `_config.yml` itself). Some posts embed audio via `{% include embed/audio.html src=... title=... %}` referencing files in `assets/media/`. Jekyll picks up posts recursively, so nested dated subdirectories (e.g. `_posts/2026/`) also work if ever used.
- `_tabs/` — top-level nav pages (`about`, `archives`, `categories`, `tags`), rendered via the `tabs` collection (`layout: page`, permalink `/:title/`).
- `_data/` — small YAML data files (`contact.yml`, `share.yml`) consumed by theme includes.
- `_plugins/posts-lastmod-hook.rb` — the only custom code in the repo; a Jekyll hook, not application logic.
- `assets/lib` — git submodule (`chirpy-static-assets`), vendored theme JS/fonts/icons. Don't hand-edit; update via the submodule.
- `_site/` and `.jekyll-cache/` — build output, gitignored, never hand-edit.

## Conventions

- New posts should follow the existing frontmatter shape (see any file in `_posts/`) and use the `[categories]`/`[tags]` arrays already in use across the blog rather than inventing a parallel taxonomy.
- No em dashes in post content — use a single dash instead. This applies to all article prose, not just code/config.
- Write posts with real depth (worked examples, code, concrete tradeoffs) grounded in the author's actual background (.NET, C#, SQL, Azure, AWS, CDC, ad-tech). A batch of generic "Introduction to X" filler posts (22 of them, covering unrelated buzzwords like VR/5G/quantum computing) was deleted in 2026-07 for being shallow, voiceless, and off-topic for this blog — don't recreate that pattern.
- Theme upgrades: the `Gemfile`'s `~> 7.2, >= 7.2.4` constraint on `jekyll-theme-chirpy` is intentionally loose (resolves to 7.5.x) — don't tighten it without checking it still matches the Ruby/Jekyll versions pinned in `.github/workflows/pages-deploy.yml`.
- `exclude:` in `_config.yml` keeps `tools/`, `README.md`, `LICENSE`, and packaging files out of the built site — add new non-content top-level files there if they shouldn't ship.
