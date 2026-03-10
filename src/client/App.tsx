import { useState } from "react";
import type { SessionMeta, ParseResult } from "../shared/types";
import { useFetch } from "./hooks/useApi";
import { usePolling } from "./hooks/usePolling";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SessionList } from "./components/SessionList";
import { TokenChart } from "./components/TokenChart";
import { DetailPopup } from "./components/DetailPopup";
import "./App.css";

export function App() {
  const [selected, setSelected] = useState<SessionMeta | null>(null);
  const [popupTurn, setPopupTurn] = useState<number | null>(null);

  const {
    data: sessions,
    loading: sessionsLoading,
    error: sessionsError,
  } = useFetch<SessionMeta[]>("/api/sessions");

  const sessionUrl = selected
    ? `/api/sessions/${selected.id}?project=${encodeURIComponent(selected.projectPath)}`
    : null;
  const {
    data: sessionData,
    loading: sessionLoading,
    error: sessionError,
  } = useFetch<ParseResult>(sessionUrl);

  const pollUrl = selected
    ? `/api/sessions/${selected.id}/poll?project=${encodeURIComponent(selected.projectPath)}`
    : null;
  const polledData = usePolling(pollUrl);

  const displayData = polledData ?? sessionData;

  return (
    <ErrorBoundary>
      <div className="app">
        <header className="app-header">
          <h1>Claude Context Analyzer</h1>
        </header>
        <div className="app-layout">
          <aside className="app-sidebar">
            {sessionsLoading && (
              <div className="sidebar-loading">Loading sessions...</div>
            )}
            {sessionsError && (
              <div className="sidebar-error">
                Failed to load sessions: {sessionsError}
              </div>
            )}
            <SessionList
              sessions={sessions ?? []}
              selectedId={selected?.id ?? null}
              onSelect={(s) => {
                setSelected(s);
                setPopupTurn(null);
              }}
            />
          </aside>
          <main className="app-main">
            {!selected && (
              <div className="app-placeholder">
                Select a session to view token usage
              </div>
            )}
            {selected && sessionLoading && (
              <div className="app-loading">Loading session data...</div>
            )}
            {selected && sessionError && (
              <div className="app-error">
                Failed to load session: {sessionError}
              </div>
            )}
            {selected && displayData && (
              <div className="session-detail">
                <h2>
                  Session: {selected.id.slice(0, 8)}...
                </h2>
                <p>
                  {displayData.turns.length} turns
                  {displayData.skippedLines > 0 && (
                    <span className="skipped-count">
                      {" "}({displayData.skippedLines} skipped)
                    </span>
                  )}
                </p>
                {displayData.warnings.length > 0 && (
                  <div className="session-warnings">
                    {displayData.warnings.map((w, i) => (
                      <div key={i} className="warning">{w}</div>
                    ))}
                  </div>
                )}
                <TokenChart
                  turns={displayData.turns}
                  onTurnClick={setPopupTurn}
                />
              </div>
            )}
            {popupTurn !== null && displayData && displayData.turns[popupTurn] && (
              <DetailPopup
                turnIndex={popupTurn}
                userMessage={displayData.turns[popupTurn].userMessage}
                onClose={() => setPopupTurn(null)}
              />
            )}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
