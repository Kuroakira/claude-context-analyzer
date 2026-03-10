import * as fs from "node:fs";
import { parseJsonl } from "./parser";
import type { ParseResult } from "../shared/types";

export class SessionWatcher {
  private fileSizes = new Map<string, number>();
  private cache = new Map<string, ParseResult>();
  private readOffsets = new Map<string, number>();
  private pendingBuffer = new Map<string, string>();

  hasChanged(filePath: string): boolean {
    try {
      const stat = fs.statSync(filePath);
      const prevSize = this.fileSizes.get(filePath);
      this.fileSizes.set(filePath, stat.size);
      return prevSize === undefined || stat.size !== prevSize;
    } catch {
      return false;
    }
  }

  getSessionData(filePath: string): ParseResult {
    const cached = this.cache.get(filePath);
    if (cached && !this.hasChanged(filePath)) {
      return cached;
    }

    const offset = this.readOffsets.get(filePath) ?? 0;

    if (offset === 0) {
      // Initial full read
      const raw = fs.readFileSync(filePath, "utf-8");
      const { completeLines, remainder } = splitCompleteLines(raw);
      const result = parseJsonl(completeLines);
      this.cache.set(filePath, result);
      this.readOffsets.set(filePath, Buffer.byteLength(completeLines, "utf-8"));
      this.pendingBuffer.set(filePath, remainder);
      return result;
    }

    // Incremental read from offset
    const stat = fs.statSync(filePath);
    if (stat.size <= offset) {
      return cached ?? { turns: [], skippedLines: 0, warnings: [] };
    }

    const fd = fs.openSync(filePath, "r");
    const bytesToRead = stat.size - offset;
    const buffer = Buffer.alloc(bytesToRead);
    fs.readSync(fd, buffer, 0, bytesToRead, offset);
    fs.closeSync(fd);

    const pending = this.pendingBuffer.get(filePath) ?? "";
    const newRaw = pending + buffer.toString("utf-8");
    const { completeLines, remainder } = splitCompleteLines(newRaw);

    if (completeLines.length > 0) {
      const newResult = parseJsonl(completeLines);
      const prev = cached ?? { turns: [], skippedLines: 0, warnings: [] };

      const merged: ParseResult = {
        turns: [
          ...prev.turns,
          ...newResult.turns.map((t) => ({
            ...t,
            turnIndex: prev.turns.length + t.turnIndex,
          })),
        ],
        skippedLines: prev.skippedLines + newResult.skippedLines,
        warnings: [...new Set([...prev.warnings, ...newResult.warnings])],
      };

      this.cache.set(filePath, merged);
      this.readOffsets.set(filePath, offset + Buffer.byteLength(completeLines, "utf-8"));
    }

    this.pendingBuffer.set(filePath, remainder);
    return this.cache.get(filePath) ?? { turns: [], skippedLines: 0, warnings: [] };
  }
}

function splitCompleteLines(raw: string): { completeLines: string; remainder: string } {
  if (raw.length === 0) return { completeLines: "", remainder: "" };
  if (raw.endsWith("\n")) return { completeLines: raw, remainder: "" };

  const lastNewline = raw.lastIndexOf("\n");
  if (lastNewline === -1) return { completeLines: "", remainder: raw };

  return {
    completeLines: raw.slice(0, lastNewline + 1),
    remainder: raw.slice(lastNewline + 1),
  };
}
