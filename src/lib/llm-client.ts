// Client-side helpers calling the server routes.
import { useUsageStore } from "@/store/useUsageStore";
import { computeCost } from "@/lib/pricing";

interface UsagePayload {
  prompt_tokens?: number;
  completion_tokens?: number;
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  /** OpenRouter возвращает фактическую стоимость запроса в USD. */
  cost?: number;
}

function recordUsage(
  model: string,
  usage: UsagePayload | null | undefined,
  kind: "text" | "image",
) {
  if (!usage) return;
  const inputTokens = usage.prompt_tokens ?? usage.input_tokens ?? 0;
  const outputTokens = usage.completion_tokens ?? usage.output_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? inputTokens + outputTokens;
  // Если апстрим (OpenRouter) сообщил фактическую стоимость — используем её напрямую,
  // иначе считаем по тарифной таблице.
  const costUsd =
    typeof usage.cost === "number" && Number.isFinite(usage.cost) && usage.cost >= 0
      ? usage.cost
      : computeCost(model, inputTokens, outputTokens, kind);
  useUsageStore
    .getState()
    .add({ model, inputTokens, outputTokens, totalTokens, costUsd, kind, at: Date.now() });
}

function recordRaw(
  model: string,
  raw: string | undefined,
  kind: "text" | "image",
  note?: string,
) {
  if (!raw) return;
  let pretty = raw;
  try {
    pretty = JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    /* keep as-is */
  }
  useUsageStore.getState().addRaw({ model, kind, at: Date.now(), raw: pretty, note });
}

async function callTextLLMOnce(opts: {
  model: string;
  prompt: string;
  system?: string;
  images?: string[];
}): Promise<string> {
  const res = await fetch("/api/llm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");
    recordRaw(opts.model, text, "text", `http ${res.status}`);
    throw new Error(`LLM request failed (${res.status}): ${text.slice(0, 400) || res.statusText}`);
  }
  const data = (await res.json()) as {
    text: string;
    usage?: UsagePayload | null;
    model?: string;
    provider?: string;
    raw?: string;
    error?: string;
  };
  recordRaw(data.model ?? opts.model, data.raw, "text", data.provider ?? (res.ok ? "ok" : `err ${res.status}`));
  if (!res.ok || data.error) {
    throw new Error(data.error || `LLM request failed (${res.status})`);
  }
  recordUsage(data.model ?? opts.model, data.usage, "text");
  return data.text;
}

export async function callTextLLM(opts: {
  model: string;
  prompt: string;
  system?: string;
  images?: string[]; // data URLs or https URLs
  /** On failure, one retry with this model (e.g. 2.5 Flash after 3.1 Lite). */
  fallbackModel?: string;
}): Promise<string> {
  const { fallbackModel, ...primaryOpts } = opts;
  try {
    return await callTextLLMOnce(primaryOpts);
  } catch (primaryError) {
    if (!fallbackModel || fallbackModel === opts.model) throw primaryError;
    try {
      return await callTextLLMOnce({ ...primaryOpts, model: fallbackModel });
    } catch {
      throw primaryError;
    }
  }
}

export async function callImageLLM(opts: {
  model: string;
  prompt: string;
  resolution?: string;
  aspect_ratio?: string;
  /** Reference images (data URLs or https URLs) attached to the drawing request. */
  images?: string[];
}): Promise<string> {
  const res = await fetch("/api/generate-image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const text = await res.text().catch(() => "");
    recordRaw(opts.model, text, "image", `http ${res.status}`);
    throw new Error(`Image generation failed (${res.status}): ${text.slice(0, 400) || res.statusText}`);
  }
  const data = (await res.json()) as {
    b64: string;
    usage?: UsagePayload | null;
    model?: string;
    provider?: string;
    raw?: string;
    error?: string;
  };
  recordRaw(data.model ?? opts.model, data.raw, "image", data.provider ?? (res.ok ? "ok" : `err ${res.status}`));
  if (!res.ok || data.error || !data.b64) {
    throw new Error(data.error || `Image generation failed (${res.status})`);
  }
  recordUsage(data.model ?? opts.model, data.usage, "image");
  return `data:image/png;base64,${data.b64}`;
}
