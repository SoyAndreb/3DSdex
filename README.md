# 3DSdex

> Manage and update your Nintendo 3DS CFW SD card or local folder from the browser: Luma3DS, GodMode9, homebrew tools, and SD maintenance. A fork of [PicoDex](https://github.com/rasalopa/picodex) built for personal maintenance and educational use. No install, no backend — your files never leave your machine.

## What it does

- **Flexible SD or local folder selection**: open your Nintendo 3DS SD card or a local backup/working folder directly in the browser to test changes safely before touching your console.
- **CFW & homebrew overview**: inspect key Nintendo 3DS CFW components and paths (`boot.firm`, `boot.3dsx`, `/luma/`, `/gm9/`, `/3ds/`, `/cias/`), with strict protection for `/Nintendo 3DS/` and `/boot9strap/`.
- **SD health & cleanup**: detects OS junk files (such as `._*`, `.DS_Store`, `.fseventsd` without `no_log`, `.Trashes`, and `.Spotlight-V100`), misplaced `.cia` and `.3dsx` files in the SD root, and missing essential files, with two-step confirmation before deleting anything.
- **FBI / NSA detection rule**: if an `FBI` setup is detected without `NSA`, recommends checking out [NSA](https://github.com/tinaut1986/NSA); if `NSA` is already present, stays quiet.
- **Browser compatibility (Chromium + Firefox)**: supports direct read/write access via the File System Access API in Chromium-based browsers, and a compatible folder mode with `.zip` export for Firefox and other browsers without directory write support.

Everything runs client-side. 3DSdex has no server, no accounts, and no telemetry.

## Requirements

- **Browsers**:
  - **Chromium-based browsers** (Chrome, Edge, Brave, Opera) for direct folder/SD access via the File System Access API.
  - **Firefox** (and other browsers without directory write support) via compatible folder mode with `.zip` export.
- **Storage target**: a Nintendo 3DS SD card (Old/New 3DS with CFW) or a local copy/working folder.

## Using it

Run it locally:

```bash
git clone https://github.com/SoyAndreb/3DSdex
cd 3dsdex
npm install
npm run dev

```

Open the printed URL, select **your SD card or a local working/backup folder**, and run a scan.

## Development

```bash
npm run dev          # dev server
npm test             # unit tests (vitest)
npm run lint         # oxlint
npm run format:check # prettier
npm run build        # production build

```

Core logic lives in `src/lib/` (`sd3ds.ts`, `sdAudit.ts`, `compatFs.ts`, `zipExport.ts`) alongside state management in `src/state/` and views in `src/views/`.

## Current Status

* **Phase 1 & Phase 2 completed**: 3DSdex rebranding, flexible SD/local folder picker, Chromium + Firefox compatibility (`compatFs.ts` and `zipExport.ts`), protected system paths, SD health auditing, and FBI/NSA detection logic.
* **Upcoming phases**: SHA-256 CFW release verification (`Luma3DS`, `GodMode9`, Homebrew Launcher), safe pre-overwrite backups (`safeBackup.ts`), homebrew/payload management, and Luma screenshot support.

## Acknowledgements

* [rasalopa/picodex](https://github.com/rasalopa/picodex) for the original project architecture and UI foundation.
* [3ds.hacks.guide](https://3ds.hacks.guide/) for Nintendo 3DS CFW layout and best-practice documentation.
* [tinaut1986/NSA](https://github.com/tinaut1986/NSA) for the NSA title manager project.

## License

[MIT](https://www.google.com/search?q=LICENSEMIT)