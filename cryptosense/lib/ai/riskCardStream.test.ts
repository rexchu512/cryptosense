// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import { readRiskCardStream } from "./riskCardStream";

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(c) {
      for (const s of chunks) c.enqueue(enc.encode(s));
      c.close();
    },
  });
}

describe("readRiskCardStream", () => {
  it("emits one event per newline-delimited object", async () => {
    const on = vi.fn();
    await readRiskCardStream(
      streamOf(
        '{"type":"incidents","data":null}\n',
        '{"type":"card","data":{"stance":"中性"}}\n',
        '{"type":"done"}\n',
      ),
      on,
    );
    expect(on).toHaveBeenCalledTimes(3);
    expect(on.mock.calls[0][0]).toEqual({ type: "incidents", data: null });
    expect(on.mock.calls[2][0]).toEqual({ type: "done" });
  });

  it("reassembles an object split across chunk boundaries", async () => {
    // The transport decides where chunks break, not the writer, so a single
    // JSON line routinely arrives in pieces.
    const on = vi.fn();
    await readRiskCardStream(streamOf('{"type":"car', 'd","data":{"stance":"中性"}}\n'), on);
    expect(on).toHaveBeenCalledTimes(1);
    expect(on.mock.calls[0][0]).toEqual({ type: "card", data: { stance: "中性" } });
  });

  it("handles several objects arriving in one chunk", async () => {
    const on = vi.fn();
    await readRiskCardStream(streamOf('{"type":"done"}\n{"type":"done"}\n'), on);
    expect(on).toHaveBeenCalledTimes(2);
  });

  it("emits a trailing object that arrives without a final newline", async () => {
    const on = vi.fn();
    await readRiskCardStream(streamOf('{"type":"done"}'), on);
    expect(on).toHaveBeenCalledTimes(1);
  });

  it("skips a malformed line instead of aborting the stream", async () => {
    const on = vi.fn();
    await readRiskCardStream(streamOf('not json\n{"type":"done"}\n'), on);
    expect(on).toHaveBeenCalledTimes(1);
    expect(on.mock.calls[0][0]).toEqual({ type: "done" });
  });

  it("ignores blank lines", async () => {
    const on = vi.fn();
    await readRiskCardStream(streamOf('\n\n{"type":"done"}\n\n'), on);
    expect(on).toHaveBeenCalledTimes(1);
  });

  it("does not throw when the body is null", async () => {
    await expect(readRiskCardStream(null, vi.fn())).resolves.toBeUndefined();
  });
});
