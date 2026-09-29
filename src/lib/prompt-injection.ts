import type { DesignProfile, DesignProfileColors, InfographicStyle } from "./types";
import typographyOptions from "@/data/typography-options.json";

interface TypoOption { id: string; label: string; prompt: string }
const TYPO_STYLES = typographyOptions.typography_styles as TypoOption[];
const TYPO_SPECIFICITY = typographyOptions.font_specificity_modes as TypoOption[];

export function styleGeneralRulesBlock(style: InfographicStyle | null | undefined): string {
  const text = (style?.generalRules ?? "").trim();
  if (!text) return "";
  return `Размещая информацию на постере, придерживайся следующих общих правил:\n${text}`;
}

export function styleSpecificRulesBlock(style: InfographicStyle | null | undefined): string {
  const text = (style?.specificRules ?? "").trim();
  if (!text) return "";
  return `При оформлении отдельных элементов руководствуйся следующими принципами:\n${text}`;
}

const COLOR_ROLE_LABELS: Array<{ key: keyof DesignProfileColors; label: string }> = [
  { key: "backgroundColor", label: "Задний фон (backgroundColor)" },
  { key: "surfaceColor", label: "Светлый фон плашки внутри карточки (surfaceColor)" },
  { key: "primaryColor", label: "Акцентный цвет палитры (primaryColor)" },
  { key: "detailSoftColor", label: "Более светлая пастель (detailSoftColor)" },
  { key: "detailDeepColor", label: "Более тёмная пастель (detailDeepColor)" },
  { key: "contrastSoftColor", label: "Контрастная пастель (contrastSoftColor)" },
  { key: "inkColor", label: "Цвет тёмного текста и технических линий (inkColor)" },
  { key: "headerColor", label: "Цвет шапки и фона заголовков (headerColor)" },
  { key: "lightTextColor", label: "Цвет светлого текста (lightTextColor)" },
  { key: "spotAccentColor", label: "Цвет акцентных деталей (spotAccentColor)" },
  { key: "mutedheaderTextColor", label: "Вторичный светлый текст в шапке (mutedheaderTextColor)" },
];

const PASTEL_FILL_LABEL = "Пастельная заливка (detailSoftColor)";

function normalizeHex(hex: string): string {
  return hex.trim().toUpperCase();
}

/** True when both pastel roles share the same hex — palette lists one unified pastel fill. */
export function pastelColorsUnified(colors: DesignProfileColors | undefined): boolean {
  const soft = colors?.detailSoftColor;
  const deep = colors?.detailDeepColor;
  if (!soft || !deep) return false;
  return normalizeHex(soft) === normalizeHex(deep);
}

function paletteRoleEntries(
  colors: DesignProfileColors | undefined,
): Array<{ key: keyof DesignProfileColors; label: string }> {
  const unifiedPastel = pastelColorsUnified(colors);
  return COLOR_ROLE_LABELS.flatMap(({ key, label }) => {
    if (!colors?.[key]) return [];
    if (unifiedPastel && key === "detailDeepColor") return [];
    if (unifiedPastel && key === "detailSoftColor") {
      return [{ key, label: PASTEL_FILL_LABEL }];
    }
    return [{ key, label }];
  });
}

// Original free-mode prose; preserved for the free style design brief.
export function designProfileProse(profile: DesignProfile | null | undefined): string {
  if (!profile) return "(дизайн-профиль не задан)";
  const c = profile.colors;
  const typoStyle = TYPO_STYLES.find((t) => t.id === profile.typography.styleId);
  const typoSpec = TYPO_SPECIFICITY.find((t) => t.id === profile.typography.specificityId);

  const lines: string[] = [];
  lines.push(
    "Используй только цвета из палитры дизайн-профиля, опираясь на роли каждого цвета.",
  );
  lines.push(`Профиль: ${profile.profileName}.`);
  lines.push("Палитра по ролям:");
  for (const { key, label } of paletteRoleEntries(c)) {
    const hex = c?.[key];
    if (hex) lines.push(`- ${label}: ${hex}.`);
  }

  if (typoStyle) {
    lines.push("");
    lines.push(`Типографика — ${typoStyle.label}. ${typoStyle.prompt}`);
  }
  if (typoSpec) {
    lines.push(`Режим выбора шрифта — ${typoSpec.label}. ${typoSpec.prompt}`);
  }

  if (profile.notesForAI?.trim()) {
    lines.push("");
    lines.push("Следуй этим правилам при использовании цветов на инфографике:");
    lines.push(profile.notesForAI.trim());
  }

  return lines.join("\n");
}

