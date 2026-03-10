import { describe, it, expect, vi, beforeEach } from "vitest";
import { SessionWatcher } from "./watcher";
import * as fs from "node:fs";

vi.mock("node:fs");
const mockedFs = vi.mocked(fs);

function makeUserLine(text: string) {
  return JSON.stringify({
    type: "user",
    timestamp: "2026-03-10T09:59:00Z",
    message: { content: [{ type: "text", text }] },
  });
}

function makeAssistantLine(inputTokens: number, outputTokens: number) {
  return JSON.stringify({
    type: "assistant",
    timestamp: "2026-03-10T10:00:00Z",
    message: {
      model: "claude-opus-4-6",
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
      content: [{ type: "text", text: "response" }],
    },
  });
}

describe("SessionWatcher", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("detects file size changes", () => {
    const watcher = new SessionWatcher();

    mockedFs.statSync.mockReturnValueOnce({ size: 1000 } as fs.Stats);
    expect(watcher.hasChanged("/path/to/file.jsonl")).toBe(true);

    mockedFs.statSync.mockReturnValueOnce({ size: 1000 } as fs.Stats);
    expect(watcher.hasChanged("/path/to/file.jsonl")).toBe(false);

    mockedFs.statSync.mockReturnValueOnce({ size: 1500 } as fs.Stats);
    expect(watcher.hasChanged("/path/to/file.jsonl")).toBe(true);
  });

  it("initial getSessionData reads and parses full file", () => {
    const watcher = new SessionWatcher();
    const content = makeUserLine("Hello") + "\n" + makeAssistantLine(100, 50) + "\n";
    const contentSize = Buffer.byteLength(content, "utf-8");

    // getSessionData -> hasChanged (statSync) -> readFileSync
    mockedFs.statSync.mockReturnValue({ size: contentSize } as fs.Stats);
    mockedFs.readFileSync.mockReturnValue(content);

    const result = watcher.getSessionData("/path/to/file.jsonl");
    expect(result.turns).toHaveLength(1);
    expect(result.turns[0].usage.input_tokens).toBe(100);
    expect(result.turns[0].userMessage).toBe("Hello");
  });

  it("incremental read appends new turns to cache", () => {
    const watcher = new SessionWatcher();
    const filePath = "/path/to/file.jsonl";

    // Initial read
    const line1 = makeUserLine("First") + "\n" + makeAssistantLine(100, 50) + "\n";
    const line1Size = Buffer.byteLength(line1, "utf-8");

    mockedFs.statSync.mockReturnValue({ size: line1Size } as fs.Stats);
    mockedFs.readFileSync.mockReturnValue(line1);

    const result1 = watcher.getSessionData(filePath);
    expect(result1.turns).toHaveLength(1);

    // Incremental read — file grew with new lines
    const line2 = makeUserLine("Second") + "\n" + makeAssistantLine(200, 80) + "\n";
    const line2Bytes = Buffer.from(line2, "utf-8");
    const totalSize = line1Size + line2Bytes.length;

    // Reset mocks for second call
    vi.resetAllMocks();
    mockedFs.statSync.mockReturnValue({ size: totalSize } as fs.Stats);
    mockedFs.openSync.mockReturnValue(3);
    mockedFs.readSync.mockImplementation(
      (_fd: number, buffer: NodeJS.ArrayBufferView) => {
        const target = buffer as Buffer;
        line2Bytes.copy(target, 0, 0, Math.min(line2Bytes.length, target.length));
        return Math.min(line2Bytes.length, target.length);
      },
    );
    mockedFs.closeSync.mockReturnValue(undefined);

    const result2 = watcher.getSessionData(filePath);
    expect(result2.turns).toHaveLength(2);
    expect(result2.turns[0].userMessage).toBe("First");
    expect(result2.turns[1].userMessage).toBe("Second");
    expect(result2.turns[1].turnIndex).toBe(1);
  });

  it("buffers incomplete last line during incremental read", () => {
    const watcher = new SessionWatcher();
    const filePath = "/path/to/file.jsonl";

    const completeLine = makeUserLine("Hello") + "\n" + makeAssistantLine(100, 50) + "\n";
    const incompletePart = '{"type":"user","timesta';
    const content = completeLine + incompletePart;
    const contentSize = Buffer.byteLength(content, "utf-8");

    mockedFs.statSync.mockReturnValue({ size: contentSize } as fs.Stats);
    mockedFs.readFileSync.mockReturnValue(content);

    const result = watcher.getSessionData(filePath);
    expect(result.turns).toHaveLength(1);
  });
});
