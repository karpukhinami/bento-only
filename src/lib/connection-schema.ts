import type {
  ConnectionCore,
  ConnectionCoreType,
  ConnectionEntity,
  ConnectionRegion,
  ConnectionRelation,
  ConnectionRegionRelation,
  ConnectionSchemaJson,
} from "@/lib/types";

export const ORGANIZATION_TYPE_LABELS: Record<string, string> = {
  linear_path: "Линейная последовательность",
  timeline: "Хронология / таймлайн",
  branching_tree: "Дерево / классификация",
  hub_and_spoke: "Центр и лучи",
  converging_diverging_flow: "Схождение / расхождение",
  parallel_lanes: "Параллельные линии",
  cycle: "Цикл",
  algorithmic_flowchart: "Блок-схема алгоритма",
};

export const CORE_TYPE_LABELS: Record<string, string> = {
  single_entity: "Одна центральная сущность",
  linear_route: "Линейный маршрут",
  cyclic_route: "Циклический маршрут",
  hub: "Центр и лучи",
};

const CORE_TYPES = new Set(["single_entity", "linear_route", "cyclic_route", "hub"]);

const DIRECTIONS = new Set(["one_way", "two_way", "none"]);

function str(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
}

function strOrArray(v: unknown): string | string[] | null {
  if (v == null) return null;
  if (Array.isArray(v)) {
    const arr = v.map((x) => String(x).trim()).filter(Boolean);
    return arr.length ? arr : null;
  }
  return str(v);
}

export function asAddendumLines(v: string | string[] | null | undefined): string[] {
  if (v == null) return [];
  return Array.isArray(v) ? v.filter((s) => String(s).trim() !== "").map(String) : [String(v)];
}

/** Flat list of entity ids that belong to the region core, in order. */
export function coreEntityIds(region: ConnectionRegion): string[] {
  const ids = (region.core?.entityIdSequences ?? []).flat().filter(Boolean);
  return Array.from(new Set(ids));
}

/** Single entry point of a region: first core entity, then legacy anchor. */
export function regionAnchorId(region: ConnectionRegion): string | null {
  const first = coreEntityIds(region)[0];
  if (first) return first;
  return region.anchorEntityId ?? null;
}

function normalizeDirection(v: unknown): ConnectionRelation["direction"] {
  const s = String(v ?? "").trim();
  return (DIRECTIONS.has(s) ? s : "one_way") as ConnectionRelation["direction"];
}

/** Validate + normalize the region `core` object; unknown ids are dropped. */
function normalizeCore(
  raw: unknown,
  ids: Set<string>,
  rid: string,
  warnings: string[],
): ConnectionCore | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const rawType = String(o.type ?? "").trim();
  const type = (CORE_TYPES.has(rawType) ? rawType : "") as ConnectionCoreType | "";
  if (!type) warnings.push(`Регион ${rid}: неизвестный core.type «${rawType || "—"}»`);

  const seqRaw = Array.isArray(o.entityIdSequences) ? o.entityIdSequences : [];
  const seen = new Set<string>();
  const sequences: string[][] = seqRaw
    .map((seq) => {
      const list = Array.isArray(seq) ? seq : [seq];
      return list
        .map((x) => str(x))
        .filter((x): x is string => {
          if (!x) return false;
          if (!ids.has(x)) {
            warnings.push(`Регион ${rid}: core ссылается на несуществующую сущность ${x}`);
            return false;
          }
          if (seen.has(x)) {
            warnings.push(`Регион ${rid}: сущность ${x} указана в core несколько раз`);
            return false;
          }
          seen.add(x);
          return true;
        });
    })
    .filter((seq) => seq.length > 0);

  if (!sequences.length) return null;
  const finalType: ConnectionCoreType =
    type || (sequences[0].length === 1 ? "single_entity" : "linear_route");
  return { type: finalType, entityIdSequences: sequences };
}

/**
 * Feature flag: drop labels on relations whose BOTH endpoints belong to the
 * region core. Set to false to disable this post-processing entirely.
 */
export const STRIP_CORE_RELATION_LABELS = true;