// English labels used ONLY inside prompt text (UI keeps Russian labels above).
const COLOR_ROLE_LABELS_EN: Record<keyof DesignProfileColors, string> = {
  backgroundColor: "Page background (backgroundColor)",
  surfaceColor: "Inner card surface / inset background (surfaceColor)",
  primaryColor: "Main palette accent (primaryColor)",
  detailSoftColor: "Lighter pastel (detailSoftColor)",
  detailDeepColor: "Deeper pastel (detailDeepColor)",
  contrastSoftColor: "Contrast pastel (contrastSoftColor)",
  inkColor: "Dark text and technical lines (inkColor)",
  headerColor: "Header background and title plates (headerColor)",
  lightTextColor: "Light text (lightTextColor)",
  spotAccentColor: "Spot accent details (spotAccentColor)",
  mutedheaderTextColor: "Secondary light text in header (mutedheaderTextColor)",
};

const PASTEL_FILL_LABEL_EN = "Unified pastel fill (detailSoftColor)";

// English-only "use for" descriptions for the LAYER 1 palette block (hex codes injected at assembly time).
const COLOR_USE_FOR: Record<keyof DesignProfileColors, string> = {
  backgroundColor: "use for the overall page / canvas background",
  surfaceColor: "use for small inner surfaces and insets inside cards (formulas, examples, notes, mini explanations)",
  primaryColor: "use for the main semantic accent of the infographic and one key word in the main title",
  detailSoftColor: "use for soft background fills of secondary content zones (lighter variant)",
  detailDeepColor: "use for soft background fills of secondary content zones (deeper variant)",
  contrastSoftColor: "use for a separate emphasized content zone (conclusion, consequence, quote, mnemonic, warning, key takeaway)",
  inkColor: "use for main educational text, labels, formulas, captions, icons, lines, arrows, outlines and other technical graphic elements",
  headerColor: "use for the dark header background and for card title plates",
  lightTextColor: "use for the main title text on the dark header and for text on dark plates",
  spotAccentColor: "use only for rare micro-accents (one word, small icon, marker, warning sign); max ~2 uses per infographic",
  mutedheaderTextColor: "use for subtitles, meta labels and secondary text inside the dark header",
};

/** One palette row: role name, hex from the active profile, then usage description. */
function colorPaletteLine(
  key: keyof DesignProfileColors,
  hex: string,
  unifiedPastel: boolean,
): string {
  let roleLabel: string = COLOR_ROLE_LABELS_EN[key] ?? key;
  if (unifiedPastel && key === "detailSoftColor") {
    roleLabel = PASTEL_FILL_LABEL_EN;
  }
  let useFor = COLOR_USE_FOR[key];
  if (unifiedPastel && key === "detailSoftColor") {
    useFor =
      "use for soft pastel background fills of secondary content zones (detailSoftColor; single unified pastel — no alternation between cards)";
  }
  return `- ${roleLabel} ${hex} — ${useFor}`;
}

const FONT_FAMILY_PLACEHOLDER = "[FONT_FAMILY_PLACEHOLDER]";

