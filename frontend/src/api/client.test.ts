import { describe, it, expect, vi, beforeEach } from "vitest";
import { streamSSE, ApiError } from "./client";
import type { SSEEvent } from "./client";

function mockFetchResponse(body: string, ok = true, status = 200) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body));
      controller.close();
    },
  });
  return {
    ok,
    status,
    body: stream,
    json: async () => ({ detail: "error" }),
  } as unknown as Response;
}

describe("streamSSE", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("parses SSE events and calls onEvent", async () => {
    const events: SSEEvent[] = [];
    const body =
      'event: stage\ndata: {"stage":"embedding"}\n\n' +
      'event: result\ndata: {"key_points":["a"]}\n\n';

    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockFetchResponse(body));

    await streamSSE("/test", {}, "token", (e) => events.push(e));

    expect(events).toHaveLength(2);
    expect(events[0].event).toBe("stage");
    expect(events[0].data).toEqual({ stage: "embedding" });
    expect(events[1].event).toBe("result");
    expect(events[1].data).toEqual({ key_points: ["a"] });
  });

  it("rejects with ApiError on non-OK response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      mockFetchResponse("", false, 503),
    );

    await expect(
      streamSSE("/test", {}, "token", () => {}),
    ).rejects.toThrow(ApiError);
  });

  it("resolves on abort instead of rejecting", async () => {
    const controller = new AbortController();
    controller.abort();

    vi.spyOn(globalThis, "fetch").mockRejectedValue(new DOMException("aborted"));

    await expect(
      streamSSE("/test", {}, "token", () => {}, controller.signal),
    ).resolves.toBeUndefined();
  });

  it("skips malformed JSON data lines", async () => {
    const events: SSEEvent[] = [];
    const body =
      'event: stage\ndata: not-json\n\n' +
      'event: result\ndata: {"ok":true}\n\n';

    vi.spyOn(globalThis, "fetch").mockResolvedValue(mockFetchResponse(body));

    await streamSSE("/test", {}, "token", (e) => events.push(e));

    expect(events).toHaveLength(1);
    expect(events[0].data).toEqual({ ok: true });
  });
});
