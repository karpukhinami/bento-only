export type AppMode = "free" | "strict";

export interface InfographicStyle {
  id: string;
  name: string;
  shortDescription: string;
  enabled: boolean;
  /** General composition / layout rules for this style. */
  generalRules: string;
  /** Specific element-level rules for this style. */
  specificRules: string;
  /** Features used by the style-detection prompt to decide if this style fits the material. */
  detectionFeatures: string;
}

export interface DesignProfileColors {
  backgroundColor: string;
  surfaceColor: string;
  primaryColor: string;
  detailSoftColor: string;
  detailDeepColor: string;
  contrastSoftColor: string;
  inkColor: string;
  headerColor: string;
  lightTextColor: string;
  spotAccentColor: string;
  mutedheaderTextColor: string;
}

export interface DesignProfile {
  profileName: string;
  colors: DesignProfileColors;
  typography: {
    styleId: string;
    specificityId: string;
  };
  notesForAI: string;
}


export type InputMode = "text" | "file" | "topic";

export interface SourceText {
  mode: InputMode;
  text: string;
  topic?: string;
  subject?: string;
  grade?: string;
  userInstructions: string;
  educationalIllustrations: boolean;
  narrativeIllustrations: boolean;
}

export type WireframeBlockSize =
  | "full"
  | "half"
  | "third"
  | "quarter"
  | "compact"
  | "dominant"
  | "narrow"
  | "wide";

export interface WireframeBlock {
  /** Stable id, e.g. "card-1". */
  id?: string;
  /** Group id matching ContentSummary.entities[].sectionId. */
  sectionId?: number;
  /** entityType from ContentSummary (mainIdea, rule, definition, formula, warning, ...). */
  entityType?: string;
  /** Visual role of the card: header / mainIdea / rule / detail / warning / formula / visualCore / diagram / conclusion / classification. */
  role?: string;
  /** Semantic size token. */
  size?: WireframeBlockSize;
  /** Numeric width in grid units within the row (derived from size when absent). */
  width?: number;
  /** Exact title text from ContentSummary, if any. */
  title?: string;
  /** Short preview of the body text (one line). */
  contentPreview?: string;
  hasIcon?: boolean;
  hasVisual?: boolean;
  hasFormula?: boolean;
  hasExample?: boolean;
  priority?: "high" | "medium" | "low";
  /** Background role token: accent / pastel / structural-dark / card / warning. */
  backgroundRole?: string;
  note?: string;
  /** Legacy fields, still accepted for backward compatibility. */
  label?: string;
  type?: string;
}
export interface WireframeRow {
  blocks: WireframeBlock[];
}
export interface WireframeDescription {
  title: string;
  mainVisual?: string;
  rows: WireframeRow[];
  connections?: Array<{ from: string; to: string; kind: string }>;
}

/** Section ids in the strict-mode analysis JSON. */
export type AnalysisSectionId = "prerequisites" | "main" | "additions";
export type AnalysisAttention = "main" | "core" | "normal" | "accent";

/** Nested item inside a group entity (factGroup, algorithmGroup). */
export interface AnalysisGroupItem {
  title?: string | null;
  content?: string | string[] | null;
  formula?: string | string[] | null;
  cardAddendum?: string | string[] | null;
  icon?: string | null;
  attention?: "normal" | "accent";
}

/** Structured analysis JSON produced by the strict-mode analysis prompt. */
export interface AnalysisEntity {
  sectionId: AnalysisSectionId;
  entityType: string;
  attention?: AnalysisAttention;
  title: string | null;
  content: string | string[] | null;
  formula?: string | string[] | null;
  cardAddendum?: string | string[] | null;
  items?: AnalysisGroupItem[] | null;
  icon?: string | null;
  visual?: {
    type: string | null;
    description: string;
    /** Workspace: data URL of a generated card illustration (not sent to analysis prompts). */
    generatedImage?: string | null;
  } | null;
  /** Legacy field, kept for backward compatibility. */
  example?: string | string[] | null;
  /** Legacy field, kept for backward compatibility. */
  priority?: "high" | "medium" | "low";
}
export interface AnalysisJson {
  sourceMode: "text" | "topic";
  topic: string;
  subject: string | null;
  grade: string | null;
  summary: string;
  entities: AnalysisEntity[];
  warnings: string[];
  /** UI-only hint: which design profile to preselect on step 2. Not propagated further. */
  recommendedDesignProfile?: string | null;
}

/** ===== "Схема связей" (connection schema) analysis JSON ===== */
export interface ConnectionEntity {
  id: string;
  title: string | null;
  text: string | null;
  /** Legacy field (older prompt versions); kept for backward compatibility. */
  addendum?: string | string[] | null;
  depiction: string | null;
  /** Workspace: data URL of a generated illustration for this entity. */
  generatedImage?: string | null;
}
export interface ConnectionRelation {
  from: string;
  to: string;
  direction: "one_way" | "two_way" | "none";
  label: string | null;
}
export interface ConnectionRegionRelation {
  fromRegion: string;
  toRegion: string;
  direction: "one_way" | "two_way" | "none";
  label: string | null;
}
export type ConnectionCoreType = "single_entity" | "linear_route" | "cyclic_route" | "hub";
/** Core of a region: which entities form its main structure and in which order. */
export interface ConnectionCore {
  type: ConnectionCoreType;
  entityIdSequences: string[][];
}
export interface ConnectionRegion {
  id: string;
  /** Legacy field (older prompt versions); kept for backward compatibility. */
  number?: string | null;
  title: string | null;
  organizationType: string;
  core: ConnectionCore | null;
  /**
   * Legacy field (older prompt versions). Derived from `core` when absent, so
   * downstream consumers (Mermaid, design brief) keep a single entry point.
   */
  anchorEntityId?: string | null;
  entities: ConnectionEntity[];
  relations: ConnectionRelation[];
}

