import type { ReactNode } from "react";
import { Explained } from "./Explained";

interface Props {
  label: string;
  value: ReactNode;
  tone?: "gain" | "loss" | "flat";
  lead?: boolean;
  note?: ReactNode;
}

export function Figure({ label, value, tone, lead, note }: Props) {
  return (
    <div className={lead ? "figure figure-lead" : "figure"}>
      <span className="figure-label">
        <Explained>{label}</Explained>
      </span>
      <span className={`figure-value ${tone && tone !== "flat" ? tone : ""}`}>{value}</span>
      {note ? <span className="figure-label">{note}</span> : null}
    </div>
  );
}
