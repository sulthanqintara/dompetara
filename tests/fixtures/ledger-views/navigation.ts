import { useMemo, useSyncExternalStore } from "react";

const changed = "fixture-navigation";
for (const method of ["pushState", "replaceState"] as const) {
  const original = window.history[method].bind(window.history);
  window.history[method] = (...args) => { original(...args); window.dispatchEvent(new Event(changed)); };
}
const subscribe = (listener: () => void) => {
  window.addEventListener(changed, listener);
  window.addEventListener("popstate", listener);
  return () => { window.removeEventListener(changed, listener); window.removeEventListener("popstate", listener); };
};
export function usePathname() { return useSyncExternalStore(subscribe, () => window.location.pathname); }
export function useSearchParams() {
  const search = useSyncExternalStore(subscribe, () => window.location.search);
  return useMemo(() => new URLSearchParams(search), [search]);
}
const router = {
  push: (href: string) => window.history.pushState(null, "", href),
  refresh: () => window.dispatchEvent(new Event("fixture-refresh")),
};
export function useRouter() { return router; }
