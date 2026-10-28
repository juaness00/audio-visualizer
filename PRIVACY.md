# Audio Visualizer privacy disclosure

This describes the extension code in this repository. The publisher must review it and host an approved copy before a Chrome Web Store submission; this file is not a hosted privacy-policy URL.

## Audio stays on your device

Tab audio, microphone audio, and audio files you choose are processed locally using the browser's Web Audio API to draw visualizations. The extension does not upload audio, audio files, frequency samples, or recordings. It does not implement audio recording, analytics, advertising, or a developer-operated backend. A website playing tab audio may independently use its own network services; this disclosure concerns the extension, not that website or Chrome itself.

- **Tab audio:** capture begins after a user invokes the extension toolbar action or configured keyboard shortcut for a tab (Command+Shift+V on macOS, Ctrl+Shift+V elsewhere by default). The shortcut also stops active tab capture. Only audio is requested, not video. The tab's audio is routed to the speakers as well as the visualizer.
- **Microphone:** requested only when you select Microphone and grant Chrome/operating-system permission. An extension permission page may open to request access. Microphone audio is analyzed locally, not played back through the speakers.
- **Files:** only the file you select or drop is read and decoded locally. Playback controls include pause, seek, and loop. The extension does not upload the file.
- **Stopping:** Stop or switching sources releases the active source; microphone/tab media tracks are stopped. Removing the extension revokes its access.

## Settings can leave the device through Chrome Sync

Visualization preferences and custom presets (including names you enter) are saved through `chrome.storage.sync`; Chrome may sync them to your other signed-in browsers according to your Chrome settings. Local storage keeps pending settings writes and sync retry metadata. These settings do not contain audio or audio files. Avoid placing personal information in preset names. This means **“no audio leaves your device” is accurate; “no data ever leaves your device” is not**.

To remove preferences, delete custom presets/reset values through the UI or clear the extension's Chrome storage. Uninstalling removes local extension data; Google controls Chrome Sync retention and account-level removal.

## Permissions

See [the store permission justifications](docs/store/listing.md#permission-justifications) for the purpose of each manifest permission. No general website host permissions are requested. The microphone uses the browser's separate media-permission prompt rather than an invented `microphone` manifest permission.

## Publisher review required

No publisher identity, contact address, policy hosting location, legal certification, or retention commitment beyond the implementation above has been supplied. The publisher must provide appropriate contact/support information, approve this disclosure, and complete the Store's current privacy questionnaire before publishing.
