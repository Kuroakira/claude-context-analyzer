import { useRef, useEffect, useCallback } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import type { ParsedTurn } from "../../shared/types";
import { toChartData } from "../lib/chartData";

interface Props {
  turns: ParsedTurn[];
  onTurnHover?: (turnIndex: number | null) => void;
}

const SERIES: uPlot.Series[] = [
  {},
  {
    label: "Input Tokens",
    stroke: "#5af",
    width: 2,
  },
  {
    label: "Output Tokens",
    stroke: "#f5a",
    width: 2,
  },
  {
    label: "Cache Creation",
    stroke: "#5fa",
    width: 1,
    dash: [4, 4],
  },
  {
    label: "Cache Read",
    stroke: "#fa5",
    width: 1,
    dash: [4, 4],
  },
];

function formatTokenCount(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
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

// Build a set of turn indices that have user messages for quick lookup
function buildMessageIndices(turns: ParsedTurn[]): Set<number> {
  const set = new Set<number>();
  for (let i = 0; i < turns.length; i++) {
    if (turns[i].userMessage) set.add(i);
  }
  return set;
}

function userMessageMarkerPlugin(_turns: ParsedTurn[], messageIndices: Set<number>): uPlot.Plugin {
  let hoveredIdx: number | null = null;
  let markers: HTMLDivElement[] = [];
  let container: HTMLDivElement | null = null;

  function init(u: uPlot) {
    // Create a container inside the over element (plot overlay)
    container = document.createElement("div");
    container.style.cssText = "position:absolute;inset:0;pointer-events:none;overflow:hidden;";
    u.over.appendChild(container);
  }

  function updateMarkers(u: uPlot) {
    if (!container) return;
    const xData = u.data[0];
    if (!xData) return;

    // Remove old markers
    for (const m of markers) m.remove();
    markers = [];

    // over element height = plot area height in CSS pixels
    // cursor.left uses same coordinate system (CSS px relative to over)
    const overH = u.over.offsetHeight;

    for (const i of messageIndices) {
      if (i >= xData.length) continue;
      // cursor-space X: valToPos returns CSS px relative to canvas,
      // subtract over's offset to get position within over
      const cx = u.valToPos(xData[i], "x", true) - u.over.offsetLeft;
      const isHovered = i === hoveredIdx;
      const size = isHovered ? 8 : 5;

      const el = document.createElement("div");
      el.style.cssText = `
        position:absolute;
        left:${cx - size}px;
        top:${overH - size * 1.5}px;
        width:0;height:0;
        border-left:${size}px solid transparent;
        border-right:${size}px solid transparent;
        border-bottom:${size * 1.5}px solid ${isHovered ? "#fff" : "#5af"};
        opacity:${isHovered ? 1 : 0.7};
        pointer-events:none;
      `;
      container.appendChild(el);
      markers.push(el);
    }
  }

  function setCursor(u: uPlot) {
    const idx = u.cursor.idx;
    if (idx !== hoveredIdx) {
      hoveredIdx = idx ?? null;
    }
  }

  return {
    hooks: {
      init,
      draw: updateMarkers,
      setCursor,
    },
  };
}

function tooltipPlugin(
  turns: ParsedTurn[],
  onTurnHover?: (turnIndex: number | null) => void,
): uPlot.Plugin {
  let tooltip: HTMLDivElement | null = null;
  let lastIdx: number | null = null;

  function init(u: uPlot) {
    tooltip = document.createElement("div");
    tooltip.className = "uplot-tooltip";
    tooltip.style.display = "none";
    u.over.appendChild(tooltip);
  }

  function setCursor(u: uPlot) {
    if (!tooltip) return;
    const idx = u.cursor.idx;
    if (idx == null || idx < 0 || idx >= turns.length) {
      tooltip.style.display = "none";
      if (lastIdx !== null) {
        lastIdx = null;
      }
      return;
    }

    if (lastIdx !== idx) {
      lastIdx = idx;
      onTurnHover?.(idx);
    }

    const turn = turns[idx];
    const { usage, contextBreakdown } = turn;

    // Build token rows
    const tokenRows = [
      { label: "Input Tokens", value: usage.input_tokens, color: "#5af" },
      { label: "Output Tokens", value: usage.output_tokens, color: "#f5a" },
      {
        label: "Cache Creation",
        value: usage.cache_creation_input_tokens,
        color: "#5fa",
      },
      {
        label: "Cache Read",
        value: usage.cache_read_input_tokens,
        color: "#fa5",
      },
    ];

    // Build breakdown rows (only non-zero)
    const breakdownEntries = Object.entries(contextBreakdown).filter(
      ([, v]) => v > 0,
    );
    const breakdownTotal = breakdownEntries.reduce(
      (sum, [, v]) => sum + v,
      0,
    );

    let html = `<div class="tt-header">Turn ${idx}</div>`;

    // Token values
    html += `<div class="tt-section">`;
    for (const row of tokenRows) {
      html += `<div class="tt-row">
        <span class="tt-dot" style="background:${row.color}"></span>
        <span class="tt-label">${row.label}</span>
        <span class="tt-value">${formatTokenCount(row.value)}</span>
      </div>`;
    }
    html += `</div>`;

    // Context breakdown
    if (breakdownEntries.length > 0) {
      html += `<div class="tt-divider"></div>`;
      html += `<div class="tt-section-title">Context Composition (est.)</div>`;
      html += `<div class="tt-breakdown-bar">`;
      for (const [key, val] of breakdownEntries) {
        const pct = (val / breakdownTotal) * 100;
        if (pct < 1) continue;
        html += `<div class="tt-bar-seg" style="width:${pct}%;background:${BREAKDOWN_COLORS[key] ?? "#666"}" title="${BREAKDOWN_LABELS[key] ?? key}: ${formatTokenCount(val)}"></div>`;
      }
      html += `</div>`;
      html += `<div class="tt-breakdown-list">`;
      for (const [key, val] of breakdownEntries) {
        const pct = ((val / breakdownTotal) * 100).toFixed(1);
        html += `<div class="tt-row">
          <span class="tt-dot" style="background:${BREAKDOWN_COLORS[key] ?? "#666"}"></span>
          <span class="tt-label">${BREAKDOWN_LABELS[key] ?? key}</span>
          <span class="tt-value">${formatTokenCount(val)} (${pct}%)</span>
        </div>`;
      }
      html += `</div>`;
    }

    tooltip.innerHTML = html;
    tooltip.style.display = "block";

    // Position tooltip
    const left = u.cursor.left ?? 0;
    const top = u.cursor.top ?? 0;
    const overRect = u.over.getBoundingClientRect();
    const ttWidth = 320;

    // Flip to left side if too close to right edge
    const xPos =
      left + ttWidth + 20 > overRect.width
        ? left - ttWidth - 10
        : left + 10;
    const yPos = Math.min(top, overRect.height - tooltip.offsetHeight - 10);

    tooltip.style.left = Math.max(0, xPos) + "px";
    tooltip.style.top = Math.max(0, yPos) + "px";
  }

  return {
    hooks: {
      init,
      setCursor,
    },
  };
}

export function TokenChart({ turns, onTurnHover }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);

  const stableOnTurnHover = useCallback(
    (idx: number | null) => onTurnHover?.(idx),
    [onTurnHover],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el || turns.length === 0) return;

    const data = toChartData(turns);
    const msgIndices = buildMessageIndices(turns);

    const opts: uPlot.Options = {
      width: el.clientWidth,
      height: 400,
      series: SERIES,
      plugins: [
        userMessageMarkerPlugin(turns, msgIndices),
        tooltipPlugin(turns, stableOnTurnHover),
      ],
      axes: [
        { label: "Turn", space: 40 },
        {
          label: "Tokens",
          space: 60,
          size: 90,
          values: (_u: uPlot, vals: number[]) =>
            vals.map((v) => formatTokenCount(v)),
        },
      ],
      scales: {
        x: { time: false },
      },
      cursor: {
        points: {
          size: 8,
          fill: "#fff",
          stroke: "#5af",
          width: 2,
        },
        dataIdx: (_u, seriesIdx, closestIdx) => {
          // Only snap for the first series (others follow)
          if (seriesIdx !== 1 || closestIdx == null) return closestIdx;
          // If current turn has a message, stay
          if (msgIndices.has(closestIdx)) return closestIdx;
          // Snap to nearest turn with a message (within 3 indices)
          const range = 3;
          let bestIdx = closestIdx;
          let bestDist = Infinity;
          for (const mi of msgIndices) {
            const dist = Math.abs(mi - closestIdx);
            if (dist <= range && dist < bestDist) {
              bestDist = dist;
              bestIdx = mi;
            }
          }
          return bestIdx;
        },
      },
    };

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    chartRef.current = new uPlot(opts, data, el);

    const ro = new ResizeObserver(() => {
      if (chartRef.current && el) {
        chartRef.current.setSize({
          width: el.clientWidth,
          height: 400,
        });
      }
    });
    ro.observe(el);

    return () => {
      ro.disconnect();
      chartRef.current?.destroy();
      chartRef.current = null;
    };
  }, [turns, stableOnTurnHover]);

  if (turns.length === 0) {
    return <div className="chart-empty">No turn data to display</div>;
  }

  return <div ref={containerRef} className="token-chart" />;
}