function layer1RulesTemplate(): string {
  // Body uses {{role}} markers; substituted with hex codes from the active palette.
  return `1. PAGE BACKGROUND & GLOBAL SYSTEM

- Use {{backgroundColor}} for the full canvas background.

- All spacing between cards must visually expose {{backgroundColor}}, reinforcing grid structure.

- No other background colors may replace or override {{backgroundColor}} outside cards.

- Use ${FONT_FAMILY_PLACEHOLDER} as the single typographic system.

- Global text color rule:

- Default text color is {{inkColor}} for all educational content.


2. TITLE CARD (HEADER AREA) COLORING RULES

- Card background: {{headerColor}}. Use it for the background of the title card without exceptions.

- Title text:

- Color: {{lightTextColor}}

- Style: VERY BOLD, UPPERCASE, max 2 lines

- Meta pill (subject + grade):

- Background: {{headerColor}}, but mixed slightly with white.

- Text color: {{mutedheaderTextColor}}

- Style: UPPERCASE, increased letter spacing

- Separator: small dot "•"

- Position: top-right corner of title card

- Summary text:

- Color: {{mutedheaderTextColor}}

- Style: sentence case, regular weight

- {{spotAccentColor}} may be used for a single word or phrase; if used, it will be specified in the title card description

- Color accents in title card text must not affect full sentences or structural elements

- title card must not be white or nude.


CARD COLORING RULES

- Normal content and card inset text color: {{inkColor}} if contrast allows; usage of {{lightTextColor}} will be specified in the card description, but should be additionally judged anyway.

- Use background color specified in the card description.


3. Card caption plate styling rules:

- caption plate background: {{headerColor}}, use this color only!

- caption plate text: {{lightTextColor}}, use this color only! No other color can appear in the caption plate text!

- Typography: UPPERCASE, BOLD

- Must be visually consistent across all cards

- No decorative variation between same-level cards

- Exception (use only when absolutely necessary):

- Core card may use plain large heading without caption plate if readability is improved


4. TEXT CONTENT RULES (INSIDE CARDS)

- Main content:

- Always {{inkColor}}

- Emphasis rules:

- Bold allowed only for semantic highlighting

- {{spotAccentColor}} allowed only for single-word micro emphasis and will be specified in the card description

- Typography:

- Body: sentence case, regular weight


5. CONTENT INSETS

- Content insets are internal zones inside a card

- Background: {{surfaceColor}}

- Text inside inset: {{inkColor}}

- Typography: sentence case, regular weight

- Layout inside the card will be specified in the card description

- Must remain typographically consistent with main system font


6. ICONS & DIAGRAM ELEMENTS

- Icon color: {{inkColor}}

- Icons must be outline-style, minimal, and consistent stroke weight

- Icons must never use pastel colors

- Position rules:

- Icons may appear above title, next to title, or aligned with section headers

- Icons must not displace main content hierarchy

- Visual / diagrams:

- Must inherit card background (core/normal/accent rules) if not specified that it is placed inside a content inset

- Lines, arrows, labels: always {{inkColor}}

- No decorative or non-semantic visual elements allowed


9. MINI-ITEM BLOCKS (LIST / ALGORITHM COMPRESSION)

- Used only for:

- factList

- actionList

- algorithmStep sequences when compact representation is needed

- Structure:

- pictogram/icon + short text label

- Rules:

- Background: same as parent card (no new color layer)

- Text color: {{inkColor}}

- Icon color: {{inkColor}}

- Must NOT use {{surfaceColor}}, {{detailSoftColor}}, or {{contrastSoftColor}} as separate blocks

- Must NOT be treated as inset or separate card

- Placement:

- Can be arranged in rows or grids inside a card

- Must preserve reading order


10. GLOBAL CONSTRAINTS

- Never introduce colors outside specified palette.

- Never output technical variables or HEX codes in final visible design

- Never break consistency of typographic system

- Never allow decorative elements not specified in the card description

- Never let non-core elements visually compete with core card`;
}

