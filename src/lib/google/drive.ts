import { Readable } from "node:stream";
import { google } from "googleapis";
import { getGoogleAuth } from "@/lib/google/auth";

function driveFileLink(fileId: string): string {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

export function driveFolderLink(folderId: string): string {
  return `https://drive.google.com/drive/folders/${folderId}`;
}

export async function ensureSessionFolder(opts: {
  rootFolderId: string;
  sessionId: string;
  sessionFolderId?: string | null;
}): Promise<{ folderId: string; folderLink: string }> {
  if (opts.sessionFolderId) {
    return {
      folderId: opts.sessionFolderId,
      folderLink: driveFolderLink(opts.sessionFolderId),
    };
  }

  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });
  const date = new Date().toISOString().slice(0, 10);
  const shortId = opts.sessionId.slice(0, 8);
  const name = `${date}_${shortId}`;

  const existing = await drive.files.list({
    q: [
      `'${opts.rootFolderId}' in parents`,
      "mimeType='application/vnd.google-apps.folder'",
      "trashed=false",
      `name contains '_${shortId}'`,
    ].join(" and "),
    fields: "files(id)",
    pageSize: 1,
    orderBy: "createdTime",
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  const existingId = existing.data.files?.[0]?.id;
  if (existingId) {
    return { folderId: existingId, folderLink: driveFolderLink(existingId) };
  }

  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [opts.rootFolderId],
    },
    fields: "id",
    supportsAllDrives: true,
  });

  const folderId = created.data.id;
  if (!folderId) throw new Error("Drive did not return folder id");

  return { folderId, folderLink: driveFolderLink(folderId) };
}

export async function uploadSessionImage(opts: {
  folderId: string;
  version: number;
  jpegBuffer: Buffer;
}): Promise<{ fileId: string; driveLink: string }> {
  const auth = getGoogleAuth();
  const drive = google.drive({ version: "v3", auth });
  const name = `v${opts.version}_${Date.now()}.jpg`;

  const created = await drive.files.create({
    requestBody: {
      name,
      parents: [opts.folderId],
      mimeType: "image/jpeg",
    },
    media: {
      mimeType: "image/jpeg",
      body: ReadableFromBuffer(opts.jpegBuffer),
    },
    fields: "id",
    supportsAllDrives: true,
  });

  const fileId = created.data.id;
  if (!fileId) throw new Error("Drive did not return file id");

  return { fileId, driveLink: driveFileLink(fileId) };
}

function ReadableFromBuffer(buffer: Buffer): NodeJS.ReadableStream {
  return Readable.from(buffer);
}
