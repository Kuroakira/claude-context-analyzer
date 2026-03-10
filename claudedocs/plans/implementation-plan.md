# Implementation Plan: Claude Context Analyzer

## Overview
React + Vite + Hono で構築するClaude Codeセッションログ可視化ダッシュボード。
`npm run dev` で起動し、ブラウザでtoken消費推移を確認できる。

## Task Dependency Graph
```
Task 1 (setup) → Task 2 (parser) → Task 3 (API) → Task 4 (app shell + session list)
                                                  → Task 5 (token chart)
                                                  → Task 6 (detail popup + live updates)
                                                  → Task 7 (error handling)
                                                  → Final Review
```
Task 4, 5 は Task 3 完了後に並列可能だが、単一コンテキストで実行するため sequential。

---

## Task 1: Project Setup + Smoke Test (~200 lines)

### Files to create
- `package.json` — dependencies: react, react-dom, hono, @hono/node-server, uplot, concurrently, tsx, vitest, @testing-library/react, jsdom, typescript, vite, @vitejs/plugin-react
- `tsconfig.json` — base config
- `tsconfig.node.json` — server target (Node)
- `vite.config.ts` — React plugin, proxy `/api` → localhost:3001
- `index.html` — Vite entry point
- `src/client/main.tsx` — React entry
- `src/client/App.tsx` — 最小限のApp component
- `src/server/index.ts` — 最小限のHono server (health endpoint)
- scripts in package.json: `dev`, `dev:server`, `dev:client`, `test`, `typecheck`

### Tests
- `src/server/index.test.ts` — health endpoint returns 200

### Verification
- `npm run typecheck && npm test`
- `npm run dev` で両サーバー起動確認

### Review: None (scaffolding)

---

## Task 2: Shared Types + JSONL Parser (~300 lines)

### Files to create
- `src/shared/types.ts` — SessionRecord, UsageData, ParsedTurn, SessionMeta types（ParsedTurnにmodelフィールドを含む。v2コスト計算への拡張性確保）
- `src/server/parser.ts` — JSONL parser (defensive, optional chaining, sanity checks)
- `src/server/parser.test.ts` — TDD: valid records, missing fields, corrupt lines, sanity checks

### TDD order
1. Write test cases first (valid assistant record, missing usage, corrupt JSON, empty file, sanity check warnings)
2. Implement parser to make tests pass

### Verification
- `npm run typecheck && npm test`

### Review: Light — `code-quality` + `simplicity`

---

## Task 3: API Server + Session Discovery (~350 lines)

### Files to create/modify
- `src/server/sessions.ts` — session discovery (scan directories, extract metadata)
- `src/server/sessions.test.ts` — TDD: directory scanning, metadata extraction
- `src/server/index.ts` — add API routes: GET /api/sessions, GET /api/sessions/:id

### API endpoints
- `GET /api/sessions` — returns session list with metadata (id, start time, first message preview, project path)
- `GET /api/sessions/:id?project=<path>` — returns parsed session data (turns with usage)

### TDD order
1. Session discovery tests (mock fs)
2. API endpoint tests (Hono test client)
3. Implementation

### Verification
- `npm run typecheck && npm test`

### Review: Light — `code-quality` + `simplicity`

---

## Task 4: React App Shell + Session List (~350 lines)

### Files to create/modify
- `src/client/App.tsx` — layout with session list + detail area
- `src/client/components/SessionList.tsx` — session list with search/filter
- `src/client/hooks/useApi.ts` — fetch wrapper + polling hook
- `src/client/App.css` — basic styling

### Features
- Session list displaying: start time, first message preview（先頭100文字）, project name
- Keyword search (client-side filter on metadata)
- Date filter (today, last 3 days, all)
- Session selection → triggers data fetch

### TDD order
1. API fetch hook tests (mock fetch)
2. Component logic tests (filtering)
3. Implementation

### Verification
- `npm run typecheck && npm test`
- Visual: ブラウザで session list 表示確認

### Review: Light — `code-quality` + `simplicity`

---

## Task 5: Token Chart with uPlot (~350 lines)

### Files to create
- `src/client/components/TokenChart.tsx` — uPlot wrapper (useRef + useEffect)
- `src/client/lib/chartData.ts` — transform ParsedTurn[] → uPlot data format
- `src/client/lib/chartData.test.ts` — TDD: data transformation

### Features
- Line chart: input_tokens, output_tokens over turn index
- Additional lines: cache_creation_input_tokens, cache_read_input_tokens
- Responsive sizing (ResizeObserver)
- Turn index as x-axis, token count as y-axis

### TDD order
1. chartData transformation tests
2. Implementation

### Verification
- `npm run typecheck && npm test`
- Visual: ブラウザでチャート描画確認

### Review: Light — `code-quality` + `simplicity`

---

## Task 6: Detail Popup + Live Updates (~300 lines)

### Files to create/modify
- `src/client/components/DetailPopup.tsx` — popup overlay showing user request
- `src/client/components/TokenChart.tsx` — add click handler
- `src/client/hooks/usePolling.ts` — polling hook (3s interval)
- `src/server/watcher.ts` — fs.watchFile integration, incremental read
- `src/server/index.ts` — add polling endpoint with change detection

### Features
- Chart click → show popup with user message for that turn
- Popup dismissal (click outside / Esc)
- 3-second polling: client checks for updates, server returns new data if file changed
- fs.watchFile on active session file
- 増分読み取り時、改行文字で終わらない不完全行は次回ポーリングまで保留し、完全な行のみ処理する

### TDD order
1. Watcher tests (mock fs.watchFile)
2. Polling endpoint tests
3. Implementation

### Verification
- `npm run typecheck && npm test`
- Visual: クリック→ポップアップ、ライブ更新確認

### Review: Light — `code-quality` + `simplicity`

---

## Task 7: Error Handling + Polish (~200 lines)

### Files to modify
- Various files — add error boundaries, loading states, warnings

### Features
- Error count display (skipped records)
- Sanity check warnings (no usage data, flat input_tokens)
- Loading state for session data
- Empty state (no sessions found)
- HTML escaping for user message content (XSS prevention)

### Verification
- `npm run typecheck && npm test`

### Review: Light — `code-quality` + `simplicity` + `security-perf`

---

## Final Review (Thorough)

### Reviewers
- `spec-compliance` — Feature Specとの整合性
- `code-quality` — コード品質
- `simplicity` — 不要な複雑さの検出
- `devils-advocate` — 盲点の指摘

### Verification
- `npm run typecheck && npm test && npm run build` (if build configured)
