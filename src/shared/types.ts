export interface UsageData {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

/** Estimated token breakdown by content category (chars / 4 approximation) */
export interface ContextBreakdown {
  userText: number;
  toolResults: number;
  systemReminder: number;
  ideContext: number;
  assistantResponse: number;
  images: number;
}

export interface UserContentBlock {
  type: 'user-text' | 'system-context' | 'tool-result' | 'image';
  subtype?: string;
  text: string;
  raw?: string;
}

export interface ParsedTurn {
  turnIndex: number;
  timestamp: string;
  userMessage: string;
  model?: string;
  usage: UsageData;
  /** Cumulative estimated context breakdown at this turn */
  contextBreakdown: ContextBreakdown;
  /** Delta: content added in this turn only */
  contextDelta: ContextBreakdown;
  /** Parsed content blocks from the user message */
  userContent: UserContentBlock[];
}

export interface SessionMeta {
  id: string;
  projectPath: string;
  startTime: string;
  firstMessage: string;
  filePath: string;
}

export interface ParseResult {
  turns: ParsedTurn[];
  skippedLines: number;
  warnings: string[];
}
