import type { components } from "../api/schema";

export type Explanations = components["schemas"]["AgentExplanations"];
export type Decision = components["schemas"]["Decision"];

export const FEATURES: Record<string, string> = {
  ret_1: "1-day return",
  ret_5: "5-day return",
  ret_20: "20-day return",
  ret_60: "60-day return",
  vol_20: "20-day volatility",
  macd: "MACD",
  boll: "Bollinger position",
  rsi: "RSI",
  cci: "CCI",
  dx: "Trend strength (DX)",
  sma_30: "Price vs 30-day average",
  sma_60: "Price vs 60-day average",
  held: "Weights already held",
  sentiment: "Headline sentiment",
  news_risk: "Headline risk",
};

export const nameOf = (group: string): string => FEATURES[group] ?? group;

export interface Signal {
  key: string;
  algorithm: string;
  decided: string;
  symbol: string;
  weight: number;
  change: number | null;
  direction: "Buy" | "Sell" | "Hold";
  confidence?: number | null;
  decision: Decision;
}

const MOVE = 0.02;

export function signalsOf(found: Explanations): Signal[] {
  const ordered = [...found.decisions].sort((a, b) => a.decided.localeCompare(b.decided));
  const signals: Signal[] = [];
  ordered.forEach((decision, index) => {
    const before = ordered[index - 1];
    for (const symbol of found.assets.filter((asset) => asset !== "cash")) {
      const weight = decision.weights[symbol] ?? 0;
      const previous = before ? (before.weights[symbol] ?? 0) : null;
      const change = previous == null ? null : weight - previous;
      const direction =
        change == null || Math.abs(change) < MOVE ? "Hold" : change > 0 ? "Buy" : "Sell";
      signals.push({
        key: `${found.algorithm}-${decision.decided}-${symbol}`,
        algorithm: found.algorithm,
        decided: decision.decided,
        symbol,
        weight,
        change,
        direction,
        decision,
      });
    }
  });
  return signals.reverse();
}

export interface Bar {
  label: string;
  start: number;
  end: number;
  value: number;
}

export function waterfall(decision: Decision, symbol: string, limit = 8): Bar[] {
  const pushes = Object.entries(decision.values)
    .map(([group, values]) => ({ group, value: values[symbol] ?? 0 }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  const shown = pushes.slice(0, limit);
  const rest = pushes.slice(limit).reduce((sum, item) => sum + item.value, 0);
  const bars: Bar[] = [];
  let level = decision.base[symbol] ?? 0;
  for (const item of shown) {
    bars.push({
      label: nameOf(item.group),
      start: level,
      end: level + item.value,
      value: item.value,
    });
    level += item.value;
  }
  if (Math.abs(rest) > 1e-9) {
    bars.push({
      label: `${pushes.length - limit} other features`,
      start: level,
      end: level + rest,
      value: rest,
    });
  }
  return bars;
}

export const MIN_HISTORY = 10;

export function percentile(values: number[], value: number): number | null {
  if (values.length < MIN_HISTORY) return null;
  const below = values.filter((item) => item < value).length;
  const equal = values.filter((item) => item === value).length;
  return (below + equal / 2) / values.length;
}

export function narrative(signal: Signal, explanations: Explanations): string {
  const { decision, symbol } = signal;
  const pushes = Object.entries(decision.values)
    .map(([group, values]) => ({ group, value: values[symbol] ?? 0 }))
    .sort((a, b) => b.value - a.value);
  const up = pushes.filter((item) => item.value > 0.01).slice(0, 2);
  const down = pushes
    .filter((item) => item.value < -0.01)
    .slice(-2)
    .reverse();
  const share = (value: number) => `${(value * 100).toFixed(1)}%`;
  const points = (value: number) =>
    `${value >= 0 ? "+" : "−"}${Math.abs(value * 100).toFixed(1)} points`;
  const verb = signal.direction === "Buy" ? "raised" : signal.direction === "Sell" ? "cut" : "kept";
  let text = `On ${decision.decided} ${explanations.algorithm.toUpperCase()} ${verb} ${symbol} to ${share(signal.weight)}, against an average of ${share(decision.base[symbol] ?? 0)}.`;
  if (up.length)
    text += ` Pushed up by ${up.map((item) => `${nameOf(item.group).toLowerCase()} (${points(item.value)})`).join(" and ")}.`;
  if (down.length)
    text += ` Held back by ${down.map((item) => `${nameOf(item.group).toLowerCase()} (${points(item.value)})`).join(" and ")}.`;
  return text;
}
