import { Button, Drawer, DrawerSize, HTMLSelect, HTMLTable, Tag } from "@blueprintjs/core";
import type { ColDef } from "ag-grid-community";
import { useMemo, useState } from "react";
import { api } from "../api/client";
import type { components } from "../api/schema";
import { moneyCell, quantityCell, timeCell } from "../components/cells";
import { Explained, PanelTitle, Th } from "../components/Explained";
import { Figure } from "../components/Figure";
import { Grid } from "../components/Grid";
import { Loadable } from "../components/Loadable";
import { download } from "../csv";
import { money, quantity } from "../format";
import { page } from "../glossary";
import { ENV_COLUMN } from "../shell/EnvChip";
import { useDark } from "../shell/theme";

type Trade = components["schemas"]["app__features__tca__service__Trade"];
type Summary = components["schemas"]["Summary"];

const bps = (value: number | null | undefined) => (value == null ? "—" : value.toFixed(1));
const bpsCell = (params: { value: number | null | undefined }) => bps(params.value);
const bpsClass = (params: { value: number | null | undefined }) =>
  `num ${params.value == null ? "muted" : params.value > 0 ? "loss" : "gain"}`;

const COLUMNS: ColDef<Trade>[] = [
  ENV_COLUMN,
  { field: "time", headerName: "Time", valueFormatter: timeCell, width: 120 },
  { field: "symbol", headerName: "Symbol", filter: true, width: 100 },
  { field: "side", headerName: "Side", filter: true, width: 70 },
  { field: "source", headerName: "Source", filter: true, width: 90 },
  { field: "algo", headerName: "Algo", filter: true, width: 80 },
  {
    field: "qty",
    headerName: "Qty",
    valueFormatter: quantityCell,
    type: "rightAligned",
    cellClass: "num",
  },
  {
    field: "decision",
    headerName: "Decision",
    valueFormatter: moneyCell,
    type: "rightAligned",
    cellClass: "num",
  },
  {
    field: "arrival",
    headerName: "Arrival",
    valueFormatter: moneyCell,
    type: "rightAligned",
    cellClass: "num",
  },
  {
    field: "fill",
    headerName: "Fill",
    valueFormatter: moneyCell,
    type: "rightAligned",
    cellClass: "num",
  },
  {
    field: "vwap",
    headerName: "Day VWAP",
    valueFormatter: moneyCell,
    type: "rightAligned",
    cellClass: "num",
  },
  {
    field: "timing_bps",
    headerName: "Timing",
    valueFormatter: bpsCell,
    type: "rightAligned",
    cellClass: bpsClass,
  },
  {
    field: "impact_bps",
    headerName: "Impact",
    valueFormatter: bpsCell,
    type: "rightAligned",
    cellClass: bpsClass,
  },
  {
    field: "shortfall_bps",
    headerName: "Shortfall",
    valueFormatter: bpsCell,
    type: "rightAligned",
    cellClass: bpsClass,
  },
  {
    field: "vs_vwap_bps",
    headerName: "vs VWAP",
    valueFormatter: bpsCell,
    type: "rightAligned",
    cellClass: bpsClass,
  },
  {
    field: "vs_twap_bps",
    headerName: "vs TWAP",
    valueFormatter: bpsCell,
    type: "rightAligned",
    cellClass: bpsClass,
  },
  {
    field: "fee_bps",
    headerName: "Fee",
    valueFormatter: bpsCell,
    type: "rightAligned",
    cellClass: bpsClass,
  },
];

function Breakdown({ title, rows }: { title: string; rows: Summary[] }) {
  return (
    <section className="panel">
      <h2 className="panel-title">{title}</h2>
      <HTMLTable compact striped className="num" style={{ width: "100%" }}>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th className="right">Trades</Th>
            <Th className="right">Notional</Th>
            <Th className="right">Impact</Th>
            <Th className="right">Shortfall</Th>
            <Th className="right">vs VWAP</Th>
            <Th className="right">vs TWAP</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name}>
              <td>{row.name}</td>
              <td className="right">{row.trades}</td>
              <td className="right">{money(row.notional)}</td>
              <td className="right">{bps(row.impact_bps)}</td>
              <td className="right">{bps(row.shortfall_bps)}</td>
              <td className="right">{bps(row.vs_vwap_bps)}</td>
              <td className="right">{bps(row.vs_twap_bps)}</td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={7} className="muted">
                None in this window
              </td>
            </tr>
          ) : null}
        </tbody>
      </HTMLTable>
    </section>
  );
}

