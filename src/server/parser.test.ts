import { describe, it, expect } from "vitest";
import { parseJsonl } from "./parser";

function makeAssistantRecord(
  usage: Record<string, unknown>,
  model = "claude-opus-4-6",
  timestamp = "2026-03-10T10:00:00Z",
) {
  return JSON.stringify({
    type: "assistant",
    timestamp,
    message: {
      model,
      usage,
      content: [{ type: "text", text: "response" }],
    },
  });
}

function makeUserRecord(
  text: string,
  timestamp = "2026-03-10T09:59:00Z",
) {
  return JSON.stringify({
    type: "user",
    timestamp,
    message: {
      content: [{ type: "text", text }],
    },
  });
}

describe("parseJsonl", () => {
  it("parses a valid user+assistant pair into a turn", () => {
    const lines = [
      makeUserRecord("Hello Claude"),
      makeAssistantRecord({ input_tokens: 100, output_tokens: 50 }),
    ].join("\n");

    const result = parseJsonl(lines);
    expect(result.turns).toHaveLength(1);
    const turn = result.turns[0];
    expect(turn.turnIndex).toBe(0);
    expect(turn.timestamp).toBe("2026-03-10T10:00:00Z");
    expect(turn.userMessage).toBe("Hello Claude");
    expect(turn.model).toBe("claude-opus-4-6");
    expect(turn.usage).toEqual({
      input_tokens: 100,
      output_tokens: 50,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    });
    // contextBreakdown and contextDelta should be present
    expect(turn.contextBreakdown).toBeDefined();
    expect(turn.contextDelta).toBeDefined();
    expect(turn.contextDelta.userText).toBeGreaterThan(0);
    expect(turn.contextDelta.assistantResponse).toBeGreaterThan(0);
    expect(result.skippedLines).toBe(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("handles multiple turns", () => {
    const lines = [
      makeUserRecord("First"),
      makeAssistantRecord({ input_tokens: 100, output_tokens: 50 }),
      makeUserRecord("Second"),
      makeAssistantRecord({ input_tokens: 200, output_tokens: 80 }),
    ].join("\n");

    const result = parseJsonl(lines);
    expect(result.turns).toHaveLength(2);
    expect(result.turns[0].turnIndex).toBe(0);
    expect(result.turns[1].turnIndex).toBe(1);
    expect(result.turns[1].userMessage).toBe("Second");
  });

  it("handles missing usage fields with defaults", () => {
    const lines = [
      makeUserRecord("Test"),
      makeAssistantRecord({}),
    ].join("\n");

    const result = parseJsonl(lines);
    expect(result.turns).toHaveLength(1);
    expect(result.turns[0].usage).toEqual({
      input_tokens: 0,
      output_tokens: 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: 0,
    });
  });

  it("includes cache tokens when present", () => {
    const lines = [
      makeUserRecord("Test"),
      makeAssistantRecord({
        input_tokens: 500,
        output_tokens: 100,
        cache_creation_input_tokens: 200,
        cache_read_input_tokens: 300,
      }),
    ].join("\n");

    const result = parseJsonl(lines);
    expect(result.turns[0].usage.cache_creation_input_tokens).toBe(200);
    expect(result.turns[0].usage.cache_read_input_tokens).toBe(300);
  });

  it("skips corrupt JSON lines and increments skippedLines", () => {
    const lines = [
      makeUserRecord("Hello"),
      "this is not valid json",
      makeAssistantRecord({ input_tokens: 100, output_tokens: 50 }),
    ].join("\n");

    const result = parseJsonl(lines);
    expect(result.turns).toHaveLength(1);
    expect(result.skippedLines).toBe(1);
  });

  it("handles empty input", () => {
    const result = parseJsonl("");
    expect(result.turns).toHaveLength(0);
    expect(result.skippedLines).toBe(0);
    expect(result.warnings).toHaveLength(0);
  });

  it("skips non-user/assistant record types", () => {
    const lines = [
      JSON.stringify({ type: "progress", timestamp: "2026-03-10T10:00:00Z", data: {} }),
      JSON.stringify({ type: "queue-operation", timestamp: "2026-03-10T10:00:00Z" }),
      makeUserRecord("Hello"),
      makeAssistantRecord({ input_tokens: 100, output_tokens: 50 }),
    ].join("\n");

    const result = parseJsonl(lines);
    expect(result.turns).toHaveLength(1);
    expect(result.skippedLines).toBe(0);
  });

  it("warns when no usage data found in any assistant record", () => {
    const lines = [
      makeUserRecord("Test"),
      JSON.stringify({
        type: "assistant",
        timestamp: "2026-03-10T10:00:00Z",
        message: { content: [{ type: "text", text: "hi" }] },
      }),
    ].join("\n");

    const result = parseJsonl(lines);
    expect(result.warnings).toContain("No usage data found in session");
  });

  it("warns when all input_tokens are zero", () => {
    const lines = [
      makeUserRecord("First"),
      makeAssistantRecord({ input_tokens: 0, output_tokens: 10 }),
      makeUserRecord("Second"),
      makeAssistantRecord({ input_tokens: 0, output_tokens: 20 }),
    ].join("\n");

    const result = parseJsonl(lines);
    expect(result.warnings).toContain(
      "All input_tokens are zero — possible format change",
    );
  });

  it("assigns assistant without preceding user an empty userMessage", () => {
    const lines = [
      makeAssistantRecord({ input_tokens: 100, output_tokens: 50 }),
    ].join("\n");

    const result = parseJsonl(lines);
    expect(result.turns).toHaveLength(1);
    expect(result.turns[0].userMessage).toBe("");
  });

  it("extracts user text excluding system-reminder tags", () => {
    const userRecord = JSON.stringify({
      type: "user",
      timestamp: "2026-03-10T09:59:00Z",
      message: {
        content: [
          { type: "text", text: "<system-reminder>hook output</system-reminder>" },
          { type: "text", text: "Real user message" },
        ],
      },
    });
    const lines = [
      userRecord,
      makeAssistantRecord({ input_tokens: 100, output_tokens: 50 }),
    ].join("\n");

    const result = parseJsonl(lines);
    expect(result.turns[0].userMessage).toBe("Real user message");
  });

  it("handles trailing newline without creating extra turn", () => {
    const lines =
      makeUserRecord("Hello") +
      "\n" +
      makeAssistantRecord({ input_tokens: 100, output_tokens: 50 }) +
      "\n";

    const result = parseJsonl(lines);
    expect(result.turns).toHaveLength(1);
  });
});
