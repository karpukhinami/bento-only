import type {
  AnalysisAttention,
  AnalysisEntity,
  AnalysisGroupItem,
  AnalysisJson,
  AnalysisSectionId,
} from "./types";

const SECTION_LABELS: Record<AnalysisSectionId, string> = {
  prerequisites: "Введение",
  main: "Основная часть",
  additions: "Дополнения и уточнения",
};

const SECTION_ORDER: AnalysisSectionId[] = ["prerequisites", "main", "additions"];

const ENTITY_LABELS: Record<string, string> = {
  concept: "Понятие",
  rule: "Правило",
  classificationBasis: "Основание классификации",
  factGroup: "Группа фактов (отдельные карточки)",
  factList: "Список фактов (одна карточка)",
  algorithmGroup: "Алгоритм (отдельные карточки)",
  actionList: "Список действий (одна карточка)",
  exception: "Исключение",
  specialCase: "Частный случай",
  commonMistake: "Частая ошибка",
  warning: "Внимание",
  example: "Пример",
  comparison: "Сравнение",
  conclusion: "Вывод",
  visualCore: "Главный визуал",
  // legacy labels
  mainIdea: "Главная идея",
  definition: "Определение",
  principle: "Принцип",
  theorem: "Теорема",
  property: "Свойство",
  criterion: "Признак",
  consequence: "Следствие",
  formula: "Формула",
  algorithm: "Алгоритм",
  solutionStep: "Шаг решения",
  diagram: "Схема",
};

/** Entities that produce multiple cards (one per item). */
const GROUP_ENTITY_TYPES = new Set(["factGroup", "algorithmGroup"]);
/** Entities that produce one single card containing a list. */
const FLAT_LIST_ENTITY_TYPES = new Set(["factList", "actionList"]);

function asLines(v: string | string[] | null | undefined): string[] {
  if (v == null) return [];
  return Array.isArray(v) ? v.filter((s) => s != null && String(s).trim() !== "").map(String) : [String(v)];
}

/** Render a formula string: keep $...$ / $$...$$ as is; otherwise wrap in $...$. */
function renderFormula(f: string): string {
  const t = f.trim();
  if (!t) return "";
  if (t.startsWith("$") || t.includes("$$")) return t;
  return `$${t}$`;
}

function attentionBadge(a: AnalysisAttention | undefined): string {
  if (a === "main" || a === "core") return " 🟢 **ЯДРО**";
  if (a === "accent") return " 🟠 _акцент_";
  return "";
}

function renderContent(content: string | string[] | null | undefined, ordered = false): string {
  const lines = asLines(content);
  if (lines.length === 0) return "";
  if (lines.length === 1) return lines[0];
  const marker = ordered ? (i: number) => `${i + 1}. ` : () => "- ";
  return lines.map((c, i) => `${marker(i)}${c}`).join("\n");
}

function renderAddendum(v: string | string[] | null | undefined): string {
  const lines = asLines(v);
  if (!lines.length) return "";
  if (lines.length === 1) return `> 💬 _Дополнение:_ ${lines[0]}`;
  return ["> 💬 _Дополнения:_", ...lines.map((l) => `> - ${l}`)].join("\n");
}

function renderFormulas(v: string | string[] | null | undefined): string {
  const lines = asLines(v);
  if (!lines.length) return "";
  return lines.map((f) => `**Формула:** ${renderFormula(f)}`).join("\n\n");
}

function renderGroupItem(item: AnalysisGroupItem, idx: number, ordered: boolean): string {
  const out: string[] = [];
  const marker = ordered ? `Шаг ${idx + 1}` : `Карточка ${idx + 1}`;
  const title = item.title ? ` · **${item.title}**` : "";
  const acc = item.attention === "accent" ? " 🟠" : "";
  out.push(`**▸ ${marker}**${title}${acc}`);
  const body = renderContent(item.content);
  if (body) out.push(body);
  const f = renderFormulas(item.formula);
  if (f) out.push(f);
  const add = renderAddendum(item.cardAddendum);
  if (add) out.push(add);
  return out.join("\n\n");
}

