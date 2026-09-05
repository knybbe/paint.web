import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { AppState } from "@/app-state";
import { useChromePhase } from "@/ui/chrome-phase";
import { useAppEvents } from "@/ui/react/use-app";

let inspectorRoot: Root | null = null;

type Pane = "layers" | "colors" | "history";

const PANES: { id: Pane; label: string }[] = [
  { id: "layers", label: "Layers" },
  { id: "colors", label: "Color" },
  { id: "history", label: "History" },
];

function activePane(app: AppState): Pane | null {
  if (app.windows.layers) return "layers";
  if (app.windows.colors) return "colors";
  if (app.windows.history) return "history";
  return null;
}

function setPane(app: AppState, pane: Pane | null): void {
  app.windows.layers = pane === "layers";
  app.windows.colors = pane === "colors";
  app.windows.history = pane === "history";
  app.notify("windows");
}

function TabletInspectorBar({ app }: { app: AppState }) {
  useAppEvents(app, ["windows"]);
  const phase = useChromePhase();
  if (phase !== "tablet") return null;
  const pane = activePane(app);
  if (!pane) return null;
  return (
    <div className="tablet-inspector-bar" data-testid="tablet-inspector-bar">
      <div className="tablet-seg">
        {PANES.map((p) => (
          <button
            key={p.id}
            type="button"
            className={pane === p.id ? "active" : ""}
            data-testid={`tablet-pane-${p.id}`}
            onClick={() => setPane(app, p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <button type="button" className="tablet-inspector-close" title="Hide inspector" onClick={() => setPane(app, null)}>
        ✕
      </button>
    </div>
  );
}

export function unmountTabletInspector(): void {
  if (inspectorRoot) {
    const root = inspectorRoot;
    inspectorRoot = null;
    flushSync(() => root.unmount());
  }
}

export function mountTabletInspector(host: HTMLElement, app: AppState): void {
  unmountTabletInspector();
  inspectorRoot = createRoot(host);
  flushSync(() => {
    inspectorRoot!.render(<TabletInspectorBar app={app} />);
  });
}
