import { createFileRoute } from "@tanstack/react-router";
import { OPENROUTER_API_KEY } from "@/lib/openrouter";
import { isOpenRouterModel, resolveUpstreamModelId } from "@/lib/models";

interface ReqBody {
  model: string;
  prompt: string;
  /** Card visual only — OpenRouter image size/aspect (omitted for full infographic). */
  resolution?: string;
  aspect_ratio?: string;
  /** Reference images (data URLs or https URLs) sent alongside the prompt. */
  images?: string[];
}

/** Chat-shaped user content: plain text, or text + attached reference images. */
function userContent(body: ReqBody): unknown {
  if (!body.images?.length) return body.prompt;
  return [
    { type: "text", text: body.prompt },
    ...body.images.map((url) => ({ type: "image_url", image_url: { url } })),
  ];
}

const OPENROUTER_TIMEOUT_MS = 180_000;

function openRouterHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    "Content-Type": "application/json",
  };
}

function openRouterErrorResponse(status: number, body: ReqBody, rawText: string) {
  return Response.json(
    {
      b64: "",
      usage: null,
      model: body.model,
      provider: "openrouter",
      raw: rawText,
      error: `Upstream ${status}: ${rawText.slice(0, 400) || String(status)}`,
    },
    { status },
  );
}

function isContextTooLongError(text: string): boolean {
  const t = text.toLowerCase();
  return (
    t.includes("context length") ||
    t.includes("too long") ||
    t.includes("token limit") ||
    t.includes("maximum context")
  );
}

