# Local Chrome Web Store artifact

## One command from a fresh checkout

Prerequisites: Node 22+ (see `.nvmrc`), npm, network access for the lockfile install, and the `unzip` command (macOS/Linux). Run from the repository root:

```sh
npm run release
```

This installs with `npm ci`, removes stale `.output`, actually runs the production build and WXT ZIP command, and validates the **ZIP contents**, not just the loose build directory. No upload, tag, commit, signing, or Store submission occurs. Existing uncommitted source changes are included; use a clean checkout for a release. ZIP bytes are not promised to be reproducible across timestamps/platforms.

Output at the current version:

- `.output/audio-visualizer-0.1.0-chrome.zip` — local upload candidate
- `.output/chrome-mv3/` — unpacked extension for manual smoke testing

Validation checks ZIP integrity, root manifest, MV3/package version agreement, expected permissions/no host permissions, 16/32/48/128 PNG dimensions, service worker, side-panel page, and local HTML-linked assets. It prints a SHA-256 digest. It is not a Store policy audit or a complete JavaScript dependency/security review.

```sh
npm run artifact:validate -- .output/audio-visualizer-0.1.0-chrome.zip
npm test -- tests/packaging.test.ts
```

The packaging test includes a real clean-directory dependency install/build/ZIP, so it requires network/cache access and is slower than unit tests. It does not reinstall dependencies in the running test runner's checkout.

## Versioning

```sh
npm run version:set -- 0.2.0
npm run release
```

The explicit numeric MAJOR.MINOR.PATCH must increase, with components 0–65535 and no leading zeros/prerelease labels. The script keeps `package.json`, lockfile top-level version and root package version aligned; dependency versions are untouched. WXT derives the manifest version from the package. No tag or commit is created. Review and commit the two version files. This preparation intentionally retains 0.1.0; the publisher chooses the actual next release version.

## Icons

`public/icon/{16,32,48,128}.png` are an original rounded five-bar equalizer mark, not the old circle placeholders. `npm run icons` regenerates them deterministically using only Node's built-in PNG/zlib tooling and supersampling; the generator contains the editable vector-like design coordinates. WXT discovers these filenames and populates the manifest automatically.

## Remaining human gates

- Approve branding, listing copy, and screenshots against the **final integrated** artifact.
- Supply publisher account details/support contact; review and host the privacy disclosure at an actual reachable URL. No URL/contact has been invented.
- Review Chrome Sync disclosure and complete the Store's current privacy declarations/certifications yourself.
- Resolve/review dependency audit findings from installation before publishing; dependency remediation belongs to the dependency owner, not this packaging change.
- Manually smoke-test the final ZIP in supported Chrome: toolbar tab capture and audible playback, native side-panel opening, microphone permission allow/deny, file playback/pause/seek/loop, settings persistence, and Stop releasing capture.
- Rebuild after all integrated changes and version selection, then upload/submit manually only when authorized. This task does not establish approval or publication.
