# Reproducible demo and verification checklist

## Setup

Use Node.js 22.12+ within 22.x, 24.x, or 26+ (CI uses `.nvmrc`) and npm. In PowerShell use `npm.cmd`
if script policy prevents `npm.ps1`. No account, remote backend, or extra extension
is required. Start in the repository root of the branch being demonstrated.

```sh
npm ci
npm run build
```

Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and
select `.output/chrome-mv3`. Pin Audio Visualizer from the extensions menu. After
rebuilding, reload the extension on that page; a stale loaded build is not evidence
about the current checkout. Record `git rev-parse HEAD`, Chrome version, OS, and
microphone device before a real demo test.

## Deterministic audio, no copyrighted recording

The E2E fixture generates a 60-second, 440 Hz mono WAV mathematically. It contains
no microphone recording or third-party media. It is a steady test tone, not a
musical demonstration of every frequency range; keep system volume low.

After installing dependencies, generate the file outside the tracked source:

```sh
node --input-type=module -e "import { toneFile } from './e2e/fixture.mjs'; import { mkdirSync, writeFileSync } from 'node:fs'; mkdirSync('test-results', { recursive: true }); const file = toneFile(); writeFileSync('test-results/' + file.name, file.buffer); console.log('Created test-results/' + file.name);"
```

Expected output: `Created test-results/demo-tone.wav`. The file is ignored by git.
Playwright clears `test-results` at the start of a run: regenerate it after tests
when preparing a presentation. An owned/licensed music file can replace it for
more interesting visuals, but must not be committed as an unlicensed fixture.

## Short presentation script

1. Build/load/reload and open the side panel from the pinned toolbar icon. If the
   current page blocks capture, use **Back to sources** to continue with a file.
2. Choose `demo-tone.wav`. Show Bars, Radial, Waveform, Particles, and Sound
   Awareness. Verify audio continues while modes change. Awareness indicates
   frequency-band energy; it does not recognize speech or provide safety alerts.
