import { useState, useEffect, useCallback } from "react";
import type { SessionMeta, ParseResult } from "../shared/types";
import { useFetch } from "./hooks/useApi";
import { usePolling } from "./hooks/usePolling";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { SessionList } from "./components/SessionList";
import { TokenChart } from "./components/TokenChart";
import { DetailPanel } from "./components/DetailPanel";
import { RequestTimeline } from "./components/RequestTimeline";
import "./App.css";

function getSessionFromUrl(): { id: string; project: string } | null {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("session");
  const project = params.get("project");
  if (id && project) return { id, project };
  return null;
}

function updateUrl(session: SessionMeta | null) {
  const url = new URL(window.location.href);
  if (session) {
    url.searchParams.set("session", session.id);
    url.searchParams.set("project", session.projectPath);
  } else {
    url.searchParams.delete("session");
    url.searchParams.delete("project");
  }
  window.history.replaceState(null, "", url.toString());
}

export function App() {
  const [selected, setSelected] = useState<SessionMeta | null>(null);
  const [hoveredTurn, setHoveredTurn] = useState<number | null>(null);
  const [showTimeline, setShowTimeline] = useState(false);
  const [urlRestored, setUrlRestored] = useState(false);

  const {
    data: sessions,
    loading: sessionsLoading,
    error: sessionsError,
  } = useFetch<SessionMeta[]>("/api/sessions");

  // Restore session from URL once sessions are loaded
  useEffect(() => {
    if (urlRestored || !sessions || sessions.length === 0) return;
    setUrlRestored(true);
    const fromUrl = getSessionFromUrl();
    if (!fromUrl) return;
    const match = sessions.find(
      (s) => s.id === fromUrl.id && s.projectPath === fromUrl.project,
    );
    if (match) setSelected(match);
  }, [sessions, urlRestored]);

  const handleSelect = useCallback((s: SessionMeta) => {
    setSelected(s);
    setHoveredTurn(null);
    updateUrl(s);
  }, []);

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
              onSelect={handleSelect}
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
              <div className="session-content">
                <div className="session-chart-area">
                  <div className="session-detail">
                    <div className="session-detail-header">
                      <div>
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
                      </div>
                      <button
                        className="timeline-toggle"
                        onClick={() => setShowTimeline((v) => !v)}
                      >
                        {showTimeline ? "Hide Requests" : "Show Requests"}
                      </button>
                    </div>
                    {displayData.warnings.length > 0 && (
                      <div className="session-warnings">
                        {displayData.warnings.map((w, i) => (
                          <div key={i} className="warning">{w}</div>
                        ))}
                      </div>
                    )}
                    <TokenChart
                      turns={displayData.turns}
                      onTurnHover={setHoveredTurn}
                    />
                  </div>
                  {showTimeline && (
                    <RequestTimeline
                      turns={displayData.turns}
                      hoveredTurn={hoveredTurn}
                      onTurnHover={setHoveredTurn}
                    />
                  )}
                </div>
                <DetailPanel
                  turn={hoveredTurn !== null ? displayData.turns[hoveredTurn] ?? null : null}
                />
              </div>
            )}
          </main>
        </div>
      </div>
    </ErrorBoundary>
  );
}
