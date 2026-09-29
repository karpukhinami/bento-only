export function downloadInfographicPng(dataUrl: string, topic?: string | null): void {
  downloadNamedPng(dataUrl, "инфографика", topic);
}

export function downloadLayoutPng(dataUrl: string, kind: string, topic?: string | null): void {
  downloadNamedPng(dataUrl, kind, topic);
}

function downloadNamedPng(dataUrl: string, prefix: string, topic?: string | null): void {
  const title = topic?.trim() || "без названия";
  const safe = title.replace(/[\\/:*?"<>|]+/g, "").slice(0, 120);
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = `${prefix}: ${safe}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
