import { highlightText, type HighlightSegment } from "../lib/highlight";

interface Props {
  text?: string;
  segments?: HighlightSegment[];
}

export function HighlightedText({ text, segments }: Props) {
  const resolved = segments ?? (text ? highlightText(text) : []);

  if (resolved.length === 0) {
    return <span className="hl-text">{text ?? ""}</span>;
  }

  return (
    <span className="hl-text">
      {resolved.map((seg, i) =>
        seg.className ? (
          <span key={i} className={seg.className} title={seg.label}>
            {seg.text}
          </span>
        ) : (
          <span key={i}>{seg.text}</span>
        )
      )}
    </span>
  );
}
