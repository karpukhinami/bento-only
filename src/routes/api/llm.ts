import { createFileRoute } from "@tanstack/react-router";
import { OPENROUTER_API_KEY } from "@/lib/openrouter";
import { isOpenRouterModel, resolveUpstreamModelId } from "@/lib/models";

interface ReqBody {
  model: string;
  prompt: string;
  system?: string;
  images?: string[];
}

const OPENROUTER_TIMEOUT_MS = 180_000;

function isContextTooLongError(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("context length") ||
    t.includes("context_length") ||
    t.includes("maximum context") ||
    t.includes("too long") ||
    t.includes("token limit") ||
    t.includes("max tokens") ||
    t.includes("prompt is too long")
  );
}

/** Extracts plain text from OpenAI-shaped chat completion message.content. */
function extractContent(content: unknown): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => {
        if (typeof p === "string") return p;
        if (p && typeof p === "object") {
          const obj = p as { type?: string; text?: string; content?: string };
          return obj.text ?? obj.content ?? "";
        }
        return "";
      })
      .join("");
  }
  if (typeof content === "object") {
    const obj = content as { text?: string };
    return obj.text ?? "";
  }
  return "";
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: { content?: unknown; reasoning?: string };
    finish_reason?: string;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string; code?: number | string };
}

export const Route = createFileRoute("/api/llm")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ReqBody;
        if (!body?.model || !body?.prompt) {
          return new Response("Missing model or prompt", { status: 400 });
        }

        const useOpenRouter = isOpenRouterModel(body.model);

        const userContent: unknown = body.images?.length
          ? [
              { type: "text", text: body.prompt },
              ...body.images.map((url) => ({ type: "image_url", image_url: { url } })),
            ]
          : body.prompt;

        const messages = [
          ...(body.system ? [{ role: "system", content: body.system }] : []),
          { role: "user", content: userContent },
        ];

        let upstreamUrl: string;
        let headers: Record<string, string>;
        const provider = useOpenRouter ? "openrouter" : "lovable";

        if (useOpenRouter) {
          if (!OPENROUTER_API_KEY) {
            return new Response(
              "OpenRouter API key not configured. Set OPENROUTER_API_KEY in the environment.",
              { status: 500 },
            );
          }
          upstreamUrl = "https://openrouter.ai/api/v1/chat/completions";
          headers = {
            Authorization: `Bearer ${OPENROUTER_API_KEY}`,
            "Content-Type": "application/json",
          };
        } else {
          const key = process.env.LOVABLE_API_KEY;
          if (!key) return new Response("LOVABLE_API_KEY not configured", { status: 500 });
          upstreamUrl = "https://ai.gateway.lovable.dev/v1/chat/completions";
          headers = {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          };
        }

        const controller = new AbortController();
        const timer = useOpenRouter
          ? setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS)
          : null;

        let upstream: Response;
        try {
          upstream = await fetch(upstreamUrl, {
            method: "POST",
            headers,
            body: JSON.stringify({
              model: resolveUpstreamModelId(body.model),
              messages,
              max_tokens: 16000,
              // Просим OpenRouter вернуть фактическую стоимость в usage.cost
              ...(useOpenRouter ? { usage: { include: true } } : {}),
            }),
            signal: controller.signal,
          });
        } catch (e) {
          if (timer) clearTimeout(timer);
          const aborted = (e as Error)?.name === "AbortError";
          if (aborted) {
            return new Response(
              `OpenRouter timeout: модель «${body.model}» не ответила за ${Math.round(
                OPENROUTER_TIMEOUT_MS / 1000,
              )} сек. Попробуйте другую модель или сократите запрос.`,
              { status: 504 },
            );
          }
          return new Response(`Network error: ${(e as Error).message}`, { status: 502 });
        }
        if (timer) clearTimeout(timer);

        // Read raw body once, then try to parse JSON. This lets us return the
        // raw payload to the client so the developer can inspect it.
        const rawText = await upstream.text().catch(() => "");

        if (!upstream.ok) {
          if (isContextTooLongError(rawText) || upstream.status === 413) {
            return new Response(
              `Запрос слишком длинный для модели «${body.model}». Сократите исходный текст или выберите модель с большим контекстом. (${rawText.slice(0, 200)})`,
              { status: 413 },
            );
          }
          return Response.json(
            {
              text: "",
              usage: null,
              model: body.model,
              provider,
              raw: rawText,
              error: `Upstream ${upstream.status}: ${rawText.slice(0, 400) || upstream.statusText}`,
            },
            { status: upstream.status },
          );
        }

        let data: ChatCompletionResponse;
        try {
          data = JSON.parse(rawText) as ChatCompletionResponse;
        } catch {
          return Response.json(
            {
              text: "",
              usage: null,
              model: body.model,
              provider,
              raw: rawText,
              error: "Upstream вернул не-JSON ответ.",
            },
            { status: 502 },
          );
        }

        if (data.error?.message) {
          const msg = data.error.message;
          if (isContextTooLongError(msg)) {
            return new Response(
              `Запрос слишком длинный для модели «${body.model}». ${msg}`,
              { status: 413 },
            );
          }
          return Response.json(
            { text: "", usage: data.usage ?? null, model: body.model, provider, raw: rawText, error: msg },
            { status: 502 },
          );
        }

        const choice = data.choices?.[0];
        const text = extractContent(choice?.message?.content);

        if (!text) {
          // Return raw so client can show diagnostic, but signal error.
          return Response.json(
            {
              text: "",
              usage: data.usage ?? null,
              model: body.model,
              provider,
              raw: rawText,
              error:
                choice?.finish_reason
                  ? `Модель не вернула текст (finish_reason: ${choice.finish_reason}). Проверьте сырой ответ.`
                  : "Ответ модели не содержит текста. Проверьте сырой ответ.",
            },
            { status: 502 },
          );
        }

        return Response.json({
          text,
          usage: data.usage ?? null,
          model: body.model,
          provider,
          raw: rawText,
        });
      },
    },
  },
});
