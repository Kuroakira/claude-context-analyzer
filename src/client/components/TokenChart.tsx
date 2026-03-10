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
        onTurnHover?.(null);
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

    const opts: uPlot.Options = {
      width: el.clientWidth,
      height: 400,
      series: SERIES,
      plugins: [tooltipPlugin(turns, stableOnTurnHover)],
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
