import { HTMLSelect, SegmentedControl } from "@blueprintjs/core";
import type { ColDef } from "ag-grid-community";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "../api/client";
import type { components } from "../api/schema";
import {
  moneyCell,
  numClass,
  percentCell,
  quantityCell,
  signedMoneyCell,
  signedPercentCell,
  toneClass,
} from "../components/cells";
import { EquityChart, type Mark, type Point } from "../components/EquityChart";
import { PanelTitle } from "../components/Explained";
import { Figure } from "../components/Figure";
import { Grid } from "../components/Grid";
import { money, percent, signedMoney, signedPercent, time, tone } from "../format";
import { useDark } from "../shell/theme";
import { useStream } from "../stream/store";
import { Recovery } from "./Recovery";

type Position = components["schemas"]["Position"];
type Event = components["schemas"]["app__activity__Event"];
type Period = "1D" | "1W" | "1M" | "3M" | "1A";

const PERIODS: Period[] = ["1D", "1W", "1M", "3M", "1A"];
const BARS: Record<Period, { timeframe: "5Min" | "1Hour" | "1Day"; limit: number; days: number }> =
  {
    "1D": { timeframe: "5Min", limit: 100, days: 1 },
    "1W": { timeframe: "1Hour", limit: 60, days: 7 },
    "1M": { timeframe: "1Day", limit: 25, days: 31 },
    "3M": { timeframe: "1Day", limit: 70, days: 92 },
    "1A": { timeframe: "1Day", limit: 260, days: 366 },
  };
const OPEN = ["new", "accepted", "partially_filled", "held", "pending_new"];

export interface Row extends Position {
  price: number;
  value: number;
  weight: number;
  gain_pct: number | null;
}

export function positionRows(
  positions: Position[],
  equity: number,
  quotes: Record<string, { bid_price: number; ask_price: number }>,
): Row[] {
  return positions
    .filter((position) => Math.abs(position.market_value) >= 0.01)
    .map((position) => {
      const quote = quotes[position.symbol] ?? quotes[position.symbol.replace(/USD$/, "/USD")];
      const live =
        quote && quote.bid_price > 0 && quote.ask_price > 0
          ? (quote.bid_price + quote.ask_price) / 2
          : null;
      const price = live ?? position.current_price;
      const value = position.qty * price;
      const cost = position.qty * position.avg_entry_price;
      return {
        ...position,
        price,
        value,
        unrealized_pl: value - cost,
        weight: equity ? value / equity : 0,
        gain_pct: cost ? (value - cost) / cost : null,
      };
    })
    .sort((a, b) => b.value - a.value);
}

export const POSITION_COLUMNS: ColDef<Row>[] = [
  { field: "symbol", headerName: "Symbol", pinned: "left", minWidth: 90 },
  {
    field: "qty",
    headerName: "Qty",
    valueFormatter: quantityCell,
    cellClass: numClass,
    type: "rightAligned",
  },
  {
    field: "avg_entry_price",
    headerName: "Avg cost",
    valueFormatter: moneyCell,
    cellClass: numClass,
    type: "rightAligned",
  },
  {
    field: "price",
    headerName: "Price",
    valueFormatter: moneyCell,
    cellClass: numClass,
    type: "rightAligned",
  },
  {
    field: "value",
    headerName: "Value",
    valueFormatter: moneyCell,
    cellClass: numClass,
    type: "rightAligned",
  },
  {
    field: "unrealized_pl",
    headerName: "P&L",
    valueFormatter: signedMoneyCell,
    cellClass: toneClass,
    type: "rightAligned",
  },
  {
    field: "gain_pct",
    headerName: "P&L %",
    valueFormatter: signedPercentCell,
    cellClass: toneClass,
    type: "rightAligned",
  },
  {
    field: "weight",
    headerName: "Weight",
    valueFormatter: percentCell,
    cellClass: numClass,
    type: "rightAligned",
  },
];

export function dailyMarks(
  fills: { time: string; side: "buy" | "sell"; symbol: string }[],
): Mark[] {
  const days = new Map<string, { time: string; side: "buy" | "sell"; symbols: Set<string> }>();
  for (const fill of fills) {
    const key = `${fill.time.slice(0, 10)}-${fill.side}`;
    const found = days.get(key) ?? { time: fill.time, side: fill.side, symbols: new Set<string>() };
    found.symbols.add(fill.symbol);
    if (fill.time < found.time) found.time = fill.time;
    days.set(key, found);
  }
  return [...days.values()].map((day) => ({
    time: day.time,
    side: day.side,
    text: [...day.symbols].sort().join(" "),
  }));
}

