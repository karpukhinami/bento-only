import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import defaultStylesStrict from "@/data/default-styles.strict.json";
import defaultProfiles from "@/data/default-design-profile.json";

import promptStrictAnalysisWith from "@/data/prompts/strict/analysis-with-content.txt?raw";
import promptStrictAnalysisTopic from "@/data/prompts/strict/analysis-topic-only.txt?raw";
import promptStrictGeneralRules from "@/data/prompts/strict/general-rules.txt?raw";

import type { DesignProfile, InfographicStyle } from "@/lib/types";

/** Bento home uses strict analysis + general rules; brief prompt is loaded separately in the page. */
interface HomePromptSet {
  analysisWithContent: string;
  analysisTopicOnly: string;
  generalRules: string;
}

interface SettingsState {
  prompts: HomePromptSet;
  styles: InfographicStyle[];
  profiles: DesignProfile[];
  upsertProfile: (p: DesignProfile) => void;
  resetProfiles: () => void;
}

const initialPrompts: HomePromptSet = {
  analysisWithContent: promptStrictAnalysisWith,
  analysisTopicOnly: promptStrictAnalysisTopic,
  generalRules: promptStrictGeneralRules,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      prompts: initialPrompts,
      styles: defaultStylesStrict as InfographicStyle[],
      profiles: defaultProfiles as DesignProfile[],
      upsertProfile: (p) =>
        set((s) => ({
          profiles: s.profiles.some((x) => x.profileName === p.profileName)
            ? s.profiles.map((x) => (x.profileName === p.profileName ? p : x))
            : [...s.profiles, p],
        })),
      resetProfiles: () => set({ profiles: defaultProfiles as DesignProfile[] }),
    }),
    {
      name: "infographic-settings-home",
      version: 1,
      migrate: () => undefined as unknown as SettingsState,
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? sessionStorage : (undefined as unknown as Storage),
      ),
    },
  ),
);
