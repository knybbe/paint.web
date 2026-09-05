import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { AppState } from "@/app-state";
import {
  setTabletInspectorPane,
  tabletInspectorPane,
  useChromePhase,
  type TabletInspectorPane,
} from "@/ui/chrome-phase";
import { useAppEvents } from "@/ui/react/use-app";

let inspectorRoot: Root | null = null;

const PANES: { id: TabletInspectorPane; label: string }[] = [
  { id: "layers", label: "Layers" },
  { id: "colors", label: "Color" },
  { id: "history", label: "History" },
];

function TabletInspectorBar({ app }: { app: AppState }) {
  useAppEvents(app, ["windows"]);
  const phase = useChromePhase();
  if (phase !== "tablet") return null;
  const pane = tabletInspectorPane(app);
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
            onClick={() => setTabletInspectorPane(app, p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <button type="button" className="tablet-inspector-close" title="Hide inspector" onClick={() => setTabletInspectorPane(app, null)}>
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