/** English font-character names for the prompt (UI labels stay Russian). */
const TYPO_STYLE_LABELS_EN: Record<string, string> = {
  geometric_grotesque: "Geometric grotesque sans-serif",
  neutral_ui_sans: "Neutral UI sans-serif",
  soft_humanist_sans: "Soft humanist sans-serif",
  strict_neo_grotesque: "Strict neo-grotesque sans-serif",
  editorial_serif: "Editorial serif",
  soft_modern_serif: "Soft modern serif",
  display_headline: "Display headline font with clean sans-serif body",
  tech_monospace: "Tech monospaced sans-serif",
  readability_first: "Maximum-readability clean sans-serif",
};

/** Shared header + palette + font block, used by every style-specific builder. */
function paletteAndFontBlock(profile: DesignProfile): string {
  const c = profile.colors;
  const typoStyle = TYPO_STYLES.find((t) => t.id === profile.typography.styleId);
  const lines: string[] = [];
  lines.push("LAYER 1 -- COLOR AND TYPOGRAPHY GENERAL RULES");
  lines.push("");
  lines.push("PALETTE AND FONT:");
  const unifiedPastel = pastelColorsUnified(c);
  for (const { key } of paletteRoleEntries(c)) {
    const hex = c?.[key];
    if (!hex) continue;
    lines.push(colorPaletteLine(key, hex, unifiedPastel));
  }
  if (typoStyle) {
    lines.push("");
    lines.push(typoStyle.prompt);
  }
  return lines.join("\n");
}

function fillRolePlaceholders(body: string, profile: DesignProfile): string {
  const c = profile.colors;
  let out = body;
  for (const { key } of COLOR_ROLE_LABELS) {
    const hex = c?.[key];
    out = out.replaceAll(`{{${key}}}`, hex ?? `(${key})`);
  }
  const typoStyle = TYPO_STYLES.find((t) => t.id === profile.typography.styleId);
  const fontLabel = typoStyle
    ? TYPO_STYLE_LABELS_EN[typoStyle.id] ?? FONT_FAMILY_PLACEHOLDER
    : FONT_FAMILY_PLACEHOLDER;
  return out.replaceAll(FONT_FAMILY_PLACEHOLDER, fontLabel);
}

/** Bento-specific LAYER 1 (the historical rule set; used by the home page too). */
function bentoColorsAndRules(profile: DesignProfile): string {
  return [
    paletteAndFontBlock(profile),
    "",
    fillRolePlaceholders(layer1RulesTemplate(), profile),
  ].join("\n");
}

/** Minimal, style-neutral LAYER 1 for styles that do not yet have their own rule set. */
function genericColorsAndRules(profile: DesignProfile): string {
  const generic = `GLOBAL COLOR CONSTRAINTS

- Use {{backgroundColor}} for the overall canvas background.

- Use ${FONT_FAMILY_PLACEHOLDER} as the single typographic system.

- Default text color is {{inkColor}}; light text on dark areas is {{lightTextColor}}.

- Use {{primaryColor}} for the main semantic accent, {{spotAccentColor}} only for rare micro-accents.

- Never introduce colors outside the palette above.

- Never output HEX codes or technical role names in the final visible design.`;
  return [paletteAndFontBlock(profile), "", fillRolePlaceholders(generic, profile)].join("\n");
}

