import { describe, it, expect, vi } from "vitest";
import { filterSessions } from "./filters";
import type { SessionMeta } from "../../shared/types";

function makeMeta(overrides: Partial<SessionMeta> = {}): SessionMeta {
  return {
    id: "test-id",
    projectPath: "-Users-test-project",
    startTime: new Date().toISOString(),
    firstMessage: "Hello Claude",
    filePath: "/path/to/file.jsonl",
    ...overrides,
  };
}

describe("filterSessions", () => {
  it("filters by keyword in firstMessage", () => {
    const sessions = [
      makeMeta({ id: "1", firstMessage: "Implement auth" }),
      makeMeta({ id: "2", firstMessage: "Fix bug" }),
      makeMeta({ id: "3", firstMessage: "Add authentication" }),
    ];
    const result = filterSessions(sessions, "auth", "all");
    expect(result).toHaveLength(2);
    expect(result.map((s) => s.id)).toEqual(["1", "3"]);
  });

  it("filters by keyword in projectPath", () => {
    const sessions = [
      makeMeta({ id: "1", projectPath: "-Users-test-myapp" }),
      makeMeta({ id: "2", projectPath: "-Users-test-otherproject" }),
    ];
    const result = filterSessions(sessions, "myapp", "all");
    expect(result).toHaveLength(1);
  });

  it("keyword search is case insensitive", () => {
    const sessions = [
      makeMeta({ id: "1", firstMessage: "HELLO WORLD" }),
    ];
    const result = filterSessions(sessions, "hello", "all");
    expect(result).toHaveLength(1);
  });

  it("filters by date: today", () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const sessions = [
      makeMeta({ id: "1", startTime: today.toISOString() }),
      makeMeta({ id: "2", startTime: yesterday.toISOString() }),
    ];
    const result = filterSessions(sessions, "", "today");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters by date: last 3 days", () => {
    const today = new Date();
    const twoDaysAgo = new Date(today);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    const fiveDaysAgo = new Date(today);
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const sessions = [
      makeMeta({ id: "1", startTime: today.toISOString() }),
      makeMeta({ id: "2", startTime: twoDaysAgo.toISOString() }),
      makeMeta({ id: "3", startTime: fiveDaysAgo.toISOString() }),
    ];
    const result = filterSessions(sessions, "", "3days");
    expect(result).toHaveLength(2);
  });

  it("returns all when dateFilter is 'all'", () => {
    const sessions = [makeMeta(), makeMeta(), makeMeta()];
    const result = filterSessions(sessions, "", "all");
    expect(result).toHaveLength(3);
  });

  it("combines keyword and date filter", () => {
    const today = new Date();
    const oldDate = new Date("2020-01-01");

    const sessions = [
      makeMeta({ id: "1", firstMessage: "Deploy auth", startTime: today.toISOString() }),
      makeMeta({ id: "2", firstMessage: "Deploy auth", startTime: oldDate.toISOString() }),
      makeMeta({ id: "3", firstMessage: "Fix bug", startTime: today.toISOString() }),
    ];
    const result = filterSessions(sessions, "auth", "today");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });
});