function renderEntity(e: AnalysisEntity): string {
  const typeLabel = ENTITY_LABELS[e.entityType] ?? e.entityType;
  const isGroup = GROUP_ENTITY_TYPES.has(e.entityType);
  const isFlatList = FLAT_LIST_ENTITY_TYPES.has(e.entityType);
  const isAlgo = e.entityType === "algorithmGroup" || e.entityType === "actionList";

  const out: string[] = [];

  // Header line: type label + attention badge + title
  const heading = e.title ? ` · **${e.title}**` : "";
  out.push(`#### _${typeLabel}_${heading}${attentionBadge(e.attention)}`);

  // Explicit hint about "one card vs many cards"
  if (isGroup) {
    const n = (e.items ?? []).length;
    out.push(
      `> ℹ️ _Группа: ${n > 0 ? `${n} отдельных карточек` : "несколько отдельных карточек"} — каждый элемент станет своей карточкой._`,
    );
  } else if (isFlatList) {
    const n = asLines(e.content).length;
    out.push(
      `> ℹ️ _Одна карточка-список${n ? ` из ${n} пунктов` : ""} — все пункты идут вместе на одной карточке._`,
    );
  }

  // Content / list
  const body = renderContent(e.content, isAlgo);
  if (body) out.push(body);

  // Formulas
  const f = renderFormulas(e.formula);
  if (f) out.push(f);

  // Group items
  if (isGroup && Array.isArray(e.items) && e.items.length) {
    for (let i = 0; i < e.items.length; i += 1) {
      out.push(renderGroupItem(e.items[i], i, isAlgo));
    }
  }

  // Card addendum
  const add = renderAddendum(e.cardAddendum);
  if (add) out.push(add);

  // Legacy example field
  const legacyExamples = asLines(e.example);
  if (legacyExamples.length) {
    out.push(legacyExamples.map((x) => `**Пример:** ${x}`).join("\n\n"));
  }

  // Visual
  if (e.visual?.description) {
    out.push(`🖼 _Иллюстрация (${e.visual.type || "схема"}):_ ${e.visual.description}`);
  }

  return out.join("\n\n");
}

export function renderAnalysisJson(a: AnalysisJson): string {
  const parts: string[] = [];
  parts.push(`# ${a.topic || "Без темы"}`);
  const meta = [a.subject, a.grade].filter(Boolean).join(" · ");
  if (meta) parts.push(`*${meta}*`);
  if (a.summary) parts.push(`> **Summary:** ${a.summary}`);

  // Group by sectionId (string) with tolerance to legacy numeric/unknown values.
  const bySection = new Map<string, AnalysisEntity[]>();
  for (const e of a.entities ?? []) {
    const sid = String(e.sectionId ?? "");
    const list = bySection.get(sid) ?? [];
    list.push(e);
    bySection.set(sid, list);
  }

  const orderedKeys: string[] = [];
  for (const sid of SECTION_ORDER) {
    if (bySection.has(sid)) orderedKeys.push(sid);
  }
  // Append any unknown / legacy sections (e.g. numeric ones) at the end.
  for (const k of bySection.keys()) {
    if (!orderedKeys.includes(k)) orderedKeys.push(k);
  }

  for (const sid of orderedKeys) {
    const entities = bySection.get(sid) ?? [];
    if (!entities.length) continue;
    const label = SECTION_LABELS[sid as AnalysisSectionId] ?? `Раздел ${sid}`;
    parts.push(`\n---\n\n## 📚 ${label}`);
    for (const e of entities) parts.push(renderEntity(e));
  }

  if (a.warnings?.length) {
    parts.push(`\n---\n\n## ⚠ Предупреждения анализа`);
    parts.push(a.warnings.map((w) => `- ${w}`).join("\n"));
  }
  return parts.join("\n\n");
}

