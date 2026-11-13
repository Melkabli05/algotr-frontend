import { Alert, ContextMenu, HTMLTable, Menu, MenuItem, PopoverNext, Tag } from "@blueprintjs/core";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, detail } from "../api/client";
import type { components } from "../api/schema";
import { Th } from "../components/Explained";
import { money, quantity } from "../format";
import { useEnv } from "../shell/env";
import { useTicket } from "../shell/ticket";
import { QuickOrder } from "./QuickOrder";

type Order = components["schemas"]["Order"];

interface Rung {
  price: number;
  size: number;
  total: number;
}

type Side = "ask" | "bid";

const WORKING = ["new", "accepted", "partially_filled", "held", "pending_new"];

export function nearest(price: number, levels: number[]): number | null {
  let best: number | null = null;
  for (const level of levels)
    if (best == null || Math.abs(level - price) < Math.abs(best - price)) best = level;
  return best;
}

export function dragQuantity(rungs: Rung[], from: number, to: number): number {
  const last = Math.max(from, to);
  const first = Math.min(from, to);
  return rungs.slice(first, last + 1).reduce((sum, rung) => sum + rung.size, 0);
}

const same = (a: string, b: string) => a.replace("/", "") === b.replace("/", "");

function Ticket({
  symbol,
  side,
  price,
  qty,
  mid,
  children,
}: {
  symbol: string;
  side: "buy" | "sell";
  price: number;
  qty?: number;
  mid: number;
  children: React.ReactElement;
}) {
  return (
    <PopoverNext
      placement="left"
      content={
        <div style={{ padding: 10, width: 460 }}>
          <QuickOrder symbol={symbol} mid={mid} initial={{ side, price, qty }} />
        </div>
      }
    >
      {children}
    </PopoverNext>
  );
}