/** LAYER 1 for the "схема связей" style: same palette/font block, own drawing rules. */
function connectionColorsAndRules(profile: DesignProfile): string {
  const rules = `GENERAL DRAWING RULES FOR RELATIONSHIP INFOGRAPHICS

Use the full canvas efficiently. Preserve comfortable outer margins and clear spacing, but do not leave large accidental empty areas that have no compositional or semantic purpose.

Keep every region visually coherent and spatially distinct. Do not interleave entities from different regions. Do not place parts of one region inside another region or allow one region to visually absorb another unless this is explicitly required by the content structure.

Balance the regions according to their actual complexity and amount of content. Regions do not have to be equal in size, but their relative sizes must appear intentional.

Maintain a consistent visual language across the entire infographic: coordinated entity shapes, border weights, corner treatment, typography, illustration style, connection style, and level of detail.

Use only colors from the provided palette.

Use ${FONT_FAMILY_PLACEHOLDER} as the single typographic system.

Use {{backgroundColor}} for the main canvas.

Use {{inkColor}} as the default color for educational text, entity outlines, connections, arrowheads, markers, and relation labels.

Use {{primaryColor}} for the main structural emphasis, such as the core entities of a region, a central core entity, a root entity, or the main route. Do not apply it to every entity.

{{PASTEL_RULE}}

Use {{contrastSoftColor}} only for a meaningful contrast, such as a result, condition, exception, alternative route, or opposing element.

Use {{surfaceColor}} for small secondary areas, relation-label backgrounds, or compact content placed beside a marker.

Use {{headerColor}} and {{lightTextColor}} primarily for the title area or a rare dark structural accent.

Ensure sufficient contrast between text, connections, and backgrounds. Do not place light text on a light fill or dark text on a dark fill.

Connections may be realized as lines, ribbons, routes, arrows, or connectors. Do not assume that every relation is a thin line by default; follow the visualization decisions of the design brief.

Connections must remain clearly readable. They must not pass through entity cards, visible text, depictions, or relation labels.

Minimize crossings by adjusting entity positions and connection paths. If a crossing cannot be avoided, make the crossing visually unambiguous and use one consistent crossing convention throughout the infographic.

Do not allow unrelated connection paths to overlap for long distances. Shared segments are allowed only when they intentionally represent one common route.

Arrowheads must be clearly visible, proportional to the width of the connection they belong to, and separated from text and card borders. Direction must be immediately understandable.

RIBBON-BASED MAIN ROUTES

When the design brief specifies a main route as a ribbon, band, or highway, render it as one continuous solid filled shape with a clearly visible width, not as a stroked line with increased thickness. Preserve a consistent width along straight sections and broad rounded turns. Integrate directional arrowheads into the ribbon silhouette rather than attaching unrelated thin-line arrowheads.

CONNECTION CONSISTENCY

All directed connections within one infographic must belong to the same visual family. Main structural, local, and inter-region connections may differ in width, scale, contrast, or color intensity, but their geometry and arrowhead character must remain visually consistent. If the design uses a ribbon system, weaker directed connections may be narrow versions of it. Non-semantic attachments of cards to route nodes may remain simple thin stems without arrowheads.

Use one consistent arrowhead geometry throughout the infographic. Arrowheads may differ in scale when connection widths differ, but they must not change into unrelated shapes between regions or relation classes. For a ribbon main route the arrowhead must be built into its silhouette; a narrower connection uses a geometrically related arrowhead.

A relation with direction none follows the visual style of its own relation class — main structural, local, or inter-region — but has no arrowhead.

Place every relation label close to the connection or branch it describes. Do not place labels at intersections or in positions where they may be associated with another relation. Use a small {{surfaceColor}} background when needed for readability.

Internal relations and relations between regions must follow the same overall graphic language. Relations between regions may use one consistent additional distinction, such as greater width, stronger contrast, or a dedicated palette color.

The image generation model may adjust exact spacing, path curvature, and minor proportions to achieve a balanced composition, but it must preserve all regions, entities, directions, labels, visible texts, and semantic relationships specified in the prompt.

Hex codes, palette-role names, field names, IDs, organization-type names, direction values, and other technical instructions are never visible text.

Treat a hex code placed near visible-text instructions only as a color specification. Never render it as part of a label, title, card, or meta pill.

LATEX AND MATHEMATICAL NOTATION

Treat any mathematical expression enclosed in $...$ or $$...$$ as LaTeX source code that describes a mathematical formula.

Render the formula as properly typeset mathematical notation. Do not reproduce the dollar-sign delimiters as visible characters.

Do not display LaTeX command syntax such as backslashes, command names, or structural braces. For example, render $\\frac{a}{b}$ as a fraction, not as the visible text \\frac{a}{b}.

If backslashes are doubled because the prompt is encoded as JSON, interpret them as escaped LaTeX commands and render the intended formula.

Preserve the mathematical content exactly. Do not simplify, solve, translate, expand, or rewrite the formula. Preserve all variables, numbers, operators, inequalities, superscripts, subscripts, fractions, roots, brackets, and other mathematical symbols.

Render formulas enclosed in $...$ as inline mathematics when they occur inside a sentence or short text line.

Render formulas enclosed in $$...$$ as display mathematics on a separate line or in a visually distinct formula area.

If a field contains only a formula, treat the formula as the main visible content of that element. Center or align it according to the element's layout rules, while preserving the specified visual hierarchy.

Dollar signs, escaped backslashes, and LaTeX structural braces are technical markup and must never appear on the final image unless they are explicitly part of the mathematical content.`;
  const pastelRule = pastelColorsUnified(profile.colors)
    ? "Use {{detailSoftColor}} as the single pastel fill for ordinary entities, branches, levels, or parallel groups. Assign it according to structure; do not invent a second pastel and do not alternate colors mechanically."
    : "Use {{detailSoftColor}} and {{detailDeepColor}} for ordinary entities, branches, levels, or parallel groups. Assign them according to structure; do not alternate colors mechanically.";
  const body = rules.replaceAll("{{PASTEL_RULE}}", pastelRule);
  return [paletteAndFontBlock(profile), "", fillRolePlaceholders(body, profile)].join("\n");
}

