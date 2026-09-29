// Types for ProgrammaticRenderSpec — the JSON spec returned by the LLM in
// "code-based product" mode. Mirrors the structure described in
// src/data/prompts/strict/code-based-product.txt.

export interface ColorRef {
  role: string;
  hex: string;
}

export type Orientation = "portrait" | "landscape";
export type AspectRatio = "3:4" | "4:3";
export type DensityToken = "airy" | "balanced" | "compact";
export type RadiusToken = "small" | "medium" | "large" | "xl" | "pill";
export type CardRadiusToken = "inherit" | "small" | "medium" | "large" | "xl";
export type SpacingToken = "small" | "medium" | "large";
export type ShadowToken = "none" | "soft";
export type TextScale =
  | "display"
  | "large"
  | "normal"
  | "small"
  | "caption"
  | "formula";
export type CardTextScale = "display" | "large" | "normal" | "small";
export type AddOnTextScale = "small" | "normal" | "large" | "formula";
export type FontWeight = "medium" | "semibold" | "bold" | "extrabold";
export type ContainerVariant = "none" | "inset" | "badge" | "plate";
export type TitleVariant = "none" | "plain" | "plate" | "pill";
export type FillStrategy =
  | "air"
  | "centerContent"
  | "scaleText"
  | "accentShape"
  | "largeFormula";
export type TextSizing = "shared" | "independent" | "hierarchical";

export const COLUMN_RATIOS = [
  "1",
  "1:1",
  "1:2",
  "2:1",
  "1:1:1",
  "2:1:1",
  "1:2:1",
  "1:1:2",
] as const;
export type ColumnRatio = (typeof COLUMN_RATIOS)[number];

export const TITLE_SIZE_RATIOS = [0.9, 1.0, 1.15, 1.35, 1.6] as const;

export interface BorderSpec {
  color: ColorRef;
  width: "thin" | "medium";
  style: "solid";
}

export interface TitleStyle {
  variant: TitleVariant;
  background: ColorRef | null;
  textColor: ColorRef;
  uppercase: boolean;
  weight: FontWeight;
  sizeRatio: number;
}

export interface AddOnContainer {
  variant: "inset" | "badge" | "plate";
  background: ColorRef | null;
  border: BorderSpec | null;
  align: "left" | "center";
  layout: "single" | "horizontalGroup";
  textScale: AddOnTextScale;
}

export interface AddOnPlacement {
  mode: "inline" | "separateContainer";
  container: AddOnContainer | null;
}

export interface CardContent {
  title: string | null;
  body: string | string[] | null;
  formula: string | string[] | null;
  example: string | string[] | null;
}

export interface RenderCard {
  id: string;
  sourceEntityIndexes: number[];
  role: string;
  background: ColorRef;
  textColor: ColorRef;
  border: BorderSpec | null;
  shadow: ShadowToken;
  radius: CardRadiusToken;
  contentDensity: "inherit" | DensityToken;
  textScale: CardTextScale;
  fillStrategy: FillStrategy;
  titleStyle: TitleStyle;
  content: CardContent;
  formulaPlacement: AddOnPlacement | null;
  examplePlacement: AddOnPlacement | null;
}

export interface RowTitleSpec {
  text: string;
  variant: "text" | "pill";
  background: ColorRef | null;
  textColor: ColorRef;
  uppercase: boolean;
  weight: "medium" | "semibold" | "bold";
  align: "center";
}

export interface GroupContainer {
  background: ColorRef | null;
  border: BorderSpec | null;
  shadow: ShadowToken;
  radius: "inherit" | "medium" | "large" | "xl";
  padding: SpacingToken;
}

export interface RenderRow {
  id: string;
  role: string;
  heightWeight: number;
  cardCount: number;
  columnRatio: ColumnRatio;
  textSizing: TextSizing;
  rowTitle: RowTitleSpec | null;
  groupContainer: GroupContainer | null;
  cards: RenderCard[];
}

export interface RenderHeader {
  title: string;
  meta: string | null;
  subtitle: string | null;
  background: ColorRef | null;
  titleColor: ColorRef;
  metaStyle: {
    variant: "none" | "text" | "pill";
    background: ColorRef | null;
    textColor: ColorRef;
  };
  subtitleColor: ColorRef;
  textScale: "display" | "large";
  align: "left" | "center";
}

export interface RenderTheme {
  styleName: string;
  pageBackground: ColorRef;
  typography: {
    character: string | null;
    fontFamily: string | null;
  };
  density: DensityToken;
  radius: RadiusToken;
  margin: SpacingToken;
  gap: SpacingToken;
  defaultCard: {
    background: ColorRef;
    textColor: ColorRef;
    border: BorderSpec | null;
    shadow: ShadowToken;
  };
  defaultTitleStyle: TitleStyle;
  defaultFormulaContainer: {
    variant: ContainerVariant;
    background: ColorRef | null;
    border: BorderSpec | null;
    align: "left" | "center";
    textScale: AddOnTextScale;
  };
  defaultExampleContainer: {
    variant: ContainerVariant;
    background: ColorRef | null;
    border: BorderSpec | null;
    align: "left" | "center";
    textScale: AddOnTextScale;
  };
}

export interface RenderFormat {
  orientation: Orientation;
  aspectRatio: AspectRatio;
}

export interface ProgrammaticRenderSpec {
  format: RenderFormat;
  theme: RenderTheme;
  header: RenderHeader;
  rows: RenderRow[];
}

export interface RenderSpecEnvelope {
  ProgrammaticRenderSpec: ProgrammaticRenderSpec;
}

export interface ValidationResult {
  spec: ProgrammaticRenderSpec;
  warnings: string[];
}
