import { type KeyboardEvent, useCallback, useEffect, useRef } from "react";

const ITEMS = "button:not(:disabled)";

export function useToolbar(orientation: "horizontal" | "vertical") {
  const ref = useRef<HTMLDivElement>(null);
  const keys =
    orientation === "horizontal"
      ? { next: "ArrowRight", back: "ArrowLeft" }
      : { next: "ArrowDown", back: "ArrowUp" };

  const settle = useCallback((active?: HTMLElement) => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])];
    const keep = active && items.includes(active) ? active : items[0];
    for (const item of items) item.tabIndex = item === keep ? 0 : -1;
  }, []);

  useEffect(() => {
    settle();
    const observer = new MutationObserver(() => settle(document.activeElement as HTMLElement));
    if (ref.current) observer.observe(ref.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [settle]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = [...(ref.current?.querySelectorAll<HTMLElement>(ITEMS) ?? [])];
    const at = items.indexOf(document.activeElement as HTMLElement);
    if (at < 0) return;
    const target =
      event.key === keys.next
        ? items[(at + 1) % items.length]
        : event.key === keys.back
          ? items[(at - 1 + items.length) % items.length]
          : event.key === "Home"
            ? items[0]
            : event.key === "End"
              ? items.at(-1)
              : undefined;
    if (!target) return;
    event.preventDefault();
    settle(target);
    target.focus();
  };

  return {
    ref,
    onKeyDown,
    onFocus: (event: React.FocusEvent) => settle(event.target as HTMLElement),
  };
}
