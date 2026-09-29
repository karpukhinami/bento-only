import type { GenTrigger, SimpleImageArchiveMeta } from "@/lib/google/archive-schema";
import type {
  BipolarFeedbackValue,
  ImageFeedbackRating,
  PendingArchiveFeedback,
  SimpleImageFeedbackDetail,
} from "@/lib/image-feedback-types";
import { useProjectStore } from "@/store/useProjectStore";

export interface ArchiveImagePayload {
  imageId: string;
  dataUrl: string;
  sessionId: string;
  sessionFolderId?: string | null;
  version: number;
  genTrigger: GenTrigger;
  subject: string;
  className: string;
  topic: string;
  addedContent: boolean;
  style: string;
  profile: string;
  analysisModel: string;
  briefModel: string;
  imageModel: string;
}

export interface ArchiveFeedbackPayload extends PendingArchiveFeedback {
  sheetRow?: number;
  imageId: string;
}

export type ArchiveError = {
  ok: false;
  status: number;
  message: string;
  sessionFolderId?: string;
  folderLink?: string;
};
export type ArchiveImageSuccess = SimpleImageArchiveMeta & {
  ok: true;
  sessionFolderId: string;
};

export type SubmitArchiveFeedbackResult =
  | { ok: true; queued: false }
  | { ok: true; queued: true }
  | ArchiveError;

function feedbackAxes(payload: PendingArchiveFeedback) {
  return (
    payload.detail ?? {
      colors: "neutral" as BipolarFeedbackValue,
      composition: "neutral" as BipolarFeedbackValue,
      extraElements: "neutral" as BipolarFeedbackValue,
      text: "neutral" as BipolarFeedbackValue,
      illustrations: "neutral" as BipolarFeedbackValue,
      comment: "",
    }
  );
}

export async function archiveImageToGoogle(
  payload: ArchiveImagePayload,
): Promise<ArchiveImageSuccess | ArchiveError> {
  try {
    const res = await fetch("/api/archive-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) {
      let message = text || res.statusText || "Archive request failed";
      let sessionFolderId: string | undefined;
      let folderLink: string | undefined;
      try {
        const parsed = JSON.parse(text) as {
          error?: string;
          sessionFolderId?: string;
          folderLink?: string;
        };
        if (parsed.error) message = parsed.error;
        sessionFolderId = parsed.sessionFolderId;
        folderLink = parsed.folderLink;
      } catch {
        /* plain text error body */
      }
      console.error("[archive-image]", res.status, message);
      return { ok: false, status: res.status, message, sessionFolderId, folderLink };
    }
    const data = JSON.parse(text) as SimpleImageArchiveMeta & { sessionFolderId: string };
    console.info("[archive-image] ok", { sheetRow: data.sheetRow, imageId: payload.imageId });
    return { ok: true, ...data };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error";
    console.error("[archive-image]", message);
    return { ok: false, status: 0, message };
  }
}

export async function updateArchiveFeedback(
  payload: ArchiveFeedbackPayload,
): Promise<{ ok: true } | ArchiveError> {
  try {
    const axes = feedbackAxes(payload);

    const res = await fetch("/api/archive-feedback", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sheetRow: payload.sheetRow,
        imageId: payload.imageId,
        rating: payload.rating,
        feedbackSent: payload.feedbackSent,
        showIllustrationsRow: payload.showIllustrationsRow,
        color: axes.colors,
        composition: axes.composition,
        artefacts: axes.extraElements,
        text: axes.text,
        illustration: axes.illustrations,
        comment: axes.comment ?? "",
      }),
    });
    if (res.ok) {
      console.info("[archive-feedback] ok", {
        sheetRow: payload.sheetRow,
        imageId: payload.imageId,
      });
      return { ok: true };
    }
    const text = await res.text().catch(() => "");
    const message = text || res.statusText || "Feedback update failed";
    console.error("[archive-feedback]", res.status, message);
    return { ok: false, status: res.status, message };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Network error";
    console.error("[archive-feedback]", message);
    return { ok: false, status: 0, message };
  }
}

/** Poll until archive finishes, fails, or timeout. */
export async function waitForArchiveSheetRow(
  imageId: string,
  getState: () => { sheetRow?: number; error?: string },
  timeoutMs = 180_000,
): Promise<number | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const { sheetRow, error } = getState();
    if (error) return null;
    if (sheetRow) return sheetRow;
    await new Promise((r) => setTimeout(r, 400));
  }
  console.warn("[archive-feedback] wait timeout", { imageId, timeoutMs });
  return null;
}

export async function flushPendingArchiveFeedback(
  imageId: string,
  sheetRow?: number,
): Promise<{ ok: true } | ArchiveError | null> {
  const store = useProjectStore.getState();
  const pending = store.pendingArchiveFeedback[imageId];
  if (!pending) return null;

  const row = sheetRow ?? store.simpleImageArchiveMeta[imageId]?.sheetRow;
  const result = await updateArchiveFeedback({ ...pending, imageId, sheetRow: row });
  if (result.ok) {
    store.clearPendingArchiveFeedback(imageId);
  }
  return result;
}

/** Send feedback now, or queue until the sheet row for this image is ready. */
export async function submitArchiveFeedback(
  imageId: string,
  payload: PendingArchiveFeedback,
): Promise<SubmitArchiveFeedbackResult> {
  const store = useProjectStore.getState();

  if (store.simpleImageArchiveErrors[imageId]) {
    return { ok: false, status: 0, message: store.simpleImageArchiveErrors[imageId] };
  }

  const existingRow = store.simpleImageArchiveMeta[imageId]?.sheetRow;
  if (existingRow) {
    const result = await updateArchiveFeedback({ ...payload, imageId, sheetRow: existingRow });
    if (result.ok) store.clearPendingArchiveFeedback(imageId);
    return result.ok ? { ok: true, queued: false } : result;
  }

  const sheetRow = await waitForArchiveSheetRow(imageId, () => {
    const s = useProjectStore.getState();
    return {
      sheetRow: s.simpleImageArchiveMeta[imageId]?.sheetRow,
      error: s.simpleImageArchiveErrors[imageId],
    };
  });

  if (sheetRow) {
    const result = await updateArchiveFeedback({ ...payload, imageId, sheetRow });
    if (result.ok) store.clearPendingArchiveFeedback(imageId);
    return result.ok ? { ok: true, queued: false } : result;
  }

  if (useProjectStore.getState().simpleImageArchiveErrors[imageId]) {
    return {
      ok: false,
      status: 0,
      message: useProjectStore.getState().simpleImageArchiveErrors[imageId],
    };
  }

  store.setPendingArchiveFeedback(imageId, payload);
  console.info("[archive-feedback] queued until archive row is ready", { imageId });
  return { ok: true, queued: true };
}

/** Retry queued feedback for all images that already have a sheet row. */
export async function flushAllPendingArchiveFeedback(): Promise<void> {
  const store = useProjectStore.getState();
  for (const imageId of Object.keys(store.pendingArchiveFeedback)) {
    await flushPendingArchiveFeedback(imageId);
  }
}
