// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useFetch } from "./useApi";

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useFetch", () => {
  it("fetches data from URL", async () => {
    const mockData = [{ id: "session-1" }];
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockData),
        }),
      ),
    );

    const { result } = renderHook(() => useFetch("/api/sessions"));

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("handles fetch errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
        }),
      ),
    );

    const { result } = renderHook(() => useFetch("/api/sessions"));

    await waitFor(() => {
      expect(result.current.error).toBe("HTTP 500");
    });
    expect(result.current.data).toBeNull();
  });

  it("does not fetch when url is null", async () => {
    const mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);

    const { result } = renderHook(() => useFetch(null));

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
