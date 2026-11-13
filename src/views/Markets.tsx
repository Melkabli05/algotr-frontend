import { Button, HTMLTable, InputGroup, Tag } from "@blueprintjs/core";
import type { ColDef } from "ag-grid-community";
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router";
import { api } from "../api/client";
import type { components } from "../api/schema";
import { RuleLine, TradesLine } from "../components/chart/OverlayLine";
import { RuleTrades } from "../components/chart/RuleTrades";
import { dayMs, fillMarkers, traceCandles, traceMarkers } from "../components/chart/sources";
import { Explained, PanelTitle } from "../components/Explained";
import { Figure } from "../components/Figure";
import { Grid } from "../components/Grid";
import { barStart } from "../components/liveBars";
import { type Focus, PriceChart } from "../components/PriceChart";
import { money, signedPercent, time } from "../format";
import { page } from "../glossary";
import { focusSymbol, useFocusedSymbol } from "../shell/commands";
import { useDark } from "../shell/theme";
import { useTicket } from "../shell/ticket";
import { useStream } from "../stream/store";

type Candidate = components["schemas"]["Candidate"];
type Coin = components["schemas"]["CryptoRow"];
type Timeframe = "1Min" | "5Min" | "15Min" | "1Hour" | "1Day";

const LIMITS: Record<Timeframe, number> = {
  "1Day": 500,
  "1Hour": 600,
  "15Min": 520,
  "5Min": 780,
  "1Min": 1000,
};

const CANDIDATES: ColDef<Candidate>[] = [
  { field: "rank", headerName: "#", width: 60, cellClass: "num" },
  { field: "symbol", headerName: "Symbol", width: 90, filter: true },
  { field: "name", headerName: "Name", flex: 2 },
  {
    field: "score",
    headerName: "Score",
    valueFormatter: (p) => p.value?.toFixed(2),
    cellClass: "num",
  },
  {
    field: "mom_12_1",
    headerName: "12-1 mo",
    valueFormatter: (p) => signedPercent(p.value, 1),
    cellClass: "num",
  },
  {
    field: "mom_6_1",
    headerName: "6-1 mo",
    valueFormatter: (p) => signedPercent(p.value, 1),
    cellClass: "num",
  },
  { field: "price", headerName: "Price", valueFormatter: (p) => money(p.value), cellClass: "num" },
  {
    field: "picked",
    headerName: "Picked",
    valueFormatter: (p) => (p.value ? "Yes" : ""),
    filter: true,
    width: 80,
  },
];

const COINS: ColDef<Coin>[] = [
  { field: "rank", headerName: "#", width: 60, cellClass: "num" },
  { field: "coin", headerName: "Coin", width: 100 },
  { field: "price", headerName: "Price", valueFormatter: (p) => money(p.value), cellClass: "num" },
  {
    field: "week",
    headerName: "Week",
    valueFormatter: (p) => signedPercent(p.value, 1),
    cellClass: "num",
  },
  {
    field: "month",
    headerName: "Month",
    valueFormatter: (p) => signedPercent(p.value, 1),
    cellClass: "num",
  },
  {
    field: "quarter",
    headerName: "Quarter",
    valueFormatter: (p) => signedPercent(p.value, 1),
    cellClass: "num",
  },
  {
    field: "trend",
    headerName: "Vs 200-day",
    valueFormatter: (p) => signedPercent(p.value, 1),
    cellClass: "num",
  },
  {
    field: "above",
    headerName: "Above",
    valueFormatter: (p) => (p.value ? `${p.data?.days ?? 0} days` : "No"),
  },
];

function Watchlist({ chosen, onPick }: { chosen: string; onPick: (symbol: string) => void }) {
  const symbols = api.useQuery("get", "/stream/symbols", undefined, { staleTime: 300_000 });
  const { quotes } = useStream();
  return (
    <section className="panel">
      <PanelTitle>Watchlist</PanelTitle>
      <HTMLTable compact interactive style={{ width: "100%" }}>
        <tbody className="num">
          {(symbols.data ?? []).map((symbol) => {
            const quote = quotes[symbol];
            const mid = quote ? (quote.bid_price + quote.ask_price) / 2 : null;
            return (
              <tr
                key={symbol}
                onClick={() => onPick(symbol)}
                className={symbol === chosen ? "chosen" : undefined}
              >
                <td>{symbol}</td>
                <td style={{ textAlign: "right" }}>{money(mid)}</td>
              </tr>
            );
          })}
        </tbody>
      </HTMLTable>
    </section>
  );
}