function Equity() {
  const dark = useDark();
  const [period, setPeriod] = useState<Period>("1M");
  const bars = BARS[period];
  const history = api.useQuery("get", "/portfolio/history", { params: { query: { period } } });
  const spy = api.useQuery("get", "/market/bars", {
    params: { query: { symbol: "SPY", timeframe: bars.timeframe, limit: bars.limit } },
  });
  const fills = api.useQuery("get", "/ledger/fills", {
    params: { query: { days: bars.days, limit: 500 } },
  });
  const equity = useMemo<Point[]>(
    () => (history.data ?? []).map((point) => ({ time: point.time, value: point.equity })),
    [history.data],
  );
  const first = equity[0]?.time;
  const benchmark = useMemo<Point[]>(
    () =>
      (spy.data ?? [])
        .filter((bar) => !first || bar.time >= first)
        .map((bar) => ({ time: bar.time, value: bar.close })),
    [spy.data, first],
  );
  const marks = useMemo<Mark[]>(
    () => dailyMarks((fills.data ?? []).filter((fill) => !first || fill.time >= first)),
    [fills.data, first],
  );
  return (
    <section className="panel" aria-labelledby="equity-title">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="panel-title" id="equity-title">
          Account value against SPY
        </h2>
        <SegmentedControl
          small
          options={PERIODS.map((value) => ({ label: value === "1A" ? "1Y" : value, value }))}
          value={period}
          onValueChange={(value) => setPeriod(value as Period)}
        />
      </div>
      {equity.length ? (
        <EquityChart equity={equity} benchmark={benchmark} marks={marks} dark={dark} />
      ) : (
        <p className="muted">{history.isLoading ? "Loading" : "No history"}</p>
      )}
    </section>
  );
}

const KINDS = ["all", "order", "fill", "run", "risk", "signal", "research", "system"] as const;