type Field = "impact_bps" | "timing_bps" | "shortfall_bps" | "vs_vwap_bps" | "vs_twap_bps";

const METRICS: { key: Field; label: string }[] = [
  { key: "shortfall_bps", label: "Implementation shortfall" },
  { key: "vs_vwap_bps", label: "VWAP slippage" },
  { key: "timing_bps", label: "Timing cost" },
  { key: "impact_bps", label: "Market impact" },
  { key: "vs_twap_bps", label: "vs TWAP" },
];

export function weightedBps(trades: Trade[], field: Field): number | null {
  const known = trades.filter((trade) => trade[field] != null);
  const notional = known.reduce((sum, trade) => sum + trade.notional, 0);
  return notional
    ? known.reduce((sum, trade) => sum + (trade[field] ?? 0) * trade.notional, 0) / notional
    : null;
}

export function daily(trades: Trade[], field: Field): number[] {
  const days = new Map<string, Trade[]>();
  for (const trade of trades) {
    const day = trade.time.slice(0, 10);
    days.set(day, [...(days.get(day) ?? []), trade]);
  }
  return [...days.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, items]) => weightedBps(items, field))
    .filter((value): value is number => value != null);
}

function Metric({ label, trades, field }: { label: string; trades: Trade[]; field: Field }) {
  const week = Date.now() - 7 * 86_400_000;
  const recent = weightedBps(
    trades.filter((trade) => new Date(trade.time).getTime() >= week),
    field,
  );
  const average = weightedBps(trades, field);
  const worse = recent != null && average != null && recent - average > 2;
  const series = daily(trades, field);
  return (
    <div className={`metric ${worse ? "metric-worse" : ""}`}>
      <span className="figure-label">{label}</span>
      <span className="num">
        {bps(recent)} <span className="muted">7 days · {bps(average)} window</span>
      </span>
      <Spark points={series} />
    </div>
  );
}

function Spark({ points }: { points: number[] }) {
  if (points.length < 2) return <span className="muted">too few days</span>;
  const low = Math.min(...points);
  const high = Math.max(...points);
  const span = high - low || 1;
  const path = points
    .map(
      (value, index) =>
        `${(index / (points.length - 1)) * 100},${30 - ((value - low) / span) * 28}`,
    )
    .join(" ");
  return (
    <svg viewBox="0 0 100 32" preserveAspectRatio="none" className="spark" aria-hidden="true">
      <polyline points={path} className="spark-neutral" />
    </svg>
  );
}

function byAlgoSymbol(trades: Trade[]): Summary[] {
  const groups = new Map<string, Trade[]>();
  for (const trade of trades.filter((item) => item.algo)) {
    const key = `${trade.algo?.toUpperCase()} · ${trade.symbol}`;
    groups.set(key, [...(groups.get(key) ?? []), trade]);
  }
  return [...groups.entries()].map(([name, items]) => ({
    name,
    trades: items.length,
    notional: items.reduce((sum, trade) => sum + trade.notional, 0),
    impact_bps: weightedBps(items, "impact_bps"),
    shortfall_bps: weightedBps(items, "shortfall_bps"),
    vs_vwap_bps: weightedBps(items, "vs_vwap_bps"),
    vs_twap_bps: weightedBps(items, "vs_twap_bps"),
    timing_bps: weightedBps(items, "timing_bps"),
    fee_bps: null,
  }));
}

