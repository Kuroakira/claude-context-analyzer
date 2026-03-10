import type { SessionMeta } from "../../shared/types";

export type DateFilter = "today" | "3days" | "all";

export function filterSessions(
  sessions: SessionMeta[],
  keyword: string,
  dateFilter: DateFilter,
): SessionMeta[] {
  let filtered = sessions;

  if (keyword.trim()) {
    const lower = keyword.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.firstMessage.toLowerCase().includes(lower) ||
        s.projectPath.toLowerCase().includes(lower),
    );
  }

  if (dateFilter !== "all") {
    const now = new Date();
    const cutoff = new Date(now);
    if (dateFilter === "today") {
      cutoff.setHours(0, 0, 0, 0);
    } else {
      cutoff.setDate(cutoff.getDate() - 3);
      cutoff.setHours(0, 0, 0, 0);
    }
    filtered = filtered.filter((s) => new Date(s.startTime) >= cutoff);
  }

  return filtered;
}