/**
 * Concept art: only the palette and typography block, no additional drawing rules.
 */
function conceptArtColorsAndRules(profile: DesignProfile): string {
  return paletteAndFontBlock(profile);
}

/**
 * Lightweight palette block for the image model of the "стат-деко" style:
 * no role-based drawing rules, just drawing colors vs technical colors + font.
 */
export function simplePaletteBlock(profile: DesignProfile | null | undefined): string {
  if (!profile) return "";
  const c = profile.colors;
  const typoStyle = TYPO_STYLES.find((t) => t.id === profile.typography.styleId);
  const lines: string[] = [];
  lines.push("COLOR PALETTE BASICS");
  lines.push("");
  lines.push("Drawing colors — use these for the chart, its data elements and the illustration:");
  if (c?.spotAccentColor) {
    lines.push(
      `- ${c.spotAccentColor} — MAIN bright color. Use it for whatever must attract attention first: the key data element, the main figure, the central emphasis.`,
    );
  }
  if (c?.primaryColor) {
    lines.push(
      `- ${c.primaryColor} — SECOND bright color. Use it for the next most important element or for the second level of emphasis.`,
    );
  }
  const extras = [c?.detailSoftColor, c?.detailDeepColor, c?.contrastSoftColor, c?.headerColor]
    .filter((x): x is string => !!x)
    .filter((hex, i, arr) => arr.findIndex((y) => normalizeHex(y) === normalizeHex(hex)) === i);
  if (extras.length) {
    lines.push(
      `- Supporting colors, use freely for the remaining data elements, fills and illustrative shapes: ${extras.join(", ")}.`,
    );
  }
  lines.push("");
  lines.push("Technical colors:");
  if (c?.backgroundColor) lines.push(`- ${c.backgroundColor} — page background.`);
  if (c?.surfaceColor) lines.push(`- ${c.surfaceColor} — light inner surfaces and plates behind text or formulas.`);
  if (c?.inkColor) lines.push(`- ${c.inkColor} — dark text, labels, numbers, axes and thin technical lines.`);
  if (c?.lightTextColor) lines.push(`- ${c.lightTextColor} — text placed on dark or saturated areas.`);
  if (c?.mutedheaderTextColor) lines.push(`- ${c.mutedheaderTextColor} — secondary and muted text.`);
  lines.push("");
  lines.push("Stay within these colors, except where a natural or conventional color of a depicted object is required for recognizability. Never print HEX codes or role names on the image.");
  if (typoStyle) {
    lines.push("");
    lines.push(typoStyle.prompt);
  }
  return lines.join("\n");
}

