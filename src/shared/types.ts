export interface UsageData {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

export interface ParsedTurn {
  turnIndex: number;
  timestamp: string;
  userMessage: string;
  model?: string;
  usage: UsageData;
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
