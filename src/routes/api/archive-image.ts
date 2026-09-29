import { createFileRoute } from "@tanstack/react-router";
import { isGoogleArchiveConfigured } from "@/lib/google/auth";
import { compressImageToJpeg, decodeDataUrlToBuffer } from "@/lib/google/compress-image";
import { ensureSessionFolder, uploadSessionImage } from "@/lib/google/drive";
import { appendGenerationRow } from "@/lib/google/sheets";
import type { GenTrigger } from "@/lib/google/archive-schema";

interface ReqBody {
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

export const Route = createFileRoute("/api/archive-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isGoogleArchiveConfigured()) {
          return new Response("Google archive not configured", { status: 503 });
        }
        const rootFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID?.trim();
        const spreadsheetId = process.env.GOOGLE_SHEETS_ID?.trim();
        if (!rootFolderId || !spreadsheetId) {
          return new Response("GOOGLE_DRIVE_FOLDER_ID or GOOGLE_SHEETS_ID missing", {
            status: 503,
          });
        }

        let body: ReqBody;
        try {
          body = (await request.json()) as ReqBody;
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        if (!body?.dataUrl || !body?.sessionId || !body?.imageId) {
          return new Response("Missing required fields", { status: 400 });
        }

        let sessionFolderId: string | undefined;
        let folderLink: string | undefined;

        try {
          const raw = decodeDataUrlToBuffer(body.dataUrl);
          const jpegBuffer = await compressImageToJpeg(raw);

          const folder = await ensureSessionFolder({
            rootFolderId,
            sessionId: body.sessionId,
            sessionFolderId: body.sessionFolderId,
          });
          sessionFolderId = folder.folderId;
          folderLink = folder.folderLink;

          const { fileId, driveLink } = await uploadSessionImage({
            folderId: sessionFolderId,
            version: body.version,
            jpegBuffer,
          });

          const { sheetRow } = await appendGenerationRow({
            sessionId: body.sessionId,
            createdAt: new Date().toISOString(),
            version: body.version,
            driveLink,
            genTrigger: body.genTrigger,
            subject: body.subject ?? "",
            className: body.className ?? "",
            topic: body.topic ?? "",
            addedContent: Boolean(body.addedContent),
            style: body.style ?? "",
            profile: body.profile ?? "",
            analysisModel: body.analysisModel ?? "",
            briefModel: body.briefModel ?? "",
            imageModel: body.imageModel ?? "",
            folderLink,
            imageId: body.imageId,
          });

          return Response.json({
            sheetRow,
            driveFileId: fileId,
            driveLink,
            folderLink,
            sessionFolderId,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "Archive failed";
          console.error("[archive-image]", msg);
          const hint =
            msg.includes("invalid_grant") || msg.includes("invalid_client")
              ? " Проверьте GOOGLE_OAUTH_* на Render или получите новый refresh token."
              : "";

          if (sessionFolderId && folderLink) {
            return Response.json(
              { error: msg + hint, sessionFolderId, folderLink },
              { status: 500 },
            );
          }

          return new Response(msg + hint, { status: 500 });
        }
      },
    },
  },
});
