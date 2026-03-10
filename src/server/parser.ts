import type { ParsedTurn, ParseResult, UsageData } from "../shared/types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function extractUserText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  const texts: string[] = [];
  for (const item of content) {
    if (!isRecord(item)) continue;
    if (item.type !== "text" || typeof item.text !== "string") continue;
    if (item.text.startsWith("<system-reminder>")) continue;
    if (item.text.startsWith("<ide_opened_file>")) continue;
    if (item.text.startsWith("<command-")) continue;
    texts.push(item.text);
  }
  return texts.join(" ").trim();
}

function extractUsage(usage: unknown): UsageData {
  const u = isRecord(usage) ? usage : {};
  return {
    input_tokens: Number(u.input_tokens ?? 0),
    output_tokens: Number(u.output_tokens ?? 0),
    cache_creation_input_tokens: Number(u.cache_creation_input_tokens ?? 0),
    cache_read_input_tokens: Number(u.cache_read_input_tokens ?? 0),
  };
}

export function parseJsonl(raw: string): ParseResult {
  const lines = raw.split("\n").filter((l) => l.trim() !== "");
  const turns: ParsedTurn[] = [];
  let skippedLines = 0;
  let lastUserMessage = "";
  let hasUsageData = false;

  for (const line of lines) {
    let record: unknown;
    try {
      record = JSON.parse(line);
    } catch {
      skippedLines++;
      continue;
    }

    if (!isRecord(record)) {
      skippedLines++;
      continue;
    }

    const type = record.type;

    if (type === "user") {
      const message = isRecord(record.message) ? record.message : undefined;
      lastUserMessage = extractUserText(message?.content);
      continue;
    }

    if (type === "assistant") {
      const message = isRecord(record.message) ? record.message : undefined;
      const usage = message && isRecord(message.usage) ? message.usage : undefined;
      if (usage) hasUsageData = true;

      turns.push({
        turnIndex: turns.length,
        timestamp: String(record.timestamp ?? ""),
        userMessage: lastUserMessage,
        model: typeof message?.model === "string" ? message.model : undefined,
        usage: extractUsage(usage),
      });

      lastUserMessage = "";
      continue;
    }
  }

  const warnings: string[] = [];
  if (turns.length > 0 && !hasUsageData) {
    warnings.push("No usage data found in session");
  }
  if (
    turns.length > 0 &&
    hasUsageData &&
    turns.every((t) => t.usage.input_tokens === 0)
  ) {
    warnings.push("All input_tokens are zero — possible format change");
  }

  return { turns, skippedLines, warnings };
}
