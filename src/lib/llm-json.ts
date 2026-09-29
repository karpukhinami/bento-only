import { callTextLLM } from "@/lib/llm-client";
import { extractJson } from "@/lib/json-repair";

const RECOVERABLE_JSON_ERROR_PATTERNS = [
  "bad escaped character",
  "unterminated string",
  "unexpected token",
  "expected ',' or '}'",
  "expected double-quoted property name",
  "expected property name",
  "property names must be double-quoted",
  "invalid escape",
  "truncated json output",
  "json",
];

function isRecoverableJsonError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  if (error instanceof SyntaxError) return true;
  const message = error.message.toLowerCase();
  return RECOVERABLE_JSON_ERROR_PATTERNS.some((pattern) => message.includes(pattern));
}

function buildJsonRepairPrompt(opts: {
  label: string;
  originalPrompt: string;
  invalidResponse: string;
  schemaHint?: string;
}): string {
  const { label, originalPrompt, invalidResponse, schemaHint } = opts;
  return `Ты исправляешь НЕВАЛИДНЫЙ JSON, который уже был сгенерирован ранее для шага: ${label}.

ТВОЯ ЗАДАЧА:
- вернуть только ИСПРАВЛЕННЫЙ валидный JSON;
- не писать пояснений, комментариев, markdown-ограждений и никакого текста вне JSON;
- максимально сохранить исходное содержание, структуру, поля, порядок блоков, переносы строк и формулировки;
- исправить только формат JSON и сериализацию строк.

ЧТО НУЖНО ПРОВЕРИТЬ И ИСПРАВИТЬ:
- все обратные слеши внутри JSON-строк должны быть корректно экранированы;
- LaTeX-команды внутри строк должны содержать двойные слеши: \\frac, \\sqrt, \\left, \\right, \\text, \\alpha;
- сырые переводы строк внутри строковых значений нужно заменить на escape-последовательности \\n;
- кавычки, запятые, фигурные и квадратные скобки должны быть сбалансированы;
- trailing commas недопустимы;
- если формулу нельзя безопасно оставить в LaTeX, перепиши её в простой юникодной математической записи без потери смысла.

ОЖИДАЕМЫЙ ТИП РЕЗУЛЬТАТА:
${schemaHint || "Верни тот же JSON-объект, но в валидном виде."}

ИСХОДНАЯ ЗАДАЧА ДЛЯ КОНТЕКСТА:
${originalPrompt}

НЕВАЛИДНЫЙ ОТВЕТ, КОТОРЫЙ НУЖНО ПОЧИНИТЬ:
${invalidResponse}`;
}

export async function callTextLLMForJson<T>(opts: {
  model: string;
  prompt: string;
  label: string;
  schemaHint?: string;
  parse: (value: unknown) => T;
  images?: string[];
  fallbackModel?: string;
}): Promise<T> {
  const { model, prompt, label, schemaHint, parse, images, fallbackModel } = opts;

  async function attempt(): Promise<T> {
    const raw = await callTextLLM({ model, prompt, images, fallbackModel });
    try {
      return parse(extractJson<unknown>(raw));
    } catch (error) {
      if (!isRecoverableJsonError(error)) throw error;
      const repairedRaw = await callTextLLM({
        model,
        prompt: buildJsonRepairPrompt({
          label,
          originalPrompt: prompt,
          invalidResponse: raw,
          schemaHint,
        }),
        images,
        fallbackModel,
      });
      return parse(extractJson<unknown>(repairedRaw));
    }
  }

  try {
    return await attempt();
  } catch (error) {
    // Truncated JSON ("length" finish_reason) is often transient — повторим один раз молча.
    const msg = error instanceof Error ? error.message.toLowerCase() : "";
    if (msg.includes("truncated json output") || msg.includes("обрезан")) {
      try {
        return await attempt();
      } catch (e2) {
        if (e2 instanceof Error && e2.message.toLowerCase().includes("truncated")) {
          throw new Error(
            "Модель дважды вернула обрезанный JSON. Попробуйте сократить исходный текст или повторить ещё раз.",
          );
        }
        throw e2;
      }
    }
    throw error;
  }
}
