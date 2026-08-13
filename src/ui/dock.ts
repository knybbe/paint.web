/** Stack dock panes, then switch to tabs if they overflow vertically. */
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

  const apply = (tabbed: boolean): void => {
    dock.classList.toggle("tabbed", tabbed);
    bar.hidden = !tabbed;
    for (const pane of panes) {
      pane.host.classList.toggle("dock-pane-active", !tabbed || pane.id === active);
    }
    for (const btn of bar.querySelectorAll<HTMLButtonElement>(".dock-tab")) {
      btn.classList.toggle("active", btn.dataset.pane === active);
    }
  };

  const measure = (): void => {
    apply(false);
    const overflow = dock.clientHeight > 0 && dock.scrollHeight > dock.clientHeight + 2;
    apply(overflow);
  };

  let raf = 0;
  const schedule = (): void => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(measure);
  };

  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(schedule);
    ro.observe(dock);
    for (const pane of panes) ro.observe(pane.host);
  }
  window.addEventListener("resize", schedule);
  schedule();
}