/** Per-style LAYER 1 builders. Add a new entry when a style gets its own colour rules. */
const LAYER1_BUILDERS: Record<string, (p: DesignProfile) => string> = {
  "modern-bento": bentoColorsAndRules,
  "connection-schema": connectionColorsAndRules,
  "concept-art": conceptArtColorsAndRules,
};

export const BENTO_STYLE_ID = "modern-bento";
export const CONNECTION_STYLE_ID = "connection-schema";
export const CONCEPT_ART_STYLE_ID = "concept-art";


/**
 * LAYER 1 text. `styleId` defaults to bento so the home page (which is bento-only)
 * keeps its exact historical output; the workspace passes the selected style id.
 */
export function designProfileColorsAndRules(
  profile: DesignProfile | null | undefined,
  styleId: string = BENTO_STYLE_ID,
): string {
  if (!profile) return "(design profile is not set)";
  const build = LAYER1_BUILDERS[styleId] ?? genericColorsAndRules;
  return build(profile);
}

/** Resolve design profile by name, falling back to the first profile in the list. */
export function resolveDesignProfile(
  profiles: DesignProfile[],
  profileName: string | null | undefined,
): DesignProfile | null {
  if (profileName) {
    const found = profiles.find((p) => p.profileName === profileName);
    if (found) return found;
  }
  return profiles[0] ?? null;
}

export const LAYER1_PROMPT_MARKER = "LAYER 1 -- COLOR AND TYPOGRAPHY GENERAL RULES";

/** Final image prompt for the main (simple) page: header + LAYER 1 + brief + execution rules. */
export function buildSimpleHomeImagePrompt(opts: {
  profile: DesignProfile | null | undefined;
  promptForImageGeneration: string;
  headerText: string;
  executionRules: string;
}): string {
  const layer1 = opts.profile ? designProfileColorsAndRules(opts.profile).trim() : "";
  return [opts.headerText.trim(), layer1, opts.promptForImageGeneration.trim(), opts.executionRules.trim()]
    .filter((s) => s.length > 0)
    .join("\n\n");
}

export function buildDesignBriefPrompt(opts: {
  template: string;
  contentSummary: string;
  style: InfographicStyle | null | undefined;
  profile: DesignProfile | null | undefined;
  userWishes: string;
  generalRules?: string;
  /** Pass to make LAYER 1 style-aware (workspace). Omit to keep bento rules (home page). */
  styleId?: string;
}): string {
  const { template, contentSummary, style, profile, userWishes, generalRules, styleId } = opts;
  return template
    .replaceAll("{{CONTENT_SUMMARY}}", contentSummary)
    .replaceAll("{{STYLE_NAME}}", style?.name ?? "")
    .replaceAll("{{STYLE_DESCRIPTION}}", style?.shortDescription ?? "")
    .replaceAll("{{STYLE_GENERAL_RULES_BLOCK}}", styleGeneralRulesBlock(style))
    .replaceAll("{{STYLE_SPECIFIC_RULES_BLOCK}}", styleSpecificRulesBlock(style))
    .replaceAll("{{DESIGN_PROFILE_PROSE}}", designProfileProse(profile))
    .replaceAll(
      "{{DESIGN_PROFILE_COLORS_AND_RULES}}",
      designProfileColorsAndRules(profile, styleId ?? BENTO_STYLE_ID),
    )
    .replaceAll("{{USER_WISHES}}", userWishes.trim() || "(нет)")
    .replaceAll("{{GENERAL_RULES_BLOCK}}", generalRules?.trim() ?? "");
}
