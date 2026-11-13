import { Button, ControlGroup, HTMLSelect, InputGroup } from "@blueprintjs/core";
import { useQueryClient } from "@tanstack/react-query";
import { useId, useState } from "react";
import { detail, fetchClient } from "../api/client";
import { useEnv } from "../shell/env";

export function parseQuick(
  qty: string,
  price: string,
): { qty: number; price: number | null } | null {
  const amount = Number(qty);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (!price.trim()) return { qty: amount, price: null };
  const limit = Number(price);
  return Number.isFinite(limit) && limit > 0 ? { qty: amount, price: limit } : null;
}

export function confirmedPhrase(typed: string, qty: string): boolean {
  const clean = typed.trim();
  return clean.toUpperCase() === "CONFIRM" || (clean !== "" && Number(clean) === Number(qty));
}

export function QuickOrder({
  symbol: fixed,
  mid,
  symbols = [],
  initial,
  onDone,
}: {
  symbol?: string;
  mid: number | null | undefined;
  symbols?: string[];
  initial?: { side?: "buy" | "sell"; qty?: number; price?: number };
  onDone?: () => void;
}) {
  const env = useEnv();
  const live = env !== "paper";
  const client = useQueryClient();
  const listId = useId();
  const [symbol, setSymbol] = useState(fixed ?? symbols[0] ?? "");
  const [side, setSide] = useState<"buy" | "sell">(initial?.side ?? "buy");
  const [qty, setQty] = useState(initial?.qty != null ? String(initial.qty) : "");
  const [price, setPrice] = useState(initial?.price != null ? String(initial.price) : "");
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const target = (fixed ?? symbol).trim().toUpperCase();
  const submit = async () => {
    const parsed = parseQuick(qty, price);
    if (!parsed || !target) {
      setMessage({
        ok: false,
        text: "A symbol, a positive quantity and, if any, a positive price",
      });
      return;
    }
    if (live && !confirmedPhrase(typed, qty)) {
      setMessage({ ok: false, text: "Type the quantity or CONFIRM to send on a live account" });
      return;
    }
    const body = {
      symbol: target,
      side,
      qty: parsed.qty,
      type: parsed.price == null ? ("market" as const) : ("limit" as const),
      time_in_force: target.includes("/") ? ("gtc" as const) : ("day" as const),
      limit_price: parsed.price,
      order_class: "simple" as const,
    };
    setBusy(true);
    const checked = await fetchClient.POST("/orders/check", { body });
    if (checked.data && !checked.data.allowed) {
      setBusy(false);
      setMessage({ ok: false, text: checked.data.reason ?? "Refused" });
      return;
    }
    const placed = await fetchClient.POST("/orders", { body });
    setBusy(false);
    if (placed.error) setMessage({ ok: false, text: detail(placed.error) });
    else {
      setMessage({ ok: true, text: `Sent: ${side} ${parsed.qty} ${target}` });
      setQty("");
      setTyped("");
      client.invalidateQueries();
      onDone?.();
    }
  };
  return (
    <form
      className="stack"
      style={{ gap: 4 }}
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <ControlGroup fill>
        {fixed ? null : (
          <>
            <InputGroup
              aria-label="Symbol"
              placeholder="Symbol"
              value={symbol}
              onValueChange={setSymbol}
              list={listId}
            />
            <datalist id={listId}>
              {symbols.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </>
        )}
        <HTMLSelect
          aria-label="Side"
          value={side}
          options={[
            { value: "buy", label: "Buy" },
            { value: "sell", label: "Sell" },
          ]}
          onChange={(event) => setSide(event.currentTarget.value as "buy" | "sell")}
        />
        <InputGroup aria-label="Quantity" placeholder="Qty" value={qty} onValueChange={setQty} />
        <InputGroup
          aria-label="Limit price"
          placeholder={mid ? `Limit, blank = market (${mid.toFixed(2)})` : "Limit, blank = market"}
          value={price}
          onValueChange={setPrice}
        />
        {live ? (
          <InputGroup
            aria-label="Type the quantity or CONFIRM"
            placeholder="Qty or CONFIRM"
            value={typed}
            onValueChange={setTyped}
          />
        ) : null}
        <Button type="submit" loading={busy} intent={side === "buy" ? "success" : "danger"}>
          Enter
        </Button>
      </ControlGroup>
      {live ? <span className="env env-live env-small">REAL CAPITAL</span> : null}
      {message ? <span className={message.ok ? "gain" : "loss"}>{message.text}</span> : null}
    </form>
  );
}
