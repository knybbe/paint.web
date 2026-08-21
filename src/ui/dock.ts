/**
 * Stack dock panes. If their content is taller than the dock, switch to tabs.
 * When the dock grows enough for both panes, leave tabbed mode.
 *
 * Do not use the pane body's scrollHeight while tabbed: the active pane is
 * stretched to fill the dock, so scrollHeight stays large and tabs never go away.
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
      schedule();
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
    const h = intrinsicPaneHeight(pane.host);
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
    // Tab before the dock overflows (avoids a one-frame scrollbar). Leave tabs
    // only when there is extra room so the mode does not flicker.
    const tabEarly = 36;
    const unTabSlack = 56;
    const next = tabbed
      ? !(available > needed + unTabSlack)
      : available > 32 && needed + tabEarly > available;
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

function intrinsicPaneHeight(host: HTMLElement): number {
  if (typeof getComputedStyle !== "undefined" && getComputedStyle(host).position === "fixed") return 0;
  const win = host.querySelector(".pdn-win") as HTMLElement | null;
  if (!win) return childrenExtent(host);
  const title = win.querySelector(".title") as HTMLElement | null;
  const body = win.querySelector(".body") as HTMLElement | null;
  const titleH = title?.offsetHeight ?? 0;
  const bodyH = body ? childrenExtent(body) : 0;
  return titleH + bodyH + 2;
}

/** Height of an element's children, ignoring flex stretch of the element itself. */
function childrenExtent(el: HTMLElement): number {
  if (el.offsetParent === null && getComputedStyle(el).display === "none") return 0;
  let h = 0;
  for (const child of el.children) {
    const node = child as HTMLElement;
    const style = getComputedStyle(node);
    if (style.display === "none") continue;
    h +=
      node.offsetHeight +
      (parseFloat(style.marginTop) || 0) +
      (parseFloat(style.marginBottom) || 0);
  }
  const style = getComputedStyle(el);
  h += (parseFloat(style.paddingTop) || 0) + (parseFloat(style.paddingBottom) || 0);
  return h;
}
