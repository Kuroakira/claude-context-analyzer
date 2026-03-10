import { describe, it, expect, vi, beforeEach } from "vitest";
import { discoverSessions, getSessionData, readFileHead } from "./sessions";
import * as fs from "node:fs";
import * as path from "node:path";

vi.mock("node:fs");

const mockedFs = vi.mocked(fs);

const PROJECTS_DIR = path.join(
  process.env.HOME ?? "~",
  ".claude",
  "projects",
);

describe("discoverSessions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("discovers sessions from project directories", () => {
    const projectDir = "-Users-test-workspace-myproject";
    const sessionFile = "abc-123.jsonl";
    const userRecord = JSON.stringify({
      type: "user",
      timestamp: "2026-03-10T10:00:00Z",
      message: { content: [{ type: "text", text: "Hello Claude" }] },
    });

    mockedFs.readdirSync.mockImplementation(
      ((dir: fs.PathLike): string[] => {
        const dirStr = String(dir);
        if (dirStr === PROJECTS_DIR) return [projectDir];
        if (dirStr.includes(projectDir)) return [sessionFile];
        return [];
      }) as typeof fs.readdirSync,
    );

    mockedFs.statSync.mockImplementation(
      ((_path: fs.PathLike): fs.Stats => {
        const p = String(_path);
        const isDir = p.endsWith(projectDir);
        return { isDirectory: () => isDir } as fs.Stats;
      }) as typeof fs.statSync,
    );

    mockedFs.openSync.mockImplementation(() => 3);
    mockedFs.readSync.mockImplementation(
      ((_fd: number, buffer: NodeJS.ArrayBufferView, _offset?: number, length?: number) => {
        const buf = Buffer.from(userRecord + "\n", "utf-8");
        const target = buffer as Buffer;
        const bytesToCopy = Math.min(buf.length, target.length, length ?? target.length);
        buf.copy(target, 0, 0, bytesToCopy);
        return bytesToCopy;
      }) as typeof fs.readSync,
    );
    mockedFs.closeSync.mockImplementation(() => undefined);

    const sessions = discoverSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toEqual({
      id: "abc-123",
      projectPath: projectDir,
      startTime: "2026-03-10T10:00:00Z",
      firstMessage: "Hello Claude",
      filePath: path.join(PROJECTS_DIR, projectDir, sessionFile),
    });
  });

  it("returns empty array when no projects exist", () => {
    mockedFs.readdirSync.mockReturnValue([]);
    const sessions = discoverSessions();
    expect(sessions).toEqual([]);
  });

  it("skips non-jsonl files", () => {
    const projectDir = "-Users-test-project";
    mockedFs.readdirSync.mockImplementation(
      ((dir: fs.PathLike): string[] => {
        const dirStr = String(dir);
        if (dirStr === PROJECTS_DIR) return [projectDir];
        if (dirStr.includes(projectDir)) return ["readme.md", "config.json"];
        return [];
      }) as typeof fs.readdirSync,
    );
    mockedFs.statSync.mockImplementation(
      ((_path: fs.PathLike): fs.Stats => {
        return { isDirectory: () => true } as fs.Stats;
      }) as typeof fs.statSync,
    );

    const sessions = discoverSessions();
    expect(sessions).toEqual([]);
  });

  it("truncates first message to 100 characters", () => {
    const projectDir = "-Users-test-project";
    const sessionFile = "sess-1.jsonl";
    const longMessage = "A".repeat(200);
    const userRecord = JSON.stringify({
      type: "user",
      timestamp: "2026-03-10T10:00:00Z",
      message: { content: [{ type: "text", text: longMessage }] },
    });

    mockedFs.readdirSync.mockImplementation(
      ((dir: fs.PathLike): string[] => {
        const dirStr = String(dir);
        if (dirStr === PROJECTS_DIR) return [projectDir];
        if (dirStr.includes(projectDir)) return [sessionFile];
        return [];
      }) as typeof fs.readdirSync,
    );
    mockedFs.statSync.mockImplementation(
      ((_path: fs.PathLike): fs.Stats => {
        const p = String(_path);
        return { isDirectory: () => p.endsWith(projectDir) } as fs.Stats;
      }) as typeof fs.statSync,
    );
    mockedFs.openSync.mockImplementation(() => 3);
    mockedFs.readSync.mockImplementation(
      ((_fd: number, buffer: NodeJS.ArrayBufferView, _offset?: number, length?: number) => {
        const buf = Buffer.from(userRecord + "\n", "utf-8");
        const target = buffer as Buffer;
        const bytesToCopy = Math.min(buf.length, target.length, length ?? target.length);
        buf.copy(target, 0, 0, bytesToCopy);
        return bytesToCopy;
      }) as typeof fs.readSync,
    );
    mockedFs.closeSync.mockImplementation(() => undefined);

    const sessions = discoverSessions();
    expect(sessions[0].firstMessage).toHaveLength(100);
  });
});

describe("getSessionData", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("reads and parses a session file", () => {
    const lines = [
      JSON.stringify({
        type: "user",
        timestamp: "2026-03-10T09:59:00Z",
        message: { content: [{ type: "text", text: "Hello" }] },
      }),
      JSON.stringify({
        type: "assistant",
        timestamp: "2026-03-10T10:00:00Z",
        message: {
          model: "claude-opus-4-6",
          usage: { input_tokens: 100, output_tokens: 50 },
          content: [{ type: "text", text: "Hi" }],
        },
      }),
    ].join("\n");

    mockedFs.readFileSync.mockReturnValue(lines);

    const result = getSessionData("/path/to/session.jsonl");
    expect(result.turns).toHaveLength(1);
    expect(result.turns[0].usage.input_tokens).toBe(100);
  });
});

describe("readFileHead", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("reads first N bytes of a file", () => {
    const content = "Hello World";
    mockedFs.openSync.mockReturnValue(3);
    mockedFs.readSync.mockImplementation(
      ((_fd, buffer, _offset, length) => {
        const buf = Buffer.from(content, "utf-8");
        const target = buffer as Buffer;
        const bytesToCopy = Math.min(buf.length, target.length, length ?? target.length);
        buf.copy(target, 0, 0, bytesToCopy);
        return bytesToCopy;
      }) as typeof fs.readSync,
    );
    mockedFs.closeSync.mockReturnValue(undefined);

    const result = readFileHead("/path/to/file", 4096);
    expect(result).toBe("Hello World");
  });
});
