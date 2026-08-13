/**
 * Stack dock panes. If their *content* is taller than the dock, switch to tabs.
 * Measuring dock.scrollHeight fails because pane bodies use min-height:0 and
 * scroll internally, so the dock itself never overflows.
 */
export function mountAdaptiveDock(
  dock: HTMLElement,
  panes: { id: string; label: string; host: HTMLElement }[],
): void {
  dock.classList.add("adaptive-dock");
  const bar = document.createElement("div");
  bar.className = "dock-tabs";
  bar.dataset.testid = `dock-tabs-${dock.classList.contains("left") ? "left" : "right"}`;
  bar.hidden = true;
  let active = panes[0]?.id ?? "";
  const cached = new Map<string, number>();
  let measuring = false;
  let tabbed = false;

  for (const pane of panes) {
    pane.host.classList.add("dock-pane");
    pane.host.dataset.pane = pane.id;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dock-tab";
    btn.dataset.pane = pane.id;
    btn.dataset.testid = `dock-tab-${pane.id}`;
    btn.textContent = pane.label;
    btn.addEventListener("click", () => {
      active = pane.id;
      apply(true);
    });
    bar.append(btn);
  }
  dock.prepend(bar);

  const apply = (next: boolean): void => {
    tabbed = next;
    dock.classList.toggle("tabbed", next);
    bar.hidden = !next;
    for (const pane of panes) {
      pane.host.classList.toggle("dock-pane-active", !next || pane.id === active);
    }
    for (const btn of bar.querySelectorAll<HTMLButtonElement>(".dock-tab")) {
      btn.classList.toggle("active", btn.dataset.pane === active);
    }
  };

  const paneContentHeight = (pane: { id: string; host: HTMLElement }): number => {
    const hidden = tabbed && pane.id !== active;
    if (hidden) return cached.get(pane.id) ?? 0;
    const win = pane.host.querySelector(".pdn-win") as HTMLElement | null;
    let h: number;
    if (win) {
      const title = win.querySelector(".title") as HTMLElement | null;
      const body = win.querySelector(".body") as HTMLElement | null;
      h = (title?.offsetHeight ?? 0) + (body?.scrollHeight ?? win.scrollHeight) + 2;
    } else {
      h = pane.host.scrollHeight;
    }
    if (h > 0) cached.set(pane.id, h);
    return h || cached.get(pane.id) || 0;
  };

  const measure = (): void => {
    if (measuring) return;
    measuring = true;
    const available = dock.clientHeight;
    const gap = 4;
    const pad = 8;
    const needed =
      panes.reduce((sum, pane) => sum + paneContentHeight(pane), 0) + gap * Math.max(0, panes.length - 1) + pad;
    const next = available > 32 && needed > available + 4;
    apply(next);
    measuring = false;
  };

  let raf = 0;
  const schedule = (): void => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(measure);
  };

  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(() => {
      if (!measuring) schedule();
    });
    ro.observe(dock);
  }
  window.addEventListener("resize", schedule);
  schedule();
}
