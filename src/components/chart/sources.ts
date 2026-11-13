import type { components } from "../../api/schema";
import { money, percent, quantity, signedMoney, signedPercent, time } from "../../format";
import type { Candle } from "../PriceChart";
import type { Marker } from "./markers";
import { extra } from "./rule";

export type Trace = components["schemas"]["Trace"];
export type Fill = components["schemas"]["FillRow"];
export type Closed = components["schemas"]["CloseRow"];
export type Cost = components["schemas"]["app__features__tca__service__Trade"];

export const dayMs = (day: string) => Date.parse(`${day}T00:00:00Z`);

export function traceCandles(trace: Trace): Candle[] {
  return trace.bars.map((bar) => {
    const found: Record<string, number | null> = {
      [extra.held]: bar.held,
      [extra.target]: bar.target,
    };
    for (const [name, number] of Object.entries(bar.lines))
      found[extra.line(name)] = number ?? null;
    for (const [name, number] of Object.entries(bar.values))
      found[extra.value(name)] = number ?? null;
    return {
      time: `${bar.day}T00:00:00Z`,
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      extra: found,
    };
  });
}

export function traceMarkers(trace: Trace): Marker[] {
  const at = trace.fills === "close" ? "close" : "open";
  return trace.trades.flatMap((trade, index) => {
    const entry: Marker = {
      id: `entry-${index}`,
      time: dayMs(trade.entry),
      price: trade.entry_price,
      side: "buy",
      title: `Entry ${index + 1}`,
      lines: [
        trade.entry,
        `Filled ${money(trade.entry_price)} at the ${at}`,
        trade.why_entry,
        `Held ${trade.days} days at ${percent(trade.weight, 0)} of capital`,
        ...(trade.open ? [`Open, ${signedPercent(trade.gain)} so far`] : []),
      ],
    };
    if (!trade.exit || trade.exit_price == null) return [entry];
    const exit: Marker = {
      id: `exit-${index}`,
      time: dayMs(trade.exit),
      price: trade.exit_price,
      side: "sell",
      title: `Exit ${index + 1}`,
      lines: [
        trade.exit,
        `Filled ${money(trade.exit_price)} at the ${at}`,
        ...(trade.why_exit ? [trade.why_exit] : []),
        `${signedPercent(trade.gain)} on the price, ${trade.days} days`,
      ],
    };
    return [entry, exit];
  });
}

export function fillMarkers(
  fills: Fill[],
  closed: Closed[],
  costs: Cost[],
  snap: (ms: number) => number,
): Marker[] {
  const gains = new Map<string, number>();
  for (const row of closed) gains.set(row.order, (gains.get(row.order) ?? 0) + row.gain);
  const paid = new Map(costs.map((cost) => [cost.order, cost]));
  const groups = new Map<string, Fill[]>();
  for (const fill of fills) {
    const key = `${snap(Date.parse(fill.time))}:${fill.side}`;
    groups.set(key, [...(groups.get(key) ?? []), fill]);
  }
  return [...groups.entries()].map(([key, items]) => {
    const [first] = items;
    const stamp = Number(key.split(":")[0]);
    const qty = items.reduce((sum, item) => sum + item.qty, 0);
    const value = items.reduce((sum, item) => sum + item.value, 0);
    const orders = [...new Set(items.map((item) => item.order))];
    const gain = orders.reduce<number | null>(
      (sum, order) => (gains.has(order) ? (sum ?? 0) + (gains.get(order) ?? 0) : sum),
      null,
    );
    const cost = orders.length === 1 ? paid.get(orders[0] ?? "") : undefined;
    const when = items.map((item) => Date.parse(item.time));
    const single = items.length === 1;
    return {
      id: key,
      time: stamp,
      price: qty ? value / qty : (first?.price ?? 0),
      side: first?.side ?? "buy",
      title: `${first?.side === "sell" ? "Sold" : "Bought"} ${quantity(qty)} ${first?.symbol ?? ""}`,
      lines: [
        single
          ? `${money(first?.price)} · ${money(value)}${first?.partial ? " · partial fill" : ""}`
          : `${items.length} fills in ${orders.length} order${orders.length === 1 ? "" : "s"}, average ${money(value / qty)}`,
        single
          ? time(first?.time ?? "")
          : `${time(new Date(Math.min(...when)))} to ${time(new Date(Math.max(...when)))}`,
        ...(cost?.decision != null ? [`Decided at ${money(cost.decision)}`] : []),
        ...(cost?.arrival != null ? [`Arrived at ${money(cost.arrival)}`] : []),
        ...(cost?.shortfall_bps != null ? [`Shortfall ${cost.shortfall_bps.toFixed(1)} bps`] : []),
        ...(cost?.seconds_to_fill != null
          ? [`Filled in ${cost.seconds_to_fill.toFixed(0)} s`]
          : []),
        ...(gain != null ? [`Closed lots ${signedMoney(gain)}`] : []),
        ...(orders.length === 1 ? [`Order ${orders[0]?.slice(0, 8)}`] : []),
      ],
    };
  });
}
