import { jsonrepair } from "jsonrepair";

const VALID_JSON_ESCAPES = new Set(["\"", "\\", "/", "b", "f", "n", "r", "t", "u"]);

function normalizeWrapper(raw: string): string {
  return raw
    .replace(/^\uFEFF/, "")
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .trim();
}

function looksLikeJsonString(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.startsWith("{") || trimmed.startsWith("[");
}

function parseCandidate<T>(candidate: string): T {
  const parsed = JSON.parse(candidate) as unknown;
  if (typeof parsed === "string" && looksLikeJsonString(parsed)) {
    return extractJson<T>(parsed);
  }
  return parsed as T;
}

function isLikelyJsonStart(char: string): boolean {
  return char === "{" || char === "[";
}

function findJsonCandidate(text: string): string | null {
  let start = -1;
  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (start === -1) {
      if (isLikelyJsonStart(ch)) {
        start = i;
        stack.push(ch);
      }
      continue;
    }

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }

    if (ch === "{" || ch === "[") {
      stack.push(ch);
      continue;
    }

    if (ch === "}" || ch === "]") {
      const last = stack.at(-1);
      if ((ch === "}" && last === "{") || (ch === "]" && last === "[")) {
        stack.pop();
        if (!stack.length) {
          return text.slice(start, i + 1);
        }
      }
    }
  }

  if (start !== -1) return text.slice(start);
  return null;
}

function isTruncatedJson(text: string): boolean {
  const s = text.trim();
  if (!s) return false;

  if (/\.\.\.$|\u2026$|\[truncated\]/i.test(s)) return true;

  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (let i = 0; i < s.length; i += 1) {
    const ch = s[i];
    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === "\\") {
        escaped = true;
        continue;
      }
      if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{" || ch === "[") stack.push(ch);
    if (ch === "}" || ch === "]") stack.pop();
  }

  const last = s.at(-1);
  const hasCompleteOuterBoundary =
    (s.startsWith("{") && last === "}") || (s.startsWith("[") && last === "]");

  // A misplaced quote can confuse the lightweight scanner even when the
  // response has a complete outer boundary. Let the repair passes handle it.
  if (hasCompleteOuterBoundary) return false;

  return inString || escaped || stack.length > 0 || /[,:\\]$/.test(s);
}

function removeTrailingCommas(text: string): string {
  return text.replace(/,(\s*[}\]])/g, "$1");
}

/** Splits text into string / non-string segments so structural fixes skip string contents. */
function mapOutsideStrings(text: string, fix: (chunk: string) => string): string {
  let out = "";
  let buffer = "";
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    if (ch === '"') {
      out += fix(buffer);
      buffer = "";
      let str = '"';
      i += 1;
      let escaped = false;
      while (i < text.length) {
        const c = text[i];
        str += c;
        i += 1;
        if (escaped) {
          escaped = false;
          continue;
        }
        if (c === "\\") {
          escaped = true;
          continue;
        }
        if (c === '"') break;
      }
      out += str;
      continue;
    }
    buffer += ch;
    i += 1;
  }
  return out + fix(buffer);
}

/** Strips // and /* *\/ comments that models sometimes add outside strings. */
function removeComments(text: string): string {
  return mapOutsideStrings(text, (chunk) =>
    chunk.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n\r]*/g, ""),
  );
}

/** Quotes bare object keys: { key: 1 } -> { "key": 1 } */
function quoteBareKeys(text: string): string {
  return mapOutsideStrings(text, (chunk) =>
    chunk.replace(/([{,]\s*)([A-Za-z_$][\w$-]*)(\s*:)/g, '$1"$2"$3'),
  );
}

/** Converts single-quoted keys/values to double-quoted ones. */
function normalizeSingleQuotes(text: string): string {
  return text.replace(/'((?:[^'\\]|\\.)*)'(\s*[:,}\]\n\r])/g, (_m, inner: string, tail: string) => {
    const escaped = inner.replace(/\\'/g, "'").replace(/"/g, '\\"');
    return `"${escaped}"${tail}`;
  });
}

function structuralRepair(text: string): string {
  return removeTrailingCommas(quoteBareKeys(removeComments(normalizeSingleQuotes(text))));
}


function repairJsonText(text: string): string {
  let out = "";
  let inString = false;

  const nextSignificantChar = (from: number): string => {
    for (let i = from; i < text.length; i += 1) {
      const ch = text[i];
      if (!/\s/.test(ch)) return ch;
    }
    return "";
  };

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];

    if (!inString) {
      if (ch === '"') {
        inString = true;
        out += ch;
        continue;
      }
      if ((ch === "\n" || ch === "\r" || ch === "\t") && !out.trim()) continue;
      if (ch < " " && ch !== "\n" && ch !== "\r" && ch !== "\t") continue;
      out += ch;
      continue;
    }

    if (ch === "\\") {
      const next = text[i + 1];
      if (!next) {
        out += "\\\\";
        continue;
      }
      if (VALID_JSON_ESCAPES.has(next)) {
        out += `\\${next}`;
        i += 1;
        continue;
      }
      out += `\\\\${next}`;
      i += 1;
      continue;
    }

    if (ch === '"') {
      const next = nextSignificantChar(i + 1);
      if (next && ![",", ":", "}", "]"].includes(next)) {
        out += "\\\"";
        continue;
      }
      inString = false;
      out += ch;
      continue;
    }

    if (ch === "\n") {
      out += "\\n";
      continue;
    }
    if (ch === "\r") {
      out += "\\n";
      continue;
    }
    if (ch === "\t") {
      out += "\\t";
      continue;
    }

    out += ch;
  }

  return out;
}

// Strict JSON parse with cleanup for LLM outputs.
export function extractJson<T = unknown>(raw: string): T {
  if (!raw) throw new Error("Empty model response");

  const normalized = normalizeWrapper(raw);
  try {
    return parseCandidate<T>(normalized);
  } catch {
    // Continue with extraction/repair attempts below.
  }

  const candidate = findJsonCandidate(normalized) ?? normalized;

  const repairedByLibrary: string[] = [];
  for (const source of [candidate, normalized]) {
    try {
      repairedByLibrary.push(jsonrepair(source));
    } catch {
      // Keep trying the targeted local repairs below.
    }
  }

  const attempts = [
    normalized,
    candidate,
    removeTrailingCommas(candidate),
    structuralRepair(candidate),
    repairJsonText(candidate),
    removeTrailingCommas(repairJsonText(candidate)),
    structuralRepair(repairJsonText(candidate)),
    repairJsonText(structuralRepair(candidate)),
    ...repairedByLibrary,
  ];


  let lastError: unknown;
  for (const attempt of [...new Set(attempts)]) {
    try {
      return parseCandidate<T>(attempt);
    } catch (error) {
      lastError = error;
    }
  }

  if (isTruncatedJson(candidate)) {
    throw new Error("Truncated JSON output from model");
  }

  throw lastError instanceof Error ? lastError : new Error("Failed to parse JSON response");
}
