import { useState } from "react";
import type { SessionMeta } from "../../shared/types";
import { filterSessions, type DateFilter } from "../lib/filters";

interface Props {
  sessions: SessionMeta[];
  selectedId: string | null;
  onSelect: (session: SessionMeta) => void;
}

export function SessionList({ sessions, selectedId, onSelect }: Props) {
  const [keyword, setKeyword] = useState("");
  const [dateFilter, setDateFilter] = useState<DateFilter>("all");

  const filtered = filterSessions(sessions, keyword, dateFilter);

  return (
    <div className="session-list">
      <div className="session-list-controls">
        <input
          type="text"
          placeholder="Search sessions..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          className="session-search"
        />
        <select
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value as DateFilter)}
          className="session-date-filter"
        >
          <option value="all">All</option>
          <option value="today">Today</option>
          <option value="3days">Last 3 days</option>
        </select>
      </div>
      <ul className="session-items">
        {filtered.map((session) => (
          <li
            key={`${session.projectPath}/${session.id}`}
            className={`session-item ${session.id === selectedId ? "selected" : ""}`}
            onClick={() => onSelect(session)}
          >
            <div className="session-time">
              {new Date(session.startTime).toLocaleString()}
            </div>
            <div className="session-project">{session.projectPath}</div>
            <div className="session-preview">
              {session.firstMessage || "(no message)"}
            </div>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="session-empty">No sessions found</li>
        )}
      </ul>
    </div>
  );
}
