import { Tooltip } from "@blueprintjs/core";
import type { ReactNode, ThHTMLAttributes } from "react";
import { explain } from "../glossary";

function textOf(children: ReactNode): string {
  if (typeof children === "string" || typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(textOf).join("");
  return "";
}

export function Explained({ children, text }: { children: ReactNode; text?: string }) {
  const tip = text ?? explain(textOf(children));
  if (!tip) return <>{children}</>;
  return (
    <Tooltip
      content={<span className="tip">{tip}</span>}
      placement="auto"
      hoverOpenDelay={250}
      compact
    >
      {/* biome-ignore lint/a11y/noNoninteractiveTabindex: the tooltip opens on keyboard focus */}
      <span className="explained" tabIndex={0}>
        {children}
      </span>
    </Tooltip>
  );
}

export function PanelTitle({ children, text }: { children: ReactNode; text?: string }) {
  return (
    <h2 className="panel-title">
      <Explained text={text}>{children}</Explained>
    </h2>
  );
}

export function Th({
  children,
  text,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { children: ReactNode; text?: string }) {
  return (
    <th {...rest}>
      <Explained text={text}>{children}</Explained>
    </th>
  );
}
