# audio-visualizer

Chrome extension (MV3) that turns whatever you're listening to into a real-time
visualization in the side panel — driven by frequency, color, shape, and
sensitivity controls.

## Status

Early scaffold. Backlog tracked in Linear.

## Audio sources

| Source | API | Notes |
| --- | --- | --- |
| Tab audio | `chrome.tabCapture.getMediaStreamId` | YouTube, Spotify web, any playing tab |
| Microphone | `getUserMedia` | Prompted from the side panel, an extension page |
| Local file | `<input type="file">` + `decodeAudioData` | No capture permission needed |

## Architecture

```
service worker  ──getMediaStreamId──▶  side panel page
 (no DOM, no Web Audio)                AudioContext
 opens side panel                      ├─ AnalyserNode  ──▶ canvas renderer
 mints stream ids                      └─ destination   ──▶ speakers (see below)
```

The side panel is a normal extension page, so it owns the `AudioContext`, the
`AnalyserNode`, and the canvas. FFT data never crosses a message boundary.

**Gotcha:** `tabCapture` mutes the captured tab unless the stream is re-piped to
`audioContext.destination`. Connect it, or the user's music goes silent.

## Stack

- Manifest V3, `chrome.sidePanel`
- Vite + TypeScript, `@crxjs/vite-plugin`
- Web Audio API (`AnalyserNode`) for FFT frequency data
- Canvas 2D renderer

## Development

```bash
npm install
npm run dev     # then load dist/ via chrome://extensions → Load unpacked
npm run build
```
