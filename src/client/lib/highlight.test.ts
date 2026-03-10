import { describe, it, expect } from "vitest";
import { highlightText } from "./highlight";
import type { HighlightSegment } from "./highlight";

describe("highlightText", () => {
  it("returns empty array for empty string", () => {
    const result = highlightText("");
    expect(result).toEqual([]);
  });

  it("returns single plain segment for text with no matches", () => {
    const result = highlightText("hello world");
    expect(result).toEqual([{ text: "hello world" }]);
  });

  // --- File paths ---

  it("detects file paths like src/auth.ts", () => {
    const result = highlightText("Look at src/auth.ts for details");
    expect(result).toEqual([
      { text: "Look at " },
      { text: "src/auth.ts", className: "hl-path", label: "file path" },
      { text: " for details" },
    ]);
  });

  it("detects relative file paths with ./", () => {
    const result = highlightText("edit ./config.json now");
    expect(result).toEqual([
      { text: "edit " },
      { text: "./config.json", className: "hl-path", label: "file path" },
      { text: " now" },
    ]);
  });

  it("detects parent-relative file paths with ../", () => {
    const result = highlightText("see ../utils/helper.ts");
    expect(result).toEqual([
      { text: "see " },
      { text: "../utils/helper.ts", className: "hl-path", label: "file path" },
    ]);
  });

  // --- Flags ---

  it("detects long flags like --verbose", () => {
    const result = highlightText("run with --verbose");
    expect(result).toEqual([
      { text: "run with " },
      { text: "--verbose", className: "hl-flag", label: "flag" },
    ]);
  });

  it("detects short flags like -n", () => {
    const result = highlightText("use -n option");
    expect(result).toEqual([
      { text: "use " },
      { text: "-n", className: "hl-flag", label: "flag" },
      { text: " option" },
    ]);
  });

  it("detects flags with hyphens like --dry-run", () => {
    const result = highlightText("try --dry-run first");
    expect(result).toEqual([
      { text: "try " },
      { text: "--dry-run", className: "hl-flag", label: "flag" },
      { text: " first" },
    ]);
  });

  // --- Backtick code ---

  it("detects backtick code spans", () => {
    const result = highlightText("call `functionName` here");
    expect(result).toEqual([
      { text: "call " },
      { text: "`functionName`", className: "hl-code", label: "code" },
      { text: " here" },
    ]);
  });

  it("detects backtick code with spaces", () => {
    const result = highlightText("run `some code` now");
    expect(result).toEqual([
      { text: "run " },
      { text: "`some code`", className: "hl-code", label: "code" },
      { text: " now" },
    ]);
  });

  // --- Slash commands ---

  it("detects slash commands at start of string", () => {
    const result = highlightText("/commit the changes");
    expect(result).toEqual([
      { text: "/commit", className: "hl-command", label: "command" },
      { text: " the changes" },
    ]);
  });

  it("detects slash commands after whitespace", () => {
    const result = highlightText("please /review-pr now");
    expect(result).toEqual([
      { text: "please " },
      { text: "/review-pr", className: "hl-command", label: "command" },
      { text: " now" },
    ]);
  });

  it("does not detect slash in middle of word as command", () => {
    const result = highlightText("path/to is not a command");
    // path/to should match as a file path or plain text, not a command
    const commandSegments = result.filter((s) => s.className === "hl-command");
    expect(commandSegments).toHaveLength(0);
  });

  // --- Quoted strings ---

  it("detects double-quoted strings", () => {
    const result = highlightText('search for "exact match" here');
    expect(result).toEqual([
      { text: "search for " },
      { text: '"exact match"', className: "hl-string", label: "string" },
      { text: " here" },
    ]);
  });

  // --- URL exclusion ---

  it("does not highlight URLs as file paths", () => {
    const result = highlightText("visit https://example.com/path/file.ts");
    const pathSegments = result.filter((s) => s.className === "hl-path");
    expect(pathSegments).toHaveLength(0);
  });

  it("does not highlight http URLs as file paths", () => {
    const result = highlightText("see http://example.com/foo/bar.js for info");
    const pathSegments = result.filter((s) => s.className === "hl-path");
    expect(pathSegments).toHaveLength(0);
  });

  // --- Priority / overlapping ---

  it("backtick code takes priority over file paths inside backticks", () => {
    const result = highlightText("edit `src/auth.ts` please");
    expect(result).toEqual([
      { text: "edit " },
      { text: "`src/auth.ts`", className: "hl-code", label: "code" },
      { text: " please" },
    ]);
  });

  it("quoted string takes priority over flags inside quotes", () => {
    const result = highlightText('use "--verbose" as arg');
    expect(result).toEqual([
      { text: "use " },
      { text: '"--verbose"', className: "hl-string", label: "string" },
      { text: " as arg" },
    ]);
  });

  // --- Multiple highlights ---

  it("handles multiple different highlight types in one string", () => {
    const result = highlightText("run --verbose on src/app.ts");
    expect(result).toEqual([
      { text: "run " },
      { text: "--verbose", className: "hl-flag", label: "flag" },
      { text: " on " },
      { text: "src/app.ts", className: "hl-path", label: "file path" },
    ]);
  });

  // --- Correct classNames ---

  it("returns correct className for each pattern type", () => {
    const codeResult = highlightText("`x`");
    expect(codeResult[0].className).toBe("hl-code");

    const stringResult = highlightText('"y"');
    expect(stringResult[0].className).toBe("hl-string");

    const pathResult = highlightText("src/file.ts");
    expect(pathResult[0].className).toBe("hl-path");

    const commandResult = highlightText("/commit");
    expect(commandResult[0].className).toBe("hl-command");

    const flagResult = highlightText("--flag");
    expect(flagResult[0].className).toBe("hl-flag");
  });
});
