import * as fs from "node:fs";
import * as path from "node:path";
import { parseJsonl } from "./parser";
import type { SessionMeta, ParseResult } from "../shared/types";

const PROJECTS_DIR = path.join(
  process.env.HOME ?? "~",
  ".claude",
  "projects",
);

export function readFileHead(filePath: string, maxBytes = 4096): string {
  const fd = fs.openSync(filePath, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const bytesRead = fs.readSync(fd, buffer, 0, maxBytes, 0);
    return buffer.subarray(0, bytesRead).toString("utf-8");
  } finally {
    fs.closeSync(fd);
  }
}

function extractMetadata(
  filePath: string,
  projectPath: string,
): SessionMeta | null {
  try {
    const raw = readFileHead(filePath);
    const lines = raw.split("\n");

    let startTime = "";
    let firstMessage = "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const record = JSON.parse(line);
        if (!startTime && record.timestamp) {
          startTime = record.timestamp;
        }
        if (!firstMessage && record.type === "user") {
          const content = record.message?.content;
          if (Array.isArray(content)) {
            for (const c of content) {
              if (
                c.type === "text" &&
                typeof c.text === "string" &&
                !c.text.startsWith("<system-reminder>") &&
                !c.text.startsWith("<ide_opened_file>") &&
                !c.text.startsWith("<command-")
              ) {
                firstMessage = c.text.slice(0, 100);
                break;
              }
            }
          }
        }
        if (startTime && firstMessage) break;
      } catch {
        // Last line may be truncated from partial 4KB read
        continue;
      }
    }

    const fileName = path.basename(filePath, ".jsonl");

    return {
      id: fileName,
      projectPath,
      startTime,
      firstMessage,
      filePath,
    };
  } catch {
    return null;
  }
}

export function discoverSessions(): SessionMeta[] {
  const sessions: SessionMeta[] = [];

  let projectDirs: string[];
  try {
    projectDirs = fs.readdirSync(PROJECTS_DIR, { encoding: "utf-8" });
  } catch {
    return [];
  }

  for (const projectDir of projectDirs) {
    const projectPath = path.join(PROJECTS_DIR, projectDir);
    try {
      const stat = fs.statSync(projectPath);
      if (!stat.isDirectory()) continue;
    } catch {
      continue;
    }

    let files: string[];
    try {
      files = fs.readdirSync(projectPath, { encoding: "utf-8" });
    } catch {
      continue;
    }

    for (const file of files) {
      if (!file.endsWith(".jsonl")) continue;
      const filePath = path.join(projectPath, file);
      const meta = extractMetadata(filePath, projectDir);
      if (meta) sessions.push(meta);
    }
  }

  sessions.sort((a, b) => (b.startTime > a.startTime ? 1 : -1));
  return sessions;
}

export function getSessionData(filePath: string): ParseResult {
  const raw = fs.readFileSync(filePath, "utf-8");
  return parseJsonl(raw);
}