function SymbolNews({ symbol }: { symbol: string }) {
  const stock = !symbol.includes("/");
  const verdict = api.useQuery(
    "get",
    "/scanner/symbol/{symbol}",
    { params: { path: { symbol } } },
    { enabled: stock, retry: false },
  );
  const news = api.useQuery(
    "get",
    "/scanner/news/{symbol}",
    { params: { path: { symbol } } },
    { enabled: stock, retry: false },
  );
  if (!stock) return null;
  return (
    <div className="settings-grid">
      <section className="panel stack">
        <div className="row">
          <h2 className="panel-title grow">Scanner verdict</h2>
          {verdict.data ? (
            <Tag minimal intent={verdict.data.verdict === "eligible" ? "success" : "warning"}>
              {verdict.data.verdict}
            </Tag>
          ) : null}
        </div>
        <HTMLTable compact>
          <tbody>
            {(verdict.data?.reasons ?? []).map((reason) => (
              <tr key={reason.check}>
                <td>{reason.check}</td>
                <td className={reason.passed ? "gain" : "loss"}>
                  {reason.passed ? "pass" : "fail"}
                </td>
                <td className="muted">{reason.detail}</td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
      </section>
      <section className="panel stack">
        <PanelTitle>Headlines</PanelTitle>
        <HTMLTable compact>
          <tbody>
            {(news.data?.headlines ?? []).slice(0, 10).map((item) => {
              const score = item.sentiment?.score;
              return (
                <tr key={item.id}>
                  <td className="num muted" style={{ whiteSpace: "nowrap" }}>
                    {time(item.time)}
                  </td>
                  <td>
                    <a href={item.url ?? undefined} target="_blank" rel="noreferrer">
                      {item.headline}
                    </a>
                  </td>
                  <td
                    className={`num ${score == null ? "muted" : score > 0 ? "gain" : score < 0 ? "loss" : "muted"}`}
                  >
                    {score == null ? "" : score.toFixed(2)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </HTMLTable>
        {news.data && !news.data.headlines.length ? <p className="muted">No headlines</p> : null}
      </section>
    </div>
  );
}

export function Markets() {
  const dark = useDark();
  const ticket = useTicket();
  const stream = useStream();
  const asked = (useLocation().state as { symbol?: string } | null)?.symbol;
  const focused = useFocusedSymbol();
  const [symbol, setSymbol] = useState(asked ?? focused);
  const [typed, setTyped] = useState(asked ?? focused);
  useEffect(() => {
    if (asked) {
      setSymbol(asked);
      setTyped(asked);
    }
  }, [asked]);
  useEffect(() => focusSymbol(symbol), [symbol]);
  const [frame, setFrame] = useState<Timeframe>("1Day");
  const limit = LIMITS[frame];
  const [source, setSource] = useState("none");
  const [focus, setFocus] = useState<Focus | null>(null);
  const [years, setYears] = useState(3);
  const catalog = api.useQuery("get", "/systematic/strategies", undefined, {
    staleTime: Number.POSITIVE_INFINITY,
  });
  const rules = (catalog.data ?? []).filter((spec) => spec.universe.includes(symbol));
  const ruleName = source.startsWith("rule:") ? source.slice(5) : null;
  const rule = rules.find((spec) => spec.name === ruleName) ?? null;
  useEffect(() => {
    if (source.startsWith("rule:") && catalog.data && !rule) setSource("none");
  }, [source, catalog.data, rule]);
  useEffect(() => {
    if (rule) setFrame("1Day");
  }, [rule]);
  const bars = api.useQuery(
    "get",
    "/market/bars",
    { params: { query: { symbol, timeframe: frame, limit } } },
    { retry: false },
  );
  const streamed = api.useQuery("get", "/stream/symbols", undefined, { staleTime: 300_000 });
  const streaming =
    rule == null &&
    stream.connected &&
    ((streamed.data ?? []).includes(symbol) ||
      Boolean(stream.trades[symbol] || stream.quotes[symbol]));
  const recent = api.useQuery(
    "get",
    "/market/bars",
    { params: { query: { symbol, timeframe: frame, limit: 3 } } },
    { retry: false, refetchInterval: streaming ? 15_000 : 5_000 },
  );
  const scan = api.useQuery("get", "/scanner/latest", undefined, { staleTime: 300_000 });
  const coins = api.useQuery("get", "/scanner/crypto", undefined, { staleTime: 300_000 });
  const trace = api.useQuery(
    "get",
    "/systematic/strategies/{name}/trace",
    {
      params: {
        path: { name: (rule?.name ?? "btc-trend-200") as never },
        query: { symbol, years },
      },
    },
    { enabled: rule != null, retry: false, staleTime: 300_000 },
  );
  const traced = rule ? trace.data : undefined;
  const trading = source === "trades";
  const fills = api.useQuery(
    "get",
    "/ledger/fills",
    { params: { query: { symbol, days: 365, limit: 500 } } },
    { enabled: trading, retry: false, staleTime: 60_000 },
  );
  const closed = api.useQuery(
    "get",
    "/ledger/realized",
    { params: { query: { symbol, days: 365 } } },
    { enabled: trading, retry: false, staleTime: 60_000 },
  );
  const costs = api.useQuery(
    "get",
    "/tca",
    { params: { query: { days: 90 } } },
    { enabled: trading, retry: false, staleTime: 600_000 },
  );
  const ruleView = useMemo(
    () => (traced ? { lines: traced.lines, values: traced.values } : null),
    [traced],
  );
  const series = useMemo(
    () => (traced ? traceCandles(traced) : (bars.data ?? [])),
    [traced, bars.data],
  );
  const markers = useMemo(() => {
    if (traced) return traceMarkers(traced);
    if (!trading) return [];
    const crypto = symbol.includes("/");
    return fillMarkers(fills.data ?? [], closed.data?.rows ?? [], costs.data?.trades ?? [], (ms) =>
      barStart(ms, frame, crypto),
    );
  }, [traced, trading, fills.data, closed.data, costs.data, symbol, frame]);
  const first = series[0]?.close;
  const traded = stream.trades[symbol]?.price;
  const last =
    (streaming ? traded : undefined) ?? recent.data?.at(-1)?.close ?? series.at(-1)?.close;
  const funnel = scan.data?.funnel;
  const pick = (next: string) => {
    setSymbol(next);
    setTyped(next);
  };
  return (
    <div className="stack">
      <h1 className="panel-title" style={{ margin: 0 }}>
        <Explained text={page("Markets")}>Markets</Explained>
      </h1>
      <div className="markets">
        <Watchlist chosen={symbol} onPick={pick} />
        <section className="panel stack">
          <div className="row">
            <form
              className="grow row"
              onSubmit={(event) => {
                event.preventDefault();
                if (typed.trim()) setSymbol(typed.trim().toUpperCase());
              }}
            >
              <InputGroup
                small
                leftIcon="search"
                placeholder="Symbol"
                aria-label="Symbol"
                value={typed}
                onValueChange={setTyped}
                style={{ width: 140 }}
              />
            </form>
            <Button small intent="success" onClick={() => ticket({ symbol, side: "buy" })}>
              Buy
            </Button>
            <Button small intent="danger" onClick={() => ticket({ symbol, side: "sell" })}>
              Sell
            </Button>
          </div>
          <div className="strip">
            <Figure lead label={symbol} value={money(last)} />
            <Figure
              label="Over the chart"
              value={first && last ? signedPercent(last / first - 1) : "—"}
            />
          </div>
          {rule ? (
            <RuleLine
              title={rule.title}
              trace={traced}
              loading={trace.isPending}
              years={years}
              onYears={setYears}
              onExit={() => setSource("none")}
            />
          ) : null}
          {trading ? (
            <TradesLine
              fills={fills.data?.length ?? 0}
              markers={markers.length}
              loading={fills.isPending}
              failed={Boolean(fills.error)}
              onExit={() => setSource("none")}
            />
          ) : null}
          <PriceChart
            bars={series}
            symbol={symbol}
            timeframe={frame}
            onTimeframe={(next) => setFrame(next as Timeframe)}
            loading={rule ? trace.isPending : bars.isPending}
            failed={Boolean(rule ? trace.error : bars.error)}
            dataKey={rule && traced ? `rule:${rule.name}:${years}` : "live"}
            markers={markers}
            rule={ruleView}
            focus={focus}
            source={{
              current: source,
              onChange: setSource,
              options: [
                { value: "none", label: "No overlay", about: "" },
                { value: "trades", label: "My trades", about: "Fills from the ledger" },
                ...rules.map((spec) => ({
                  value: `rule:${spec.name}`,
                  label: spec.title,
                  about: "Backtest",
                })),
              ],
            }}
            dark={dark}
            recent={rule ? undefined : recent.data}
            streaming={streaming}
          />
          {traced ? (
            <RuleTrades
              trace={traced}
              onPick={(trade) =>
                setFocus((now) => ({
                  time: dayMs(trade.entry),
                  until: trade.exit ? dayMs(trade.exit) : null,
                  n: (now?.n ?? 0) + 1,
                }))
              }
            />
          ) : null}
        </section>
      </div>
      <SymbolNews symbol={symbol} />
      <section className="panel stack">
        <div className="row">
          <h2 className="panel-title grow">
            Scanner, {scan.data?.session ?? ""} · {scan.data?.variant ?? ""}
          </h2>
        </div>
        {funnel ? (
          <div className="strip">
            <Figure label="Liquid" value={funnel.liquid} />
            <Figure label="On a Shariah list" value={funnel.listed} />
            <Figure label="Trending" value={funnel.trending} />
            <Figure label="Eligible and listed" value={funnel.listed_eligible} />
            <Figure label="Picked" value={funnel.picked} />
          </div>
        ) : null}
        <Grid
          rows={scan.data?.candidates}
          columns={CANDIDATES}
          rowId={(row) => row.symbol}
          onRow={(row) => pick(row.symbol)}
          height={360}
          empty="No scan yet"
          dark={dark}
        />
      </section>
      <section className="panel stack">
        <h2 className="panel-title">Crypto, {coins.data?.as_of ?? ""}</h2>
        <Grid
          rows={coins.data?.rows}
          columns={COINS}
          rowId={(row) => row.coin}
          onRow={(row) => pick(`${row.coin}/USD`)}
          empty="No crypto scan"
          dark={dark}
        />
      </section>
    </div>
  );
}
