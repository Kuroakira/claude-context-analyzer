import type { ParsedTurn } from "../../shared/types";

export type ChartData = [number[], number[], number[], number[], number[]];

export function toChartData(turns: ParsedTurn[]): ChartData {
  const xs: number[] = [];
  const inputTokens: number[] = [];
  const outputTokens: number[] = [];
  const cacheCreation: number[] = [];
  const cacheRead: number[] = [];

  for (const turn of turns) {
    xs.push(turn.turnIndex);
    inputTokens.push(turn.usage.input_tokens);
    outputTokens.push(turn.usage.output_tokens);
    cacheCreation.push(turn.usage.cache_creation_input_tokens);
    cacheRead.push(turn.usage.cache_read_input_tokens);
  }

  return [xs, inputTokens, outputTokens, cacheCreation, cacheRead];
}
