import { useSyncExternalStore } from "react";

export const PHONE = "(max-width: 700px)";
export const PHONE_VIEWS = ["/", "/positions", "/dashboard", "/signals"];

export function usePhone(): boolean {
  return useSyncExternalStore(
    (listener) => {
      const query = window.matchMedia(PHONE);
      query.addEventListener("change", listener);
      return () => query.removeEventListener("change", listener);
    },
    () => window.matchMedia(PHONE).matches,
  );
}

export function allowedOnPhone(path: string): boolean {
  return PHONE_VIEWS.some((view) => (view === "/" ? path === "/" : path.startsWith(view)));
}
