import { FormGroup, HTMLTable, NumericInput } from "@blueprintjs/core";
import { useState } from "react";
import { api } from "../api/client";
import { money, percent, quantity } from "../format";

export function sharesFor(target: number, value: number, price: number, equity: number): number {
  if (price <= 0 || equity <= 0) return 0;
  return (target * equity - value) / price;
}

export function weightAfter(shares: number, value: number, price: number, equity: number): number {
  return equity > 0 ? (value + shares * price) / equity : 0;
}

function Effect({ symbol, shares, price }: { symbol: string; shares: number; price: number }) {
  const found = api.useQuery(
    "post",
    "/risk/what-if",
    {
      body: {
        symbol:
          symbol.endsWith("USD") && !symbol.includes("/") ? `${symbol.slice(0, -3)}/USD` : symbol,
        side: shares >= 0 ? "buy" : "sell",
        qty: Math.abs(shares),
        price,
      },
    },
    { retry: false },
  );
  if (!found.data)
    return found.isFetching ? <span className="muted">Working out the effect…</span> : null;
  return (
    <HTMLTable compact className="num">
      <tbody>
        {found.data.changes
          .filter((change) => change.unit !== "dollars")
          .map((change) => (
            <tr key={change.name}>
              <td>{change.name}</td>
              <td>
                {change.before == null ? "—" : percent(change.before, 1)} →{" "}
                {change.after == null ? "—" : percent(change.after, 1)}
                {change.cap != null ? (
                  <span className="muted">
                    {" "}
                    ({change.after != null ? percent(change.after / change.cap, 0) : "—"} of the
                    limit)
                  </span>
                ) : null}
              </td>
            </tr>
          ))}
      </tbody>
    </HTMLTable>
  );
}

export function Sizing({
  symbol,
  value,
  price,
  equity,
  whole,
}: {
  symbol: string;
  value: number;
  price: number;
  equity: number;
  whole: boolean;
}) {
  const [target, setTarget] = useState<number | null>(null);
  const [shares, setShares] = useState<number | null>(null);
  const needed = target == null ? null : sharesFor(target / 100, value, price, equity);
  const rounded = needed == null ? null : whole ? Math.trunc(needed) : needed;
  return (
    <section className="stack" style={{ gap: 6 }}>
      <h3 className="panel-title">Sizing</h3>
      <div className="settings-fields">
        <FormGroup label="Target weight" labelInfo="%" labelFor="size-target">
          <NumericInput
            id="size-target"
            small
            fill
            min={0}
            max={100}
            value={target ?? ""}
            onValueChange={(next) => setTarget(Number.isFinite(next) ? next : null)}
          />
        </FormGroup>
        <FormGroup label="Or shares to add" labelInfo="negative sells" labelFor="size-shares">
          <NumericInput
            id="size-shares"
            small
            fill
            value={shares ?? ""}
            onValueChange={(next) => setShares(Number.isFinite(next) ? next : null)}
          />
        </FormGroup>
      </div>
      {rounded != null ? (
        <p className="num" style={{ margin: 0 }}>
          To reach {target}% of the account, {rounded >= 0 ? "buy" : "sell"}{" "}
          {quantity(Math.abs(rounded))} {symbol} (about {money(Math.abs(rounded) * price)}).
        </p>
      ) : null}
      {shares != null ? (
        <p className="num" style={{ margin: 0 }}>
          {shares >= 0 ? "Buying" : "Selling"} {quantity(Math.abs(shares))} makes {symbol}{" "}
          {percent(weightAfter(shares, value, price, equity), 1)} of the account (about{" "}
          {money(Math.abs(shares) * price)}).
        </p>
      ) : null}
      {shares ? <Effect symbol={symbol} shares={shares} price={price} /> : null}
      <span className="muted">
        At {money(price)} and an account of {money(equity)}.
      </span>
    </section>
  );
}
