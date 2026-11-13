import { KeyComboTag, Tooltip } from "@blueprintjs/core";
import type { ReactElement } from "react";

export function TipText({
  label,
  about,
  combo,
}: {
  label: string;
  about?: string;
  combo?: string;
}) {
  return (
    <span className="chart-tip">
      <span className="chart-tip-head">
        {label}
        {combo ? <KeyComboTag combo={combo} minimal /> : null}
      </span>
      {about ? <span className="chart-tip-about">{about}</span> : null}
    </span>
  );
}

export function Tip({
  label,
  about,
  combo,
  placement = "bottom",
  children,
}: {
  label: string;
  about?: string;
  combo?: string;
  placement?: "bottom" | "right" | "top" | "bottom-end";
  children: ReactElement;
}) {
  return (
    <Tooltip
      placement={placement}
      hoverOpenDelay={350}
      compact
      content={<TipText label={label} about={about} combo={combo} />}
    >
      {children}
    </Tooltip>
  );
}
