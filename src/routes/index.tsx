import { createFileRoute, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2,
  RotateCcw,
  RefreshCw,
  Upload,
  Sparkles,
  ImageIcon,
  Download,
  Info,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useProjectStore, useActiveContent } from "@/store/useProjectStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { callImageLLM } from "@/lib/llm-client";
import { callTextLLMForJson } from "@/lib/llm-json";
import { validateAnalysisJson } from "@/lib/analysis-render";
import {
  buildDesignBriefPrompt,
  buildSimpleHomeImagePrompt,
  resolveDesignProfile,
} from "@/lib/prompt-injection";
import simpleBriefPromptRaw from "@/data/prompts/simple/design-brief-short.txt?raw";
import imagePromptHeaderText from "@/data/prompts/image-prompt-header.txt?raw";
import executionRulesText from "@/data/prompts/execution-rules.txt?raw";
import type { ContentSummary, DesignBriefResult, InfographicStyle } from "@/lib/types";
import { ProfileSelect } from "@/components/design-profile/ProfileSelect";
import { SimpleImageRating } from "@/components/workspace/SimpleImageRating";
import { ImageVersionDeleteButton } from "@/components/workspace/ImageVersionDeleteButton";
import { cn } from "@/lib/utils";
import { downloadInfographicPng } from "@/lib/download-infographic";
import {
  hasEnoughStorageForNewImage,
  onStorageQuotaExceeded,
  refreshStorageQuotaWarningState,
  tryNotifyStorageQuotaExceeded,
  type StorageQuotaContext,
} from "@/lib/browser-storage-quota";
import {
  importSourceFiles,
  SOURCE_FILE_ACCEPT,
} from "@/lib/source-file-import";
import { buildSourceTextForPrompt, hasSourceMaterials } from "@/lib/source-material";
import { archiveImageToGoogle, flushAllPendingArchiveFeedback, flushPendingArchiveFeedback } from "@/lib/archive-client";
import { DEFAULT_HOME_DESIGN_PROFILE } from "@/lib/design-profile-defaults";
import type { GenTrigger } from "@/lib/google/archive-schema";
import { HomeYandexMetrika } from "@/components/analytics/HomeYandexMetrika";
import { isHomeAnalyticsRoute } from "@/lib/analytics/yandex-metrika";
import {
  trackHomeContentSuccess,
  trackHomeFormInputStart,
  trackHomeGenerateClick,
  trackHomeImageDownload,
  trackHomeImageFullscreen,
  trackHomeImageRate,
  trackHomeImageSuccess,
  trackHomeRegenImageClick,
  trackHomeRegenImageSuccess,
  trackHomeResetClick,
  trackHomeResetConfirm,
  trackHomeVersionSwitch,
} from "@/lib/analytics/home-events";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Генератор инфографики" }] }),
  component: SimpleHome,
});

const SUBJECTS = [
  "Алгебра",
  "Английский язык",
  "Астрономия",
  "Биология",
  "География",
  "Геометрия",
  "Изобразительное искусство",
  "Информатика",
  "История",
  "Литература",
  "Математика",
  "Музыка",
  "ОБЗР",
  "Обществознание",
  "Окружающий мир",
  "Русский язык",
  "Технология",
  "Физика",
  "Физкультура",
  "Химия",
  "Другое",
];
const GRADES = [...Array.from({ length: 11 }, (_, i) => String(i + 1)), "Другое"];

const BENTO_STYLE_ID = "modern-bento";
const LAVENDER = "#A78BFA";

