# Contributing

Small team, one repo, one rule: nothing lands on `main` without a PR that CI passed.

## Setup

```bash
git clone https://github.com/juaness00/audio-visualizer.git
cd audio-visualizer
npm install          # also runs `wxt prepare`, which generates .wxt/
npm run dev          # builds to .output/chrome-mv3 and watches
```

Load it once: `chrome://extensions` → enable Developer mode → **Load unpacked** →
pick `.output/chrome-mv3`. WXT reloads the extension on save after that.

## Pick up an issue

Every issue lives in Linear (team `LOS`). Start from its page: the right sidebar shows a
branch name. Use it, or make one with the alias:

```bash
git config alias.lb '!f() { id=$(echo "$1" | tr "[:upper:]" "[:lower:]"); shift; slug=$(echo "$*" | tr "[:upper:]" "[:lower:]" | tr -cs "a-z0-9" "-" | sed "s/-$//"); git checkout -b "$(git config user.name | tr -cd "a-z")/${id}-${slug}"; }; f'
git lb LOS-12 canvas renderer     # → <you>/los-12-canvas-renderer
```

Any branch name containing the issue id (`los-12`) links to Linear automatically.

## Open a PR

- Title: what it does, not what you did. `Bar spectrum renderer`, not `worked on renderer`.
- Body: first line `Closes LOS-12`. Merging then moves the issue to Done on its own.
- CI must be green: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.
- One review from a teammate.
- Squash merge. The branch is deleted automatically.

## Where things go

```
src/entrypoints/   the pages Chrome loads: background worker, side panel, permission page
src/audio/         AudioEngine + the three sources (file, tab, mic)
src/render/        Renderer interface, frame loop, one file per shape mode
src/settings/      VisualizerSettings type, defaults, chrome.storage persistence
src/utils/         small pure helpers
tests/             vitest; `npm test`
```

Stubs that throw `Error('TODO LOS-n')` mark exactly where an issue's work goes.

## Conventions

- TypeScript strict. No `any` without a comment saying why.
- No allocation inside the render loop. Reuse buffers.
- Prettier formats, ESLint lints. Run `npm run format` before pushing if unsure.
- Commit messages: short imperative subject. Body only when the _why_ isn't obvious.
