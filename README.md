# Nericx

<div align="center">
  <img src="iconhe.jpg" alt="Nericx Logo" width="128" height="128">
  
  **Link and listen to music with osu!**
  
  A modern desktop application built with Vue 3, TypeScript, and Electron for managing and playing osu! music collections.

  [![Electron](https://img.shields.io/badge/Electron-36.5.0-47848F?style=flat&logo=electron&logoColor=white)](https://electronjs.org/)
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

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- osu! installed on your system

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/MegumiKatou02/Nericx-v2.git
   cd nericx
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
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

# Start only Electron (requires built Vue app)
npm run dev:electron
```

### Production Build
```bash
# Build Vue app
npm run build

# Build for Windows
npm run dist:win

# Build for macOS
npm run dist:mac

# Build for Linux
npm run dist:linux
```

## 📁 Project Structure

```
nericx/
├── src/
│   ├── ui/                 # Vue.js frontend
│   │   ├── components/     # Vue components
│   │   ├── styles/         # CSS/SCSS styles
│   │   └── main.ts         # Vue app entry point
│   ├── electron/           # Electron main process
│   │   ├── main.ts         # Main Electron process
│   │   ├── music.ts        # Music player logic
│   │   ├── discord.ts      # Discord integration
│   │   └── util.ts         # Utility functions
│   └── main/               # Additional main process files
├── dist-vue/               # Built Vue app
├── dist-electron/          # Built Electron app
└── iconhe.jpg              # Application icon
```

## 🎛️ Configuration

### First Setup
1. Launch the application
2. Navigate to the "General" tab
3. Select your osu! installation folder
4. Save the configuration

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

