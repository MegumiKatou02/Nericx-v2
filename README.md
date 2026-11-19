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
   git clone https://github.com/MegumiKatou02/Nericx-v2.git
   cd Nericx-v2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Provide the bundled ffmpeg** (needed to play/convert `.avi` and `.mkv`
   beatmap videos; ~24 MB, not committed to the repo)
   ```bash
   npm run build:ffmpeg     # Windows: builds the slim binary (see below)

   npm run fetch:ffmpeg     # checks it is in place, and says what is missing
   ```

   The app ships a custom ffmpeg built only for this job: it demuxes the
   containers beatmaps use, muxes mp4, and encodes libx264/aac when a stream
   cannot be copied verbatim. That is ~24 MB instead of ~100 MB for a
   general-purpose build, which carries dozens of codecs and protocols the app
   never calls. `npm run build:ffmpeg` needs MSYS2 (UCRT64) with x264; the
   script documents every component it enables and how to get the toolchain.
   If you have no toolchain, `npm run fetch:ffmpeg:fallback` downloads a
   prebuilt general-purpose build instead.

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

# Build for Windows (also checks the bundled ffmpeg is present)
npm run dist:win

# Build for macOS (place the ffmpeg binary in resources/ffmpeg/darwin-arm64/ first)
npm run dist:mac

# Build for Linux (place the ffmpeg binary in resources/ffmpeg/linux-x64/ first)
npm run dist:linux
```

## 📁 Project Structure

```
Nericx-v2/
├── src/
│   ├── ui/                 # Vue renderer and components
│   └── electron/           # Electron main, preload, IPC and services
├── tests/                  # Node test-runner unit and contract tests
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