function TradeDrawer({ trade, onClose }: { trade: Trade | undefined; onClose: () => void }) {
  const algos = api.useQuery("get", "/orders/algo", undefined, { enabled: Boolean(trade?.algo) });
  const parent = (algos.data ?? []).find((item) =>
    item.children.some((child) => child.order === trade?.order),
  );
  const steps = trade
    ? [
        { name: "Decision", price: trade.decision, note: "the autopilot's planned price" },
        { name: "Arrival", price: trade.arrival, note: "open of the minute it reached Alpaca" },
        {
          name: "Fill",
          price: trade.fill,
          note:
            trade.seconds_to_fill == null
              ? ""
              : `${trade.seconds_to_fill.toFixed(1)}s after submission`,
        },
        { name: "TWAP over its life", price: trade.twap, note: "" },
        { name: "Day VWAP", price: trade.vwap, note: "" },
      ]
    : [];
  return (
    <Drawer
      isOpen={Boolean(trade)}
      onClose={onClose}
      size={DrawerSize.SMALL}
      title={trade ? `${trade.side} ${trade.qty} ${trade.symbol}` : ""}
    >
      {trade ? (
        <div style={{ padding: 16 }} className="stack">
          <HTMLTable compact className="num">
            <tbody>
              {steps.map((step) => (
                <tr key={step.name}>
                  <td>{step.name}</td>
                  <td>{money(step.price)}</td>
                  <td className="muted">{step.note}</td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
          {parent ? (
            <>
              <h3 className="panel-title">{parent.algo.toUpperCase()} slices</h3>
              <HTMLTable compact className="num">
                <tbody>
                  {parent.children.map((child) => (
                    <tr key={child.order}>
                      <td>{child.interval + 1}</td>
                      <td>{quantity(child.filled_qty)}</td>
                      <td>{money(child.average_price)}</td>
                      <td>{child.status}</td>
                    </tr>
                  ))}
                </tbody>
              </HTMLTable>
            </>
          ) : null}
        </div>
      ) : null}
    </Drawer>
  );
}

export function Blotter() {
  const dark = useDark();
  const [days, setDays] = useState(30);
  const found = api.useQuery("get", "/tca", { params: { query: { days } } }, { staleTime: 60_000 });
  const data = found.data;
  const total = data?.total;
  const [chosen, setChosen] = useState<Trade>();
  const fees = (data?.trades ?? []).reduce(
    (sum, trade) => sum + ((trade.fee_bps ?? 0) * trade.notional) / 1e4,
    0,
  );
  const pairs = useMemo(() => byAlgoSymbol(data?.trades ?? []), [data]);
  return (
    <div className="stack">
      <div className="row">
        <h1 className="panel-title grow">
          <Explained text={page("Trade blotter")}>Trade blotter</Explained>
        </h1>
        <HTMLSelect
          aria-label="Window"
          value={days}
          options={[7, 30, 90].map((value) => ({ value, label: `Last ${value} days` }))}
          onChange={(event) => setDays(Number(event.currentTarget.value))}
        />
        <Button small icon="print" onClick={() => window.print()}>
          PDF
        </Button>
        <Button
          small
          icon="download"
          disabled={!data?.trades.length}
          onClick={() =>
            data &&
            download(
              `tca-${days}d.csv`,
              data.trades.map((trade) => ({ ...trade })),
            )
          }
        >
          Export CSV
        </Button>
      </div>
      {found.isError ? <Loadable query={found}>{null}</Loadable> : null}
      <section className="panel stack">
        <div className="strip">
          <Figure
            lead
            label="Notional traded"
            value={money(total?.notional)}
            note={`${total?.trades ?? 0} orders`}
          />
          <Figure
            label="Fees"
            value={money(fees)}
            note={`${bps(total?.fee_bps)} bps on coins; stocks are commission-free`}
          />
        </div>
        <div className="metric-grid">
          {METRICS.map((metric) => (
            <Metric
              key={metric.key}
              label={metric.label}
              trades={data?.trades ?? []}
              field={metric.key}
            />
          ))}
        </div>
      </section>
      <div className="settings-grid">
        <Breakdown title="By source" rows={data?.sources ?? []} />
        <Breakdown title="By algorithm" rows={data?.algorithms ?? []} />
      </div>
      <Breakdown title="By symbol" rows={data?.symbols ?? []} />
      <Breakdown title="By algorithm and symbol" rows={pairs} />
      <TradeDrawer trade={chosen} onClose={() => setChosen(undefined)} />
      <section className="panel stack">
        <PanelTitle>Every order</PanelTitle>
        <Grid
          rows={data?.trades}
          columns={COLUMNS}
          rowId={(trade) => trade.order}
          onRow={setChosen}
          height={480}
          empty={found.isLoading ? "Loading" : "No fills in this window"}
          dark={dark}
        />
        {(data?.notes ?? []).map((note) => (
          <p key={note} className="muted" style={{ margin: 0 }}>
            {note}
          </p>
        ))}
        <p className="muted" style={{ margin: 0 }}>
          <Tag minimal intent="danger">
            red
          </Tag>{" "}
          costs money,{" "}
          <Tag minimal intent="success">
            green
          </Tag>{" "}
          beat the benchmark.
        </p>
      </section>
    </div>
  );
}