3. Change gain and palette, then pause, seek, resume, and enable loop. Because the
   fixture is only 440 Hz, a frequency window excluding 440 Hz may legitimately
   show little energy. Shared control semantics still have a separate follow-up,
   [LOS-37](https://linear.app/cis4914-ltd/issue/LOS-37); do not claim all controls
   affect every renderer identically.
4. Save a preset named `Demo`, change settings, then load it. Close/reopen the
   panel and show settings restoration. A full Chrome restart is a separate check.
5. Stop file playback. Start Microphone; allow the permission in the separate
   permission tab. Explain that input is analyzed without speaker feedback. Stop
   and confirm Chrome's microphone indicator clears.
6. Play a public web tab and click the extension toolbar icon **on that tab**.
   Audio should remain audible. The panel's **This tab** button provides guidance;
   it cannot mint a fresh tab stream ID by itself.
7. Pause source-tab audio for more than two seconds: expect the silence notice.
   Resume: expect the notice to clear without restarting capture. Close the source
   tab and demonstrate the return to the picker.

Offline file playback is a presentation fallback, not a substitute for verifying
microphone or toolbar capture. If the keyboard shortcut is unavailable/conflicted,
use `chrome://extensions/shortcuts` to inspect its assignment; verify its behavior
as described in the keyboard-capture issue before advertising it as tested.

## Automated gates

```sh
npm test
npm run lint
npm run typecheck
npm run build
npx playwright install chromium
npm run test:e2e
```

The E2E suite loads the real production bundle into an isolated persistent,
**headed** bundled Chromium profile, not the user's browser profile. Linux CI uses
`npx playwright install --with-deps chromium` followed by
`xvfb-run --auto-servernum npm run test:e2e`. Build first: `test:e2e` does not silently
rebuild a stale artifact. View the report with `npx playwright show-report` and
traces with `npx playwright show-trace <test-results/path/trace.zip>`.

- `e2e/demo.spec.mjs`: actual file decoding/transport/drop, all-mode rendering smoke
  coverage, presets, reopen persistence, and settings geometry at 360/420px widths.
  A nonempty canvas and a selected mode are smoke evidence, not proof of meaningful
  acoustic response or uninterrupted audible output.
- `e2e/panel-states.spec.mjs`: real production reducer/views/render loop, with an
  explicitly **controlled capture boundary**. Fake port messages, analyser bins,
  and permission state make loading/errors/ended/silence recovery deterministic.
  These tests do **not** prove Chrome toolbar invocation, real tab capture routing,
  real microphone permissions, OS device removal, or hardware compatibility.
- Unit tests exercise the real helpers/contracts with mocked Chrome APIs where
  necessary. Unit or browser-smoke success alone does not establish Web Store
  approval or performance at 60 FPS.

Evidence: per-test screenshots, uncaught-page-error attachments, trace archives,
and the HTML report in ignored `test-results/` and `playwright-report/`. CI uploads
these as `browser-test-evidence`, including on failure. A CI configuration being
present does not mean a remote CI run has been observed.

## Mandatory real-Chrome checks (record results, do not pre-check)

Use the actual side panel, not `sidepanel.html` opened in an ordinary tab. For each
row record pass/fail/unverified, tested SHA, Chrome version, OS, steps, and screenshot
or log evidence. Use an owned/public audio source, never a private tab/recording.

| Check                                         | Expected behavior                                                                          | Status until observed |
| --------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------- |
| Toolbar capture of playing normal tab         | Visuals react and original audio remains audible                                           | Unverified            |
| Toolbar invocation / keyboard command         | Proper window opens and capture starts/stops; no stale stream ID reuse                     | Unverified            |
| Restricted page / closed captured tab         | Plain-language recovery; a permitted next capture succeeds                                 | Unverified            |
| Tab pause/resume                              | Silence banner after >2 seconds, clears automatically on sound                             | Unverified            |
| First mic Allow / repeat start                | One permission tab initially; later start uses grant                                       | Unverified            |
| Mic Deny / settings recovery                  | No repeat denied prompt; settings link works                                               | Unverified            |
| Closing permission tab / Stop while pending   | Recovery, cleanup, and no late capture                                                     | Unverified            |
| Microphone absence / device unplug            | Clear failure/recovery, indicator released; relates to Alex's LOS-29                       | Unverified            |
| Replacing source / two Chrome windows         | Correct per-window capture and release, no stale callbacks                                 | Unverified            |
| Close/reopen then full Chrome restart         | Active settings and custom preset restore                                                  | Unverified            |
| 360px side panel and 125% zoom                | Usable stage, Stop/Save/Delete reachable without horizontal clipping                       | Unverified            |
| Sixty-second performance/allocation recording | Record measured frame timing/allocations, hide/show behavior; do not assume a flat profile | Unverified            |

### Observed native check on 2026-10-25

An isolated Chrome for Testing 156.0.8078.4 instance on macOS loaded the integrated
0.1.0 artifact and captured a localhost page generating a 440 Hz tone. Native
Command+Shift+V opened the **actual side panel** and started tab capture; another
invocation returned to the picker and removed the browser's tab-sharing state.
Silencing the source showed the readable notice after the hold; restoring sound
cleared it and restored visible bars without recapturing. Closing the captured
tab returned to the picker with `The captured tab was closed.`

Screenshots: [start](demo-evidence/command-start.png),
[stop](demo-evidence/command-stop.png), [silence](demo-evidence/tab-silent.png),
[recovery](demo-evidence/tab-recovered.png), [closed tab](demo-evidence/tab-ended.png).
These observations supersede the corresponding unverified template rows **for
this macOS/Chromium run only**. They do not establish audible speaker output,
other OS shortcut behavior, toolbar clicks, restricted pages, microphone hardware,
multi-window acceptance, or all supported Chrome versions. No microphone was
recorded. Other matrix rows remain unverified.

[LOS-32](https://linear.app/cis4914-ltd/issue/LOS-32) owns automation.
[LOS-35](https://linear.app/cis4914-ltd/issue/LOS-35) assigns real-Chrome capture
sign-off to Alex. Add evidence there rather than creating another duplicate QA
issue. [LOS-19](https://linear.app/cis4914-ltd/issue/LOS-19) and
[LOS-33](https://linear.app/cis4914-ltd/issue/LOS-33) cover state/silence integration.
[LOS-40](https://linear.app/cis4914-ltd/issue/LOS-40) owns this documentation.

## Release boundary

`npm run zip` produces an extension upload archive, not a store submission. The
listing, screenshots, privacy-policy publication, account approvals, and release
checklist must be verified separately under
[LOS-16](https://linear.app/cis4914-ltd/issue/LOS-16). Do not invent a policy URL,
claim a successful store review, or publish without approval.
