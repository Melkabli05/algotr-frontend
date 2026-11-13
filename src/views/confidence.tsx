import { Tag } from "@blueprintjs/core";
import { api } from "../api/client";
import type { Signal } from "./xai";

export type Confidence = Record<string, Record<string, Record<string, number>>>;

export function useConfidence(): Confidence {
  const options = { staleTime: 300_000, retry: false };
  const ppo = api.useQuery(
    "get",
    "/systematic/agents/{algorithm}/confidence",
    { params: { path: { algorithm: "ppo" } } },
    options,
  );
  const sac = api.useQuery(
    "get",
    "/systematic/agents/{algorithm}/confidence",
    { params: { path: { algorithm: "sac" } } },
    options,
  );
  const a2c = api.useQuery(
    "get",
    "/systematic/agents/{algorithm}/confidence",
    { params: { path: { algorithm: "a2c" } } },
    options,
  );
  return { ppo: ppo.data ?? {}, sac: sac.data ?? {}, a2c: a2c.data ?? {} };
}

export function confidenceOf(
  found: Confidence,
  signal: Pick<Signal, "algorithm" | "decided" | "symbol">,
): number | null {
  return found[signal.algorithm]?.[signal.decided]?.[signal.symbol] ?? null;
}

export function intentOf(value: number | null): "success" | "warning" | "none" {
  if (value == null) return "none";
  return value >= 0.8 ? "success" : value >= 0.6 ? "warning" : "none";
}

export function ConfidenceBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="muted">—</span>;
  return (
    <Tag
      minimal
      intent={intentOf(value)}
      title="Share of 256 draws from the agent's own policy that make this move"
    >
      {value.toFixed(2)}
    </Tag>
  );
}
