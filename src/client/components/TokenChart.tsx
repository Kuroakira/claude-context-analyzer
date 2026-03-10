import { useRef, useEffect } from "react";
import uPlot from "uplot";
import "uplot/dist/uPlot.min.css";
import type { ParsedTurn } from "../../shared/types";
import { toChartData } from "../lib/chartData";

interface Props {
  turns: ParsedTurn[];
  onTurnClick?: (turnIndex: number) => void;
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

export function TokenChart({ turns, onTurnClick }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<uPlot | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || turns.length === 0) return;

    const data = toChartData(turns);

    const opts: uPlot.Options = {
      width: el.clientWidth,
      height: 400,
      series: SERIES,
      axes: [
        { label: "Turn", space: 40 },
        {
          label: "Tokens",
          space: 40,
          size: 80,
        },
      ],
      scales: {
        x: { time: false },
      },
      cursor: {
        bind: {
          click: (uSelf) => {
            return (e) => {
              if (onTurnClick) {
                const idx = uSelf.cursor.idx;
                if (idx != null) {
                  onTurnClick(idx);
                }
              }
              return null;
            };
          },
          // Required by uPlot when overriding bind
          mousedown: () => () => null,
          mouseup: () => () => null,
          dblclick: () => () => null,
          mousemove: () => () => null,
          mouseleave: () => () => null,
          mouseenter: () => () => null,
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
  }, [turns, onTurnClick]);

  if (turns.length === 0) {
    return <div className="chart-empty">No turn data to display</div>;
  }

  return <div ref={containerRef} className="token-chart" />;
}
