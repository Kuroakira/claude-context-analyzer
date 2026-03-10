import { describe, it, expect } from "vitest";
import { parseJsonl, extractUserContent } from "./parser";
import type { UserContentBlock } from "../shared/types";

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

describe("extractUserContent", () => {
  function makeRecord(content: unknown): Record<string, unknown> {
    return { type: "user", message: { content } };
  }

  it("returns user-text block for plain text", () => {
    const record = makeRecord([{ type: "text", text: "Hello Claude" }]);
    const blocks = extractUserContent(record);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: "user-text",
      text: "Hello Claude",
    });
  });

  it("returns system-context with subtype for system-reminder", () => {
    const raw = "<system-reminder>hook output here</system-reminder>";
    const record = makeRecord([{ type: "text", text: raw }]);
    const blocks = extractUserContent(record);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: "system-context",
      subtype: "system-reminder",
      text: "system-reminder (51 chars)",
      raw,
    });
  });

  it("returns system-context with subtype for available-deferred-tools", () => {
    const raw = "some prefix <available-deferred-tools>tool1\ntool2</available-deferred-tools>";
    const record = makeRecord([{ type: "text", text: raw }]);
    const blocks = extractUserContent(record);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: "system-context",
      subtype: "available-deferred-tools",
      text: `available-deferred-tools (${raw.length} chars)`,
      raw,
    });
  });

  it("returns system-context with subtype for ide_opened_file", () => {
    const raw = "<ide_opened_file>/src/index.ts content here</ide_opened_file>";
    const record = makeRecord([{ type: "text", text: raw }]);
    const blocks = extractUserContent(record);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: "system-context",
      subtype: "ide_opened_file",
      text: `ide_opened_file (${raw.length} chars)`,
      raw,
    });
  });

  it("returns system-context with subtype for command tags", () => {
    const raw = "<command-output>ls result</command-output>";
    const record = makeRecord([{ type: "text", text: raw }]);
    const blocks = extractUserContent(record);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: "system-context",
      subtype: "command",
      text: `command (${raw.length} chars)`,
      raw,
    });
  });

  it("returns tool-result block for tool_result type", () => {
    const record = makeRecord([
      {
        type: "tool_result",
        tool_use_id: "abc123",
        content: [{ type: "text", text: "file contents here" }],
      },
    ]);
    const blocks = extractUserContent(record);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: "tool-result",
      text: "tool result (18 chars)",
      raw: "file contents here",
    });
  });

  it("returns image block for image type", () => {
    const record = makeRecord([
      {
        type: "image",
        source: { type: "base64", media_type: "image/png", data: "abc" },
      },
    ]);
    const blocks = extractUserContent(record);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: "image",
      text: "image (image/png)",
    });
  });

  it("handles mixed content array", () => {
    const sysRaw = "<system-reminder>context</system-reminder>";
    const record = makeRecord([
      { type: "text", text: sysRaw },
      { type: "text", text: "User question" },
      {
        type: "tool_result",
        tool_use_id: "t1",
        content: [{ type: "text", text: "result data" }],
      },
      {
        type: "image",
        source: { type: "base64", media_type: "image/jpeg", data: "xyz" },
      },
    ]);
    const blocks = extractUserContent(record);
    expect(blocks).toHaveLength(4);
    expect(blocks[0].type).toBe("system-context");
    expect(blocks[0].subtype).toBe("system-reminder");
    expect(blocks[1].type).toBe("user-text");
    expect(blocks[1].text).toBe("User question");
    expect(blocks[2].type).toBe("tool-result");
    expect(blocks[3].type).toBe("image");
  });

  it("returns empty array for non-array content", () => {
    const record = makeRecord("just a string");
    const blocks = extractUserContent(record);
    expect(blocks).toEqual([]);
  });

  it("returns empty array when record has no message", () => {
    const blocks = extractUserContent({ type: "user" });
    expect(blocks).toEqual([]);
  });
});

describe("parseJsonl populates userContent", () => {
  it("populates userContent on ParsedTurn", () => {
    const userRecord = JSON.stringify({
      type: "user",
      timestamp: "2026-03-10T09:59:00Z",
      message: {
        content: [
          { type: "text", text: "<system-reminder>ctx</system-reminder>" },
          { type: "text", text: "My question" },
        ],
      },
    });
    const lines = [
      userRecord,
      makeAssistantRecord({ input_tokens: 100, output_tokens: 50 }),
    ].join("\n");

    const result = parseJsonl(lines);
    expect(result.turns[0].userContent).toHaveLength(2);
    expect(result.turns[0].userContent[0].type).toBe("system-context");
    expect(result.turns[0].userContent[1].type).toBe("user-text");
    expect(result.turns[0].userContent[1].text).toBe("My question");
  });

  it("defaults userContent to empty array when no user message precedes assistant", () => {
    const lines = [
      makeAssistantRecord({ input_tokens: 100, output_tokens: 50 }),
    ].join("\n");

    const result = parseJsonl(lines);
    expect(result.turns[0].userContent).toEqual([]);
  });
});
