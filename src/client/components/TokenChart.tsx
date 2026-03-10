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

function cursorPlugin(
  turnCount: number,
  onTurnHover?: (turnIndex: number | null) => void,
): uPlot.Plugin {
  let lastIdx: number | null = null;

  function setCursor(u: uPlot) {
    const idx = u.cursor.idx;
    if (idx == null || idx < 0 || idx >= turnCount) {
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
  }

  return {
    hooks: {
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
      plugins: [cursorPlugin(turns.length, stableOnTurnHover)],
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
