# NextGenDM

**Fast. Smart. Reliable.**

A modern, cross-platform, open-source desktop download manager built with Rust and React. An IDM alternative engineered from scratch with original architecture.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-brightgreen)

---

## Features

- 🚀 **High-Performance Download Engine** — HTTP/HTTPS downloads with intelligent segmented downloading
- 🎯 **Smart File Detection** — Automatic category detection, filename extraction, and MIME type handling
- ⏸️ **Pause & Resume** — Seamless pause/resume with crash recovery support
- 🎨 **Modern UI** — Beautiful dark-mode interface with glassmorphism, gradients, and smooth animations
- 📂 **Auto-Categorization** — Automatically sorts downloads into Videos, Audio, Images, Documents, etc.
- 🔐 **Secure** — URL validation, path traversal protection, checksum verification
- 💾 **Persistent State** — SQLite database for download history and crash recovery
- 🌐 **Browser Integration** — Chrome/Edge/Firefox extension for one-click downloads *(coming soon)*
- ⚡ **Lightweight** — Minimal RAM usage, responsive with thousands of downloads

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Core Engine** | Rust, Tokio, reqwest |
| **GUI Framework** | Tauri v2 |
| **Frontend** | React 19, TypeScript |
| **Styling** | TailwindCSS, shadcn/ui, Framer Motion |
| **State** | Zustand |
| **Database** | SQLite (rusqlite) |
| **Installer** | Tauri Bundler (MSI/EXE) |

## Prerequisites

- [Node.js](https://nodejs.org/) v18+
- [Rust](https://rustup.rs/) (stable)
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) (Windows)
- WebView2 Runtime (usually pre-installed on Windows 10/11)

## Getting Started

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/yourusername/NextGenDM.git
cd NextGenDM
npm install
```

### 2. Development Mode

Run the app in development mode with hot-reload:

```bash
npm run tauri dev
```

This will:
- Start the Vite dev server on port 1420
- Compile the Rust backend
- Launch the Tauri window with DevTools available

### 3. Build for Production

Build the installer (MSI + EXE):

```bash
npm run tauri build
```

Output files will be in `src-tauri/target/release/bundle/`:
- `msi/NextGenDM_0.1.0_x64_en-US.msi` — Windows Installer
- `nsis/NextGenDM_0.1.0_x64-setup.exe` — NSIS Installer

## Project Structure

```
NextGenDM/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   ├── ui/            # shadcn/ui primitives
│   │   ├── layout/        # Layout (Sidebar, Header)
│   │   └── downloads/     # Download-specific components
│   ├── stores/            # Zustand state management
│   ├── hooks/             # Custom React hooks
│   ├── lib/               # Utilities & Tauri wrappers
│   └── types/             # TypeScript type definitions
├── src-tauri/             # Rust backend
│   ├── src/
│   │   ├── engine/        # Download engine core
│   │   ├── db/            # Database layer
│   │   ├── commands/      # Tauri IPC commands
│   │   ├── state/         # Application state
│   │   ├── config/        # Configuration
│   │   └── utils/         # Utilities
│   ├── capabilities/      # Tauri v2 permissions
│   └── icons/             # Application icons
└── browser-extension/     # Browser extension (future)
```

## Architecture

NextGenDM follows Clean Architecture with clear separation of concerns:

- **Engine Layer** — Core download logic, protocol handling, progress tracking
- **Data Layer** — SQLite database, repository pattern for CRUD operations
- **Command Layer** — Tauri IPC commands bridging frontend and backend
- **UI Layer** — React components, Zustand stores, event handling

## License

MIT License — see [LICENSE](LICENSE) for details.

## Author

**Ayush Hande** — [GitHub](https://github.com/yourusername)
