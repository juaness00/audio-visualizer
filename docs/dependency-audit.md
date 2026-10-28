# LOS-36 dependency advisory remediation

## Scope and result

Baseline: `932d9b52085a458c47b75bcf8c4d3bccef06bc25`.
Local verification: Node `v26.8.1`, npm `11.19.0`, macOS.

Re-ran `npm audit --json` against the unchanged baseline lockfile before editing.
It reported **4 vulnerable packages: 2 high, 2 moderate**, with no critical,
low, or informational package findings. The four packages are not four distinct
advisories: Vitest inherits the mocker's findings.

| Package          | Baseline | Fixed lockfile | Baseline advisories                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ---------------- | -------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vitest`         | 5.0.1    | 5.0.5          | Inherits `@vitest/mocker`                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| `@vitest/mocker` | 5.0.1    | 5.0.5          | [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8), [GHSA-xp26-3454-mjgp](https://github.com/advisories/GHSA-xp26-3454-mjgp)                                                                                                                                                                                                                                                                                                         |
| `vite`           | 8.3.0    | 8.3.5          | [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv), [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw), [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm), [GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw), [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22), [GHSA-vfpm-58rq-9qcg](https://github.com/advisories/GHSA-vfpm-58rq-9qcg) |
| `source-map-js`  | 1.2.1    | 1.2.2          | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)                                                                                                                                                                                                                                                                                                                                                                                   |

Final `npm audit --json` and `npm audit --omit=dev --json` both exit 0:

```json
{ "info": 0, "low": 0, "moderate": 0, "high": 0, "critical": 0, "total": 0 }
```

This is a registry advisory snapshot, not a guarantee of absence of vulnerabilities.

## Minimal compatible remediation

Queried actual npm metadata (`npm view <package>@<version> --json`) for the
first fixed versions: Vitest 5.0.3, Vite 8.3.3, source-map-js 1.2.2. The audit
ranges end before 5.0.3/1.2.2 and at Vite 8.3.2 inclusive. These versions exist;
no hypothetical release or forced major upgrade was used.

Raised only the Vitest direct dependency floor from `^5.0.1` to `^5.0.3`, then ran:

```sh
npm update vitest vite source-map-js --package-lock-only --ignore-scripts
```

npm selected compatible patch releases Vitest/mocker 5.0.5 and Vite 8.3.5,
plus source-map-js 1.2.2. Metadata for the selected Vitest/Vite releases was
also checked. The lockfile includes their dependency updates (including
Rolldown platform bindings, PostCSS, and Vitest helpers) and npm deduplication.
No broad `npm update`, `npm audit fix --force`, overrides, new direct transitive
dependencies, package script changes, or source changes were used.

WXT remains 0.21.4, ESLint 10.10.0, TypeScript 5.9.3. WXT 0.21.4 metadata accepts
Vite `^8.0.0-0`, ESLint `^10.0.0`, and TypeScript `>=5.4`; Vitest 5.0.5 accepts
Vite `^8.0.0`. `npm ls --all` exits 0 without invalid peers.

The existing package Node declaration (`>=22`) is broader than the tools'
actual support: Vitest 5.0.5 requires `^22.12.0 || ^24.0.0 || >=26.0.0`, and
Vite requires `^20.19.0 || >=22.12.0`. Use a mutually supported version (verified
here on Node 26.8.1). The engine declaration was not changed in this scoped fix.

## Exposure disposition

All affected packages are development dependencies. Vitest/mocker are test
infrastructure: mock-registration injection and Windows redirect traversal
concern a reachable test/browser-mocking server, not an extension-user input
path. Vite advisories concern development-server editor-launch endpoints,
custom middleware, and filesystem serving boundaries; Windows-specific issues
remain relevant to contributors even though validation ran on macOS. Keep dev
and test servers private and do not expose them to untrusted networks.

Source-map-js is pulled through PostCSS in the build toolchain; malicious indexed
source maps could stall a tooling process. Treat third-party build inputs as
untrusted. Updating rather than ignoring these findings protects contributors
and CI even where end-user runtime exposure is not established.

The production WXT build packages static extension HTML/JS/CSS and a background
worker, not a Vite or Vitest server. No extension-runtime exploit was demonstrated
or assumed. A clean production-only npm audit is not sufficient evidence by
itself because this extension bundles source through development dependencies;
the full audit, build, and real-extension smoke check are also recorded here.

## Verification and limitations

| Check                                                | Observed result                                                                                                                                                                                                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                                             | PASS; clean installation, WXT prepare succeeds, audit reports zero findings                                                                                                                                                                              |
| `npm test`                                           | PASS; 14 files, 108 tests on Vitest 5.0.5                                                                                                                                                                                                                |
| `npm run lint`                                       | PASS                                                                                                                                                                                                                                                     |
| `npm ls --all`                                       | PASS; no invalid peer/dependency tree                                                                                                                                                                                                                    |
| `npm run typecheck`                                  | BLOCKED by ambient ancestor type packages: TS2688 for `chai 2`, `chrome 2`, `deep-eql 2`, `esrecurse 2`, `filesystem 2`, `filewriter 2`, `har-format 2`                                                                                                  |
| `npx tsc --noEmit --typeRoots ./node_modules/@types` | PASS; isolates this worktree from unrelated ancestor `@types` directories; no tsconfig edit                                                                                                                                                              |
| `npm run build`                                      | PASS; WXT 0.21.4 / Vite 8.3.5 builds chrome-mv3, 50.72 kB total                                                                                                                                                                                          |
| `npm run format:check`                               | FAIL; existing formatting in `src/entrypoints/sidepanel/main.ts`, `src/entrypoints/sidepanel/settings.ts`, `src/render/modes/radial.ts`; untouched by this change                                                                                        |
| Full and production-only audits                      | PASS; all severity counts zero                                                                                                                                                                                                                           |
| Real extension smoke                                 | PASS on Playwright Chromium 156.0.8078.4; built extension loaded with a fresh persistent profile, real service worker and extension origin, settings enabled, generated WAV playback, pause, stop, and all five mode selections; no uncaught page errors |

The browser smoke used the already installed Playwright from sibling
`demo-readiness`, with a scratch-only script/profile/screenshot; it adds no test
dependency here and does not mock Chrome APIs. Modes exercised: bars, waveform,
radial, particles, awareness. It proves extension loading and basic transport/UI
compatibility, not full rendering correctness or visual fidelity. Actual tab
capture, microphone permission/capture, and full interactive browser acceptance
remain pending. No closure of LOS-36 browser acceptance is claimed.

npm 11 emitted an install-script review warning for optional `fsevents@2.3.3`;
installation and all passing gates above completed. No global install-script
policy was changed. Unrelated source formatting and ancestor type pollution are
not repaired as part of this dependency-only remediation.
