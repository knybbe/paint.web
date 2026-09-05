import { useCallback, useSyncExternalStore } from "react";
import type { AppState } from "@/app-state";

export function useAppEvent(app: AppState, event: string): number {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const h = () => onChange();
      app.addEventListener(event, h);
      return () => app.removeEventListener(event, h);
    },
    [app, event],
  );
  const getSnapshot = useCallback(() => app.revision, [app]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useAppEvents(app: AppState, events: readonly string[]): number {
  const eventsKey = events.join("\0");
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = eventsKey ? eventsKey.split("\0") : [];
      const h = () => onChange();
      for (const event of list) app.addEventListener(event, h);
      return () => {
        for (const event of list) app.removeEventListener(event, h);
      };
    },
    [app, eventsKey],
  );
  const getSnapshot = useCallback(() => app.revision, [app]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
