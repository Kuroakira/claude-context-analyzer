import { useState, useRef, useEffect } from "react";
import type { ParsedTurn, UserContentBlock } from "../../shared/types";
import { HighlightedText } from "./HighlightedText";

interface Props {
  turns: ParsedTurn[];
  hoveredTurn: number | null;
  onTurnHover: (turnIndex: number | null) => void;
}

const SUBTYPE_BADGES: Record<string, string> = {
  "system-reminder": "SYS",
  "available-deferred-tools": "TOOLS",
  "ide_opened_file": "IDE",
  command: "CMD",
};

function getBadges(blocks: UserContentBlock[]): string[] {
  const seen = new Set<string>();
  const badges: string[] = [];
  for (const block of blocks) {
    if (block.type === "system-context" && block.subtype) {
      const label = SUBTYPE_BADGES[block.subtype] ?? "SYS";
      if (!seen.has(label)) {
        seen.add(label);
        badges.push(label);
      }
    }
    if (block.type === "tool-result" && !seen.has("TOOL")) {
      seen.add("TOOL");
      badges.push("TOOL");
    }
    if (block.type === "image" && !seen.has("IMG")) {
      seen.add("IMG");
      badges.push("IMG");
    }
  }
  return badges;
}

function truncate(text: string, max: number): string {
  const firstLine = text.split("\n")[0];
  if (firstLine.length <= max) return firstLine;
  return firstLine.slice(0, max) + "...";
}

export function RequestTimeline({ turns, hoveredTurn, onTurnHover }: Props) {
  const [expandedTurn, setExpandedTurn] = useState<number | null>(null);
  const [expandedSysBlocks, setExpandedSysBlocks] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to hovered turn when changed externally (from chart)
  useEffect(() => {
    if (hoveredTurn === null || !containerRef.current) return;
    const el = containerRef.current.querySelector(`[data-turn-index="${hoveredTurn}"]`);
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [hoveredTurn]);

  const toggleSysBlock = (key: string) => {
    setExpandedSysBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="request-timeline" ref={containerRef}>
      <h4 className="timeline-header">User Requests</h4>
      <div className="timeline-items">
        {turns.map((turn) => {
          const isHovered = hoveredTurn === turn.turnIndex;
          const isExpanded = expandedTurn === turn.turnIndex;
          const badges = getBadges(turn.userContent);
          const userTextBlocks = turn.userContent.filter((b) => b.type === "user-text");
          const previewText = userTextBlocks.length > 0
            ? userTextBlocks.map((b) => b.text).join(" ")
            : turn.userMessage;

          return (
            <div
              key={turn.turnIndex}
              data-turn-index={turn.turnIndex}
              className={`timeline-item ${isHovered ? "timeline-item-hovered" : ""} ${isExpanded ? "timeline-item-expanded" : ""}`}
              onMouseEnter={() => onTurnHover(turn.turnIndex)}
              onMouseLeave={() => onTurnHover(null)}
              onClick={() => setExpandedTurn(isExpanded ? null : turn.turnIndex)}
            >
              <div className="timeline-item-header">
                <span className="timeline-turn-index">#{turn.turnIndex}</span>
                <span className="timeline-preview">
                  {truncate(previewText || "(no message)", 80)}
                </span>
                {badges.length > 0 && (
                  <span className="timeline-badges">
                    {badges.map((badge) => (
                      <span key={badge} className="timeline-badge">{badge}</span>
                    ))}
                  </span>
                )}
              </div>

              {isExpanded && (
                <div className="timeline-expanded">
                  {turn.userContent.map((block, i) => {
                    if (block.type === "user-text") {
                      return (
                        <div key={i} className="timeline-block timeline-block-text">
                          <HighlightedText text={block.text} />
                        </div>
                      );
                    }
                    if (block.type === "system-context") {
                      const sysKey = `${turn.turnIndex}-${i}`;
                      const isSysExpanded = expandedSysBlocks.has(sysKey);
                      const displayText = block.raw ?? block.text;
                      const needsTruncation = displayText.length > 200;
                      return (
                        <div key={i} className="timeline-block timeline-block-sys">
                          <span className="timeline-sys-label">
                            {SUBTYPE_BADGES[block.subtype ?? ""] ?? "SYS"}
                          </span>
                          <span className="timeline-sys-text">
                            {isSysExpanded || !needsTruncation
                              ? displayText
                              : displayText.slice(0, 200) + "..."}
                          </span>
                          {needsTruncation && (
                            <button
                              className="timeline-show-more"
                              onClick={(e) => { e.stopPropagation(); toggleSysBlock(sysKey); }}
                            >
                              {isSysExpanded ? "show less" : "show more"}
                            </button>
                          )}
                        </div>
                      );
                    }
                    if (block.type === "tool-result") {
                      return (
                        <div key={i} className="timeline-block timeline-block-tool">
                          <span className="timeline-sys-label">TOOL</span>
                          <span className="timeline-sys-text">{block.text}</span>
                        </div>
                      );
                    }
                    if (block.type === "image") {
                      return (
                        <div key={i} className="timeline-block timeline-block-image">
                          <span className="timeline-sys-label">IMG</span>
                          <span className="timeline-sys-text">{block.text}</span>
                        </div>
                      );
                    }
                    return null;
                  })}
                  {turn.userContent.length === 0 && (
                    <div className="timeline-block timeline-block-text">
                      <HighlightedText text={turn.userMessage || "(no message)"} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
