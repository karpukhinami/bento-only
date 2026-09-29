/** Импорт файлов в «Исходный материал» — без отображения в textarea. */

export const SOURCE_FILE_ACCEPT =
  ".txt,.md,.pdf,.docx,image/*,text/plain,text/markdown,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export const SOURCE_FILE_UNSUPPORTED_MESSAGE =
  "Формат не поддерживается. Загрузите .txt, .md, .docx, .pdf или изображение.";

export type SourceFileKind = "plain" | "docx" | "pdf" | "image" | "unsupported";

export interface ExtractedDocumentPayload {
  text: string;
  images: string[];
}

const MAX_SOURCE_FILE_BYTES = 15 * 1024 * 1024;

export function classifySourceFile(file: File): SourceFileKind {
  const name = file.name.toLowerCase();

  if (file.type.startsWith("image/")) return "image";

  if (name.endsWith(".docx") || file.type.includes("wordprocessingml")) return "docx";
  if (name.endsWith(".pdf") || file.type === "application/pdf") return "pdf";
  if (name.endsWith(".txt") || name.endsWith(".md")) return "plain";
  if (file.type.startsWith("text/")) return "plain";

  if (name.endsWith(".doc")) return "unsupported";

  return "unsupported";
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function extractViaApi(file: File): Promise<ExtractedDocumentPayload> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/extract-document-text", { method: "POST", body: form });
  const payload = (await res.json().catch(() => ({}))) as ExtractedDocumentPayload & { error?: string };
  if (!res.ok) {
    throw new Error(payload.error || "Не удалось извлечь содержимое из файла");
  }
  return {
    text: payload.text ?? "",
    images: payload.images ?? [],
  };
}

function appendUploadedText(current: string, chunk: string): string {
  const next = chunk.trim();
  if (!next) return current;
  const cur = current.trim();
  return cur ? `${cur}\n\n${next}` : next;
}

export async function importSourceFiles(
  files: File[],
  opts: {
    getUploadedText: () => string;
    setUploadedText: (text: string) => void;
    addImages: (urls: string[]) => void;
    onSuccess?: (message: string) => void;
    onError?: (message: string) => void;
  },
): Promise<void> {
  for (const file of files) {
    if (file.size > MAX_SOURCE_FILE_BYTES) {
      opts.onError?.(`Файл «${file.name}» слишком большой (максимум 15 МБ).`);
      continue;
    }

    const kind = classifySourceFile(file);

    if (kind === "unsupported") {
      opts.onError?.(`${SOURCE_FILE_UNSUPPORTED_MESSAGE} (${file.name})`);
      continue;
    }

    try {
      if (kind === "image") {
        const dataUrl = await fileToDataUrl(file);
        opts.addImages([dataUrl]);
        opts.onSuccess?.(`Изображение «${file.name}» загружено`);
        continue;
      }

      if (kind === "plain") {
        const text = (await file.text()).trim();
        if (!text) {
          opts.onError?.(`Файл «${file.name}» не содержит текста.`);
          continue;
        }
        opts.setUploadedText(appendUploadedText(opts.getUploadedText(), text));
        opts.onSuccess?.(`Файл «${file.name}» загружен`);
        continue;
      }

      const { text, images } = await extractViaApi(file);
      const trimmed = text.trim();
      if (images.length) opts.addImages(images);
      if (trimmed) {
        opts.setUploadedText(appendUploadedText(opts.getUploadedText(), trimmed));
      }
      if (!trimmed && !images.length) {
        opts.onError?.(`Файл «${file.name}» не содержит извлекаемого текста или изображений.`);
        continue;
      }
      opts.onSuccess?.(`Файл «${file.name}» загружен`);
    } catch (e: unknown) {
      opts.onError?.(e instanceof Error ? e.message : "Не удалось прочитать файл");
    }
  }
}
