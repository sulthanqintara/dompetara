import type { ComponentProps, MouseEvent } from "react";

export default function FixtureLink({ href, onNavigate, onClick, prefetch: _prefetch, scroll: _scroll, ...props }: Omit<ComponentProps<"a">, "href"> & {
  href: string; prefetch?: boolean; scroll?: boolean; onNavigate?: () => void;
}) {
  void _prefetch;
  void _scroll;
  const click = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    event.preventDefault();
    onNavigate?.();
    // Keep a transition window so the shell's optimistic loading state can be observed.
    setTimeout(() => window.history.pushState(null, "", href), 30);
  };
  return <a {...props} href={href} onClick={click} />;
}
