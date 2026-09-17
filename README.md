# Audio Visualizer

Chrome extension that turns whatever you're listening to into real-time visuals in the
side panel. Frequency range, sensitivity, color, and shape are all yours to tune.

Senior project, CIS4914, University of Florida. Team Los Tigres Dorados.

## Status

Skeleton. Builds, loads, side panel opens. Backlog is in Linear (team `LOS`), grouped into
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
