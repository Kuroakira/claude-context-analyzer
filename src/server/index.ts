import { serve } from "@hono/node-server";
import { Hono } from "hono";
import * as path from "node:path";
import { discoverSessions, getSessionData } from "./sessions";
import { SessionWatcher } from "./watcher";

export const app = new Hono();
const watcher = new SessionWatcher();

const PROJECTS_DIR = path.join(
  process.env.HOME ?? "~",
  ".claude",
  "projects",
);

function resolveSessionPath(id: string, projectPath: string): string | null {
  if (projectPath.includes("..") || id.includes("..")) return null;

  const filePath = path.resolve(PROJECTS_DIR, projectPath, `${id}.jsonl`);
  const resolvedProjectsDir = path.resolve(PROJECTS_DIR);

  if (!filePath.startsWith(resolvedProjectsDir + path.sep)) return null;

  return filePath;
}

app.get("/api/health", (c) => {
  return c.json({ status: "ok" });
});

app.get("/api/sessions", (c) => {
  const sessions = discoverSessions();
  return c.json(sessions);
});

app.get("/api/sessions/:id", (c) => {
  const id = c.req.param("id");
  const projectPath = c.req.query("project");

  if (!projectPath) {
    return c.json({ error: "project query parameter is required" }, 400);
  }

  const filePath = resolveSessionPath(id, projectPath);
  if (!filePath) {
    return c.json({ error: "Invalid path" }, 400);
  }

  try {
    const data = getSessionData(filePath);
    return c.json(data);
  } catch {
    return c.json({ error: "Session not found" }, 404);
  }
});

app.get("/api/sessions/:id/poll", (c) => {
  const id = c.req.param("id");
  const projectPath = c.req.query("project");

  if (!projectPath) {
    return c.json({ error: "project query parameter is required" }, 400);
  }

  const filePath = resolveSessionPath(id, projectPath);
  if (!filePath) {
    return c.json({ error: "Invalid path" }, 400);
  }

  const changed = watcher.hasChanged(filePath);
  if (!changed) {
    return c.json({ changed: false });
  }

  try {
    const data = watcher.getSessionData(filePath);
    return c.json({ changed: true, data });
  } catch {
    return c.json({ error: "Session not found" }, 404);
  }
});

const port = 4100;

if (process.env.NODE_ENV !== "test") {
  serve({ fetch: app.fetch, port, hostname: "127.0.0.1" }, (info) => {
    console.log(`API server running at http://127.0.0.1:${info.port}`);
  });
}
