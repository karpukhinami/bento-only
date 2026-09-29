import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  ensureYandexMetrikaLoaded,
  initYandexMetrikaCounter,
  isHomeAnalyticsRoute,
  sendHomeInitGoal,
} from "@/lib/analytics/yandex-metrika";

/** Loads Metrika and sends init goal — only on the public home route `/`. */
export function HomeYandexMetrika() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (!isHomeAnalyticsRoute(pathname)) return;

    let cancelled = false;
    void ensureYandexMetrikaLoaded()
      .then(() => {
        if (cancelled) return;
        initYandexMetrikaCounter();
        sendHomeInitGoal(pathname);
      })
      .catch(() => {
        /* Metrika blocked or network error — ignore */
      });

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  return null;
}
