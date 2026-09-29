import type {
  ConceptArtAbstractionLevel,
  ConceptArtInterpretation,
  ConceptArtJson,
} from "@/lib/types";
import { normalizeLatexValue, singleBackslashLatex } from "@/lib/connection-schema";

/** Canonical interpretation type names expected from the analysis prompt. */
export const INTERPRETATION_TYPES = [
  "Аннотированное представление",
  "Признаковое представление",
  "Демонстрация на примерах",
  "Абстрактно-символьная интерпретация",
  "Аналогическая интерпретация",
  "Персонифицированная интерпретация",
  "Системная интерпретация",
  "Серия состояний",
  "Пространственно-количественная модель",
];

export const ABSTRACTION_LEVEL_LABELS: Record<ConceptArtAbstractionLevel, string> = {
  low: "низкий уровень абстракции",
  medium: "средний уровень абстракции",
  high: "высокий уровень абстракции",
  very_high: "очень высокий уровень абстракции",
};

const LEVELS = new Set(["low", "medium", "high", "very_high"]);

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = Array.isArray(v)
    ? v
        .filter((x) => x != null)
        .map((x) => String(x).trim())
        .filter(Boolean)
        .join("\n")
    : String(v);
  const t = s.trim();
  return t ? t : null;
}

/** Mechanical repair of the most common level notations ("very high", "High", "3"). */
function normalizeLevel(v: unknown, warnings: string[]): ConceptArtAbstractionLevel | null {
  const raw = str(v);
  if (!raw) return null;
  const key = raw.toLowerCase().replace(/[\s-]+/g, "_");
  if (LEVELS.has(key)) return key as ConceptArtAbstractionLevel;
  if (key.includes("very")) return "very_high";
  if (key.startsWith("high") || key.includes("высок")) return "high";
  if (key.startsWith("med") || key.includes("сред")) return "medium";
  if (key.startsWith("low") || key.includes("низк")) return "low";
  warnings.push(`Неизвестный abstractionLevel «${raw}»`);
  return null;
}

/** Fuzzy-match a returned interpretation type onto the canonical list. */
function normalizeType(v: unknown, index: number, warnings: string[]): string {
  const raw = str(v);
  if (!raw) {
    warnings.push(`Вариант ${index + 1}: не указан interpretationType`);
    return "Без названия";
  }
  const norm = (s: string) => s.toLowerCase().replace(/[^a-zа-яё]+/gi, "");
  const exact = INTERPRETATION_TYPES.find((t) => norm(t) === norm(raw));
  if (exact) return exact;
  const partial = INTERPRETATION_TYPES.find(
    (t) => norm(t).includes(norm(raw)) || norm(raw).includes(norm(t)),
  );
  if (partial) return partial;
  warnings.push(`Вариант ${index + 1}: нестандартный interpretationType «${raw}»`);
  return raw;
}

/**
 * Validate + normalize the "concept art" analysis JSON returned by the model.
 * Tolerates the frequent shape errors: a bare array of interpretations, a single
 * interpretation object, alternative field names, arrays instead of strings.
 */
