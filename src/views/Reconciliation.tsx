import { Button, Callout, HTMLTable, Tag } from "@blueprintjs/core";
import { useQueryClient } from "@tanstack/react-query";
import { api, detail } from "../api/client";
import { Explained, Th } from "../components/Explained";
import { Loadable } from "../components/Loadable";
import { money, quantity, signedMoney, time } from "../format";
import { page } from "../glossary";

const STATE = {
  match: { intent: "success", label: "in sync" },
  pending: { intent: "warning", label: "fee pending" },
  cost: { intent: "warning", label: "cost differs" },
  quantity: { intent: "danger", label: "quantity differs" },
  orphan: { intent: "danger", label: "orphan: only in the ledger" },
  zombie: { intent: "danger", label: "zombie: only at Alpaca" },
} as const;

const TRIGGER = {
  scheduled: "on the 10-minute schedule",
  fill: "after a fill",
  manual: "by hand",
} as const;

export function Reconciliation() {
  const client = useQueryClient();
  const found = api.useQuery("get", "/ledger/comparison", undefined, { refetchInterval: 30_000 });
  const done = { onSuccess: () => client.invalidateQueries() };
  const sync = api.useMutation("post", "/ledger/sync", done);
  const adopt = api.useMutation("post", "/ledger/adopt/{symbol}", done);
  const data = found.data;
  const rows = [...(data?.rows ?? [])].sort(
    (a, b) =>
      Number(b.state !== "match") - Number(a.state !== "match") ||
      Math.abs(b.delta) - Math.abs(a.delta),
  );
  const broken = rows.filter((row) => ["quantity", "orphan", "zombie"].includes(row.state));
  const healing = rows.filter((row) => ["pending", "cost"].includes(row.state));
  const orphans = rows.filter((row) => row.state === "orphan");
  const zombies = rows.filter((row) => row.state === "zombie");
  const status = !data ? "none" : broken.length ? "danger" : healing.length ? "warning" : "success";
  const headline = !data
    ? found.isError
      ? "Could not compare with Alpaca"
      : "Comparing with Alpaca"
    : broken.length
      ? `Manual intervention required: ${broken.map((row) => row.symbol).join(", ")}`
      : healing.length
        ? `Drift detected, settling by itself: ${healing.map((row) => row.symbol).join(", ")}`
        : "In sync";
  const check = data?.reconciliation;
  return (
    <div className="stack">
      <div className="row">
        <h1 className="panel-title grow">
          <Explained text={page("Reconciliation")}>Reconciliation</Explained>
        </h1>
        <Button small icon="refresh" loading={sync.isPending} onClick={() => sync.mutate({})}>
          Reconcile now
        </Button>
      </div>
      <Callout intent={status} title={headline}>
        {check ? (
          <span className="num">
            Last check {time(check.checked)}
            {check.trigger ? ` ${TRIGGER[check.trigger]}` : ""} · {check.activities} activities
          </span>
        ) : (
          "No check yet"
        )}
        {data?.cursor ? (
          <span className="num muted">
            {" "}
            · newest activity {data.cursor.id}
            {data.cursor.time ? ` at ${time(data.cursor.time)}` : ""}
            {check?.synced
              ? ` · ${Math.round((Date.now() - new Date(check.synced).getTime()) / 1000)}s since the last fetch`
              : ""}
          </span>
        ) : null}
        {data?.error ? <div>Last sync failed: {data.error}</div> : null}
      </Callout>
      <section className="panel">
        <Loadable query={found} rows={5}>
          <HTMLTable compact striped style={{ width: "100%" }}>
            <thead>
              <tr>
                <Th>Symbol</Th>
                <Th>State</Th>
                <Th className="right">Ledger qty</Th>
                <Th className="right">Alpaca qty</Th>
                <Th className="right">Delta</Th>
                <Th className="right">Ledger cost</Th>
                <Th className="right">Alpaca cost</Th>
                <Th className="right">Ledger P&amp;L</Th>
                <Th className="right">Alpaca P&amp;L</Th>
                <th />
              </tr>
            </thead>
            <tbody className="num">
              {rows.map((row) => (
                <tr key={row.symbol} className={row.state === "match" ? undefined : "flag-row"}>
                  <td>{row.symbol}</td>
                  <td>
                    <Tag minimal intent={STATE[row.state].intent} title={row.note || undefined}>
                      {STATE[row.state].label}
                    </Tag>
                  </td>
                  <td className="right">{quantity(row.ledger_qty)}</td>
                  <td className="right">{quantity(row.broker_qty)}</td>
                  <td className={`right ${row.delta ? "loss" : "muted"}`}>{quantity(row.delta)}</td>
                  <td className="right">{money(row.ledger_cost)}</td>
                  <td className="right">{money(row.broker_cost)}</td>
                  <td className="right">{signedMoney(row.ledger_pnl)}</td>
                  <td className="right">{signedMoney(row.broker_pnl)}</td>
                  <td>
                    {["quantity", "orphan", "zombie"].includes(row.state) ? (
                      <Button
                        small
                        intent="primary"
                        loading={adopt.isPending}
                        onClick={() => adopt.mutate({ params: { path: { symbol: row.symbol } } })}
                      >
                        Correct now
                      </Button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="muted">
                    Nothing held in the ledger or at Alpaca
                  </td>
                </tr>
              ) : null}
            </tbody>
          </HTMLTable>
        </Loadable>
        <p className="muted">
          Correct now makes the ledger hold what Alpaca holds, with an adjusting lot or a write-off
          written to the audit log. The ledger also checks itself every 10 minutes and after each
          fill.
        </p>
      </section>
      <div className="settings-grid">
        {[
          { title: "Orphans: held by the ledger, not at Alpaca", items: orphans },
          { title: "Zombies: held at Alpaca, not in the ledger", items: zombies },
        ].map((group) => (
          <section key={group.title} className="panel stack">
            <h2 className="panel-title">{group.title}</h2>
            {group.items.length === 0 ? <p className="muted">None</p> : null}
            {group.items.map((row) => (
              <div key={row.symbol} className="row">
                <span className="grow num">
                  {row.symbol} · ledger {quantity(row.ledger_qty)} · Alpaca{" "}
                  {quantity(row.broker_qty)}
                </span>
                <Button
                  small
                  intent="primary"
                  loading={adopt.isPending}
                  onClick={() => adopt.mutate({ params: { path: { symbol: row.symbol } } })}
                >
                  Correct now
                </Button>
              </div>
            ))}
          </section>
        ))}
      </div>
      {sync.error || adopt.error ? (
        <Callout intent="danger">{detail(sync.error ?? adopt.error)}</Callout>
      ) : null}
    </div>
  );
}
