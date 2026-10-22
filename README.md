# Audio Visualizer

Chrome extension that turns whatever you're listening to into real-time visuals in the
side panel. Frequency range, sensitivity, color, and shape are all yours to tune.

Senior project, CIS4914, University of Florida. Team Los Tigres Dorados.

## Status

Tab, microphone, and local file capture, bars, waveform, radial, particle, and sound awareness visualizations,
and persistent settings/presets are implemented. Backlog is in Linear (team `LOS`), grouped into
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

The LOS-17 spike confirmed the side panel can consume a stream ID requested by
the toolbar action's service-worker handler. A per-window port handshake waits for
the panel to load and release any previous capture before minting the single-use
ID. The panel redeems it immediately and owns the audio graph; no offscreen
document is needed.

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

Local file playback remains unfinished.

## Tab audio setup and testing

After building and reloading the extension at `chrome://extensions`:

1. Pin Audio Visualizer in Chrome's extensions menu. Open a normal web tab and
   start audio, such as a YouTube video.
2. Click the Audio Visualizer toolbar icon. The panel opens and captures that tab
   automatically. Audio should stay audible while the visualization responds.
3. Switch between Bars, Waveform, Radial, and Particles under Settings & presets.
4. Click Stop. Capture should end and the original tab audio should continue.
5. Start again with the toolbar icon. Switch to a different playing tab and click
   the icon there to replace the captured source. Simply changing tabs keeps the
   original capture running.
6. Close the captured tab or use Chrome's stop-sharing control. The panel should
   return to its source picker and release capture.
7. Try the toolbar icon on a restricted page such as `chrome://extensions`.
   The panel should show capture recovery instructions.
8. Repeat in two Chrome windows; each toolbar click should target that window's panel.

The panel's This tab button explains how to start capture from the toolbar, which
grants access to the selected tab. Closing the panel also releases its stream.
Automated tests cover playback routing, cleanup, cancellation, capture failures,
panel startup, per-window routing, and superseded toolbar requests.

## Settings and presets

Open **Settings & presets** in the panel to adjust sensitivity, smoothing,
frequency range, resolution, choose from five color palettes, and select coloring by
frequency or amplitude. Sound Awareness displays labeled Bass, Voice / mids, and High sounds
meters so important frequency activity is visible without relying on color alone. These are
broad frequency-energy ranges, not speech recognition or a substitute for an alerting device.
Render mode selects Bars, Waveform, Radial, or Particles and is saved with settings and presets.
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