export function validateConceptArtJson(raw: unknown): ConceptArtJson {
  if (!raw || typeof raw !== "object") throw new Error("Ответ модели не является объектом");
  const warnings: string[] = [];

  // Model sometimes returns just the array of variants.
  const o: Record<string, unknown> = Array.isArray(raw)
    ? { visualInterpretations: raw }
    : (raw as Record<string, unknown>);

  let listRaw = o.visualInterpretations ?? o.interpretations ?? o.variants ?? null;
  if (listRaw && !Array.isArray(listRaw)) listRaw = [listRaw];
  if (!Array.isArray(listRaw) || listRaw.length === 0) {
    throw new Error("В ответе отсутствует непустой массив visualInterpretations");
  }

  const visualInterpretations: ConceptArtInterpretation[] = (listRaw as unknown[]).map((item, i) => {
    const it = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
    const idea = str(it.ideaAndRationale ?? it.idea ?? it.rationale);
    const image = str(it.imageDescription ?? it.description ?? it.image);
    if (!idea) warnings.push(`Вариант ${i + 1}: пустое поле ideaAndRationale`);
    if (!image) warnings.push(`Вариант ${i + 1}: пустое поле imageDescription`);
    return {
      interpretationType: normalizeType(it.interpretationType ?? it.type, i, warnings),
      ideaAndRationale: idea ?? "",
      imageDescription: image ?? "",
    };
  });

  const centralConcept = str(o.centralConcept ?? o.concept);
  const conceptDefinition = str(o.conceptDefinition ?? o.definition);
  if (!centralConcept) warnings.push("Не указана центральная концепция (centralConcept)");

  const extra = Array.isArray(o.warnings) ? (o.warnings as unknown[]).map((w) => String(w)) : [];

  return {
    kind: "concept-art",
    sourceMode: o.sourceMode === "topic" || o.source === "topic" ? "topic" : "text",
    topic: str(o.topic) ?? "",
    subject: str(o.subject),
    grade: str(o.grade),
    centralConcept: centralConcept ?? "",
    conceptDefinition,
    abstractionLevel: normalizeLevel(o.abstractionLevel ?? o.level, warnings),
    visualInterpretations,
    warnings: [...extra, ...warnings],
  };
}

/** Human-readable Markdown rendering of the concept-art JSON. */
export function renderConceptArtJson(a: ConceptArtJson): string {
  const parts: string[] = [];
  parts.push(`# ${a.centralConcept || a.topic || "Центральная концепция не указана"}`);
  const meta = [a.subject, a.grade].filter(Boolean).join(" · ");
  if (meta) parts.push(`*${meta}*`);
  if (a.conceptDefinition) parts.push(`**Определение концепции:**\n\n${a.conceptDefinition}`);
  if (a.abstractionLevel) {
    parts.push(`> **Уровень абстракции:** ${ABSTRACTION_LEVEL_LABELS[a.abstractionLevel]}`);
  }
  parts.push(`> **Источник:** ${a.sourceMode === "topic" ? "тема" : "текст"}`);

  a.visualInterpretations.forEach((v, i) => {
    parts.push(`\n---\n\n## ${i + 1}. ${v.interpretationType}`);
    if (v.ideaAndRationale) parts.push(`**Идея и обоснование:**\n\n${v.ideaAndRationale}`);
    if (v.imageDescription) parts.push(`**Описание изображения:**\n\n${v.imageDescription}`);
  });

  if (a.warnings.length) {
    parts.push(`\n---\n\n## ⚠ Предупреждения анализа`);
    parts.push(a.warnings.map((w) => `- ${w}`).join("\n"));
  }
  return parts.join("\n\n");
}

/**
 * Compact JSON view of the concept art for the design-brief prompt.
 * Same pipeline as connectionSchemaForBrief: strip UI-only fields, normalize
 * bare LaTeX into $...$, pretty-print JSON, then un-double backslashes so
 * formulas reach the brief model as $\frac{a}{b}$, not $\\frac{a}{b}$.
 * Not the Markdown preview — the brief prompt needs raw field names
 * (centralConcept, interpretationType, imageDescription, …).
 */
export function conceptArtForBrief(a: ConceptArtJson): string {
  const clean = {
    sourceMode: a.sourceMode,
    topic: String(a.topic ?? "").trim() || null,
    subject: String(a.subject ?? "").trim() || null,
    grade: String(a.grade ?? "").trim() || null,
    centralConcept: a.centralConcept,
    conceptDefinition: a.conceptDefinition,
    abstractionLevel: a.abstractionLevel,
    visualInterpretations: a.visualInterpretations.map((v) => ({
      interpretationType: v.interpretationType,
      ideaAndRationale: v.ideaAndRationale,
      imageDescription: v.imageDescription,
    })),
  };
  return singleBackslashLatex(JSON.stringify(normalizeLatexValue(clean), null, 2));
}
