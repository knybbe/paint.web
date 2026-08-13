import "./styles/app.css";
import { AppState } from "./app-state";
import { mountShell } from "./ui/shell";
import { bindShortcuts } from "./shortcuts";
import { registerSW } from "virtual:pwa-register";

const root = document.getElementById("app");
if (!root) throw new Error("#app missing");

const app = new AppState();

async function boot(): Promise<void> {
  await app.init();
  mountShell(root!, app);
  bindShortcuts(app);
  (window as unknown as { __PAINT_APP__: AppState }).__PAINT_APP__ = app;
  root!.dataset.ready = "1";
}

void boot();

const persistNow = (): void => {
  void app.flushPersist();
};
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") persistNow();
});
window.addEventListener("pagehide", persistNow);

window.addEventListener("beforeunload", persistNow);

window.addEventListener("dragover", (e) => {
  e.preventDefault();
});
window.addEventListener("drop", (e) => {
  e.preventDefault();
  const files = Array.from(e.dataTransfer?.files ?? []);
  if (files.length) void app.openFiles(files);
});

if ("launchQueue" in window) {
  const lq = (window as unknown as { launchQueue: { setConsumer: (cb: (p: { files: { getFile: () => Promise<File> }[] }) => void) => void } }).launchQueue;
  lq.setConsumer((params) => {
    void (async () => {
      const files: File[] = [];
      for (const h of params.files) files.push(await h.getFile());
      if (files.length) await app.openFiles(files);
    })();
  });
}

registerSW({
  immediate: true,
  onRegisteredSW() {
    app.statusMessage = "Offline-ready";
    app.notify("status");
  },
  onOfflineReady() {
    app.statusMessage = "Ready to work offline";
    app.notify("status");
  },
});

