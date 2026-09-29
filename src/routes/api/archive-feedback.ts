import { createFileRoute } from "@tanstack/react-router";
import { isGoogleArchiveConfigured } from "@/lib/google/auth";
import { findSheetRowByImageId, updateFeedbackRow } from "@/lib/google/sheets";
import type { BipolarFeedbackValue, ImageFeedbackRating } from "@/lib/image-feedback-types";

interface ReqBody {
  sheetRow?: number;
  imageId?: string;
  rating: ImageFeedbackRating;
  feedbackSent: 0 | 1;
  showIllustrationsRow: boolean;
  color: BipolarFeedbackValue;
  composition: BipolarFeedbackValue;
  artefacts: BipolarFeedbackValue;
  text: BipolarFeedbackValue;
  illustration?: BipolarFeedbackValue;
  comment: string;
}

export const Route = createFileRoute("/api/archive-feedback")({
  server: {
    handlers: {
      PATCH: async ({ request }) => {
        if (!isGoogleArchiveConfigured()) {
          return new Response("Google archive not configured", { status: 503 });
        }
        if (!process.env.GOOGLE_SHEETS_ID?.trim()) {
          return new Response("GOOGLE_SHEETS_ID missing", { status: 503 });
        }

        let body: ReqBody;
        try {
          body = (await request.json()) as ReqBody;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        if (!body?.rating) {
          return new Response("Missing rating", { status: 400 });
        }

        let sheetRow = body.sheetRow;
        if (!sheetRow && body.imageId) {
          sheetRow = (await findSheetRowByImageId(body.imageId)) ?? undefined;
        }
        if (!sheetRow) {
          return new Response("Missing sheetRow or imageId not found in sheet", { status: 404 });
        }

        try {
          await updateFeedbackRow(sheetRow, {
            rating: body.rating,
            feedbackSent: body.feedbackSent,
            color: body.color,
            composition: body.composition,
            artefacts: body.artefacts,
            text: body.text,
            illustration: body.illustration,
            showIllustrationsRow: body.showIllustrationsRow,
            comment: body.comment ?? "",
          });
          return new Response(null, { status: 204 });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Feedback update failed";
          console.error("[archive-feedback]", msg);
          const hint =
            msg.includes("invalid_grant") || msg.includes("invalid_client")
              ? " Проверьте GOOGLE_OAUTH_* на Render."
              : "";
          return new Response(msg + hint, { status: 500 });
        }
      },
    },
  },
});
