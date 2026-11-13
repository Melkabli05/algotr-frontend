import { KeyComboTag, Tooltip } from "@blueprintjs/core";
import type { ReactElement } from "react";

export function HotkeyTip({ combo, children }: { combo: string; children: ReactElement }) {
  return (
    <Tooltip content={<KeyComboTag combo={combo} minimal />} compact hoverOpenDelay={300}>
      {children}
    </Tooltip>
  );
}
