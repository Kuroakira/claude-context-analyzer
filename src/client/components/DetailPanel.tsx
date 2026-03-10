import type { ParsedTurn } from "../../shared/types";

interface Props {
  turn: ParsedTurn | null;
}

const BREAKDOWN_COLORS: Record<string, string> = {
  userText: "#5af",
  toolResults: "#f5a",
  systemReminder: "#fa5",
  ideContext: "#af5",
  assistantResponse: "#a5f",
  images: "#5fa",
};

const BREAKDOWN_LABELS: Record<string, string> = {
  userText: "User Text",
  toolResults: "Tool Results",
  systemReminder: "System / MCP / Skills",
  ideContext: "IDE / Commands",
  assistantResponse: "Assistant Response",
  images: "Images",
};

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

const CONTEXT_LIMIT = 200_000;

export function DetailPanel({ turn }: Props) {
  if (!turn) {
    return (
      <aside className="detail-panel">
        <div className="detail-panel-header">
          <h3>Turn Detail</h3>
        </div>
        <div className="detail-panel-empty">
          Hover over the chart to see turn details
        </div>
      </aside>
    );
  }

  const { usage, contextBreakdown, contextDelta, userMessage } = turn;

  const contextUsed = usage.input_tokens + usage.cache_creation_input_tokens + usage.cache_read_input_tokens;
  const contextPct = Math.min((contextUsed / CONTEXT_LIMIT) * 100, 100);
  const contextColor = contextPct >= 85 ? "#f55" : contextPct >= 70 ? "#fa5" : "#5fa";

  const tokenRows = [
    { label: "Input", value: usage.input_tokens, color: "#5af" },
    { label: "Output", value: usage.output_tokens, color: "#f5a" },
    { label: "Cache Create", value: usage.cache_creation_input_tokens, color: "#5fa" },
    { label: "Cache Read", value: usage.cache_read_input_tokens, color: "#fa5" },
  ];

  const breakdownEntries = Object.entries(contextBreakdown).filter(([, v]) => v > 0);
  const breakdownTotal = breakdownEntries.reduce((sum, [, v]) => sum + v, 0);

  const deltaEntries = Object.entries(contextDelta).filter(([, v]) => v > 0);
  const deltaTotal = deltaEntries.reduce((sum, [, v]) => sum + v, 0);

  return (
    <aside className="detail-panel">
      <div className="detail-panel-header">
        <h3>Turn {turn.turnIndex}</h3>
        {turn.timestamp && (
          <span className="detail-panel-time">
            {new Date(turn.timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>

      <div className="detail-panel-scroll">
        {contextUsed > 0 && (
          <div className="detail-section">
            <div className="detail-context-usage-label">
              <span>Context Window</span>
              <span style={{ color: contextColor }}>
                {formatTokenCount(contextUsed)} / {formatTokenCount(CONTEXT_LIMIT)} ({contextPct.toFixed(1)}%)
              </span>
            </div>
            <div className="detail-context-usage-bar">
              <div
                className="detail-context-usage-fill"
                style={{ width: `${contextPct}%`, background: contextColor }}
              />
            </div>
          </div>
        )}

        <div className="detail-section">
          <h4>Tokens</h4>
          <div className="detail-token-grid">
            {tokenRows.map((row) => (
              <div key={row.label} className="detail-token-item">
                <span className="tt-dot" style={{ background: row.color }} />
                <span className="detail-token-label">{row.label}</span>
                <span className="detail-token-value">{formatTokenCount(row.value)}</span>
              </div>
            ))}
          </div>
        </div>

        {breakdownEntries.length > 0 && (
          <div className="detail-section">
            <h4>Context Composition</h4>
            <div className="tt-breakdown-bar" style={{ height: 8, marginBottom: 8 }}>
              {breakdownEntries.map(([key, val]) => {
                const pct = (val / breakdownTotal) * 100;
                if (pct < 1) return null;
                return (
                  <div
                    key={key}
                    className="tt-bar-seg"
                    style={{ width: `${pct}%`, background: BREAKDOWN_COLORS[key] ?? "#666" }}
                    title={`${BREAKDOWN_LABELS[key] ?? key}: ${formatTokenCount(val)}`}
                  />
                );
              })}
            </div>
            <div className="detail-breakdown-list">
              {breakdownEntries.map(([key, val]) => {
                const pct = ((val / breakdownTotal) * 100).toFixed(1);
                return (
                  <div key={key} className="detail-token-item">
                    <span className="tt-dot" style={{ background: BREAKDOWN_COLORS[key] ?? "#666" }} />
                    <span className="detail-token-label">{BREAKDOWN_LABELS[key] ?? key}</span>
                    <span className="detail-token-value">{formatTokenCount(val)} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {deltaTotal > 0 && (
          <div className="detail-section">
            <h4>Added this turn</h4>
            <div className="detail-breakdown-list">
              {deltaEntries.map(([key, val]) => (
                <div key={key} className="detail-token-item">
                  <span className="tt-dot" style={{ background: BREAKDOWN_COLORS[key] ?? "#666" }} />
                  <span className="detail-token-label">{BREAKDOWN_LABELS[key] ?? key}</span>
                  <span className="detail-token-value">+{formatTokenCount(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="detail-section detail-section-message">
          <h4>User Request</h4>
          <pre className="detail-message-content">{userMessage || "(no message)"}</pre>
        </div>
      </div>
    </aside>
  );
}
