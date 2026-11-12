import type { RecepturenData } from "../bakkerij/recepturen/recepturenApi";
import { ConcurrentChangeError, mergeConcurrentChanges } from "./concurrentChanges";

type SaveResult = { ok: true; data: RecepturenData } | { ok: false; message: string; status?: number };

/** Keep queued local edits separate from changes returned by another editor. */
export function createRecipeSaveQueue(
  save: (data: RecepturenData) => Promise<SaveResult>,
  apply: (data: RecepturenData) => void,
) {
  let acknowledgedLocal: RecepturenData | null = null;
  let acknowledgedShared: RecepturenData | null = null;
  let draft: RecepturenData | null = null;
  let pending: Promise<void> = Promise.resolve();
  let submittedVersion = 0;

  function content(data: RecepturenData): RecepturenData {
    const result = { ...data };
    delete result.updatedAt;
    delete result.storageRevision;
    delete result.storageProvider;
    delete result.financialAccess;
    return result;
  }

  return {
    initialize(data: RecepturenData) {
      acknowledgedLocal = structuredClone(data);
      acknowledgedShared = structuredClone(data);
      draft = structuredClone(data);
    },
    save(data: RecepturenData): Promise<SaveResult> {
      const submitted = structuredClone(data);
      draft = submitted;
      const version = ++submittedVersion;
      const request = pending.then(async (): Promise<SaveResult> => {
        try {
          const payload = acknowledgedLocal && acknowledgedShared
            ? mergeConcurrentChanges(content(acknowledgedLocal), content(submitted), content(acknowledgedShared))
            : submitted;
          const result = await save({ ...payload, storageRevision: acknowledgedShared?.storageRevision });
          if (result.ok) {
            acknowledgedLocal = submitted;
            acknowledgedShared = result.data;
            try {
              draft = { ...result.data, ...mergeConcurrentChanges(content(submitted), content(draft!), content(result.data)) };
              if (version === submittedVersion) acknowledgedLocal = structuredClone(draft);
              apply(draft);
            } catch (error) {
              // A newer, unsaved local edit needs review. Keep that draft visible
              // so its own save can report the conflict without losing input.
              if (!(error instanceof ConcurrentChangeError)) throw error;
            }
          }
          return result;
        } catch (error) {
          return {
            ok: false,
            message: error instanceof Error ? error.message : "Opslaan is mislukt. Je invoer blijft bewaard.",
            ...(error instanceof ConcurrentChangeError ? { status: 409 } : {}),
          };
        }
      });
      pending = request.then(() => undefined);
      return request;
    },
  };
}
