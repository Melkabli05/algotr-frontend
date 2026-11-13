import { Button, Callout, HTMLTable, Tag } from "@blueprintjs/core";
import { useQueryClient } from "@tanstack/react-query";
import type { ColDef } from "ag-grid-community";
import { useMemo, useState } from "react";
import { api } from "../api/client";
import { Explained, Th } from "../components/Explained";
import { Figure } from "../components/Figure";
import { Grid } from "../components/Grid";
import { download } from "../csv";
import { money, percent } from "../format";
import { page } from "../glossary";
import { useDark } from "../shell/theme";

interface Screened {
  symbol: string;
  held: boolean;
  status: string;
  authority: string;
  ratio: number | null;
}

const COLUMNS: ColDef<Screened>[] = [
  { field: "symbol", headerName: "Symbol", filter: true },
  {
    field: "held",
    headerName: "Held",
    valueFormatter: (p) => (p.value ? "Yes" : ""),
    filter: true,
  },
  {
    field: "status",
    headerName: "Status",
    filter: true,
    cellClass: (p) =>
      p.value === "Compliant" ? "gain" : p.value === "Non-compliant" ? "loss" : "muted",
  },
  { field: "authority", headerName: "Authority", flex: 2 },
  {
    field: "ratio",
    headerName: "Purification",
    valueFormatter: (p) => (p.value == null ? "—" : percent(p.value, 2)),
    cellClass: "num",
  },
];