export function Ladder({
  symbol,
  asks,
  bids,
  mid,
  spread,
}: {
  symbol: string;
  asks: Rung[];
  bids: Rung[];
  mid: number;
  spread: number;
}) {
  const env = useEnv();
  const ticket = useTicket();
  const client = useQueryClient();
  const orders = api.useQuery(
    "get",
    "/orders",
    { params: { query: { limit: 100 } } },
    {
      refetchInterval: 5_000,
    },
  );
  const alert = api.useMutation("post", "/alerts/price", {
    onSuccess: () => client.invalidateQueries({ queryKey: ["get", "/alerts/settings"] }),
  });
  const change = api.useMutation("patch", "/orders/{order_id}", {
    onSuccess: () => client.invalidateQueries({ queryKey: ["get", "/orders"] }),
  });
  const [drag, setDrag] = useState<{ side: Side; from: number; to: number } | null>(null);
  const [moving, setMoving] = useState<{ order: Order; price: number } | null>(null);
  const top = [...asks].reverse();
  const levels = [...top, ...bids].map((rung) => rung.price);
  const deepest = Math.max(
    1e-12,
    ...asks.map((rung) => rung.total),
    ...bids.map((rung) => rung.total),
  );
  const working = (orders.data ?? []).filter(
    (order) => WORKING.includes(order.status) && same(order.symbol, symbol) && order.limit_price,
  );
  const at = new Map<number, Order[]>();
  for (const order of working) {
    const level = nearest(Number(order.limit_price), levels);
    if (level != null) at.set(level, [...(at.get(level) ?? []), order]);
  }
  const move = (order: Order, price: number) => {
    if (env === "paper")
      change.mutate({ params: { path: { order_id: order.id } }, body: { limit_price: price } });
    else setMoving({ order, price });
  };
  const finishDrag = () => {
    if (!drag) return;
    const rungs = drag.side === "ask" ? asks : bids;
    const qty = dragQuantity(rungs, drag.from, drag.to);
    setDrag(null);
    if (qty > 0) ticket({ symbol, side: drag.side === "ask" ? "buy" : "sell", qty, route: "twap" });
  };
  const row = (rung: Rung, side: Side, index: number) => {
    const action = side === "ask" ? "buy" : "sell";
    const selected =
      drag?.side === side &&
      index >= Math.min(drag.from, drag.to) &&
      index <= Math.max(drag.from, drag.to);
    const here = at.get(rung.price) ?? [];
    return (
      <ContextMenu
        key={`${side}${rung.price}`}
        tagName="tr"
        className={`rung ${selected ? "rung-selected" : ""}`}
        onDragOver={(event: React.DragEvent) => event.preventDefault()}
        onDrop={(event: React.DragEvent) => {
          const id = event.dataTransfer.getData("text/order");
          const order = working.find((item) => item.id === id);
          if (order && Number(order.limit_price) !== rung.price) move(order, rung.price);
        }}
        content={
          <Menu>
            <MenuItem
              icon="arrow-up"
              text={`Buy at ${money(rung.price)}`}
              onClick={() => ticket({ symbol, side: "buy", price: rung.price })}
            />
            <MenuItem
              icon="arrow-down"
              text={`Sell at ${money(rung.price)}`}
              onClick={() => ticket({ symbol, side: "sell", price: rung.price })}
            />
            <MenuItem
              icon="notifications"
              text={`Alert when ${symbol} reaches ${money(rung.price)}`}
              onClick={() =>
                alert.mutate({ body: { symbol, above: rung.price >= mid, price: rung.price } })
              }
            />
            <MenuItem
              icon="clipboard"
              text="Copy price"
              onClick={() => navigator.clipboard?.writeText(String(rung.price))}
            />
          </Menu>
        }
      >
        <td className={side === "ask" ? "loss" : "gain"}>
          <Ticket symbol={symbol} side={action} price={rung.price} mid={mid}>
            <button type="button" className="rung-button">
              {money(rung.price)}
            </button>
          </Ticket>
        </td>
        <td>
          <Ticket symbol={symbol} side={action} price={rung.price} qty={rung.size} mid={mid}>
            <button type="button" className="rung-button">
              {quantity(rung.size)}
            </button>
          </Ticket>
        </td>
        <td>{quantity(rung.total)}</td>
        <td
          className="depth-cell"
          onMouseDown={() => setDrag({ side, from: index, to: index })}
          onMouseEnter={() => drag?.side === side && setDrag({ ...drag, to: index })}
          onMouseUp={finishDrag}
          title="Drag across levels to slice that much as a TWAP"
        >
          <span
            className={`depth-bar depth-${side}`}
            style={{ width: `${(rung.total / deepest) * 100}%` }}
          />
        </td>
        <td>
          {here.map((order) => (
            <Tag
              key={order.id}
              minimal
              interactive
              intent={order.side === "buy" ? "success" : "danger"}
              draggable
              onDragStart={(event: React.DragEvent) =>
                event.dataTransfer.setData("text/order", order.id)
              }
              title="Drag to another level to move this order"
            >
              {order.side} {quantity(order.qty ?? 0)}
            </Tag>
          ))}
        </td>
      </ContextMenu>
    );
  };
  return (
    <>
      <HTMLTable
        compact
        className="num ladder"
        style={{ width: "100%" }}
        onMouseLeave={() => setDrag(null)}
      >
        <thead>
          <tr>
            <Th>Price</Th>
            <Th>Size</Th>
            <Th>Total</Th>
            <Th>Depth</Th>
            <Th>Mine</Th>
          </tr>
        </thead>
        <tbody>
          {top.map((rung, index) => row(rung, "ask", top.length - 1 - index))}
          <tr>
            <td colSpan={5} className="muted">
              Mid {money(mid)} · spread {spread.toFixed(2)} bps
            </td>
          </tr>
          {bids.map((rung, index) => row(rung, "bid", index))}
        </tbody>
      </HTMLTable>
      {change.isError ? <p className="loss">{detail(change.error)}</p> : null}
      <Alert
        isOpen={Boolean(moving)}
        intent="danger"
        icon="lock"
        confirmButtonText="Move the order"
        cancelButtonText="Keep it"
        onCancel={() => setMoving(null)}
        onConfirm={() => {
          if (moving)
            change.mutate({
              params: { path: { order_id: moving.order.id } },
              body: { limit_price: moving.price },
            });
          setMoving(null);
        }}
      >
        <p>
          Move the live {moving?.order.side} order of {quantity(moving?.order.qty ?? 0)} {symbol}{" "}
          from {money(Number(moving?.order.limit_price))} to {money(moving?.price)}?
        </p>
      </Alert>
    </>
  );
}
