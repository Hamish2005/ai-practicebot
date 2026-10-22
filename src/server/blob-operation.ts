import { getStore, type Store } from "@netlify/blobs";

// Bound the whole SDK operation, including retries and response-body reads.
// Each operation gets current Netlify credentials and a cancellable transport.
export async function blobOperation<T>(
  name: string,
  operation: (store: Store) => Promise<T>,
  timeoutMs = 8000,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error("Storage request timed out"));
      }, timeoutMs);
    });
    const store = getStore({
      name,
      consistency: "strong",
      fetch: (input, init) => {
        controller.signal.throwIfAborted();
        return fetch(input, {
          ...init,
          signal: init?.signal
            ? AbortSignal.any([init.signal, controller.signal])
            : controller.signal,
        });
      },
    });
    return await Promise.race([operation(store), deadline]);
  } finally {
    clearTimeout(timer);
  }
}
