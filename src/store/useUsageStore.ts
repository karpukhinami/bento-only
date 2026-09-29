import { create } from "zustand";
import type { UsageRecord } from "@/lib/pricing";

export interface RawResponseEntry {
  model: string;
  kind: "text" | "image";
  at: number;
  /** Pretty-printed raw upstream JSON (string), or error text. */
  raw: string;
  /** Short note: "ok", "parse-error", "openrouter", "lovable", etc. */
  note?: string;
}

interface UsageState {
  history: UsageRecord[];
  rawHistory: RawResponseEntry[];
  add: (r: UsageRecord) => void;
  addRaw: (r: RawResponseEntry) => void;
  reset: () => void;
}

export const useUsageStore = create<UsageState>((set) => ({
  history: [],
  rawHistory: [],
  add: (r) => set((s) => ({ history: [...s.history, r].slice(-200) })),
  addRaw: (r) => set((s) => ({ rawHistory: [...s.rawHistory, r].slice(-30) })),
  reset: () => set({ history: [], rawHistory: [] }),
}));
