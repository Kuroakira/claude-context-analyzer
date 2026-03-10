import { describe, it, expect, vi } from "vitest";
import { app } from "./index";

vi.mock("./sessions", () => ({
  discoverSessions: vi.fn(() => [
    {
      id: "test-session",
      projectPath: "-Users-test-project",
      startTime: "2026-03-10T10:00:00Z",
      firstMessage: "Hello",
      filePath: "/home/test/.claude/projects/-Users-test-project/test-session.jsonl",
    },
  ]),
  getSessionData: vi.fn(() => ({
    turns: [
      {
        turnIndex: 0,
        timestamp: "2026-03-10T10:00:00Z",
        userMessage: "Hello",
        model: "claude-opus-4-6",
        usage: {
          input_tokens: 100,
          output_tokens: 50,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 0,
        },
      },
    ],
    skippedLines: 0,
    warnings: [],
  })),
}));

describe("Health endpoint", () => {
  it("GET /api/health returns 200 with status ok", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ status: "ok" });
  });
});

describe("Sessions API", () => {
  it("GET /api/sessions returns session list", async () => {
    const res = await app.request("/api/sessions");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].id).toBe("test-session");
  });

  it("GET /api/sessions/:id returns session data", async () => {
    const res = await app.request(
      "/api/sessions/test-session?project=-Users-test-project",
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.turns).toHaveLength(1);
    expect(body.turns[0].usage.input_tokens).toBe(100);
  });

  it("GET /api/sessions/:id without project returns 400", async () => {
    const res = await app.request("/api/sessions/test-session");
    expect(res.status).toBe(400);
  });

  it("rejects path traversal attempts", async () => {
    const res = await app.request(
      "/api/sessions/test-session?project=../../etc",
    );
    expect(res.status).toBe(400);
  });
});
