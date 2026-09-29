/** Yandex Metrika + dataLayer helpers (home route `/` only). */

export const YANDEX_METRIKA_COUNTER_ID = 108472990;

const METRIKA_SCRIPT_SRC = `https://mc.yandex.ru/metrika/tag.js?id=${YANDEX_METRIKA_COUNTER_ID}`;
const INIT_GOAL_SESSION_KEY = "aig_metrika_init_sent";

declare global {
  interface Window {
    ym?: (counterId: number, method: string, ...args: unknown[]) => void;
    dataLayer?: Record<string, unknown>[];
  }
}

/** Analytics fire only on the public home page, not view_all / workspace / admin pages. */
export function isHomeAnalyticsRoute(pathname: string): boolean {
  return pathname === "/";
}

function compactPayload(payload: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "string" && value.trim() === "") continue;
    out[key] = value;
  }
  return out;
}

let metrikaLoadPromise: Promise<void> | null = null;

export function ensureYandexMetrikaLoaded(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (typeof window.ym === "function") return Promise.resolve();

  if (!metrikaLoadPromise) {
    metrikaLoadPromise = new Promise<void>((resolve, reject) => {
      for (const script of document.scripts) {
        if (script.src === METRIKA_SCRIPT_SRC) {
          resolve();
          return;
        }
      }

      const stub = (...args: unknown[]) => {
        (stub.a = stub.a || []).push(args);
      };
      stub.a = [] as unknown[];
      stub.l = Date.now();
      window.ym = stub as Window["ym"];

      const tag = document.createElement("script");
      tag.async = true;
      tag.src = METRIKA_SCRIPT_SRC;
      tag.onload = () => resolve();
      tag.onerror = () => reject(new Error("Failed to load Yandex Metrika"));
      document.head.appendChild(tag);
    });
  }

  return metrikaLoadPromise;
}

export function initYandexMetrikaCounter(): void {
  if (typeof window === "undefined" || typeof window.ym !== "function") return;
  window.dataLayer = window.dataLayer || [];
  window.ym(YANDEX_METRIKA_COUNTER_ID, "init", {
    ssr: true,
    webvisor: true,
    clickmap: true,
    ecommerce: "dataLayer",
    referrer: document.referrer,
    url: location.href,
    accurateTrackBounce: true,
    trackLinks: true,
  });
}

export function sendReachGoal(
  pathname: string,
  goalSlug: string,
  payload: Record<string, unknown> = {},
): void {
  if (!isHomeAnalyticsRoute(pathname)) return;
  if (typeof window === "undefined") return;

  const inner = compactPayload(payload);
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: goalSlug, ...inner });

  if (typeof window.ym === "function") {
    window.ym(YANDEX_METRIKA_COUNTER_ID, "reachGoal", goalSlug, { [goalSlug]: inner });
  }
}

export function sendHomeInitGoal(pathname: string): void {
  if (!isHomeAnalyticsRoute(pathname)) return;
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem(INIT_GOAL_SESSION_KEY) === "1") return;

  sendReachGoal(pathname, "aig_infographic_generator_init", {
    page_path: pathname,
    entry_url: window.location.href,
  });
  sessionStorage.setItem(INIT_GOAL_SESSION_KEY, "1");
}
