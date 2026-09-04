import { useSyncExternalStore } from "react";
import type { AppState } from "@/app-state";

export function useAppEvent(app: AppState, event: string): number {
  return useSyncExternalStore(
    (onChange) => {
      const h = () => onChange();
      app.addEventListener(event, h);
      return () => app.removeEventListener(event, h);
    },
    () => app.revision,
  );
}

export function useAppEvents(app: AppState, events: readonly string[]): number {
  return useSyncExternalStore(
    (onChange) => {
      const h = () => onChange();
      for (const event of events) app.addEventListener(event, h);
      return () => {
        for (const event of events) app.removeEventListener(event, h);
      };
    },
    () => app.revision,
  );
}
