import { useEffect, useRef, useSyncExternalStore } from "react";

export type Command = "halt" | "cancel-all" | "cancel-selected" | "flatten-selected" | "palette";

export function emit(command: Command): void {
  window.dispatchEvent(new CustomEvent(`algotr:${command}`));
}

export function useCommand(command: Command, handler: () => void): void {
  const latest = useRef(handler);
  latest.current = handler;
  useEffect(() => {
    const listener = () => latest.current();
    window.addEventListener(`algotr:${command}`, listener);
    return () => window.removeEventListener(`algotr:${command}`, listener);
  }, [command]);
}

let focused = "SPUS";
const listeners = new Set<() => void>();

export function focusSymbol(symbol: string): void {
  if (!symbol || symbol === focused) return;
  focused = symbol;
  for (const listener of listeners) listener();
}

export function useFocusedSymbol(): string {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => focused,
  );
}
