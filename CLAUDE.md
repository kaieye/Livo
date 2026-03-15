# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

```bash
# Development (Electron)
npm run dev              # Start Electron app with hot reload

# Type checking
npm run typecheck        # TypeScript type checking

# Building for desktop
npm run build            # Build for current platform
npm run build:win        # Build Windows installer
npm run build:mac        # Build macOS app
npm run build:linux      # Build Linux AppImage

# Web version (development/testing)
npm run dev:web          # Start web dev server
npm run build:web        # Build for web
npm run preview:web      # Preview web build
```

## Architecture Overview

Livo is an Electron-based RSS reader inspired by Folo, with key differences: all data is stored locally (JSON files, no backend), AI features are user-configured with custom API keys, and there's no login requirement.

### Project Structure

```
src/
├── main/           # Electron main process (Node.js context)
│   ├── index.ts            # App entry point, window creation, IPC registration
│   ├── database.ts         # JSON-based local database (feeds + entries)
│   ├── handlers/           # IPC handlers (called from renderer via preload)
│   └── services/           # Background services (RSS parsing, refresh, video)
├── preload/        # Preload script (secure bridge between main/renderer)
└── renderer/       # React UI (browser context)
    └── src/
        ├── App.tsx               # Root component
        ├── components/           # React components organized by feature
        ├── store/                # Zustand state management
        └── lib/                  # Utilities
└── shared/         # TypeScript types shared between main/renderer
    └── types.ts     # Core type definitions + IPC channel constants
```

### Key Architectural Patterns

**IPC Communication**: Renderer → Preload → Main Process
- All IPC channels are defined in `src/shared/types.ts` as the `IPC` constant
- Main process handlers in `src/main/handlers/*.ts` register with `ipcMain.handle()`
- Renderer calls via `window.api.channelName()` (exposed through preload)
- Pattern: renderer calls → main handler → database operation → returns result

**Database (JSON-based)**: `src/main/database.ts`
- Stores feeds and entries as `livo-data.json` in `userData/data`
- Debounced saves (500ms) to avoid excessive disk writes
- Entry deduplication by URL
- Auto-cleanup removes old read entries beyond per-feed cap or age limit
- Migration-safe: adds missing fields (like `view`) on load

**State Management**: Zustand stores in `src/renderer/src/store/`
- `feed-store.ts`: Feed list, selected feed, unread counts
- `entry-store.ts`: Entry list, pagination, search
- `settings-store.ts`: App settings persistence
- `ai-chat-store.ts`: AI conversation state per entry
- `discover-store.ts`: RSSHub routes and categories
- `actions-store.ts`: User-defined automation rules

**Feed Refresh Cycle**: `src/main/services/feed-refresh.ts`
- Auto-refresh runs on interval (configurable in settings)
- Concurrent fetching with limited parallelism
- Conditional GET support (ETag/Last-Modified) to avoid bandwidth
- Video/audio feeds enriched with durations after refresh
- Data cleanup runs after each refresh cycle

**AI Integration**: `src/main/handlers/ai-handlers.ts`
- Supports: OpenAI, Anthropic, DeepSeek, GLM, Ollama, custom OpenAI-compatible
- Streaming responses for chat
- Non-streaming for summarize/translate
- API key and model configured per user in settings

### Important Implementation Details

**Video Handling**: `src/main/services/video-*.ts`
- YouTube videos need duration enrichment (scrapes YouTube API)
- Bilibili videos need proxy headers
- Video feeds can use pagination instead of infinite scroll

**RSS Parsing**: `src/main/services/rss-parser.ts` + `feed-utils.ts`
- Uses `rss-parser` library for Atom/RSS
- Custom extraction for media (images, videos, audio)
- Author avatar extraction from various RSS formats
- Content extraction falls back to description

**Media CDN Header Interception**: `src/main/index.ts`
- Twitter/X: strips Referer header to allow pbs.twimg.com/video.twimg.com
- YouTube: spoofs User-Agent to look like Chrome (removes Electron tokens)
- Applied in session.defaultSession.webRequest.onBeforeSendHeaders

**Feed Views**: Based on `FeedViewType` enum in `src/shared/types.ts`
- Different layouts: grid vs list, wide vs normal
- Affects which feeds are shown in each view tab
- View type stored on each feed

**i18n**: Client-side via react-i18next
- Locale files in `src/renderer/src/locales/`
- Default: zh-CN

### Adding New Features

**New IPC Channel**:
1. Add channel name to `IPC` constant in `src/shared/types.ts`
2. Create handler in `src/main/handlers/` and register in `src/main/index.ts`
3. Add to preload API in `src/preload/index.ts`
4. Call from renderer via `window.api.channelName()`

**New Database Query**: Add functions to `src/main/database.ts`
- Follow existing patterns for queries (getAll, getById, insert, update, delete)
- Always call `scheduleSave()` after data changes

**New Settings**: Add to `AppSettings` interface in `src/shared/types.ts`
- Add default to `DEFAULT_SETTINGS`
- Settings persisted in `src/main/handlers/settings-handlers.ts`

### Dependencies Notes

- **better-sqlite3 was replaced** with JSON file storage for simpler compilation
- **openai** SDK is used for all AI providers (via baseUrl configuration)
- **rss-parser** handles RSS/Atom feed parsing
- **@tanstack/react-virtual** for virtualized lists (performance)