/** Validate that the parsed object roughly matches AnalysisJson. */
export function validateAnalysisJson(raw: unknown): AnalysisJson {
  if (!raw || typeof raw !== "object") throw new Error("Ответ модели не является объектом");
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.entities)) throw new Error("В ответе отсутствует поле entities");
  if (typeof o.topic !== "string" && o.topic !== null) throw new Error("В ответе отсутствует поле topic");
  const sourceMode = o.sourceMode === "topic" ? "topic" : "text";

  const normalizeSection = (v: unknown): AnalysisSectionId => {
    const s = String(v ?? "").toLowerCase();
    if (s === "prerequisites" || s === "main" || s === "additions") return s;
    // legacy numeric: 1 → prerequisites, 2 → main, 3 → additions
    if (s === "1") return "prerequisites";
    if (s === "2") return "main";
    if (s === "3") return "additions";
    return "main";
  };
  const normalizeAttention = (v: unknown): AnalysisAttention | undefined => {
    const s = String(v ?? "").toLowerCase();
    if (s === "main" || s === "core" || s === "normal" || s === "accent") return s;
    return undefined;
  };

  const entities = (o.entities as Record<string, unknown>[]).map((e): AnalysisEntity => {
    const items = Array.isArray(e.items)
      ? (e.items as Record<string, unknown>[]).map(
          (it): AnalysisGroupItem => ({
            title: (it.title as string | null) ?? null,
            content: (it.content as string | string[] | null) ?? null,
            formula: (it.formula as string | string[] | null) ?? null,
            cardAddendum: (it.cardAddendum as string | string[] | null) ?? null,
            icon: (it.icon as string | null) ?? null,
            attention:
              it.attention === "accent" ? "accent" : it.attention === "normal" ? "normal" : undefined,
          }),
        )
      : null;
    return {
      sectionId: normalizeSection(e.sectionId),
      entityType: String(e.entityType || "concept"),
      attention: normalizeAttention(e.attention),
      title: (e.title as string | null) ?? null,
      content: (e.content as string | string[] | null) ?? null,
      formula: (e.formula as string | string[] | null) ?? null,
      cardAddendum: (e.cardAddendum as string | string[] | null) ?? null,
      items,
      icon: (e.icon as string | null) ?? null,
      visual:
        e.visual && typeof e.visual === "object"
          ? (() => {
              const v = e.visual as { type?: string | null; description?: string; generatedImage?: string };
              const generatedImage =
                typeof v.generatedImage === "string" && v.generatedImage.startsWith("data:image/")
                  ? v.generatedImage
                  : undefined;
              return {
                type: v.type ?? null,
                description: String(v.description ?? ""),
                ...(generatedImage ? { generatedImage } : {}),
              };
            })()
          : null,
      example: (e.example as string | string[] | null) ?? null,
      priority: (e.priority as AnalysisEntity["priority"]) ?? undefined,
    };
  });

  // Sanity check: at most one entity with attention="main" or "core".
  const mainCount = entities.filter((e) => e.attention === "main" || e.attention === "core").length;
  const warnings = Array.isArray(o.warnings) ? (o.warnings as string[]) : [];
  if (mainCount > 1) {
    warnings.push(`Внимание: в ответе модели найдено несколько сущностей с attention="main"/"core" (${mainCount}).`);
  }

  const rdpRaw = typeof o.recommendedDesignProfile === "string" ? o.recommendedDesignProfile.trim() : "";
  const recommendedDesignProfile = rdpRaw || null;

  return {
    sourceMode,
    topic: (o.topic as string) ?? "",
    subject: (o.subject as string | null) ?? null,
    grade: (o.grade as string | null) ?? null,
    summary: typeof o.summary === "string" ? o.summary : "",
    entities,
    warnings,
    recommendedDesignProfile,
  };
}

