import { Button, Callout, HTMLTable, NumericInput, Tag } from "@blueprintjs/core";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, detail } from "../api/client";
import { Th } from "../components/Explained";
import { money, quantity, time } from "../format";

export function Reconciliation() {
  const client = useQueryClient();
  const status = api.useQuery("get", "/ledger/status", undefined, { refetchInterval: 60_000 });
  const done = { onSuccess: () => client.invalidateQueries() };
  const sync = api.useMutation("post", "/ledger/sync", done);
  const adopt = api.useMutation("post", "/ledger/adopt/{symbol}", done);
  const found = status.data?.reconciliation;
  return (
    <section className="panel stack">
      <div className="row">
        <h2 className="panel-title grow">Ledger against Alpaca</h2>
        {found ? (
          <Tag minimal intent={found.ok ? "success" : "danger"}>
            {found.ok ? "matches" : `${found.differences.length} differences`}
          </Tag>
        ) : null}
        <span className="muted num">
          {status.data?.activities ?? 0} activities
          {status.data?.synced ? ` · synced ${time(status.data.synced)}` : ""}
        </span>
        <Button small icon="refresh" loading={sync.isPending} onClick={() => sync.mutate({})}>
          Sync
        </Button>
      </div>
      {status.data?.error ? (
        <Callout intent="warning" compact>
          Last sync failed: {status.data.error}
        </Callout>
      ) : null}
      {found && !found.ok ? (
        <HTMLTable compact striped>
          <thead>
            <tr>
              <Th>Symbol</Th>
              <Th>Ledger</Th>
              <Th>Alpaca</Th>
              <Th>Note</Th>
              <th />
            </tr>
          </thead>
          <tbody>
            {found.differences.map((item) => (
              <tr key={`${item.symbol}-${item.kind}`}>
                <td>{item.symbol}</td>
                <td className="num">
                  {quantity(item.ledger_qty)} · {money(item.ledger_cost)}
                </td>
                <td className="num">
                  {quantity(item.broker_qty)} · {money(item.broker_cost)}
                </td>
                <td className="muted">{item.note}</td>
                <td>
                  {item.kind === "pending" ? null : (
                    <Button
                      small
                      loading={adopt.isPending}
                      onClick={() => adopt.mutate({ params: { path: { symbol: item.symbol } } })}
                    >
                      Match Alpaca
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
      ) : null}
      {sync.error || adopt.error ? (
        <Callout intent="danger" compact>
          {detail(sync.error ?? adopt.error)}
        </Callout>
      ) : null}
    </section>
  );
}

export function LotPicks({ orderId, symbol }: { orderId: string; symbol: string }) {
  const client = useQueryClient();
  const lots = api.useQuery("get", "/ledger/lots", {
    params: { query: { method: "fifo", symbol } },
  });
  const picks = api.useQuery("get", "/ledger/picks/{order_id}", {
    params: { path: { order_id: orderId } },
  });
  const [chosen, setChosen] = useState<Record<string, number>>({});
  useEffect(() => {
    setChosen(Object.fromEntries((picks.data?.lots ?? []).map((pick) => [pick.lot, pick.qty])));
  }, [picks.data]);
  const done = {
    onSuccess: () => client.invalidateQueries({ queryKey: ["get", "/ledger/picks/{order_id}"] }),
  };
  const save = api.useMutation("put", "/ledger/picks/{order_id}", done);
  const clear = api.useMutation("delete", "/ledger/picks/{order_id}", done);
  const path = { params: { path: { order_id: orderId } } };
  const body = {
    lots: Object.entries(chosen)
      .filter(([, qty]) => qty > 0)
      .map(([lot, qty]) => ({ lot, qty })),
  };
  return (
    <section className="stack">
      <h3 className="panel-title">Lots this sell closes</h3>
      <HTMLTable compact striped className="num">
        <thead>
          <tr>
            <Th>Opened</Th>
            <Th>Open qty</Th>
            <Th>Unit cost</Th>
            <Th>Close</Th>
          </tr>
        </thead>
        <tbody>
          {(lots.data ?? []).map((lot) => (
            <tr key={lot.id}>
              <td>{time(lot.opened)}</td>
              <td>{quantity(lot.qty)}</td>
              <td>{money(lot.unit_cost)}</td>
              <td>
                <NumericInput
                  small
                  min={0}
                  max={lot.qty}
                  style={{ width: 80 }}
                  aria-label={`Close from the lot opened ${time(lot.opened)}`}
                  value={chosen[lot.id] ?? 0}
                  onValueChange={(value) =>
                    setChosen({ ...chosen, [lot.id]: Number.isFinite(value) ? value : 0 })
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </HTMLTable>
      <div className="row">
        <span className="muted grow">Lots not chosen close first in, first out.</span>
        <Button
          small
          disabled={!picks.data?.lots.length}
          loading={clear.isPending}
          onClick={() => clear.mutate(path)}
        >
          Clear
        </Button>
        <Button
          small
          intent="primary"
          disabled={!body.lots.length}
          loading={save.isPending}
          onClick={() => save.mutate({ ...path, body })}
        >
          Save picks
        </Button>
      </div>
      {save.error ? (
        <Callout intent="danger" compact>
          {detail(save.error)}
        </Callout>
      ) : null}
    </section>
  );
}
