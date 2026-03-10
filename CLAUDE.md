# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Project Is

A full-stack TypeScript web app that analyzes Claude conversation logs (JSONL files from `~/.claude/projects/`) to visualize token consumption patterns. Hono backend + React 19 frontend + uPlot charting.

## Commands

```bash
npm run dev           # Start server (:4100) + client (:5173) concurrently
npm run dev:server    # Backend only (tsx watch, hot-reload)
npm run dev:client    # Frontend only (Vite HMR)
npm run build         # tsc + vite build → dist/
npm test              # vitest run (single run)
npm run test:watch    # vitest (watch mode)
npm run typecheck     # tsc --noEmit
```

No linter or formatter is configured.

## Architecture

**Three-layer structure:**
- `src/server/` — Hono API server on port 4100 (localhost only). Discovers sessions from `~/.claude/projects/*/`, parses JSONL files, serves parsed turn data with token usage breakdowns.
- `src/client/` — React 19 SPA served by Vite on port 5173. Proxies `/api/*` to the backend. Components: SessionList (sidebar), TokenChart (uPlot), RequestTimeline, DetailPanel (right sidebar).
- `src/shared/types.ts` — Shared TypeScript interfaces (`ParsedTurn`, `UsageData`, `ContextBreakdown`, `SessionMeta`, etc.)

**API endpoints:**
- `GET /api/sessions` — List all discovered sessions
- `GET /api/sessions/:id?project=...` — Full parsed session data
- `GET /api/sessions/:id/poll?project=...` — Incremental updates (polling, not SSE/WebSocket)

**Key design decisions (documented in `claudedocs/progress.md`):**
- Polling over SSE for live updates (simplicity for v1)
- Full-read + incremental-parse, not streaming
- Token estimation via `chars / 4` approximation (not API calls)
- uPlot chosen over Chart.js for performance
- `fs.watchFile` for single-file monitoring (no chokidar dependency)

## Testing

Tests are colocated with source files (`*.test.ts`). Vitest with Node environment + jsdom. Test data uses helper factories (e.g., `makeAssistantRecord()`). No mocking libraries — direct testing preferred.

## Conventions

- Strict TypeScript throughout (ES2022, bundler module resolution)
- Functional React components with custom hooks (`useApi`, `usePolling`)
- Dark theme UI (CSS, no preprocessor or CSS-in-JS)
- Path traversal protection on session ID resolution
- Server binds to 127.0.0.1 only (local tool, no auth)
