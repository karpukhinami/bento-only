import { createFileRoute } from "@tanstack/react-router";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_EMBEDDED_IMAGES = 24;

function isDocx(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".docx") || file.type.includes("wordprocessingml");
}

function isPdf(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".pdf") || file.type === "application/pdf";
}

async function extractDocx(buffer: Buffer): Promise<{ text: string; images: string[] }> {
  const images: string[] = [];
  const convertImage = mammoth.images.imgElement((image) =>
    image.readAsBase64String().then((b64) => {
      const dataUrl = `data:${image.contentType};base64,${b64}`;
      if (images.length < MAX_EMBEDDED_IMAGES) images.push(dataUrl);
      return { src: dataUrl };
    }),
  );

  const [textResult] = await Promise.all([
    mammoth.extractRawText({ buffer }),
    mammoth.convertToHtml({ buffer }, { convertImage }),
  ]);

  return { text: textResult.value.trim(), images };
}

async function extractPdfImages(parser: PDFParse): Promise<string[]> {
  const images: string[] = [];
  try {
    const imageResult = await parser.getImage({ imageThreshold: 50 });
    for (const page of imageResult.pages ?? []) {
      for (const img of page.images ?? []) {
        if (images.length >= MAX_EMBEDDED_IMAGES) return images;
        const record = img as {
          dataUrl?: string;
          data?: Uint8Array | Buffer;
          mimeType?: string;
          contentType?: string;
        };
        if (record.dataUrl) {
          images.push(record.dataUrl);
          continue;
        }
        if (record.data) {
          const mime = record.mimeType ?? record.contentType ?? "image/png";
          const b64 = Buffer.from(record.data).toString("base64");
          images.push(`data:${mime};base64,${b64}`);
        }
      }
    }
  } catch {
    /* PDF без встроенных изображений — не ошибка */
  }
  return images;
}

export const Route = createFileRoute("/api/extract-document-text")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const form = await request.formData();
          const file = form.get("file");
          if (!(file instanceof File)) {
            return Response.json({ error: "Файл не передан" }, { status: 400 });
          }

          if (file.size > MAX_BYTES) {
            return Response.json({ error: "Файл слишком большой (максимум 15 МБ)" }, { status: 413 });
          }

          const buffer = Buffer.from(await file.arrayBuffer());

          if (isDocx(file)) {
            const { text, images } = await extractDocx(buffer);
            return Response.json({ text, images });
          }

          if (isPdf(file)) {
            const parser = new PDFParse({ data: buffer });
            try {
              const parsed = await parser.getText();
              const text = parsed.text.replace(/\s+\n/g, "\n").trim();
              const images = await extractPdfImages(parser);
              return Response.json({ text, images });
            } finally {
              await parser.destroy();
            }
          }

          return Response.json(
            { error: "Поддерживаются только .docx и .pdf" },
            { status: 400 },
          );
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : "Ошибка извлечения текста";
          return Response.json({ error: message }, { status: 500 });
        }
      },
    },
  },
});
