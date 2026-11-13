import { SegmentedControl } from "@blueprintjs/core";
import { useState } from "react";
import { api } from "../api/client";
import { ACCENT_DARK, ACCENT_LIGHT, Chart, GAIN, GRAY, LOSS } from "../components/Chart";
import { Explained, PanelTitle } from "../components/Explained";
import { Figure } from "../components/Figure";
import { money, quantity, time } from "../format";
import { page } from "../glossary";
import { useDark } from "../shell/theme";
import { useStream } from "../stream/store";
import { Ladder } from "./Ladder";
import { QuickOrder } from "./QuickOrder";

const DEPTHS = [5, 10, 25, 50];

export function cumulative(levels: { price: number; size: number }[]): [number, number][] {
  let total = 0;
  return levels.map((level) => {
    total += level.size;
    return [level.price, total];
  });
}

function lean(value: number | null | undefined): string {
  if (value == null) return "—";
  const arrow = value > 0.3 ? "▲" : value < -0.3 ? "▼" : "◆";
  return `${arrow} ${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

export function OrderBook() {
  const dark = useDark();
  const status = api.useQuery("get", "/book/status", undefined, { refetchInterval: 10_000 });
  const symbols = (status.data?.books ?? []).map((book) => book.symbol);
  const [chosen, setChosen] = useState<string | null>(null);
  const [levels, setLevels] = useState(10);
  const symbol = chosen ?? symbols[0] ?? "";
  const view = api.useQuery(
    "get",
    "/book/view",
    { params: { query: { symbol, levels } } },
    { enabled: Boolean(symbol), refetchInterval: 1_000 },
  );
  const history = api.useQuery(
    "get",
    "/book/history",
    { params: { query: { symbol, minutes: 30 } } },
    { enabled: Boolean(symbol), refetchInterval: 15_000 },
  );
  const flows = api.useQuery(
    "get",
    "/book/flow",
    { params: { query: { symbol, minutes: 5 } } },
    { enabled: Boolean(symbol), refetchInterval: 5_000 },
  );
  const trade = useStream().trades[symbol];
  const book = view.data;
  const points = history.data ?? [];
  const spark = (pick: (point: (typeof points)[number]) => number | null | undefined) =>
    points.map((point) => [new Date(point.time).getTime(), pick(point) ?? null]);
  const ofi5 = (flows.data ?? []).reduce((sum, point) => sum + point.ofi, 0);
  return (
    <div className="stack">
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h1 className="panel-title" style={{ margin: 0 }}>
          <Explained text={page("Order book")}>Order book</Explained>
        </h1>
        <SegmentedControl
          small
          value={symbol}
          onValueChange={setChosen}
          options={symbols.map((value) => ({ label: value, value }))}
        />
        <SegmentedControl
          small
          value={String(levels)}
          onValueChange={(value) => setLevels(Number(value))}
          options={DEPTHS.map((value) => ({ label: `${value} levels`, value: String(value) }))}
        />
        <span className="muted">
          Alpaca has books for coins only; a stock has one best bid and ask.
        </span>
      </div>
      {!book ? (
        <p className="muted">{symbols.length ? "Loading" : "No books followed"}</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr) 280px",
            gap: 12,
          }}
        >
          <section className="panel">
            <PanelTitle>Depth</PanelTitle>
            <Chart
              label={`Cumulative depth of ${symbol}`}
              height={360}
              option={{
                tooltip: { trigger: "axis" },
                xAxis: {
                  type: "value",
                  scale: true,
                  axisLabel: { formatter: (value: number) => value.toFixed(0) },
                },
                yAxis: { type: "value" },
                series: [
                  {
                    type: "line",
                    step: "end",
                    data: cumulative(book.bids),
                    areaStyle: { opacity: 0.2 },
                    color: GAIN,
                    symbol: "none",
                    name: "Bids",
                  },
                  {
                    type: "line",
                    step: "start",
                    data: cumulative(book.asks),
                    areaStyle: { opacity: 0.2 },
                    color: LOSS,
                    symbol: "none",
                    name: "Asks",
                  },
                ],
              }}
            />
          </section>
          <section className="panel">
            <PanelTitle>Ladder</PanelTitle>
            <QuickOrder symbols={symbols} mid={book.mid} key={symbol} />
            <p className="muted" style={{ margin: "4px 0" }}>
              Click a price or size for a ticket at that level; drag across depth bars for a TWAP;
              drag your order to move it; right-click for more.
            </p>
            <Ladder
              symbol={symbol}
              asks={book.asks}
              bids={book.bids}
              mid={book.mid}
              spread={book.spread_bps}
            />
          </section>
          <section className="panel stack">
            <PanelTitle>Metrics</PanelTitle>
            {book.imbalance_levels.map((item) => (
              <Figure
                key={item.depth}
                label={`Imbalance, ${item.depth} levels`}
                value={lean(item.value)}
              />
            ))}
            <Figure
              label="Order flow, 1 minute"
              value={book.flow ? book.flow.ofi_60.toFixed(3) : "—"}
            />
            <Figure label="Order flow, 5 minutes" value={ofi5.toFixed(3)} />
            <Figure
              label="Spread"
              value={`${money(book.spread)} · ${book.spread_bps.toFixed(2)} bps`}
              note={book.spread_ratio ? `${book.spread_ratio.toFixed(1)}× usual` : undefined}
            />
            <Figure
              label="Depth within 10 bps"
              value={
                book.depth[0]
                  ? `${quantity(book.depth[0].bid)} / ${quantity(book.depth[0].ask)}`
                  : "—"
              }
            />
            {trade ? (
              <Figure
                label="Last trade"
                value={`${money(trade.price)} × ${quantity(trade.size)}`}
                note={time(trade.time)}
              />
            ) : null}
          </section>
        </div>
      )}
      {points.length ? (
        <section className="panel">
          <PanelTitle>Last 30 minutes</PanelTitle>
          <Chart
            label="Imbalance and spread over the last 30 minutes"
            height={180}
            option={{
              tooltip: { trigger: "axis" },
              legend: { top: 0, right: 0, textStyle: { color: GRAY } },
              grid: { left: 8, right: 16, top: 32, bottom: 8, containLabel: true },
              xAxis: { type: "time" },
              yAxis: [
                { type: "value", min: -1, max: 1 },
                { type: "value", splitLine: { show: false } },
              ],
              series: [
                {
                  type: "line",
                  name: "Imbalance, 10 levels",
                  symbol: "none",
                  color: dark ? ACCENT_DARK : ACCENT_LIGHT,
                  data: spark((p) => p.imbalance[1]?.value),
                },
                {
                  type: "line",
                  name: "Spread, bps",
                  symbol: "none",
                  yAxisIndex: 1,
                  data: spark((p) => p.spread_bps),
                  color: "#898781",
                },
              ],
            }}
          />
        </section>
      ) : null}
    </div>
  );
}