function RequiredStar() {
  return (
    <span aria-hidden className="ml-1 inline-block" style={{ color: LAVENDER }} title="Обязательное поле">
      ★
    </span>
  );
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

function SimpleHomePageTitle({ className }: { className?: string }) {
  return (
    <h1 className={cn("text-4xl font-semibold tracking-tight", className)}>
      Генератор инфографики
    </h1>
  );
}

function SimpleHome() {
  const source = useProjectStore((s) => s.source);
  const setSource = useProjectStore((s) => s.setSource);
  const resetProject = useProjectStore((s) => s.resetProject);
  const models = useProjectStore((s) => s.models);
  const pushContent = useProjectStore((s) => s.pushContent);
  const selectedStyleId = useProjectStore((s) => s.selectedStyleId);
  const selectedProfileName = useProjectStore((s) => s.selectedProfileName);
  const setSelectedProfileName = useProjectStore((s) => s.setSelectedProfileName);
  const userWishes = useProjectStore((s) => s.userWishes);
  const setUserWishes = useProjectStore((s) => s.setUserWishes);
  const attachedImages = useProjectStore((s) => s.attachedImages);
  const addAttachedImages = useProjectStore((s) => s.addAttachedImages);
  const uploadedSourceText = useProjectStore((s) => s.uploadedSourceText);
  const setUploadedSourceText = useProjectStore((s) => s.setUploadedSourceText);
  const simpleCurrent = useProjectStore((s) => s.simpleCurrentImage);
  const simpleVersions = useProjectStore((s) => s.simpleImageVersions);
  const setSimpleCurrent = useProjectStore((s) => s.setSimpleCurrentImage);
  const archiveSimple = useProjectStore((s) => s.archiveSimpleCurrentImage);
  const swapSimpleVersion = useProjectStore((s) => s.swapSimpleVersion);
  const deleteSimpleImage = useProjectStore((s) => s.deleteSimpleImage);
  const clearSimpleImages = useProjectStore((s) => s.clearSimpleImages);

  const activeContent = useActiveContent();
  const prompts = useSettingsStore((s) => s.prompts);
  const allStyles = useSettingsStore((s) => s.styles);
  const profiles = useSettingsStore((s) => s.profiles);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const trackHome = isHomeAnalyticsRoute(pathname);
  const formInputStartedRef = useRef(false);

  function touchFormInput(inputName: string) {
    if (!trackHome || formInputStartedRef.current) return;
    formInputStartedRef.current = true;
    trackHomeFormInputStart(pathname, inputName);
  }

  const [loading, setLoading] = useState<null | "analyze" | "image">(null);
  const [imageStage, setImageStage] = useState<null | "brief" | "render">(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [regenImageOpen, setRegenImageOpen] = useState(false);
  const [imageFullscreen, setImageFullscreen] = useState(false);
  const [deleteImageId, setDeleteImageId] = useState<string | null>(null);
  const [storageQuotaWarningOpen, setStorageQuotaWarningOpen] = useState(false);
  const [storageQuotaWarningContext, setStorageQuotaWarningContext] =
    useState<StorageQuotaContext>("save-image");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const enabledStyles = useMemo<InfographicStyle[]>(() => {
    const enabled = allStyles.filter((s) => s.enabled);
    const bento = enabled.find((s) => s.id === BENTO_STYLE_ID);
    return bento ? [bento] : enabled.slice(0, 1);
  }, [allStyles]);

  const activeStyle = useMemo(
    () => enabledStyles.find((s) => s.id === (selectedStyleId ?? activeContent?.value.recommendedStyle)) ?? enabledStyles[0],
    [enabledStyles, selectedStyleId, activeContent],
  );

  const activeProfile = useMemo(
    () => profiles.find((p) => p.profileName === selectedProfileName) ?? profiles[0],
    [profiles, selectedProfileName],
  );

  const hasSource = hasSourceMaterials(source.text, uploadedSourceText, attachedImages);
  const useTopicOnlyPrompt = !hasSource;
  const subjectOk = Boolean(source.subject);
  const gradeOk = Boolean(source.grade);
  const canGenerate = subjectOk && gradeOk;
  const showResults = Boolean(activeContent) || loading !== null;
  const isBusy = loading !== null;

  useEffect(() => {
    if (!imageFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImageFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [imageFullscreen]);

  useEffect(() => {
    if (!simpleCurrent) setImageFullscreen(false);
  }, [simpleCurrent?.id]);

  useEffect(() => {
    return onStorageQuotaExceeded((context) => {
      setStorageQuotaWarningContext(context);
      setStorageQuotaWarningOpen(true);
    });
  }, []);

  useEffect(() => {
    void flushAllPendingArchiveFeedback();
  }, []);

  const deleteImageTarget = useMemo(() => {
    if (!deleteImageId) return null;
    if (simpleCurrent?.id === deleteImageId) return simpleCurrent;
    return simpleVersions.find((v) => v.id === deleteImageId) ?? null;
  }, [deleteImageId, simpleCurrent, simpleVersions]);

  function imageDownloadTopic(): string | undefined {
    const analysis = activeContent?.value.analysis;
    return analysis?.topic?.trim() || source.topic?.trim() || undefined;
  }

  function downloadSimpleImageEntry(entry: { dataUrl: string; versionNumber?: number }) {
    downloadInfographicPng(entry.dataUrl, imageDownloadTopic());
    if (trackHome) {
      trackHomeImageDownload(pathname, { version_number: entry.versionNumber ?? 1 });
    }
  }

  async function ensureStorageForRegen(): Promise<boolean> {
    await refreshStorageQuotaWarningState();
    const ok = await hasEnoughStorageForNewImage();
    if (!ok) tryNotifyStorageQuotaExceeded("regen");
    return ok;
  }

  async function openImageGenerationDialog() {
    if (!(await ensureStorageForRegen())) return;
    if (trackHome) trackHomeRegenImageClick(pathname);
    setRegenImageOpen(true);
  }

  function confirmDeleteImage(saveFirst: boolean) {
    if (!deleteImageTarget) return;
    if (saveFirst) downloadSimpleImageEntry(deleteImageTarget);
    deleteSimpleImage(deleteImageTarget.id);
    setDeleteImageId(null);
    void refreshStorageQuotaWarningState();
  }

  async function attachImageFiles(files: File[]) {
    if (!files.length) return;
    try {
      const dataUrls = await Promise.all(files.map(fileToDataUrl));
      addAttachedImages(dataUrls);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось прикрепить картинку");
    }
  }

  async function onPasteCapture(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(e.clipboardData?.items ?? []);
    const imageFiles = items
      .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
      .map((it) => it.getAsFile())
      .filter((f): f is File => !!f);
    if (imageFiles.length) {
      e.preventDefault();
      touchFormInput("paste_image");
      await attachImageFiles(imageFiles);
    }
  }

  async function onFileChosen(files: FileList | null) {
    if (!files?.length) return;
    touchFormInput("attach_file");
    await importSourceFiles(Array.from(files), {
      getUploadedText: () => uploadedSourceText,
      setUploadedText: setUploadedSourceText,
      addImages: addAttachedImages,
      onSuccess: (message) => toast.success(message),
      onError: (message) => toast.error(message),
    });
  }

  async function runAnalyze(): Promise<ContentSummary | null> {
    const stylesList = enabledStyles.map((s) => `- ${s.id}: ${s.name} — ${s.shortDescription}`).join("\n");
    const template = useTopicOnlyPrompt ? prompts.analysisTopicOnly : prompts.analysisWithContent;
    const merged = (source.userInstructions || "").trim();
    const filled = template
      .replaceAll("{{USER_INSTRUCTIONS}}", merged || "(нет)")
      .replaceAll("{{STYLES_LIST}}", stylesList || "(стилей не задано)")
      .replaceAll("{{SOURCE_TEXT}}", buildSourceTextForPrompt(source.text, uploadedSourceText) || "")
      .replaceAll("{{TOPIC}}", source.topic || "")
      .replaceAll("{{SUBJECT}}", source.subject || "")
      .replaceAll("{{GRADE}}", source.grade || "")
      .replaceAll("{{EDUCATIONAL_ILLUSTRATIONS}}", source.educationalIllustrations ? "вкл" : "выкл")
      .replaceAll("{{NARRATIVE_ILLUSTRATIONS}}", source.narrativeIllustrations ? "вкл" : "выкл");

    const imgs = attachedImages.length ? attachedImages : undefined;
    const analysis = await callTextLLMForJson({
      model: models.analysis,
      prompt: filled,
      label: "analysis",
      parse: validateAnalysisJson,
      images: imgs,
    });
    const fallbackStyle = enabledStyles[0]?.id ?? BENTO_STYLE_ID;
    const summary: ContentSummary = {
      content: "",
      recommendedStyle: selectedStyleId ?? fallbackStyle,
      recommendedDesignProfile: analysis.recommendedDesignProfile ?? null,
      analysis,
    };
    pushContent(summary);
    return summary;
  }

  async function runImage(
    opts: { useProfileName?: string | null; genTrigger?: GenTrigger } = {},
  ): Promise<boolean> {
    const project = useProjectStore.getState();
    const settings = useSettingsStore.getState();
    const profile = resolveDesignProfile(settings.profiles, opts.useProfileName ?? project.selectedProfileName);
    const style = activeStyle ?? enabledStyles[0];
    if (!style) throw new Error("Не задан стиль инфографики");
    const content = project.contentVersions.find((v) => v.id === project.activeContentId);
    if (!content) throw new Error("Контент не готов");

    setImageStage("brief");

    const summaryText = content.value.analysis
      ? JSON.stringify(content.value.analysis, null, 2)
      : content.value.content;

    const filled = buildDesignBriefPrompt({
      template: simpleBriefPromptRaw,
      contentSummary: summaryText,
      style,
      profile,
      userWishes: project.userWishes,
      generalRules: settings.prompts.generalRules,
    });
    const briefRes = await callTextLLMForJson({
      model: project.models.brief,
      prompt: filled,
      label: "simple design brief",
      parse: (v) => v as DesignBriefResult,
    });
    if (!briefRes?.PromptForImageGeneration) throw new Error("Инструкции для генерации инфографики не готовы");

    const finalPrompt = buildSimpleHomeImagePrompt({
      profile,
      promptForImageGeneration: briefRes.PromptForImageGeneration,
      headerText: imagePromptHeaderText,
      executionRules: executionRulesText,
    });

    setImageStage("render");
    const dataUrl = await callImageLLM({ model: project.models.image, prompt: finalPrompt });
    archiveSimple();
    const generationSnapshot = {
      educationalIllustrations: project.source.educationalIllustrations,
      narrativeIllustrations: project.source.narrativeIllustrations,
    };
    setSimpleCurrent({
      dataUrl,
      prompt: finalPrompt,
      generationSnapshot,
    });

    if (!(await hasEnoughStorageForNewImage())) {
      tryNotifyStorageQuotaExceeded("save-image");
    }

    const after = useProjectStore.getState();
    const image = after.simpleCurrentImage;
    if (!image) return false;

    const analysis = content.value.analysis;
    const genTrigger = opts.genTrigger ?? "initial";
    void archiveImageToGoogle({
      imageId: image.id,
      dataUrl,
      sessionId: after.ensureArchiveSessionId(),
      sessionFolderId: after.archiveSessionFolderId,
      version: image.versionNumber ?? 1,
      genTrigger,
      subject: analysis?.subject?.trim() || project.source.subject || "",
      className: analysis?.grade?.trim() || project.source.grade || "",
      topic: analysis?.topic?.trim() || project.source.topic || "",
      addedContent: hasSourceMaterials(project.source.text, after.uploadedSourceText, after.attachedImages),
      style: style.name,
      profile: profile?.profileName ?? "",
      analysisModel: project.models.analysis,
      briefModel: project.models.brief,
      imageModel: project.models.image,
    }).then((result) => {
      const store = useProjectStore.getState();
      if (!result.ok) {
        if (result.sessionFolderId) {
          store.setArchiveSessionFolder(result.sessionFolderId, result.folderLink ?? "");
        }
        const msg =
          result.status === 503
            ? "Google-архив не настроен на сервере (503)."
            : `Archive failed (${result.status}): ${result.message.slice(0, 100)}`;
        store.setSimpleImageArchiveError(image.id, msg);
        return;
      }
      store.setArchiveSessionFolder(result.sessionFolderId, result.folderLink);
      store.setSimpleImageArchiveMeta(image.id, {
        sheetRow: result.sheetRow,
        driveFileId: result.driveFileId,
        driveLink: result.driveLink,
        folderLink: result.folderLink,
      });
      void flushPendingArchiveFeedback(image.id, result.sheetRow).then((flushResult) => {
        if (flushResult?.ok) toast.success("Оценка сохранена");
      });
    });
    return true;
  }

  async function onGenerateAll() {
    if (!canGenerate) {
      toast.error("Заполните предмет и класс. Если нет подходящего варианта, выберите «Другое».");
      return;
    }
    if (trackHome) {
      trackHomeGenerateClick(pathname, {
        has_source_text: hasSource,
        has_attached_images: attachedImages.length > 0,
        subject: source.subject || "",
        grade: source.grade || "",
        topic_length: (source.topic || "").length,
      });
    }
    try {
      setLoading("analyze");
      const profileBeforeAnalyze = useProjectStore.getState().selectedProfileName;
      const summary = await runAnalyze();
      if (!summary) return;
      if (trackHome) {
        trackHomeContentSuccess(pathname, {
          entity_count: summary.analysis?.entities?.length ?? 0,
          has_source_text: hasSource,
          generation_mode: hasSource ? "with_materials" : "topic_only",
        });
      }
      const useProfile = profileBeforeAnalyze ?? DEFAULT_HOME_DESIGN_PROFILE;
      if (!profileBeforeAnalyze) setSelectedProfileName(DEFAULT_HOME_DESIGN_PROFILE);
      setLoading("image");
      const imageOk = await runImage({ useProfileName: useProfile, genTrigger: "initial" });
      if (!imageOk) return;
      if (trackHome) {
        const img = useProjectStore.getState().simpleCurrentImage;
        trackHomeImageSuccess(pathname, {
          version_number: img?.versionNumber ?? 1,
          image_versions_count: useProjectStore.getState().simpleImageVersions.length,
          profile_name: useProfile ?? selectedProfileName ?? "",
          trigger: "initial",
        });
      }
      toast.success("Инфографика готова");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось сгенерировать");
    } finally {
      setLoading(null);
      setImageStage(null);
    }
  }

  async function onRegenImage(profileName: string | null, wishes: string) {
    try {
      setRegenImageOpen(false);
      if (profileName) setSelectedProfileName(profileName);
      setUserWishes(wishes);
      setLoading("image");
      const imageOk = await runImage({ useProfileName: profileName, genTrigger: "regen_image" });
      if (!imageOk) return;
      if (trackHome) {
        const img = useProjectStore.getState().simpleCurrentImage;
        trackHomeRegenImageSuccess(pathname, {
          version_number: img?.versionNumber ?? 1,
          profile_name: profileName ?? selectedProfileName ?? "",
          has_wishes: Boolean(wishes.trim()),
        });
        trackHomeImageSuccess(pathname, {
          version_number: img?.versionNumber ?? 1,
          image_versions_count: useProjectStore.getState().simpleImageVersions.length,
          profile_name: profileName ?? selectedProfileName ?? "",
          trigger: "regen_image",
        });
      }
      toast.success("Инфографика готова");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось перегенерировать");
    } finally {
      setLoading(null);
      setImageStage(null);
    }
  }

  function onConfirmReset() {
    if (trackHome) trackHomeResetConfirm(pathname);
    formInputStartedRef.current = false;
    clearSimpleImages();
    resetProject();
    setResetOpen(false);
    void refreshStorageQuotaWarningState();
    toast.success("Проект сброшен");
  }

  const sidebarVersions = useMemo(
    () =>
      [...simpleVersions].sort(
        (a, b) =>
          (a.versionNumber ?? Number.MAX_SAFE_INTEGER) - (b.versionNumber ?? Number.MAX_SAFE_INTEGER) ||
          a.createdAt - b.createdAt,
      ),
    [simpleVersions],
  );
  const currentVerLabel = simpleCurrent
    ? `ver.${simpleCurrent.versionNumber ?? sidebarVersions.length + 1}`
    : "ver.1";

  if (!showResults) {
    return (
      <div className="mx-auto min-h-0 w-full max-w-3xl flex-1 overflow-y-auto px-4 pt-8 pb-6">
        <HomeYandexMetrika />
        <SimpleHomePageTitle className="mb-6" />
        <section className="rounded-lg border border-border bg-card p-5 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Данные инфографики</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (trackHome) trackHomeResetClick(pathname);
                setResetOpen(true);
              }}
            >
              <RotateCcw className="size-3.5 mr-1" /> Начать заново
            </Button>
          </div>

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-6">
              <Label className="text-xs">
                Предмет
                <RequiredStar />
              </Label>
              <Select
                value={source.subject || ""}
                onValueChange={(v) => {
                  touchFormInput("subject");
                  setSource({ subject: v });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите предмет" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-6">
              <Label className="text-xs">
                Класс
                <RequiredStar />
              </Label>
              <Select
                value={source.grade || ""}
                onValueChange={(v) => {
                  touchFormInput("grade");
                  setSource({ grade: v });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите класс" />
                </SelectTrigger>
                <SelectContent>
                  {GRADES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-12">
              <Label className="text-xs">Тема</Label>
              <Input
                value={source.topic || ""}
                onChange={(e) => {
                  touchFormInput("topic");
                  setSource({ topic: e.target.value });
                }}
                placeholder="Впишите название темы"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Дополнительные инструкции</Label>
            <Textarea
              rows={2}
              value={source.userInstructions}
              onChange={(e) => {
                touchFormInput("user_instructions");
                setSource({ userInstructions: e.target.value });
              }}
              placeholder="На чём сделать акцент, что пропустить, особенности аудитории…"
            />
          </div>

          <TooltipProvider delayDuration={150}>
            <div className="flex flex-wrap items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="sw-edu"
                  checked={source.educationalIllustrations}
                  onCheckedChange={(v) => {
                    touchFormInput("educational_illustrations");
                    setSource({ educationalIllustrations: v });
                  }}
                />
                <Label htmlFor="sw-edu" className="text-sm font-normal cursor-pointer">
                  Учебные иллюстрации
                </Label>
                {source.educationalIllustrations && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="size-3.5 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs text-xs">
                      Иллюстрации по предмету — только если необходимы.
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="sw-narr"
                  checked={source.narrativeIllustrations}
                  onCheckedChange={(v) => {
                    touchFormInput("narrative_illustrations");
                    setSource({ narrativeIllustrations: v });
                  }}
                />
                <Label htmlFor="sw-narr" className="text-sm font-normal cursor-pointer">
                  Сюжетные иллюстрации
                </Label>
              </div>
            </div>
          </TooltipProvider>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Исходный материал (необязательно)</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  touchFormInput("attach_file");
                  fileInputRef.current?.click();
                }}
              >
                <Upload className="size-3.5 mr-1" /> Файл
              </Button>
            </div>
            <Textarea
              rows={6}
              placeholder="Вставьте текст или изображение (Ctrl/Cmd + V)"
              value={source.text}
              onChange={(e) => {
                touchFormInput("source_text");
                setSource({ text: e.target.value });
              }}
              onPaste={onPasteCapture}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept={SOURCE_FILE_ACCEPT}
              multiple
              className="hidden"
              onChange={(e) => {
                void onFileChosen(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          <Button onClick={onGenerateAll} disabled={!canGenerate} className="w-full">
            <Sparkles className="size-4 mr-2" />
            Сгенерировать инфографику
          </Button>
        </section>

        <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
              <AlertDialogDescription>Форма ввода данных будет очищена</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отменить</AlertDialogCancel>
              <AlertDialogAction onClick={onConfirmReset}>Начать заново</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-hidden px-4 py-3">
        <HomeYandexMetrika />
        <div className="mb-3 flex shrink-0 items-center justify-between gap-4">
          <SimpleHomePageTitle className="text-3xl" />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (trackHome) trackHomeResetClick(pathname);
              setResetOpen(true);
            }}
            disabled={isBusy}
          >
            <RotateCcw className="size-3.5 mr-1" /> Начать заново
          </Button>
        </div>

        <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-border px-5 py-3 min-h-12">
            <h2 className="text-sm font-semibold text-muted-foreground">Итоговая инфографика</h2>
            {!isBusy && (
              <div className="flex flex-wrap gap-2">
                {simpleCurrent && (
                  <Button size="sm" variant="outline" onClick={() => downloadSimpleImageEntry(simpleCurrent)}>
                    <Download className="size-3.5 mr-1" /> Сохранить
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!activeContent}
                  onClick={() => {
                    void openImageGenerationDialog();
                  }}
                >
                  {simpleCurrent ? (
                    <>
                      <RefreshCw className="size-3.5 mr-1" /> Перегенерировать
                    </>
                  ) : (
                    <>
                      <Sparkles className="size-3.5 mr-1" /> Сгенерировать
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-2 px-3 py-2">
            <div className="flex min-h-0 flex-1 gap-2">
              {simpleVersions.length > 0 && !isBusy && (
                <aside className="flex w-[4.5rem] shrink-0 flex-col overflow-hidden rounded-md border border-border bg-muted/40">
                  <div className="shrink-0 border-b border-border px-1 py-1.5 text-center text-[10px] leading-tight text-muted-foreground">
                    <div className="font-medium">Версии</div>
                    <div>{currentVerLabel}</div>
                  </div>
                  <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-1.5">
                    {sidebarVersions.map((v) => (
                      <div key={v.id} className="group relative aspect-[3/4] w-full shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (trackHome && simpleCurrent) {
                              trackHomeVersionSwitch(pathname, {
                                from_version: simpleCurrent.versionNumber ?? 1,
                                to_version: v.versionNumber ?? 1,
                              });
                            }
                            swapSimpleVersion(v.id);
                          }}
                          className="relative h-full w-full overflow-hidden rounded border hover:ring-2 hover:ring-ring"
                          title={`Открыть ver.${v.versionNumber ?? "?"}`}
                        >
                          <img src={v.dataUrl} alt="" className="h-full w-full object-cover" />
                          <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[10px] text-white">
                            ver.{v.versionNumber ?? "?"}
                          </span>
                        </button>
                        <ImageVersionDeleteButton
                          className="absolute top-1 right-1 z-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteImageId(v.id);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </aside>
              )}

              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1">
                <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-md border border-border bg-background">
                  {loading === "analyze" ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
                      <Loader2 className="size-8 animate-spin" />
                      <div>Шаг 1 из 3 — подбираем контент…</div>
                    </div>
                  ) : loading === "image" ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
                      <Loader2 className="size-8 animate-spin" />
                      <div>
                        {imageStage === "brief"
                          ? "Шаг 2 из 3 — придумываем дизайн…"
                          : "Шаг 3 из 3 — генерируем инфографику…"}
                      </div>
                    </div>
                  ) : simpleCurrent ? (
                    <div className="relative flex h-full w-full min-h-[280px]">
                      <button
                        type="button"
                        onClick={() => {
                          if (trackHome && simpleCurrent) {
                            trackHomeImageFullscreen(pathname, {
                              version_number: simpleCurrent.versionNumber ?? 1,
                            });
                          }
                          setImageFullscreen(true);
                        }}
                        className="flex h-full w-full cursor-zoom-in items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        title="Открыть на весь экран"
                      >
                        <img
                          src={simpleCurrent.dataUrl}
                          alt=""
                          className="max-h-full max-w-full object-contain"
                        />
                      </button>
                      <ImageVersionDeleteButton
                        className="absolute top-2 right-2 z-10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteImageId(simpleCurrent.id);
                        }}
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
                      <ImageIcon className="size-8 opacity-50" />
                      Итоговая инфографика появится здесь
                    </div>
                  )}
                </div>

                {simpleCurrent && !isBusy && (
                  <div className="shrink-0">
                    <SimpleImageRating
                      imageId={simpleCurrent.id}
                      showIllustrationsRow={
                        Boolean(
                          simpleCurrent.generationSnapshot?.educationalIllustrations ||
                            simpleCurrent.generationSnapshot?.narrativeIllustrations,
                        )
                      }
                      onRate={
                        trackHome
                          ? (rating) =>
                              trackHomeImageRate(pathname, {
                                version_number: simpleCurrent.versionNumber ?? 1,
                                rating,
                              })
                          : undefined
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        {imageFullscreen && simpleCurrent && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Изображение на весь экран"
            onClick={() => setImageFullscreen(false)}
          >
            <img
              src={simpleCurrent.dataUrl}
              alt=""
              className="max-h-full max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        <Dialog open={deleteImageId !== null} onOpenChange={(open) => { if (!open) setDeleteImageId(null); }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Удалить инфографику?</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              Инфографика будет удалена из проекта. Рекомендуем сохранить её перед удалением.
            </p>
            <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
              <Button variant="default" className="w-full" onClick={() => confirmDeleteImage(true)}>
                Сохранить и удалить
              </Button>
              <Button variant="outline" className="w-full" onClick={() => confirmDeleteImage(false)}>
                Удалить без сохранения
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setDeleteImageId(null)}>
                Отменить
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={storageQuotaWarningOpen} onOpenChange={setStorageQuotaWarningOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Недостаточно места</AlertDialogTitle>
              <AlertDialogDescription>
                {storageQuotaWarningContext === "regen"
                  ? "Хранилища браузера не хватит для сохранения нового изображения. Удалите одну из ранее созданных инфографик прежде чем выполнять перегенерацию."
                  : "Хранилища браузера недостаточно для сохранения нового изображения. Удалите одну из ранее созданных инфографик или начните новый проект."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction>Понятно</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={resetOpen} onOpenChange={setResetOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Вы уверены?</AlertDialogTitle>
              <AlertDialogDescription>
                Все сгенерированные инфографики будут удалены, форма сбросится
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Отменить</AlertDialogCancel>
              <AlertDialogAction onClick={onConfirmReset}>Начать заново</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <RegenerateImageDialog
          open={regenImageOpen}
          initialProfile={selectedProfileName ?? activeProfile?.profileName ?? ""}
          initialWishes={userWishes}
          onClose={() => setRegenImageOpen(false)}
          onConfirm={onRegenImage}
        />
      </div>
    </TooltipProvider>
  );
}

function RegenerateImageDialog({
  open,
  initialProfile,
  initialWishes,
  onClose,
  onConfirm,
}: {
  open: boolean;
  initialProfile: string;
  initialWishes: string;
  onClose: () => void;
  onConfirm: (profileName: string | null, wishes: string) => void;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [wishes, setWishes] = useState(initialWishes);

  useEffect(() => {
    if (open) {
      setProfile(initialProfile);
      setWishes(initialWishes);
    }
  }, [open, initialProfile, initialWishes]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Перегенерация инфографики</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Новая картинка на основе уже сгенерированного контента (без изменения текста карточек).
          </p>
          <div className="space-y-1.5">
            <Label className="text-xs">Цветовая палитра</Label>
            <ProfileSelect value={profile} onChange={setProfile} allowCreate={false} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Дополнительные требования к инфографике</Label>
            <Textarea
              rows={3}
              value={wishes}
              onChange={(e) => setWishes(e.target.value)}
              placeholder="Например, написать формулы крупнее…"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={() => onConfirm(profile || null, wishes)}>
            <RefreshCw className="size-3.5 mr-1" /> Перегенерировать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