export function Compliance() {
  const dark = useDark();
  const client = useQueryClient();
  const holdings = api.useQuery("get", "/compliance/holdings");
  const universe = api.useQuery("get", "/compliance/universe", undefined, { staleTime: 300_000 });
  const ratios = api.useQuery("get", "/ledger/purification/ratios");
  const purification = api.useQuery("get", "/ledger/purification");
  const realized = api.useQuery("get", "/ledger/realized", {
    params: { query: { method: "fifo" } },
  });
  const rescan = api.useMutation("post", "/scanner/run", {
    onSuccess: () => client.invalidateQueries(),
  });
  const [onlyHeld, setOnlyHeld] = useState(false);
  const rows = useMemo<Screened[]>(() => {
    const ratio = (symbol: string) => {
      const found = ratios.data?.[symbol];
      return found == null ? null : Number(found);
    };
    const held = (holdings.data ?? []).map((item) => ({
      symbol: item.symbol,
      held: true,
      status: item.screening.allowed ? "Compliant" : "Non-compliant",
      authority: item.screening.reason,
      ratio: ratio(item.symbol),
    }));
    const known = new Set(held.map((item) => item.symbol));
    const listed = (universe.data ?? [])
      .filter((item) => !known.has(item.symbol))
      .map((item) => ({
        symbol: item.symbol,
        held: false,
        status: item.allowed ? "Compliant" : "Non-compliant",
        authority: item.reason,
        ratio: ratio(item.symbol),
      }));
    return [...held, ...listed];
  }, [holdings.data, universe.data, ratios.data]);
  const value = (holdings.data ?? []).reduce((sum, item) => sum + Math.abs(item.market_value), 0);
  const compliant = (holdings.data ?? [])
    .filter((item) => item.screening.allowed)
    .reduce((sum, item) => sum + Math.abs(item.market_value), 0);
  const month = new Date().toISOString().slice(0, 7);
  const washes = (realized.data?.rows ?? []).filter((row) => (row.disallowed ?? 0) > 0);
  const washesThisMonth = washes.filter((row) => row.closed.startsWith(month));
  const statement = purification.data;
  return (
    <div className="stack">
      <h1 className="panel-title" style={{ margin: 0 }}>
        <Explained text={page("Compliance")}>Compliance</Explained>
      </h1>
      <section className="panel strip">
        <Figure lead label="Holdings compliant" value={value ? percent(compliant / value) : "—"} />
        <Figure label="Wash sales this month" value={washesThisMonth.length} />
        <Figure
          label={`To purify, ${statement?.year ?? ""}`}
          value={money(statement ? Number(statement.owed) : null)}
        />
        <Figure
          label="Pattern day trading"
          value="Not applicable"
          note="FINRA retired the rule on 4 June 2026"
        />
      </section>
      <section className="panel stack">
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <h2 className="panel-title" style={{ margin: 0, flex: 1 }}>
            Shariah screening
          </h2>
          <Button small active={onlyHeld} onClick={() => setOnlyHeld(!onlyHeld)}>
            Holdings only
          </Button>
          <Button small icon="refresh" loading={rescan.isPending} onClick={() => rescan.mutate({})}>
            Re-screen all
          </Button>
        </div>
        {rescan.isSuccess ? (
          <Callout intent="success" compact>
            The lists are being downloaded again; the table updates when the scan ends.
          </Callout>
        ) : null}
        <Grid
          rows={rows.filter((row) => !onlyHeld || row.held)}
          columns={COLUMNS}
          rowId={(row) => row.symbol}
          height={420}
          empty="No lists"
          dark={dark}
        />
      </section>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <section className="panel stack">
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 className="panel-title" style={{ margin: 0, flex: 1 }}>
              Purification, {statement?.year}
            </h2>
            <Button
              small
              icon="download"
              disabled={!statement}
              onClick={() =>
                statement &&
                download(`purification-${statement.year}.csv`, [
                  ...statement.dividends.map((row) => ({
                    source: "dividend",
                    symbol: row.symbol,
                    received: row.received,
                    ratio: row.ratio,
                    owed: row.owed,
                  })),
                  {
                    source: "interest received",
                    symbol: "",
                    received: statement.interest_received,
                    ratio: 1,
                    owed: statement.interest_received,
                  },
                ])
              }
            >
              Export CSV
            </Button>
          </div>
          <HTMLTable compact striped>
            <thead>
              <tr>
                <Th>Source</Th>
                <Th>Received</Th>
                <Th>Impure share</Th>
                <Th>Owed</Th>
              </tr>
            </thead>
            <tbody className="num">
              {(statement?.dividends ?? []).map((row) => (
                <tr key={row.symbol}>
                  <td>Dividends, {row.symbol}</td>
                  <td>{money(Number(row.received))}</td>
                  <td>
                    {row.ratio == null ? (
                      <Tag minimal intent="warning">
                        no ratio
                      </Tag>
                    ) : (
                      percent(Number(row.ratio), 2)
                    )}
                  </td>
                  <td>{row.owed == null ? "—" : money(Number(row.owed))}</td>
                </tr>
              ))}
              <tr>
                <td>Interest received</td>
                <td>{money(Number(statement?.interest_received ?? 0))}</td>
                <td>100%</td>
                <td>{money(Number(statement?.interest_received ?? 0))}</td>
              </tr>
              <tr>
                <Th>Total</Th>
                <td />
                <td />
                <th>{money(Number(statement?.owed ?? 0))}</th>
              </tr>
            </tbody>
          </HTMLTable>
          {Number(statement?.interest_paid ?? 0) > 0 ? (
            <Callout intent="warning" compact>
              {money(Number(statement?.interest_paid))} of interest was paid this year
            </Callout>
          ) : null}
        </section>
        <section className="panel stack">
          <div style={{ display: "flex", alignItems: "center" }}>
            <h2 className="panel-title" style={{ margin: 0, flex: 1 }}>
              Wash sales
            </h2>
            <Button
              small
              icon="download"
              disabled={washes.length === 0}
              onClick={() =>
                download(
                  "wash-sales.csv",
                  washes.map((row) => ({
                    symbol: row.symbol,
                    sold: row.closed,
                    qty: row.qty,
                    loss: row.gain,
                    disallowed: row.disallowed,
                    reported: row.reported,
                  })),
                )
              }
            >
              Export CSV
            </Button>
          </div>
          {washes.length === 0 ? <p className="muted">No wash sales</p> : null}
          {washes.length ? (
            <HTMLTable compact striped>
              <thead>
                <tr>
                  <Th>Symbol</Th>
                  <Th>Sold</Th>
                  <Th>Loss</Th>
                  <Th>Disallowed</Th>
                  <Th>Reported</Th>
                </tr>
              </thead>
              <tbody className="num">
                {washes.map((row) => (
                  <tr key={`${row.order}-${row.lot}`}>
                    <td>{row.symbol}</td>
                    <td>{row.closed.slice(0, 10)}</td>
                    <td className="loss">{money(row.gain)}</td>
                    <td>{money(row.disallowed)}</td>
                    <td>{money(row.reported)}</td>
                  </tr>
                ))}
              </tbody>
            </HTMLTable>
          ) : null}
          <p className="muted" style={{ margin: 0 }}>
            The disallowed loss is added to the basis of the shares bought back; their lots show it
            under Wash sale.
          </p>
        </section>
      </div>
    </div>
  );
}
