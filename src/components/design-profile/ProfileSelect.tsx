import { useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSettingsStore } from "@/store/useSettingsStore";
import { PalettePickerDialog, profileSelectStyle } from "./PalettePickerDialog";
import defaultProfiles from "@/data/default-design-profile.json";
import type { DesignProfile } from "@/lib/types";

const NEW_PROFILE_VALUE = "__new_profile__";
const DEFAULT_NOTES = (defaultProfiles as DesignProfile[])[0]?.notesForAI ?? "";

interface Props {
  value: string;
  onChange: (name: string) => void;
  className?: string;
  /** When false, hides the "+ Добавить новый" menu item. Default: true. */
  allowCreate?: boolean;
}

export function ProfileSelect({ value, onChange, className, allowCreate = true }: Props) {
  const profiles = useSettingsStore((s) => s.profiles);
  const upsertProfile = useSettingsStore((s) => s.upsertProfile);
  const [open, setOpen] = useState(false);

  const nextName = useMemo(() => {
    let n = 1;
    const existing = new Set(profiles.map((p) => p.profileName));
    while (existing.has(`Персональный профиль ${n}`)) n++;
    return `Персональный профиль ${n}`;
  }, [profiles]);

  const handleChange = (v: string) => {
    if (v === NEW_PROFILE_VALUE) {
      setOpen(true);
      return;
    }
    onChange(v);
  };

  const handleSave = (profile: DesignProfile) => {
    upsertProfile(profile);
    onChange(profile.profileName);
  };

  return (
    <>
      <Select value={value} onValueChange={handleChange}>
        <SelectTrigger className={className}>
          <SelectValue placeholder="Выберите палитру" />
        </SelectTrigger>
        <SelectContent>
          {profiles.map((p) => (
            <SelectItem
              key={p.profileName}
              value={p.profileName}
              className="focus:!text-current focus:!brightness-95 my-0.5 rounded-md"
              style={profileSelectStyle(p)}
            >
              {p.profileName}
            </SelectItem>
          ))}
          {allowCreate && (
            <SelectItem value={NEW_PROFILE_VALUE} className="font-medium">
              + Добавить новый
            </SelectItem>
          )}
        </SelectContent>
      </Select>

      <PalettePickerDialog
        open={open}
        onOpenChange={setOpen}
        defaultName={nextName}
        onSave={handleSave}
        notesTemplate={DEFAULT_NOTES}
      />
    </>
  );
}
