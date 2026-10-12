# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

Math-operation 4-choice quiz game (Korean UI). Not a git repository. No build step, no server: `index.html` is opened by double-click, so never use `fetch` — data is loaded via `<script src="questions.js">`. See `README.md` for user-facing run/deploy (GitHub Pages) instructions.

## Commands

`python` on this machine's PATH may be the Microsoft Store stub; the real interpreter is `%LOCALAPPDATA%\Programs\Python\Python313\python.exe`. Node is not installed.

- Regenerate data: `python gen_questions.py` (writes `questions.js`; fixed `SEED`, so output is deterministic)
- Validate data: `python validate_questions.py` (exit code 1 if any check fails; also prints summary tables and 2 samples per category)
- Unit tests (score + ranking): open `test.html` in a browser, or `node tests.js` if Node is available. `tests.js` works in both.
- Headless UI checks without Node: drive the page with Edge, e.g. `msedge --headless=new --allow-file-access-from-files --virtual-time-budget=N --dump-dom|--screenshot=... file:///...` against a throwaway harness page that clicks through an `<iframe>` of `index.html` (put harness files outside the project).

## Architecture

- `gen_questions.py` → `questions.js` (`window.QUESTIONS = [...]`, 240 questions) ← checked by `validate_questions.py`. Do not hand-edit `questions.js`; change the generator and rerun both scripts.
- Data shape: 3 areas (nat/int/rat) × 4 ops (add/sub/mul/div) = 12 categories (`category` like `"int-mul"`), 20 questions each, levels 하/중/상 = 7/8/5, answer positions A–D exactly 5 each per category.
- Question text is always a bare expression `"a op b = ?"` (second operand parenthesized if negative). The validator re-parses this text to recompute answers, so changing the format means updating both scripts.
- Numbers use the Unicode minus `−` (U+2212), never ASCII `-`; fractions are `"3/4"` strings, and rational answers/choices must be reduced fractions.
- Front end is vanilla (`index.html`, `style.css`, `app.js`, `logic.js`). Screens: home (nickname required; mode category 20 / area 80 / all 240) → category grid (in area mode the 3 column headers are the buttons) → quiz → result → ranking.
- `logic.js` holds the pure rules (UMD: `window.QuizLogic` / `require`): score = 10 + round(5 × remaining/30s) for correct answers, 0 otherwise; ranking order = score desc → total answer time asc → earlier `at`. Rankings are keyed per mode (`"category:int-mul"`, `"area:int"`, `"all"`), capped at 100 per key. Keep rule changes here and covered by `tests.js`.
- `app.js` owns DOM, per-question 30s timer (timeout counts as wrong, 30s), WebAudio sound effects, and storage. Rankings/mute live in `localStorage` (`mathquiz.records.v1`, `mathquiz.muted.v1`) behind try/catch; if storage is blocked the game still runs with in-memory records and shows `.store-notice`. "Retry wrong only" runs are `practice` and never saved to the ranking.
- `renderMath()` converts `"3/4"` strings into stacked fractions and wraps `−` in a highlighted `.neg` span; it is used for questions, choices, explanations and concepts, so keep data text in the plain-string format.
- PWA: `manifest.json` (standalone, `start_url`/`scope` `./` so it works under a GitHub Pages subpath — keep all paths relative), `icons/` (`icon.svg` is the source; `icon-512.png`/`icon-192.png`/`apple-touch-icon.png` were rendered from it), and `sw.js` (precache + cache-first, `ignoreSearch`, versioned cache `mathquiz-<VERSION>`). **When any app file changes, bump `VERSION` in `sw.js` AND `APP_VERSION` in `app.js` to the same value (the latter is shown at the bottom of the home screen so you can tell which files a phone is actually running); when adding a file the app needs, add it to `ASSETS`.** When an installed app gets a new SW (not on first install) it reloads itself on the home screen, or after returning home if a quiz is in progress.
- Fractions: one function `makeFrac()` in `app.js` and one `.frac` rule set in `style.css` serve question, choices, answer line, explanation and concept. The bar is a separate `.frac-bar` element (`background: currentColor`, height `max(2px, .12em)`, `flex: none`), not a border; do not add per-location overrides. Rendering was verified by sampling real screenshot pixels over CDP (375px, DPR 3, light/dark, choice default/pressed/correct/wrong/dim). `app.js` registers the SW only on http(s) — on `file://` it is skipped and the game still works.
- Verifying the SW needs a secure context: serve the folder on `http://127.0.0.1:<port>` (e.g. a small `http.server` script kept outside the project) and drive Edge via `--remote-debugging-port` (CDP) — headless `--dump-dom` cannot observe SW install. Offline check = stop the server, restart the browser with the same `--user-data-dir`, reload.
- Opening `index.html?check=1` adds a "skip to result" button on the quiz screen (result is not saved to the ranking).
