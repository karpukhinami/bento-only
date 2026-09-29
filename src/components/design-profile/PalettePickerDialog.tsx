import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  WHEEL,
  wheelColorAt,
  getInfographicBackground,
  getPastels,
  getDensestPastel,
  getAccentColors,
  readableTextColor,
  readableTextColorForHex,
  type Color,
} from "@/lib/palette-math";
import type { DesignProfile, DesignProfileColors } from "@/lib/types";

const HEADER_COLOR = "#1A2236";
const INK_COLOR = "#101828";
const LIGHT_TEXT = "#FFFFFF";
const MUTED_HEADER_TEXT = "#9399BD";
const SPOT_ACCENT = "#F074FF";

// Inherit the app's main UI font so the dialog matches the rest of the interface.
const FONT_STACK = `inherit`;

const HUE_GRADIENT = `linear-gradient(90deg, ${WHEEL.filter((_, i) => i % 6 === 0).map((w) => w.hex).join(",")})`;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  onSave: (profile: DesignProfile) => void;
  notesTemplate: string;
}

export function PalettePickerDialog({ open, onOpenChange, defaultName, onSave, notesTemplate }: Props) {
  const [hue, setHue] = useState(28);
  const [density, setDensity] = useState(50);
  const [pastelIdx, setPastelIdx] = useState(2);
  const [accentIdx, setAccentIdx] = useState(2);

  const base: Color = useMemo(() => wheelColorAt(hue, "base"), [hue]);
  const infographicBg = useMemo(() => getInfographicBackground(base), [base]);
  const pastels = useMemo(() => getPastels(base, infographicBg, density), [base, infographicBg, density]);
  const detailSoftColor = pastels[2].hex; // lightest
  const detailDeepColor = pastels[0].hex; // densest

  const accents = useMemo(() => getAccentColors(base), [base]);
  const contrastPastels = useMemo(
    () => accents.map((c, i) => getDensestPastel(c, infographicBg, density, `contrast-${i}`)),
    [accents, infographicBg, density],
  );

  const accent = accents[accentIdx];
  const contrastPastel = contrastPastels[pastelIdx];

  const handleSave = () => {
    const colors: DesignProfileColors = {
      backgroundColor: infographicBg.hex,
      surfaceColor: infographicBg.hex,
      primaryColor: base.hex,
      detailSoftColor,
      detailDeepColor,
      contrastSoftColor: contrastPastel.hex,
      inkColor: INK_COLOR,
      headerColor: HEADER_COLOR,
      lightTextColor: LIGHT_TEXT,
      spotAccentColor: accent.hex,
      mutedheaderTextColor: MUTED_HEADER_TEXT,
    };
    onSave({
      profileName: defaultName,
      colors,
      typography: { styleId: "geometric_grotesque", specificityId: "character_only" },
      notesForAI: notesTemplate,
    });
    onOpenChange(false);
  };

  const titleOnBaseColor = readableTextColor(base);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px] p-0 gap-0 overflow-hidden bg-card">
        <DialogTitle className="sr-only">Создание новой палитры</DialogTitle>
        <div className="relative p-4 pt-9 space-y-3 bg-card">
          {/* Hue slider — thin, with narrow ruler-style handle */}
          <div className="pr-7">
            <div
              className="relative h-3 rounded-full shadow-inner overflow-hidden"
              style={{ background: HUE_GRADIENT }}
            >
              <input
                type="range"
                min={0}
                max={359}
                step={1}
                value={hue}
                onChange={(e) => setHue(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none rounded-[3px] border-2 border-foreground bg-background shadow-md"
                style={{ left: `${(hue / 359) * 100}%`, width: 8, height: 20 }}
              />
            </div>
          </div>

          <div className="grid gap-4 grid-cols-[140px_1fr] items-start">
            {/* LEFT: controls (narrow) */}
            <div className="space-y-3">
              <div
                className="w-full h-16 rounded-md shadow-sm"
                style={{ background: base.hex }}
              />

              <Slider
                value={[density]}
                onValueChange={(v) => setDensity(v[0] ?? 0)}
                min={0}
                max={100}
                step={1}
              />

              <div className="space-y-1.5">
                <Label className="text-xs">Контрастная пастель</Label>
                <SwatchRow
                  colors={contrastPastels}
                  selected={pastelIdx}
                  onSelect={setPastelIdx}
                  name="contrast-pastel"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Акцентный цвет</Label>
                <SwatchRow
                  colors={accents}
                  selected={accentIdx}
                  onSelect={setAccentIdx}
                  name="accent-color"
                />
              </div>
            </div>

            {/* RIGHT: A4 portrait mock — bordered, infographic bg inside only */}
            <div
              className="w-full rounded-lg border border-border p-2"
              style={{
                background: infographicBg.hex,
                aspectRatio: "1 / 1.35",
                fontFamily: FONT_STACK,
              }}
            >
              <div
                className="h-full grid gap-1.5"
                style={{ gridTemplateRows: "auto 1.4fr 0.9fr 0.9fr 1.6fr 0.9fr" }}
              >
                <MockCard
                  bg={HEADER_COLOR}
                  text={LIGHT_TEXT}
                  className="uppercase font-extrabold text-[22px] leading-[1.05] tracking-wide flex items-start"
                >
                  <span>
                    <span style={{ color: base.hex }}>Тестовый</span><br />макет инфографики
                  </span>
                </MockCard>

                <div
                  className="rounded-md p-2.5 flex flex-col gap-1.5 justify-start min-h-0"
                  style={{ background: base.hex, color: titleOnBaseColor }}
                >
                  <TitlePill text="Главная идея" />
                  <div className="text-[20px] font-extrabold leading-tight">
                    словесный <span style={{ color: accent.hex }}>акцент</span>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5 min-h-0">
                  <MockCard bg={detailDeepColor} text={INK_COLOR} />
                  <MockCard bg={detailSoftColor} text={INK_COLOR} />
                  <MockCard bg={detailDeepColor} text={INK_COLOR} />
                </div>

                <div className="grid grid-cols-2 gap-1.5 min-h-0">
                  <MockCard bg={detailSoftColor} text={INK_COLOR} />
                  <MockCard bg={detailDeepColor} text={INK_COLOR} />
                </div>

                <div
                  className="rounded-md p-2.5 flex flex-col gap-1.5 justify-start min-h-0"
                  style={{ background: contrastPastel.hex, color: INK_COLOR }}
                >
                  <TitlePill text="Обрати внимание" />
                  <div className="text-[20px] font-extrabold leading-tight">
                    Посмотри на эту красоту!
                  </div>
                </div>

                <div
                  className="rounded-md min-h-0"
                  style={{ background: detailSoftColor }}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>Отмена</Button>
            <Button size="sm" onClick={handleSave}>Сохранить</Button>
          </div>
        </div>

      </DialogContent>
    </Dialog>
  );
}

