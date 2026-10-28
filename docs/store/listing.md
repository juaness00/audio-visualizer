# Chrome Web Store listing draft

Local preparation only. Nothing has been submitted or approved by Google. Publisher must review the final integrated build and current Store form before using this copy.

## Name

Audio Visualizer

The manifest uses Audio Visualizer; the current UI also displays GatorTasm. Confirm the intended public branding before submission; do not imply a separate publisher identity.

## Short description

Real-time visuals for tab, mic, or file audio, in the side panel.

## Detailed description

Make your sound visible while you browse. Audio Visualizer turns audio from a browser tab, your microphone, or a local audio file into live visualizations in Chrome's side panel.

Choose Bars, Waveform, Radial, Particles, or Sound Awareness. Adjust sensitivity, smoothing, frequency range, resolution, and color palettes, then save your own presets. Local audio files support pause, seek, and loop.

To capture tab audio, play sound in the tab and invoke Audio Visualizer from the Chrome toolbar or configured keyboard shortcut (Command+Shift+V on macOS, Ctrl+Shift+V elsewhere by default). The shortcut also stops active tab capture. Select Microphone to request microphone access, or choose/drop an audio file. Use Stop to release the active source. Chrome and operating-system permissions apply; protected or restricted pages may not support capture. Requires Chrome 116 or later.

Audio is processed on your device. The extension does not upload audio or audio files. Preferences and custom preset names can sync using Chrome Sync. Review the publisher's approved privacy disclosure before installing.

Sound Awareness is an audio visualization mode, not a medical, diagnostic, or safety-monitoring service.

## Single purpose

Visualize user-selected tab, microphone, or local-file audio in the Chrome side panel, with local playback and visual customization controls.

## Permission justifications

- `tabCapture`: captures the audio stream of the tab for which the user invokes the extension toolbar action or configured keyboard shortcut, so that audio can be analyzed and rendered locally. Video is not requested. Capture is not automatically started on arbitrary tabs.
- `activeTab`: provides temporary access to the user-invoked tab for tab capture. Avoids persistent access to all browsing sites.
- `sidePanel`: displays the visualization, source controls, playback controls, and settings beside the current browsing tab.
- `storage`: saves visualization preferences and custom presets in Chrome Sync; local storage buffers pending writes and retry metadata. Does not store captured audio.
- **Microphone (media prompt, not a manifest permission):** needed only when the user selects microphone input. `getUserMedia` requests audio following consent; the permission page helps Chrome display that request. No microphone audio is uploaded.

No host permissions or remotely hosted executable code are requested by this build. Recheck after integration or future changes.

## Privacy questionnaire notes — publisher must confirm

Distinguish locally processed audio from data transmitted to a developer. The code has no developer audio collection or telemetry, but Chrome Sync can transmit preferences/preset names. Do not paste a blanket “no data leaves the device” statement. Review Store definitions and the approved privacy policy before selecting declarations or certifying compliance. This document intentionally supplies neither legal certifications nor a fabricated contact/policy URL.

## Screenshots

See [screenshots.md](screenshots.md). The supplied images are actual extension-page captures, not mockups; their expanded page layout is disclosed there. Review whether native side-panel captures should replace them before submission.
