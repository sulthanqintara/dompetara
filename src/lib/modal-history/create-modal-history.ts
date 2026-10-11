type ModalEntry = { id: string; url: string; close: () => void };

export function createModalHistory() {
  const key = "dompetaraModal";
  const entries: ModalEntry[] = [];
  const retired = new Map<string, string>();
  let nextId = 0;
  let scheduled = false;
  let traversing = false;
  let dismissing = false;
  let listening = false;

  // Reconcile in a microtask so Strict Mode's setup/cleanup replay cannot add
  // phantom entries, and several dialogs can close in the same React commit.
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      reconcile();
    });
  }

  function reconcile() {
    if (traversing || dismissing) return;
    const marker = window.history.state?.[key] as string | undefined;
    if (marker && retired.get(marker) === window.location.href) {
      traversing = true;
      window.history.back();
      return;
    }
    const top = entries.at(-1);
    if (top && top.url === window.location.href && marker !== top.id) {
      window.history.pushState({ ...window.history.state, [key]: top.id }, "", top.url);
    }
    if (!entries.length && !traversing) {
      window.removeEventListener("popstate", onPopState);
      listening = false;
      retired.clear();
    }
  }

  function onPopState() {
    if (traversing) {
      traversing = false;
      schedule();
      return;
    }
    const top = entries.at(-1);
    if (!top || top.url !== window.location.href || window.history.state?.[key] === top.id) return;
    dismissing = true;
    top.close();
    // Give controlled roots a render to accept (or reject) the close request.
    // A rejected close gets a new guard, keeping a pending save on this page.
    window.requestAnimationFrame(() => {
      dismissing = false;
      schedule();
    });
  }

  /** Register an open modal without changing the URL or discarding router state. */
  function register(close: () => void) {
    const entry = { id: `${Date.now()}-${++nextId}`, url: window.location.href, close };
    entries.push(entry);
    if (!listening) {
      window.addEventListener("popstate", onPopState);
      listening = true;
    }
    schedule();
    return () => {
      const index = entries.indexOf(entry);
      if (index === -1) return;
      entries.splice(index, 1);
      retired.set(entry.id, entry.url);
      schedule();
    };
  }

  return { register };
}
