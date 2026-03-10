export interface HighlightSegment {
  text: string;
  className?: string;
  label?: string;
}

interface HighlightRule {
  pattern: RegExp;
  className: string;
  label: string;
}

// Priority-ordered highlight rules (higher index = lower priority in overlap resolution)
const HIGHLIGHT_RULES: HighlightRule[] = [
  // 1. Backtick code spans (highest priority)
  {
    pattern: /`[^`]+`/g,
    className: "hl-code",
    label: "code",
  },
  // 2. Double-quoted strings
  {
    pattern: /"[^"]+"/g,
    className: "hl-string",
    label: "string",
  },
  // 3. File paths — but NOT URLs
  //    Matches: src/foo.ts, ./bar.json, ../baz/qux.ts, path/to/file.ext
  //    Excludes: http:// and https:// URLs handled by filtering below
  {
    pattern: /(?:\.{1,2}\/|[a-zA-Z0-9_-]+\/)[a-zA-Z0-9_\-/.]+\.[a-zA-Z]{1,10}/g,
    className: "hl-path",
    label: "file path",
  },
  // 4. Slash commands — at start of string or after whitespace
  {
    pattern: /(?:^|(?<=\s))\/[a-zA-Z][a-zA-Z0-9-]*/gm,
    className: "hl-command",
    label: "command",
  },
  // 5. Flags — --long-flag or -s (short)
  {
    pattern: /(?:^|(?<=\s))--[a-zA-Z][a-zA-Z0-9-]*|(?:^|(?<=\s))-[a-zA-Z]\b/gm,
    className: "hl-flag",
    label: "flag",
  },
];

interface Match {
  start: number;
  end: number;
  text: string;
  className: string;
  label: string;
  priority: number;
}

function findAllMatches(text: string): Match[] {
  const matches: Match[] = [];

  for (let ruleIndex = 0; ruleIndex < HIGHLIGHT_RULES.length; ruleIndex++) {
    const rule = HIGHLIGHT_RULES[ruleIndex];
    const regex = new RegExp(rule.pattern.source, rule.pattern.flags);
    let m: RegExpExecArray | null;

    while ((m = regex.exec(text)) !== null) {
      const start = m.index;
      const end = start + m[0].length;

      // Exclude URL paths: check if this file-path match is inside a URL
      if (rule.className === "hl-path") {
        const before = text.slice(0, start);
        if (/https?:\/\/\S*$/.test(before)) {
          continue;
        }
      }

      matches.push({
        start,
        end,
        text: m[0],
        className: rule.className,
        label: rule.label,
        priority: ruleIndex,
      });
    }
  }

  return matches;
}

function resolveOverlaps(matches: Match[]): Match[] {
  // Sort by start position, then by priority (lower = higher priority)
  const sorted = [...matches].sort((a, b) => {
    if (a.start !== b.start) return a.start - b.start;
    return a.priority - b.priority;
  });

  const resolved: Match[] = [];
  let lastEnd = -1;

  for (const match of sorted) {
    if (match.start >= lastEnd) {
      resolved.push(match);
      lastEnd = match.end;
    } else if (match.priority < (resolved[resolved.length - 1]?.priority ?? Infinity)) {
      // Higher priority match overlaps — skip (already claimed by earlier position)
      continue;
    }
  }

  return resolved;
}

export function highlightText(text: string): HighlightSegment[] {
  if (text === "") {
    return [];
  }

  const allMatches = findAllMatches(text);

  if (allMatches.length === 0) {
    return [{ text }];
  }

  const resolved = resolveOverlaps(allMatches);
  const segments: HighlightSegment[] = [];
  let cursor = 0;

  for (const match of resolved) {
    if (match.start > cursor) {
      segments.push({ text: text.slice(cursor, match.start) });
    }
    segments.push({
      text: match.text,
      className: match.className,
      label: match.label,
    });
    cursor = match.end;
  }

  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) });
  }

  return segments;
}
