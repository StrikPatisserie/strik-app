/** Serialize writes so an older request can never overwrite a newer route in storage.
 * Intermediate concepts still waiting in the queue can be replaced by the latest.
 * A final route is always written, even when another edit follows it. */
export function createRouteSaveQueue() {
  let tail: Promise<unknown> = Promise.resolve();
  let revision = 0;
  return {
    enqueue<T>(write: () => Promise<T>, coalesce = true) {
      const current = ++revision;
      const isLatest = () => current === revision;
      const promise = tail.then(() => coalesce && !isLatest() ? undefined : write());
      tail = promise.catch(() => undefined);
      return { promise, isLatest };
    },
    invalidate() { revision++; },
    settled() { return tail; },
  };
}
