/** Сборка исходного материала для промпта: ручной ввод + загруженные файлы. */

export function buildSourceTextForPrompt(manualText: string, uploadedSourceText: string): string {
  return [manualText.trim(), uploadedSourceText.trim()].filter(Boolean).join("\n\n");
}

export function hasSourceMaterials(
  manualText: string,
  uploadedSourceText: string,
  attachedImages: string[],
): boolean {
  return Boolean(manualText.trim() || uploadedSourceText.trim() || attachedImages.length);
}