function SwatchRow({
  colors,
  selected,
  onSelect,
  name,
}: {
  colors: Color[];
  selected: number;
  onSelect: (i: number) => void;
  name: string;
}) {
  return (
    <div className="grid grid-cols-5 gap-1.5">
      {colors.map((c, i) => (
        <label key={`${name}-${i}`} className="block cursor-pointer">
          <input
            type="radio"
            name={name}
            className="sr-only peer"
            checked={selected === i}
            onChange={() => onSelect(i)}
          />
          <span
            className="block aspect-square w-full shadow-sm transition-all peer-checked:ring-2 peer-checked:ring-foreground peer-checked:ring-offset-1 peer-checked:ring-offset-background"
            style={{ background: c.hex }}
          />
        </label>
      ))}
    </div>
  );
}

function MockCard({
  bg,
  text,
  className = "",
  children,
}: {
  bg: string;
  text: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg p-3 ${className}`}
      style={{ background: bg, color: text }}
    >
      {children}
    </div>
  );
}

function TitlePill({ text }: { text: string }) {
  return (
    <span
      className="inline-block self-start rounded-md px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider"
      style={{ background: HEADER_COLOR, color: LIGHT_TEXT }}
    >
      {text}
    </span>
  );
}

/** Helper: build the gradient + readable text for a profile dropdown chip. */
export function profileSelectStyle(profile: DesignProfile) {
  const a = profile.colors.primaryColor;
  const b = profile.colors.contrastSoftColor;
  // Pick text color based on midpoint luminance.
  const midHex = mixHex(a, b, 0.5);
  return {
    background: `linear-gradient(135deg, ${a}, ${b})`,
    color: readableTextColorForHex(midHex),
  };
}

function mixHex(a: string, b: string, k: number) {
  const pa = parseInt(a.replace("#", ""), 16);
  const pb = parseInt(b.replace("#", ""), 16);
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
  const r = Math.round(ar * (1 - k) + br * k);
  const g = Math.round(ag * (1 - k) + bg * k);
  const bl = Math.round(ab * (1 - k) + bb * k);
  return `#${[r, g, bl].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}
