# Audio Visualizer

Chrome extension that turns whatever you're listening to into real-time visuals in the
side panel. Frequency range, sensitivity, color, and shape are all yours to tune.

Senior project, CIS4914, University of Florida. Team Los Tigres Dorados.

## Status

Microphone capture and basic spectrum visualization are implemented. Other sources
and advanced controls are still in progress. Backlog is in Linear (team `LOS`), grouped into
four milestones: walking skeleton → tab & mic audio → controls & presets → ship.

## Audio sources

| Source     | How                                       | Notes                                                 |
| ---------- | ----------------------------------------- | ----------------------------------------------------- |
| Tab audio  | `chrome.tabCapture.getMediaStreamId`      | YouTube, Spotify web, any playing tab                 |
| Microphone | `getUserMedia`                            | Prompted from a real tab, never the panel (see below) |
| Local file | `<input type="file">` + `decodeAudioData` | Easiest to build and test                             |

## Architecture

```
background.ts                     side panel (extension page)
 opens the side panel on click     AudioContext
 mints tabCapture stream ids  ──▶  ├─ AnalyserNode ──▶ canvas renderer
                                   └─ destination  ──▶ speakers
```

The side panel is a normal extension page, so it owns the `AudioContext`, the
`AnalyserNode`, and the canvas. FFT data never crosses a message boundary.

Two Chrome behaviors shape everything:

- **`tabCapture` mutes the tab** unless the stream is re-piped to
  `audioContext.destination`. Connect it, or the user's music goes silent.
- **Side panels can't show permission prompts.** The mic flow opens
  `permission.html` in a real tab once; the permission is scoped to the extension origin,
  so the panel inherits it.

Whether the side panel can consume a tabCapture stream id directly is unverified;
LOS-17 is a timeboxed spike. The fallback is an offscreen document that owns the audio
graph and posts frames to the panel.

## Stack

- Manifest V3, `chrome.sidePanel`, Chrome 116+
- [WXT](https://wxt.dev) on Vite: file-based entrypoints, generated manifest, auto-reload
- TypeScript 5.9, ESLint 10, Prettier, Vitest
- Web Audio API, Canvas 2D

## Development

```bash
npm install        # runs `wxt prepare`
npm run dev        # build + watch → .output/chrome-mv3
npm run build      # production build
npm run zip        # store-ready zip
npm run lint && npm run typecheck && npm test
```

Load once via `chrome://extensions` → Developer mode → Load unpacked → `.output/chrome-mv3`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch and PR flow.

## Microphone setup and testing

The microphone source opens a permission tab on first use, then starts the spectrum
in the panel after access is allowed. Later uses skip the permission tab while the
grant remains valid. Microphone audio is analysed without speaker playback to avoid
feedback. Stop releases the device; switching sources or closing the panel also
cleans up capture.

To verify in Chrome after `npm run build` and loading `.output/chrome-mv3`:

1. Click Microphone with permission unset. Allow access in the new tab; it should
   close and the bars should respond to sound.
2. Stop and click Microphone again. It should start without another permission tab.
3. Reset the permission, retry, and choose Block. Both pages should show recovery
   guidance. Open microphone settings, allow/reset access, and retry Microphone.
4. Close the permission tab without answering, then retry from the panel.
5. Stop while permission is pending; the permission tab should close and capture
   must not start later. Stop during capture and check Chrome's mic indicator clears.
6. Try with no microphone or with access blocked in Windows privacy settings; the
   panel should explain the failure.

Tab and file sources remain separate unfinished issues. The basic audio engine and
bar renderer are included so the microphone flow can be exercised end to end.

## Settings and presets

Open **Settings & presets** in the panel to adjust sensitivity, smoothing,
frequency range, resolution, colors, and coloring by frequency or amplitude.
Changes apply live. Spectrum, Bass glow, Voice, and Electric are built in.
Save up to 12 named custom presets; saving the same name (case-insensitive)
replaces that custom preset. Selecting a preset loads it. Built-ins cannot be
deleted; deleting a custom preset leaves the current visualization unchanged.

The active settings and custom presets use a versioned item in
`chrome.storage.sync`. The background worker first stages edits in
`chrome.storage.local`, so closing the panel during debounce does not discard
them. Sync writes debounce for 750 ms, with a 5-second maximum wait during
continuous input and at least 2.5 seconds between writes across settings and
presets. Pending edits recover when the worker starts, including after browser
restart. Failed sync writes retain the local copy and retry after 10 seconds.
The UI reports storage errors instead of claiming an unsuccessful save worked.
Cross-device sync depends on Chrome Sync being enabled.

Manual verification after rebuilding and reloading the extension:

1. Change several controls, immediately close the panel, and reopen it. Confirm
   all values and the visualization restore.
2. Restart Chrome and confirm the values restore again.
3. Load each built-in preset. Save a custom preset, modify the controls, and load
   the custom preset again. Check replacement by name and deletion.
4. Drag sensitivity continuously. In the extension service worker's DevTools,
   inspect Extension Storage: the pending local state changes immediately while
   sync writes remain batched. Release the slider and confirm the final value.
5. Run `npm test` for simulated worker restarts, rapid edits, sync failures,
   invalid stored data, and preset operations.

No additional Chrome extension is required. Optional VS Code extensions matching
this repository are ESLint (`dbaeumer.vscode-eslint`) and Prettier
(`esbenp.prettier-vscode`). Node.js 22+ is required for development. On Windows,
use `npm.cmd` if PowerShell blocks the `npm.ps1` wrapper.