export function Feed() {
  const [kind, setKind] = useState<(typeof KINDS)[number]>("all");
  const activity = api.useQuery(
    "get",
    "/activity",
    { params: { query: { hours: 24 } } },
    { refetchInterval: 20_000 },
  );
  const events = (activity.data ?? []).filter(
    (event: Event) => kind === "all" || event.kind === kind,
  );
  return (
    <section className="panel" aria-labelledby="feed-title">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 className="panel-title" id="feed-title">
          Activity, last 24 hours
        </h2>
        <HTMLSelect
          minimal
          value={kind}
          onChange={(event) => setKind(event.currentTarget.value as (typeof KINDS)[number])}
          options={KINDS.map((value) => ({
            value,
            label: value === "all" ? "All" : value[0]?.toUpperCase() + value.slice(1),
          }))}
          aria-label="Event type"
        />
      </div>
      {events.length === 0 ? <p className="muted">No activity</p> : null}
      <ul className="feed">
        {events.map((event) => (
          <li key={`${event.time}-${event.title}`}>
            <span className="num muted">{time(event.time)}</span>
            <span
              className={
                event.level === "info" ? undefined : event.level === "error" ? "loss" : "warn-text"
              }
            >
              {event.title}
              {event.detail ? <span className="muted"> · {event.detail}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Meter({ label, value, limit }: { label: string; value: number; limit: number }) {
  const used = limit ? Math.max(0, value) / limit : 0;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span>{label}</span>
        <span className="num">
          {percent(value)} of {percent(limit, 0)}
        </span>
      </div>
      <meter
        className="meter"
        aria-label={label}
        min={0}
        max={1}
        low={0.5}
        high={0.9}
        optimum={0}
        value={Math.min(used, 1)}
      />
    </div>
  );
}

const STATE_DOT: Record<string, string> = {
  normal: "dot-ok",
  watch: "dot-warn",
  reduce: "dot-warn",
  defensive: "dot-error",
  flatten: "dot-error",
};

function Rail({
  equity,
  invested,
  dayPl,
  lastEquity,
}: {
  equity: number;
  invested: number;
  dayPl: number;
  lastEquity: number;
}) {
  const automation = api.useQuery("get", "/systematic/automation");
  const limits = api.useQuery("get", "/orders/limits");
  const status = api.useQuery("get", "/status", undefined, { refetchInterval: 30_000 });
  const overview = api.useQuery("get", "/systematic/overview", undefined, { staleTime: 60_000 });
  const state = automation.data?.kill_state ?? "normal";
  const loss = lastEquity ? Math.max(0, -dayPl / lastEquity) : 0;
  const running = (overview.data?.strategies ?? []).filter((item) => item.active);
  return (
    <aside className="stack" aria-label="Live status">
      <section className="panel">
        <PanelTitle>Kill switch</PanelTitle>
        <div style={{ fontSize: 16 }}>
          <span className={`dot ${STATE_DOT[state] ?? ""}`} aria-hidden />
          {state[0]?.toUpperCase() + state.slice(1)}
        </div>
        {automation.data?.halted ? <p className="loss">{automation.data.halted}</p> : null}
      </section>
      <section className="panel">
        <PanelTitle>Risk use</PanelTitle>
        <Meter label="Daily loss" value={loss} limit={limits.data?.limits.daily_loss ?? 0.03} />
        <Meter
          label="Drawdown"
          value={automation.data?.book.drawdown ?? 0}
          limit={automation.data?.config.max_drawdown ?? 0.15}
        />
        <Meter label="Gross exposure" value={equity ? invested / equity : 0} limit={1} />
      </section>
      <section className="panel">
        <PanelTitle>Strategies</PanelTitle>
        {running.length === 0 ? <p className="muted">None running</p> : null}
        {running.map((item) => {
          const passed = item.research?.checks.every((check) => check.passed) ?? false;
          return (
            <div key={item.spec.name}>
              <span className={`dot ${passed ? "dot-ok" : "dot-warn"}`} aria-hidden />
              {item.spec.title}
            </div>
          );
        })}
        {overview.data?.ensemble_active ? (
          <div>
            <span className="dot dot-ok" aria-hidden />
            Agent ensemble
          </div>
        ) : null}
      </section>
      <section className="panel">
        <PanelTitle>System</PanelTitle>
        {(status.data?.checks ?? []).map((check) => (
          <div key={check.name} title={check.detail}>
            <span
              className={`dot ${check.level === "ok" ? "dot-ok" : check.level === "warn" ? "dot-warn" : "dot-error"}`}
              aria-hidden
            />
            {check.name}
            <span className="muted"> · {check.detail}</span>
          </div>
        ))}
      </section>
    </aside>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const dark = useDark();
  const account = api.useQuery("get", "/account", undefined, { refetchInterval: 15_000 });
  const positions = api.useQuery("get", "/positions", undefined, { refetchInterval: 15_000 });
  const orders = api.useQuery("get", "/orders", { params: { query: { limit: 100 } } });
  const automation = api.useQuery("get", "/systematic/automation");
  const stream = useStream();
  const data = account.data;
  const rows = positionRows(positions.data ?? [], data?.equity ?? 0, stream.quotes);
  const invested = rows.reduce((sum, row) => sum + Math.abs(row.value), 0);
  const open = (orders.data ?? []).filter((order) => OPEN.includes(order.status)).length;
  return (
    <div className="dashboard">
      <Recovery />
      <div className="stack">
        <section className="panel strip" aria-label="Portfolio summary">
          <Figure
            lead
            label="Account value"
            value={money(data?.equity)}
            note={signedPercent(data ? data.day_pl_pct / 100 : null)}
          />
          <Figure label="Today" value={signedMoney(data?.day_pl)} tone={tone(data?.day_pl)} />
          <Figure label="Autopilot drawdown" value={percent(automation.data?.book.drawdown)} />
          <Figure label="Cash" value={money(data?.cash)} />
          <Figure label="Buying power" value={money(data?.buying_power)} />
          <Figure label="Positions" value={rows.length} />
          <Figure label="Open orders" value={open} />
        </section>
        <Equity />
        <section className="panel" aria-labelledby="positions-title">
          <h2 className="panel-title" id="positions-title">
            Positions
          </h2>
          <Grid
            rows={rows}
            columns={POSITION_COLUMNS}
            rowId={(row) => row.symbol}
            onRow={(row) => navigate("/positions", { state: { symbol: row.symbol } })}
            empty="No positions"
            dark={dark}
          />
        </section>
        <Feed />
      </div>
      <Rail
        equity={data?.equity ?? 0}
        invested={invested}
        dayPl={data?.day_pl ?? 0}
        lastEquity={data?.last_equity ?? 0}
      />
    </div>
  );
}
