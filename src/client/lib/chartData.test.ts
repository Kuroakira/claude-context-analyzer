import { describe, it, expect } from "vitest";
import { toChartData } from "./chartData";
import type { ParsedTurn } from "../../shared/types";

const emptyBreakdown = { userText: 0, toolResults: 0, systemReminder: 0, ideContext: 0, assistantResponse: 0, images: 0 };

function makeTurn(
  turnIndex: number,
  usage: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number },
): ParsedTurn {
  return {
    turnIndex,
    timestamp: `2026-03-10T10:0${turnIndex}:00Z`,
    userMessage: `Turn ${turnIndex}`,
    model: "claude-opus-4-6",
    usage: {
      input_tokens: usage.input_tokens,
      output_tokens: usage.output_tokens,
      cache_creation_input_tokens: usage.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: usage.cache_read_input_tokens ?? 0,
    },
    contextBreakdown: emptyBreakdown,
    contextDelta: emptyBreakdown,
  };
}

describe("toChartData", () => {
  it("transforms turns into uPlot data format", () => {
    const turns = [
      makeTurn(0, { input_tokens: 100, output_tokens: 50 }),
      makeTurn(1, { input_tokens: 200, output_tokens: 80 }),
      makeTurn(2, { input_tokens: 300, output_tokens: 120 }),
    ];

    const data = toChartData(turns);
    // [x-values, input_tokens, output_tokens, cache_creation, cache_read]
    expect(data).toHaveLength(5);
    expect(data[0]).toEqual([0, 1, 2]); // turn indices
    expect(data[1]).toEqual([100, 200, 300]); // input_tokens
    expect(data[2]).toEqual([50, 80, 120]); // output_tokens
    expect(data[3]).toEqual([0, 0, 0]); // cache_creation
    expect(data[4]).toEqual([0, 0, 0]); // cache_read
  });

  it("includes cache tokens when present", () => {
    const turns = [
      makeTurn(0, {
        input_tokens: 100,
        output_tokens: 50,
        cache_creation_input_tokens: 200,
        cache_read_input_tokens: 300,
      }),
    ];

    const data = toChartData(turns);
    expect(data[3]).toEqual([200]);
    expect(data[4]).toEqual([300]);
  });

  it("returns empty arrays for no turns", () => {
    const data = toChartData([]);
    expect(data).toEqual([[], [], [], [], []]);
  });
});
