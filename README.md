# Nericx

<div align="center">
  <img src="./icon.ico" alt="Nericx Logo" width="128" height="128">
  
  **Link and listen to music with osu!**
  
  A modern desktop application built with Vue 3, TypeScript, and Electron for managing and playing osu! music collections.

  [![Electron](https://img.shields.io/badge/Electron-45.2.3-47848F?style=flat&logo=electron&logoColor=white)](https://electronjs.org/)
  [![Vue.js](https://img.shields.io/badge/Vue.js-3.5.13-4FC08D?style=flat&logo=vue.js&logoColor=white)](https://vuejs.org/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-3178C6?style=flat&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
</div>

## ✨ Features

- 🎵 **Music Player**: Play your osu! beatmap collection with a modern interface
- 📁 **Backup Management**: Create and manage backups of your osu! data
- ⌨️ **Keyboard Shortcuts**: Quick navigation with customizable hotkeys
- 🎨 **Customizable Themes**: Dark/light themes with accent color customization
- 🔧 **Settings Management**: Persistent configuration storage
- 🖼️ **Image Viewer**: View beatmap backgrounds and artwork
- 🎮 **Discord Integration**: Rich presence support
- 🪟 **Custom Title Bar**: Frameless window with custom controls

## Images

<img width="1247" height="817" alt="image" src="https://github.com/user-attachments/assets/be5a08bb-18f3-41c5-a3fb-23c28c56b18a" />
<img width="1241" height="814" alt="image" src="https://github.com/user-attachments/assets/1cf1c5de-7361-4a6c-b038-fcad066c09de" />



## 🚀 Getting Started

### Prerequisites

- Node.js (v22.18 or newer; the test suite imports TypeScript modules directly)
- npm or yarn
- osu! installed on your system

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/MegumiKatou02/Nericx-Player.git
   cd Nericx-Player
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Provide the bundled ffmpeg** (needed to play/convert `.avi` and `.mkv`
   beatmap videos; ~24 MB, not committed to the repo)
   ```bash
   node scripts/fetch-ffmpeg-source.mjs   # downloads the pinned sources and verifies them
   npm run build:ffmpeg                   # builds the slim binary (see below)
   node scripts/stamp-ffmpeg.mjs          # writes the PE version resource
   node scripts/verify-ffmpeg.mjs --update

   npm run fetch:ffmpeg                   # checks it is present and matches its hash
   ```

   The app ships a custom ffmpeg built only for this job: it demuxes the
   containers beatmaps use, muxes mp4, and encodes libx264/aac when a stream
   cannot be copied verbatim. That is ~24 MB instead of ~100 MB for a
   general-purpose build, which carries dozens of codecs and protocols the app
   never calls. `npm run build:ffmpeg` needs MSYS2 (UCRT64) with x264; the
   script documents every component it enables and how to get the toolchain.
   If you have no toolchain, `npm run fetch:ffmpeg:fallback` downloads a
   prebuilt general-purpose build instead.

   Sources are pinned by SHA-256 (and by GPG signature for ffmpeg) in
   `scripts/pinned-sources.json`; see `scripts/PINNED-SOURCES.md` for why, and
   for what to update when the version is bumped. The binary that ships is
   pinned separately, in `resources/ffmpeg/win32-x64/ffmpeg.exe.sha256`.

4. **Start development server**
   ```bash
   npm run dev
   ```

## 🏗️ Building

### Development
```bash
# Start both Vue dev server and Electron
npm run dev

# Start only Vue dev server
npm run dev:vue

# Start only Electron (requires the Vite dev server from another terminal)
npm run dev:electron
```

### Production Build
```bash
# Build Vue app
npm run build

# Build for Windows: fetch/check the bundled ffmpeg, stamp its version
# resource, compare it against the committed hash, then build the MSI
npm run dist:win

# Just transpile + build + package, without the ffmpeg checks
# (used by CI after it has already signed and verified the binary)
npm run package:win

# Build for macOS (place the ffmpeg binary in resources/ffmpeg/darwin-arm64/ first)
npm run dist:mac

# Build for Linux (place the ffmpeg binary in resources/ffmpeg/linux-x64/ first)
npm run dist:linux
```

The Windows installer is an **MSI** only. There is no portable target: a
portable build unpacks itself into `%TEMP%` on every launch, which is both
slower and one of the most common reasons a small application is flagged by
antivirus software.

Releases are built by GitHub Actions, not on a developer machine:

| Workflow | When | What it does |
|---|---|---|
| `Build slim ffmpeg` | manually | Rebuilds the pinned ffmpeg, stamps it, and publishes it as a release asset. Run it only when bumping the version in `scripts/pinned-sources.json`. |
| `Release (Windows)` | on a `v*` tag | Fetches the pinned ffmpeg, builds the MSI, writes `SHA256SUMS.txt`, attests build provenance, and publishes a GitHub release. Signs everything if a certificate is configured. |

Signing is opt-in and needs no code change: add the `WIN_CSC_LINK` and
`WIN_CSC_KEY_PASSWORD` repository secrets and electron-builder signs the app
executable and the MSI with them; the bundled `ffmpeg.exe` gets its own
`signtool` pass in the workflow.

## 📁 Project Structure

```
Nericx-Player/
├── src/
│   ├── ui/                 # Vue renderer and components
│   └── electron/           # Electron main, preload, IPC and services
├── tests/                  # Node test-runner unit and contract tests
├── scripts/                # ffmpeg build, stamp, verify and fetch scripts
├── resources/licenses/     # Third-party license texts shipped with the app
├── dist-vue/               # Generated renderer build
└── dist-electron/          # Generated Electron main/preload build
```

## 🎛️ Configuration

### First Setup
1. Launch the application
2. Navigate to the "General" tab
3. Select your osu! installation folder
4. Save the configuration

The Backup tab uses this saved osu! path and opens a native save dialog for the `.zip` destination when you start a backup. Selected sections are validated in the Electron main process; the renderer does not choose source or destination paths.

### Finding Your osu! Folder
1. Open osu!
2. Press `Alt + Enter` to open settings
3. Go to the "General" tab
4. Scroll down to "Location" section
5. Click "Open osu! folder"

## ⌨️ Keyboard Shortcuts

- `Ctrl + 1` - General tab
- `Ctrl + 2` - Backup tab  
- `Ctrl + 3` - Music tab
- `Ctrl + 4` - Keyboard shortcuts tab
- `Ctrl + /` - Keyboard shortcuts tab (alternative)
- `Ctrl + 5` - Settings tab

## 🛠️ Technologies Used

### Frontend
- **Vue 3** - Progressive JavaScript framework
- **TypeScript** - Type-safe JavaScript
- **Vite** - Fast build tool and dev server

### Backend/Desktop
- **Electron** - Cross-platform desktop app framework
- **SQLite** - Local database for configuration
- **Howler.js** - Audio library for music playback
- **music-metadata** - Audio metadata extraction

### Additional Libraries
- **Discord RPC** - Discord rich presence integration
- **Archiver** - File compression for backups
- **Font Awesome** - Icon library

## 🛡️ Antivirus and SmartScreen

Nericx is unsigned. Without a code-signing certificate, Windows cannot tell you
who published the download, and a few antivirus engines will guess wrong about
a small program that ships its own `ffmpeg.exe`. What the release build does
about it:

- **Complete version resources.** Both `Nericx.exe` and the bundled
  `ffmpeg.exe` carry FileDescription, ProductName, CompanyName, FileVersion and
  LegalCopyright, and both name the same publisher. An unsigned binary with an
  empty version resource is the shape scanners treat as a dropped payload.
- **No portable build.** The portable target unpacked itself into `%TEMP%` on
  every launch, which is a well-known false-positive trigger. The Windows
  release is an MSI that installs to a normal location.
- **No hidden DevTools.** Developer tools and the F12 / Ctrl+Shift+I / Ctrl+Shift+J
  shortcuts are compiled out of release builds.
- **Verified, pinned inputs.** ffmpeg sources are pinned by SHA-256 and by GPG
  signature; the binary that ships is pinned by its own hash, and the release
  workflow refuses to build if the two disagree.
- **Reproducible provenance.** Every release is built on GitHub Actions, and the
  MSI plus both executables are attested with `actions/attest-build-provenance`.
  `SHA256SUMS.txt` on the release page lets you check what you downloaded:

  ```powershell
  Get-FileHash .\Nericx-*-x64.msi -Algorithm SHA256
  ```

  and compare it with the line in `SHA256SUMS.txt` (or run
  `gh attestation verify .\Nericx-*-x64.msi --repo MegumiKatou02/Nericx-Player`).

### If you get a warning

Be careful here: **do not** disable your antivirus or click through a warning
for a download you cannot verify. Only do the following for a file whose hash
matches `SHA256SUMS.txt` on the release page.

- **SmartScreen / "Windows protected your PC"** — click **More info** and check
  that the app name and publisher line up with what this README says. The
  publisher will read as unknown until releases are signed, and SmartScreen
  reputation only accumulates per certificate, so this warning is expected
  today.
- **Windows Defender or another engine flags the file** — report it. False
  positives get fixed, but the fix is per file, and an unsigned build produces a
  new file on every release:

  - Microsoft: <https://www.microsoft.com/en-us/wdsi/filesubmission> — choose
    *Software developer* → *Incorrectly detected as malware / PUA*, and include
    the repository link, the release link and the SHA-256. (You can also report
    an end-user detection there if you are not the developer.)
  - Your engine's vendor, if it is not Microsoft (Kaspersky, ESET, Bitdefender
    and others each have a false-positive form).

  A report that names the exact file hash is the only kind Microsoft can act
  on. A release bypasses this entirely once it is signed with a stable
  certificate; until then, each build has to be reported again.

## 📄 License

The application is [MIT licensed](./LICENSE). It bundles a GPL-licensed FFmpeg
binary that it runs as a separate process; the corresponding license texts and
the source offer for that binary are in
[`resources/licenses/NOTICE.md`](./resources/licenses/NOTICE.md).

