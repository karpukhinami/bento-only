import type { StateStorage } from "zustand/middleware";

/** Минимальный запас перед сохранением новой инфографики. */
export const MIN_FREE_FOR_NEW_IMAGE = 1024 * 1024;

const DEFAULT_QUOTA = 5 * 1024 * 1024;

export type StorageQuotaContext = "save-image" | "regen";

type QuotaListener = (context: StorageQuotaContext) => void;
const quotaListeners = new Set<QuotaListener>();
const shownQuotaWarnings = new Set<StorageQuotaContext>();

export function onStorageQuotaExceeded(listener: QuotaListener): () => void {
  quotaListeners.add(listener);
  return () => quotaListeners.delete(listener);
}

/** Показать предупреждение не чаще одного раза для каждого контекста, пока место не освободится. */
export function tryNotifyStorageQuotaExceeded(context: StorageQuotaContext): boolean {
  if (shownQuotaWarnings.has(context)) return false;
  shownQuotaWarnings.add(context);
  quotaListeners.forEach((fn) => fn(context));
  return true;
}

/** Сбросить «уже показано», если в хранилище снова достаточно места. */
export async function refreshStorageQuotaWarningState(): Promise<void> {
  if (await hasEnoughStorageForNewImage()) {
    shownQuotaWarnings.clear();
  }
}

function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === "QuotaExceededError" || e.code === 22 || e.code === 1014)
  );
}

export function estimateSessionStorageBytes(storage: Storage = sessionStorage): number {
  let total = 0;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key) continue;
    const val = storage.getItem(key) ?? "";
    total += (key.length + val.length) * 2;
  }
  return total;
}

export async function getBrowserStorageEstimate(): Promise<{
  used: number;
  quota: number;
  remaining: number;
}> {
  if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      const quota = est.quota ?? DEFAULT_QUOTA;
      const used = est.usage ?? estimateSessionStorageBytes();
      return { used, quota, remaining: Math.max(0, quota - used) };
    } catch {
      /* fallback below */
    }
  }
  const used = typeof sessionStorage !== "undefined" ? estimateSessionStorageBytes() : 0;
  const quota = DEFAULT_QUOTA;
  return { used, quota, remaining: Math.max(0, quota - used) };
}

export async function hasEnoughStorageForNewImage(): Promise<boolean> {
  const { remaining } = await getBrowserStorageEstimate();
  return remaining >= MIN_FREE_FOR_NEW_IMAGE;
}

export function createQuotaAwareSessionStorage(): StateStorage {
  const storage = sessionStorage;
  return {
    getItem: (name) => storage.getItem(name),
    setItem: (name, value) => {
      try {
        storage.setItem(name, value);
      } catch (e) {
        if (isQuotaError(e)) tryNotifyStorageQuotaExceeded("save-image");
        throw e;
      }
    },
    removeItem: (name) => storage.removeItem(name),
  };
}