/**
 * Clear `label` on core↔core relations only. Relations touching non-core
 * entities keep their labels. No relations are added or removed.
 */
export function stripCoreRelationLabels(region: ConnectionRegion): void {
  if (!STRIP_CORE_RELATION_LABELS) return;
  const core = new Set(coreEntityIds(region));
  if (core.size < 2) return;
  for (const rel of region.relations) {
    if (core.has(rel.from) && core.has(rel.to)) rel.label = null;
  }
}

/** Validate + normalize the "connection schema" analysis JSON returned by the model. */
export function validateConnectionSchemaJson(raw: unknown): ConnectionSchemaJson {
  if (!raw || typeof raw !== "object") throw new Error("Ответ модели не является объектом");
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.regions)) throw new Error("В ответе отсутствует поле regions");

  const warnings: string[] = Array.isArray(o.warnings) ? (o.warnings as string[]).map(String) : [];
  const seenEntityIds = new Set<string>();

  const regions: ConnectionRegion[] = (o.regions as Record<string, unknown>[]).map((r, ri) => {
    const rid = str(r.id) ?? `r${ri + 1}`;
    const entitiesRaw = Array.isArray(r.entities) ? (r.entities as Record<string, unknown>[]) : [];
    const entities: ConnectionEntity[] = entitiesRaw.map((e, ei) => {
      let id = str(e.id) ?? `${rid}-e${ei + 1}`;
      if (seenEntityIds.has(id)) {
        warnings.push(`Дублирующийся id сущности: ${id}`);
        id = `${id}-${ri + 1}${ei + 1}`;
      }
      seenEntityIds.add(id);
      const entity: ConnectionEntity = {
        id,
        title: str(e.title),
        text: str(e.text),
        depiction: str(e.depiction),
        generatedImage:
          typeof e.generatedImage === "string" && e.generatedImage.startsWith("data:image/")
            ? e.generatedImage
            : null,
      };
      const addendum = strOrArray(e.addendum);
      if (addendum) entity.addendum = addendum;
      if (!entity.title && !entity.text && !entity.depiction) {
        warnings.push(`Сущность ${id}: не заполнено ни одно из полей title, text, depiction`);
      }
      return entity;
    });

    const ids = new Set(entities.map((e) => e.id));
    const relationsRaw = Array.isArray(r.relations) ? (r.relations as Record<string, unknown>[]) : [];
    const relations: ConnectionRelation[] = relationsRaw
      .map((rel) => ({
        from: str(rel.from) ?? "",
        to: str(rel.to) ?? "",
        direction: normalizeDirection(rel.direction),
        label: str(rel.label),
      }))
      .filter((rel) => {
        const ok = ids.has(rel.from) && ids.has(rel.to);
        if (!ok) warnings.push(`Связь ссылается на несуществующую сущность: ${rel.from} → ${rel.to}`);
        return ok;
      });

    const core = normalizeCore(r.core, ids, rid, warnings);

    // Legacy field: kept in sync with core so older consumers keep working.
    let anchorEntityId = str(r.anchorEntityId);
    if (anchorEntityId && !ids.has(anchorEntityId)) {
      warnings.push(`Якорь ${anchorEntityId} не найден среди сущностей региона ${rid}`);
      anchorEntityId = null;
    }
    const coreFirst = core?.entityIdSequences[0]?.[0] ?? null;
    if (!anchorEntityId) anchorEntityId = coreFirst;

    const region: ConnectionRegion = {
      id: rid,
      title: str(r.title),
      organizationType: str(r.organizationType) ?? "linear_path",
      core,
      anchorEntityId,
      entities,
      relations,
    };
    const number = str(r.number);
    if (number) region.number = number;
    if (!core && entities.length) {
      warnings.push(`Регион ${rid}: отсутствует core — структура определена только связями`);
    }
    stripCoreRelationLabels(region);
    return region;
  });

  const regionIds = new Set(regions.map((r) => r.id));
  const regionRelations: ConnectionRegionRelation[] = (
    Array.isArray(o.regionRelations) ? (o.regionRelations as Record<string, unknown>[]) : []
  )
    .map((rel) => ({
      fromRegion: str(rel.fromRegion) ?? "",
      toRegion: str(rel.toRegion) ?? "",
      direction: normalizeDirection(rel.direction),
      label: str(rel.label),
    }))
    .filter((rel) => regionIds.has(rel.fromRegion) && regionIds.has(rel.toRegion));

  return {
    kind: "connection-schema",
    sourceMode: o.sourceMode === "topic" ? "topic" : "text",
    topic: str(o.topic) ?? "",
    subject: str(o.subject),
    grade: str(o.grade),
    focusQuestion: str(o.focusQuestion) ?? "",
    displaySubtitle: str(o.displaySubtitle),
    regions,
    regionRelations,
    warnings,
  };
}


