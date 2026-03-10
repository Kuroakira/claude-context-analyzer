import type {
  ParsedTurn,
  ParseResult,
  UsageData,
  ContextBreakdown,
} from "../shared/types";

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

const CHARS_PER_TOKEN = 4;

function estimateTokens(chars: number): number {
  return Math.round(chars / CHARS_PER_TOKEN);
}

function emptyBreakdown(): ContextBreakdown {
  return {
    userText: 0,
    toolResults: 0,
    systemReminder: 0,
    ideContext: 0,
    assistantResponse: 0,
    images: 0,
  };
}

function addBreakdown(
  cumulative: ContextBreakdown,
  delta: ContextBreakdown,
): ContextBreakdown {
  return {
    userText: cumulative.userText + delta.userText,
    toolResults: cumulative.toolResults + delta.toolResults,
    systemReminder: cumulative.systemReminder + delta.systemReminder,
    ideContext: cumulative.ideContext + delta.ideContext,
    assistantResponse: cumulative.assistantResponse + delta.assistantResponse,
    images: cumulative.images + delta.images,
  };
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
    if ((item.text as string).includes("<available-deferred-tools>")) continue;
    texts.push(item.text);
  }
  return texts.join(" ").trim();
}

/** Categorize and estimate tokens for each content block in a user message */
function categorizeUserContent(content: unknown): ContextBreakdown {
  const delta = emptyBreakdown();
  if (!Array.isArray(content)) return delta;

  for (const item of content) {
    if (!isRecord(item)) continue;

    if (item.type === "tool_result") {
      // Tool result content can be nested
      const innerContent = Array.isArray(item.content) ? item.content : [];
      let charCount = 0;
      for (const inner of innerContent) {
        if (isRecord(inner) && typeof inner.text === "string") {
          charCount += (inner.text as string).length;
        }
      }
      delta.toolResults += estimateTokens(charCount);
      continue;
    }

    if (item.type === "image") {
      // Images use ~1600 tokens for a typical screenshot
      delta.images += 1600;
      continue;
    }

    if (item.type !== "text" || typeof item.text !== "string") continue;

    const text = item.text as string;

    if (
      text.startsWith("<system-reminder>") ||
      text.includes("<available-deferred-tools>")
    ) {
      delta.systemReminder += estimateTokens(text.length);
    } else if (
      text.startsWith("<ide_opened_file>") ||
      text.startsWith("<command-")
    ) {
      delta.ideContext += estimateTokens(text.length);
    } else {
      delta.userText += estimateTokens(text.length);
    }
  }

  return delta;
}

/** Estimate tokens from assistant message content */
function categorizeAssistantContent(content: unknown): number {
  if (!Array.isArray(content)) return 0;
  let chars = 0;
  for (const item of content) {
    if (!isRecord(item)) continue;
    if (item.type === "text" && typeof item.text === "string") {
      chars += (item.text as string).length;
    } else if (item.type === "tool_use") {
      // Tool use JSON is roughly the stringified input
      chars += JSON.stringify(item.input ?? {}).length + 100;
    } else if (item.type === "thinking" && typeof item.thinking === "string") {
      // Thinking blocks are not sent back but consume output tokens
      // Don't count them in context since they're not in the next turn's input
    }
  }
  return estimateTokens(chars);
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

  let cumulative = emptyBreakdown();
  let pendingUserDelta = emptyBreakdown();

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
      pendingUserDelta = categorizeUserContent(message?.content);
      continue;
    }

    if (type === "assistant") {
      const message = isRecord(record.message) ? record.message : undefined;
      const usage =
        message && isRecord(message.usage) ? message.usage : undefined;
      if (usage) hasUsageData = true;

      // Estimate assistant response tokens
      const assistantTokens = categorizeAssistantContent(message?.content);

      const delta: ContextBreakdown = {
        ...pendingUserDelta,
        assistantResponse:
          pendingUserDelta.assistantResponse + assistantTokens,
      };

      cumulative = addBreakdown(cumulative, delta);

      turns.push({
        turnIndex: turns.length,
        timestamp: String(record.timestamp ?? ""),
        userMessage: lastUserMessage,
        model: typeof message?.model === "string" ? message.model : undefined,
        usage: extractUsage(usage),
        contextBreakdown: { ...cumulative },
        contextDelta: delta,
      });

      // Reset pending delta after first assistant message consumes it
      pendingUserDelta = emptyBreakdown();
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
