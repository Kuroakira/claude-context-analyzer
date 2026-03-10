import { useState, useEffect, useRef, useCallback } from "react";
import type { ParseResult } from "../../shared/types";

interface PollResponse {
  changed: boolean;
  data?: ParseResult;
}

export function usePolling(
  url: string | null,
  intervalMs = 3000,
) {
  const [data, setData] = useState<ParseResult | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const poll = useCallback(async () => {
    if (!url) return;
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const body: PollResponse = await res.json();
      if (body.changed && body.data) {
        setData(body.data);
      }
    } catch {
      // silently ignore polling errors
    }
  }, [url]);

  useEffect(() => {
    if (!url) {
      setData(null);
      return;
    }

    // Initial fetch
    poll();

    timerRef.current = setInterval(poll, intervalMs);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [url, intervalMs, poll]);

  return data;
}