function arrow(direction: ConnectionRelation["direction"]): string {
  if (direction === "two_way") return "↔";
  if (direction === "none") return "—";
  return "→";
}

function entityLabel(e: ConnectionEntity | undefined, id: string): string {
  if (!e) return id;
  return e.title || e.text || e.depiction || id;
}

/** Human-readable Markdown rendering of the connection-schema JSON. */
export function renderConnectionSchemaJson(a: ConnectionSchemaJson): string {
  const parts: string[] = [];
  parts.push(`# ${a.topic || "Без темы"}`);
  const meta = [a.subject, a.grade].filter(Boolean).join(" · ");
  if (meta) parts.push(`*${meta}*`);
  if (a.displaySubtitle) parts.push(`> **Подзаголовок:** ${a.displaySubtitle}`);
  if (a.focusQuestion) parts.push(`> **Фокусный вопрос:** ${a.focusQuestion}`);

  a.regions.forEach((r, i) => {
    const num = r.number ? `${r.number}. ` : `${i + 1}. `;
    const orgLabel = ORGANIZATION_TYPE_LABELS[r.organizationType] ?? r.organizationType;
    parts.push(`\n---\n\n## 🗺 Регион ${num}${r.title ?? ""} _(${orgLabel})_`);

    const coreIds = coreEntityIds(r);
    if (r.core) {
      const byId = new Map(r.entities.map((e) => [e.id, e]));
      const coreLabel = CORE_TYPE_LABELS[r.core.type] ?? r.core.type;
      const routes = r.core.entityIdSequences
        .map((seq) => seq.map((id) => entityLabel(byId.get(id), id)).join(" → "))
        .join(" / ");
      parts.push(`**⚓ Ядро региона** _(${coreLabel})_: ${routes}`);
    }

    r.entities.forEach((e) => {
      const isCore = coreIds.includes(e.id);
      const head = `#### ${isCore ? "⚓ " : ""}${e.title ?? e.id}`;
      const chunk: string[] = [head];
      if (e.text) chunk.push(e.text);
      const add = asAddendumLines(e.addendum);
      if (add.length) chunk.push(add.map((x) => `> 💬 ${x}`).join("\n"));
      if (e.depiction) chunk.push(`🖼 _Изображение:_ ${e.depiction}`);
      parts.push(chunk.join("\n\n"));
    });


    if (r.relations.length) {
      const byId = new Map(r.entities.map((e) => [e.id, e]));
      parts.push(
        ["**Связи:**", ...r.relations.map(
          (rel) =>
            `- ${entityLabel(byId.get(rel.from), rel.from)} ${arrow(rel.direction)} ${entityLabel(byId.get(rel.to), rel.to)}${rel.label ? ` — _${rel.label}_` : ""}`,
        )].join("\n"),
      );
    }
  });

  if (a.regionRelations.length) {
    const byId = new Map(a.regions.map((r) => [r.id, r]));
    parts.push(`\n---\n\n## 🔗 Связи между регионами`);
    parts.push(
      a.regionRelations
        .map(
          (rel) =>
            `- ${byId.get(rel.fromRegion)?.title ?? rel.fromRegion} ${arrow(rel.direction)} ${byId.get(rel.toRegion)?.title ?? rel.toRegion}${rel.label ? ` — _${rel.label}_` : ""}`,
        )
        .join("\n"),
    );
  }

  if (a.warnings.length) {
    parts.push(`\n---\n\n## ⚠ Предупреждения анализа`);
    parts.push(a.warnings.map((w) => `- ${w}`).join("\n"));
  }

  return parts.join("\n\n");
}