function extractB64FromDataUrl(url: string): string {
  const i = url.indexOf("base64,");
  return i >= 0 ? url.slice(i + 7) : url;
}

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ReqBody;
        if (!body?.model || !body?.prompt) {
          return new Response("Missing model or prompt", { status: 400 });
        }

        const useOpenRouter = isOpenRouterModel(body.model);

        if (useOpenRouter) {
          if (!OPENROUTER_API_KEY) {
            return new Response(
              "OpenRouter API key not configured. Set OPENROUTER_API_KEY in the environment.",
              { status: 500 },
            );
          }
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);
          const upstreamModel = resolveUpstreamModelId(body.model);
          const isCardImage = Boolean(body.resolution || body.aspect_ratio);
          let upstream: Response;

          try {
            if (isCardImage) {
              const imagesPayload: Record<string, unknown> = {
                model: upstreamModel,
                prompt: body.prompt,
              };
              if (body.resolution) imagesPayload.resolution = body.resolution;
              if (body.aspect_ratio) imagesPayload.aspect_ratio = body.aspect_ratio;

              console.log("[OpenRouter card image]", {
                endpoint: "/api/v1/images",
                model: body.model,
                upstreamModel,
                prompt: body.prompt,
                resolution: body.resolution ?? null,
                aspect_ratio: body.aspect_ratio ?? null,
              });

              upstream = await fetch("https://openrouter.ai/api/v1/images", {
                method: "POST",
                headers: openRouterHeaders(),
                body: JSON.stringify(imagesPayload),
                signal: controller.signal,
              });
            } else {
              upstream = await fetch("https://openrouter.ai/api/v1/chat/completions", {
                method: "POST",
                headers: openRouterHeaders(),
                body: JSON.stringify({
                  model: upstreamModel,
                  messages: [{ role: "user", content: userContent(body) }],
                  modalities: ["image", "text"],
                  usage: { include: true },
                }),
                signal: controller.signal,
              });
            }
          } catch (e) {
            clearTimeout(timer);
            if ((e as Error)?.name === "AbortError") {
              return new Response(
                `OpenRouter timeout: модель «${body.model}» не вернула изображение за ${Math.round(
                  OPENROUTER_TIMEOUT_MS / 1000,
                )} сек. Попробуйте другую модель или упростите промпт.`,
                { status: 504 },
              );
            }
            return new Response(`Network error: ${(e as Error).message}`, { status: 502 });
          }
          clearTimeout(timer);

          const rawText = await upstream.text().catch(() => "");

          if (!upstream.ok) {
            if (isContextTooLongError(rawText) || upstream.status === 413) {
              return new Response(
                `Запрос слишком длинный для модели «${body.model}». Сократите промпт. (${rawText.slice(0, 200)})`,
                { status: 413 },
              );
            }
            return openRouterErrorResponse(upstream.status, body, rawText);
          }

          if (isCardImage) {
            let imageData: {
              data?: Array<{ b64_json?: string }>;
              usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
              error?: { message?: string };
            };
            try {
              imageData = JSON.parse(rawText);
            } catch {
              return Response.json(
                { b64: "", usage: null, model: body.model, provider: "openrouter", raw: rawText, error: "Upstream вернул не-JSON ответ." },
                { status: 502 },
              );
            }
            if (imageData.error?.message) {
              return Response.json(
                { b64: "", usage: null, model: body.model, provider: "openrouter", raw: rawText, error: imageData.error.message },
                { status: 502 },
              );
            }
            const b64 = imageData.data?.[0]?.b64_json;
            if (!b64) {
              return Response.json(
                {
                  b64: "",
                  usage: imageData.usage ?? null,
                  model: body.model,
                  provider: "openrouter",
                  raw: rawText,
                  error: "Модель не вернула изображение. См. сырой ответ.",
                },
                { status: 502 },
              );
            }
            return Response.json({
              b64,
              usage: imageData.usage ?? null,
              model: body.model,
              provider: "openrouter",
              raw: rawText,
            });
          }

          let data: {
            choices?: Array<{
              message?: {
                content?: string;
                images?: Array<{ image_url?: { url?: string } | string; type?: string }>;
              };
            }>;
            usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
            error?: { message?: string };
          };
          try {
            data = JSON.parse(rawText);
          } catch {
            return Response.json(
              { b64: "", usage: null, model: body.model, provider: "openrouter", raw: rawText, error: "Upstream вернул не-JSON ответ." },
              { status: 502 },
            );
          }

          if (data.error?.message) {
            return Response.json(
              { b64: "", usage: null, model: body.model, provider: "openrouter", raw: rawText, error: data.error.message },
              { status: 502 },
            );
          }
          const imgs = data.choices?.[0]?.message?.images;
          const first = imgs?.[0];
          const url =
            typeof first?.image_url === "string"
              ? first.image_url
              : first?.image_url?.url ?? "";
          if (!url) {
            return Response.json(
              {
                b64: "",
                usage: data.usage ?? null,
                model: body.model,
                provider: "openrouter",
                raw: rawText,
                error: "Модель не вернула изображение. См. сырой ответ.",
              },
              { status: 502 },
            );
          }
          return Response.json({
            b64: extractB64FromDataUrl(url),
            usage: data.usage ?? null,
            model: body.model,
            provider: "openrouter",
            raw: rawText,
          });
        }

        // Lovable path
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return new Response("LOVABLE_API_KEY not configured", { status: 500 });

        const upstreamModel = resolveUpstreamModelId(body.model);
        const isGemini = upstreamModel.startsWith("google/");
        const upstreamBody = isGemini
          ? {
              model: upstreamModel,
              messages: [{ role: "user", content: userContent(body) }],
              modalities: ["image", "text"],
            }
          : {
              model: upstreamModel,
              prompt: body.prompt,
              quality: "low",
              size: "1024x1024",
              n: 1,
            };

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/images/generations", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${key}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(upstreamBody),
        });
        const rawText = await upstream.text().catch(() => "");
        if (!upstream.ok) {
          return Response.json(
            { b64: "", usage: null, model: body.model, provider: "lovable", raw: rawText, error: `Upstream ${upstream.status}: ${rawText.slice(0, 400) || upstream.statusText}` },
            { status: upstream.status },
          );
        }
        let data: {
          data?: Array<{ b64_json?: string }>;
          choices?: Array<{ message?: { images?: Array<{ image_url?: { url?: string } | string }> } }>;
          usage?: { input_tokens?: number; output_tokens?: number; total_tokens?: number; prompt_tokens?: number; completion_tokens?: number };
        };
        try {
          data = JSON.parse(rawText);
        } catch {
          return Response.json(
            { b64: "", usage: null, model: body.model, provider: "lovable", raw: rawText, error: "Lovable вернул не-JSON ответ." },
            { status: 502 },
          );
        }
        let b64 = data.data?.[0]?.b64_json;
        if (!b64) {
          // Gemini-style chat-completion shape
          const first = data.choices?.[0]?.message?.images?.[0];
          const url =
            typeof first?.image_url === "string" ? first.image_url : first?.image_url?.url ?? "";
          if (url) b64 = extractB64FromDataUrl(url);
        }
        if (!b64) {
          return Response.json(
            { b64: "", usage: data.usage ?? null, model: body.model, provider: "lovable", raw: rawText, error: "Lovable не вернул изображение." },
            { status: 502 },
          );
        }
        return Response.json({ b64, usage: data.usage ?? null, model: body.model, provider: "lovable", raw: rawText });
      },
    },
  },
});
