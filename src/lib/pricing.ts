// Approximate USD prices per 1M tokens. Update as needed.
import openrouterModels from "@/data/openrouter-models.json";

export interface ModelPrice {
  inputPerM: number;
  outputPerM: number;
  imagePerM?: number;
}

const or = openrouterModels as {
  text: Array<{ id: string; inputPerM: number; outputPerM: number }>;
  image: Array<{ id: string; inputPerM: number; outputPerM: number }>;
};

const orPrices: Record<string, ModelPrice> = {};
for (const m of or.text) orPrices[m.id] = { inputPerM: m.inputPerM, outputPerM: m.outputPerM };
for (const m of or.image)
  orPrices[m.id] = { inputPerM: m.inputPerM, outputPerM: m.outputPerM, imagePerM: m.outputPerM };

export const MODEL_PRICES: Record<string, ModelPrice> = {
  // Lovable text
  "google/gemini-3-flash-preview": { inputPerM: 0.3, outputPerM: 2.5 },
  "google/gemini-2.5-pro": { inputPerM: 1.25, outputPerM: 10 },
  "google/gemini-2.5-flash": { inputPerM: 0.3, outputPerM: 2.5 },
  "openai/gpt-5": { inputPerM: 1.25, outputPerM: 10 },
  "openai/gpt-5-mini": { inputPerM: 0.25, outputPerM: 2 },
  "openai/gpt-5-nano": { inputPerM: 0.05, outputPerM: 0.4 },
  "openai/gpt-4o-mini": { inputPerM: 0.15, outputPerM: 0.6 },
  "anthropic/claude-3.5-sonnet": { inputPerM: 3, outputPerM: 15 },
  // Lovable image
  "openai/gpt-image-2": { inputPerM: 5, outputPerM: 40, imagePerM: 40 },
  "openai/gpt-image-1-mini": { inputPerM: 2, outputPerM: 8, imagePerM: 8 },
  "google/gemini-2.5-flash-image": { inputPerM: 0.3, outputPerM: 30, imagePerM: 30 },
  "google/gemini-3.1-flash-image-preview": { inputPerM: 0.3, outputPerM: 30, imagePerM: 30 },
  "google/gemini-3-pro-image-preview": { inputPerM: 2, outputPerM: 60, imagePerM: 60 },
  // OpenRouter (overrides above for duplicate ids)
  ...orPrices,
};

export interface UsageRecord {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  kind: "text" | "image";
  at: number;
}

export function computeCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  kind: "text" | "image",
): number {
  const key = model.startsWith("openrouter:") ? model.slice("openrouter:".length) : model;
  const p = MODEL_PRICES[key];
  if (!p) return 0;
  // Negative prices (openrouter/auto sentinel) mean "unknown"
  if (p.inputPerM < 0 || p.outputPerM < 0) return 0;
  const out = kind === "image" && p.imagePerM != null ? p.imagePerM : p.outputPerM;
  return (inputTokens * p.inputPerM + outputTokens * out) / 1_000_000;
}

export function fmtUsd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(5)}`;
  if (n < 1) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(2)}`;
}