// --- LaTeX normalization for the design-brief input (connection style only) ---
// Bento feeds the brief a Markdown summary, where formulas already carry $...$
// delimiters and single backslashes. The connection style feeds raw JSON, so the
// same two guarantees have to be reproduced here, otherwise the image model sees
// `\\frac` / undelimited LaTeX and renders it as visible technical syntax.

const LATEX_COMMAND_RE =
  /\\(frac|dfrac|tfrac|sqrt|left|right|text|mathrm|mathbb|cdot|times|div|pm|mp|sum|prod|int|lim|log|ln|sin|cos|tan|cot|vec|overline|underline|hat|bar|begin|end|alpha|beta|gamma|delta|Delta|epsilon|varepsilon|theta|lambda|mu|nu|pi|rho|sigma|tau|phi|varphi|chi|psi|omega|Omega|Sigma|Pi|infty|approx|neq|leq|geq|le|ge|ll|gg|equiv|propto|partial|nabla|angle|perp|parallel|in|notin|subset|supset|cup|cap|forall|exists|Rightarrow|rightarrow|leftarrow|leftrightarrow|to|circ|deg|%|,|;|!)/;

/** Whole string is a bare formula (LaTeX commands or math-only) without $ delimiters. */
function isBareFormula(text: string): boolean {
  const t = text.trim();
  if (!t || t.includes("$")) return false;
  if (LATEX_COMMAND_RE.test(t)) return true;
  return /^[A-Za-z0-9\s()[\]{}^_+\-*/=<>.,:;|'"·×÷±≤≥≈≠°%]+$/.test(t) && /[=^_]/.test(t);
}

/** Wrap bare formulas in $...$, mirroring the bento renderFormula behaviour. */
export function normalizeLatexValue<T>(value: T): T {
  if (typeof value === "string") {
    return (isBareFormula(value) ? `$${value.trim()}$` : value) as unknown as T;
  }
  if (Array.isArray(value)) return value.map((v) => normalizeLatexValue(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = normalizeLatexValue(v);
    }
    return out as unknown as T;
  }
  return value;
}

/**
 * Un-double the backslashes JSON.stringify introduces, so LaTeX appears in the
 * prompt exactly as it does in the bento Markdown summary ($\frac{a}{b}$, not
 * $\\frac{a}{b}$). Line breaks stay encoded as \n.
 */
export function singleBackslashLatex(json: string): string {
  return json.replace(/\\\\/g, "\\");
}

/**
 * Compact raw-JSON view of the connection schema for the design-brief prompt.
 * The brief prompt references raw field names (organizationType, core,
 * direction, displaySubtitle = null, …), so it needs the JSON, not the Markdown.
 * Generated base64 previews are stripped — they must never reach the LLM.
 * Legacy fields (number, anchorEntityId) are dropped: the current prompt describes
 * the region entry point through `core`, so passing an extra anchor would duplicate it.
 */
export function connectionSchemaForBrief(a: ConnectionSchemaJson): string {
  const clean = {
    topic: a.topic,
    // Blank subject/grade become null so the prompt can skip the meta pill.
    subject: String(a.subject ?? "").trim() || null,
    grade: String(a.grade ?? "").trim() || null,
    focusQuestion: a.focusQuestion,
    displaySubtitle: a.displaySubtitle,
    regions: a.regions.map((r) => ({
      id: r.id,
      title: r.title,
      organizationType: r.organizationType,
      core: r.core ?? {
        type: "single_entity",
        entityIdSequences: regionAnchorId(r) ? [[regionAnchorId(r) as string]] : [],
      },
      entities: r.entities.map((e) => ({
        id: e.id,
        title: e.title,
        text: e.text,
        ...(e.addendum ? { addendum: e.addendum } : {}),
        depiction: e.depiction,
      })),
      relations: r.relations,
    })),

    regionRelations: a.regionRelations,
  };
  return singleBackslashLatex(JSON.stringify(normalizeLatexValue(clean), null, 2));
}

