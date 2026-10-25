# Actual screenshots and capture provenance

These PNGs were captured from the actual production extension built by `npm run release` at version 0.1.0, in a fresh persistent Chromium context with the unpacked `.output/chrome-mv3` extension loaded. Playwright used its installed bundled Chromium (from the sibling demo-readiness worktree), without modifying extension HTML, CSS, canvas output, browser APIs, or application state. These are not illustrations, placeholders, composites, or fabricated browser screenshots.

All files are **1280 × 800 pixels**, RGB PNG, captured with device scale factor 1:

| File                           | Actual state                                                                                |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| `screenshots/01-sources.png`   | Source chooser before starting audio                                                        |
| `screenshots/02-file-bars.png` | A locally generated two-tone WAV actually playing; default Bars renderer and file transport |

The WAV is a 20-second generated test tone (220 Hz plus an 880 Hz harmonic), not music licensed from a third party; it was selected through the real file input. The file name visible in the screenshots is `los16-local-demo.wav`.

**Layout limitation:** captures navigate directly to the loaded extension's `sidepanel.html` at a 1280 × 800 viewport, so they show the extension page expanded, not Chrome's native narrow side-panel container or browser toolbar. Do not label them as browser-chrome/native side-panel captures. No tab-capture/microphone success is claimed by these file-playback screenshots. They are listing candidates subject to publisher approval; capture native side-panel context as an additional human release check if required for an accurate listing presentation.

## Reproduction outline

Build the production extension; launch an extension-capable persistent Chromium with `--disable-extensions-except=<absolute unpacked path>` and `--load-extension=<absolute unpacked path>`. Read the extension ID from its service-worker URL, navigate to `chrome-extension://<id>/sidepanel.html`, and use a 1280 × 800 viewport. Capture the source chooser; select an actual local audio file in `#src-file`, wait for `#stop` to become visible and audio rendering to start, then capture. Do not inject fake source state or paint over the renderer. Review final images after any UI changes.