export interface ConnectionSchemaJson {
  kind: "connection-schema";
  sourceMode: "text" | "topic";
  topic: string;
  subject: string | null;
  grade: string | null;
  focusQuestion: string;
  displaySubtitle: string | null;
  regions: ConnectionRegion[];
  regionRelations: ConnectionRegionRelation[];
  warnings: string[];
}

/** ===== "Концепт-арт" (concept art) analysis JSON ===== */
export type ConceptArtAbstractionLevel = "low" | "medium" | "high" | "very_high";

export interface ConceptArtInterpretation {
  interpretationType: string;
  ideaAndRationale: string;
  imageDescription: string;
}

export interface ConceptArtJson {
  kind: "concept-art";
  sourceMode: "text" | "topic";
  topic: string;
  subject: string | null;
  grade: string | null;
  centralConcept: string;
  conceptDefinition: string | null;
  abstractionLevel: ConceptArtAbstractionLevel | null;
  visualInterpretations: ConceptArtInterpretation[];
  warnings: string[];
}

/** ===== "Стат-деко" (stat-deco) analysis JSON ===== */
export type StatDecoChartType =
  | "bar"
  | "line"
  | "area"
  | "pie"
  | "scatter"
  | "histogram"
  | "radar"
  | "funnel"
  | "treemap"
  | "waterfall"
  | "boxplot";

export type StatDecoColorMode = "same" | "similar" | "different";

/** Column-oriented data table: first element of each column is its header. */
export type StatDecoColumn = Array<string | number | null>;

export interface StatDecoDataStatus {
  canRender: boolean;
  reason: string;
}

/** Column-index mapping; used only where column roles are not positional. */
export interface StatDecoMapping {
  label?: number;
  category?: number;
  value?: number;
  type?: number;
  parent?: number;
  x?: number;
  y?: number;
  size?: number;
}

/** Categorical rendering hints chosen by the model (never pixels/percentages). */
export interface StatDecoRendering {
  orientation?: "vertical" | "horizontal";
  seriesLayout?: "grouped" | "stacked" | "stacked100" | "overlay";
  barWidth?: "narrow" | "medium" | "wide";
  categoryGap?: "narrow" | "medium" | "wide";
  seriesGap?: "narrow" | "medium" | "wide";
  volume?: boolean;
  headroom?: "small" | "medium" | "large";
  showValues?: boolean;
  colorMode?: StatDecoColorMode;
  chartSize?: "small" | "medium" | "large";
  sliceGap?: "none" | "narrow" | "medium" | "wide";
  innerHole?: "none" | "small" | "medium" | "large";
  lineWidth?: "thin" | "medium" | "thick";
  lineShape?: "straight" | "smooth";
  pointSize?: "none" | "small" | "medium" | "large";
}

export interface StatDecoElementInstruction {
  target: string;
  instruction: string;
}

export interface StatDecoIllustrationPlan {
  visualIntent: string;
  overallTreatment: string;
  elementInstructions: StatDecoElementInstruction[];
}

export interface StatDecoJson {
  kind: "stat-deco";
  sourceMode: "text";
  topic: string;
  subject: string | null;
  grade: string | null;
  chartType: StatDecoChartType;
  title: string;
  summary: string;
  dataStatus: StatDecoDataStatus;
  data: { columns: StatDecoColumn[] };
  mapping: StatDecoMapping;
  rendering: StatDecoRendering;
  illustrationPlan: StatDecoIllustrationPlan;
  warnings: string[];
}

export interface ContentSummary {
  /** Human-readable text shown to the user (rendered from analysis JSON in strict mode). */
  content: string;
  /** Style id recommended by the model (or chosen by fallback). */
  recommendedStyle: string;
  /** Design profile name recommended by the model (UI hint only). */
  recommendedDesignProfile?: string | null;
  /** Structured analysis JSON (strict mode, bento styles). */
  analysis?: AnalysisJson | null;
  /** Structured analysis JSON for the "схема связей" style. */
  connection?: ConnectionSchemaJson | null;
  /** Structured analysis JSON for the "концепт-арт" style. */
  conceptArt?: ConceptArtJson | null;
  /** Structured analysis JSON for the "стат-деко" style. */
  statDeco?: StatDecoJson | null;
}




export interface DesignBriefResult {
  PromptForImageGeneration: string;
  /** Structured wireframe (legacy / alternative output). */
  WireframeDescription?: WireframeDescription;
  /** Plain-text box-drawing sketch (current preferred output). */
  WireframeSketch?: string;
}

export type PaneMode = "content" | "auto-layout" | "wireframe" | "ai-layout" | "mermaid" | "image";

export interface Versioned<T> {
  id: string;
  createdAt: number;
  value: T;
}
