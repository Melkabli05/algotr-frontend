import { OverlayToaster, type Toaster } from "@blueprintjs/core";

let found: Promise<Toaster> | undefined;

export function toaster(): Promise<Toaster> {
  found ??= OverlayToaster.create({ position: "bottom-right" });
  return found;
}
