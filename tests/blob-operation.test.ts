import { afterEach, expect, it, vi } from "vitest";
vi.mock("@netlify/blobs", () => ({ getStore: vi.fn(() => ({})) }));
import { getStore } from "@netlify/blobs";
import { blobOperation } from "../src/server/blob-operation";

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

it("bounds a stalled SDK operation, including its retry waits", async () => {
  vi.useFakeTimers();
  const pending = blobOperation("test", () => new Promise(() => {}));
  const result = expect(pending).rejects.toThrow("Storage request timed out");
  await vi.advanceTimersByTimeAsync(8000);
  await result;
});

it("aborts transport and prevents later SDK retries from sending requests", async () => {
  vi.useFakeTimers();
  const transport = vi.fn().mockImplementation(
    (_input, init) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      }),
  );
  vi.stubGlobal("fetch", transport);
  const pending = blobOperation("test", async () => {
    const options = vi.mocked(getStore).mock.calls.at(-1)![0] as {
      fetch: typeof fetch;
    };
    return options.fetch("https://storage.example");
  });
  const result = expect(pending).rejects.toThrow();
  await vi.advanceTimersByTimeAsync(8000);
  await result;
  const options = vi.mocked(getStore).mock.calls.at(-1)![0] as {
    fetch: typeof fetch;
  };
  expect(() => options.fetch("https://storage.example")).toThrow();
  expect(transport).toHaveBeenCalledTimes(1);
});

it("creates fresh storage clients for successive operations", async () => {
  expect(await blobOperation("test", async () => "saved")).toBe("saved");
  expect(await blobOperation("test", async () => "restored")).toBe("restored");
  expect(getStore).toHaveBeenCalledTimes(2);
});
