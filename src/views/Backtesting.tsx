import {
  Button,
  Callout,
  FormGroup,
  HTMLSelect,
  HTMLTable,
  NumericInput,
  Switch,
  Tag,
  Tooltip,
} from "@blueprintjs/core";
import { useQueryClient } from "@tanstack/react-query";
import type { ColDef } from "ag-grid-community";
import { useState } from "react";
import { api, detail } from "../api/client";
import type { components } from "../api/schema";
import { ACCENT_DARK, ACCENT_LIGHT, Chart, GRAY } from "../components/Chart";
import { numClass, percentCell, timeCell, toneClass } from "../components/cells";
import { Explained, PanelTitle, Th } from "../components/Explained";
import { Grid } from "../components/Grid";
import { percent, signedPercent } from "../format";
import { page } from "../glossary";
import { useDark } from "../shell/theme";

type Run = components["schemas"]["BacktestRun"];
type Variant = components["schemas"]["Variant"];
type Family = "halal-etf-trend" | "btc-trend-200" | "halal-etf-rotation";

interface Choice {
  value: Family;
  label: string;
  momentum: boolean;
  window: [number, number, number];
}

const TREND: Choice = {
  value: "halal-etf-trend",
  label: "Shariah ETF trend",
  momentum: false,
  window: [100, 250, 25],
};
const FAMILIES: Choice[] = [
  TREND,
  { value: "btc-trend-200", label: "Bitcoin trend", momentum: false, window: [100, 250, 25] },
  {
    value: "halal-etf-rotation",
    label: "Shariah ETF dual momentum",
    momentum: true,
    window: [63, 252, 63],
  },
];

export function variantCount(
  window: [number, number, number],
  top: [number, number] | null,
): number {
  const [start, stop, step] = window;
  const windows = step > 0 && stop >= start ? Math.floor((stop - start) / step) + 1 : 0;
  return top ? windows * Math.max(0, top[1] - top[0] + 1) : windows;
}

function Form() {
  const client = useQueryClient();
  const [family, setFamily] = useState<Family>("halal-etf-trend");
  const chosen = FAMILIES.find((item) => item.value === family) ?? TREND;
  const [window, setWindow] = useState<[number, number, number]>(chosen.window);
  const [top, setTop] = useState<[number, number]>([1, 2]);
  const [years, setYears] = useState(8);
  const [event, setEvent] = useState(false);
  const submit = api.useMutation("post", "/systematic/backtests", {
    onSuccess: () => client.invalidateQueries({ queryKey: ["get", "/systematic/backtests"] }),
  });
  const pick = (value: Family) => {
    const found = FAMILIES.find((item) => item.value === value);
    setFamily(value);
    if (found) setWindow(found.window);
    setEvent(false);
  };
  const count = variantCount(window, chosen.momentum ? top : null);
  const set = (index: number) => (value: number) =>
    setWindow(
      (current) =>
        current.map((item, at) => (at === index ? value : item)) as [number, number, number],
    );
  return (
    <section className="panel stack">
      <PanelTitle>New backtest</PanelTitle>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
        <FormGroup label="Rule" labelFor="bt-family" style={{ margin: 0 }}>
          <HTMLSelect
            id="bt-family"
            value={family}
            onChange={(e) => pick(e.currentTarget.value as Family)}
            options={FAMILIES.map(({ value, label }) => ({ value, label }))}
          />
        </FormGroup>
        <FormGroup label="Years" labelFor="bt-years" style={{ margin: 0 }}>
          <NumericInput
            id="bt-years"
            min={2}
            max={8}
            value={years}
            onValueChange={setYears}
            style={{ width: 60 }}
          />
        </FormGroup>
        <FormGroup label="Window, days: from, to, step" style={{ margin: 0 }}>
          <div style={{ display: "flex", gap: 4 }}>
            <NumericInput
              aria-label="Window from"
              min={1}
              value={window[0]}
              onValueChange={set(0)}
              style={{ width: 70 }}
            />
            <NumericInput
              aria-label="Window to"
              min={1}
              value={window[1]}
              onValueChange={set(1)}
              style={{ width: 70 }}
            />
            <NumericInput
              aria-label="Window step"
              min={1}
              value={window[2]}
              onValueChange={set(2)}
              style={{ width: 60 }}
            />
          </div>
        </FormGroup>
        {chosen.momentum ? (
          <FormGroup label="Funds held: from, to" style={{ margin: 0 }}>
            <div style={{ display: "flex", gap: 4 }}>
              <NumericInput
                aria-label="Funds from"
                min={1}
                max={3}
                value={top[0]}
                onValueChange={(v) => setTop([v, top[1]])}
                style={{ width: 60 }}
              />
              <NumericInput
                aria-label="Funds to"
                min={1}
                max={3}
                value={top[1]}
                onValueChange={(v) => setTop([top[0], v])}
                style={{ width: 60 }}
              />
            </div>
          </FormGroup>
        ) : (
          <Switch
            checked={event}
            onChange={() => setEvent(!event)}
            label="Then check the best in Nautilus"
            style={{ margin: 0 }}
          />
        )}
        <Button
          intent="primary"
          icon="play"
          loading={submit.isPending}
          onClick={() =>
            submit.mutate({
              body: {
                family,
                years,
                window: { start: window[0], stop: window[1], step: window[2] },
                top_n: chosen.momentum ? { start: top[0], stop: top[1], step: 1 } : null,
                event,
              },
            })
          }
        >
          Run {count} variant{count === 1 ? "" : "s"}
        </Button>
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Every variant counts as a trial: each one tried raises the bar the deflated Sharpe sets for
        every rule, including the ones trading.
      </p>
      {submit.error ? <Callout intent="danger">{detail(submit.error)}</Callout> : null}
    </section>
  );
}

const RUNS: ColDef<Run>[] = [
  {
    field: "created",
    headerName: "Submitted",
    valueFormatter: timeCell,
    cellClass: numClass,
    sort: "desc",
  },
  { headerName: "Rule", valueGetter: (p) => p.data?.request.family },
  {
    headerName: "Span",
    valueGetter: (p) =>
      p.data?.start ? `${p.data.start} to ${p.data.end}` : `${p.data?.request.years} years`,
  },
  {
    headerName: "Variants",
    valueGetter: (p) => p.data?.variants.length || "",
    cellClass: numClass,
  },
  {
    field: "status",
    headerName: "Status",
    cellClass: (p) => (p.value === "failed" ? "loss" : p.value === "complete" ? "" : "warn-text"),
  },
  {
    headerName: "Best Sharpe",
    valueGetter: (p) => p.data?.variants.find((v) => v.label === p.data?.best)?.sharpe ?? null,
    valueFormatter: (p) => (p.value == null ? "—" : p.value.toFixed(2)),
    cellClass: numClass,
  },
  {
    headerName: "Best drawdown",
    valueGetter: (p) =>
      p.data?.variants.find((v) => v.label === p.data?.best)?.max_drawdown ?? null,
    valueFormatter: percentCell,
    cellClass: numClass,
  },
];

const VARIANTS: ColDef<Variant>[] = [
  { field: "label", headerName: "Variant" },
  {
    field: "sharpe",
    headerName: "Sharpe",
    valueFormatter: (p) => p.value.toFixed(2),
    cellClass: numClass,
    sort: "desc",
  },
  { field: "cagr", headerName: "CAGR", valueFormatter: percentCell, cellClass: toneClass },
  {
    field: "max_drawdown",
    headerName: "Max drawdown",
    valueFormatter: percentCell,
    cellClass: numClass,
  },
  {
    field: "deflated_sharpe",
    headerName: "Deflated Sharpe",
    valueFormatter: percentCell,
    cellClass: numClass,
  },
  { field: "checks_passed", headerName: "Checks", valueFormatter: (p) => `${p.value} of 5` },
];

function Result({ run }: { run: Run }) {
  const dark = useDark();
  const accent = dark ? ACCENT_DARK : ACCENT_LIGHT;
  if (run.status !== "complete") {
    return (
      <Callout intent={run.status === "failed" ? "danger" : "none"}>
        {run.status === "failed" ? run.detail : "Running"}
      </Callout>
    );
  }
  const heat = run.heatmap;
  const passed = run.checks.every((check) => check.passed);
  return (
    <div className="stack">
      <section className="panel">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 className="panel-title" style={{ margin: 0, flex: 1 }}>
            Best: {run.best}, {run.start} to {run.end}, {run.trials} trials counted
          </h2>
          <Tooltip content="Rules are fixed: a variant never trades. The catalog's rule trades once its lifecycle reaches canary.">
            <Button disabled icon="arrow-up">
              Promote to paper trading
            </Button>
          </Tooltip>
        </div>
        <Chart
          label="Growth of the best variant against buy and hold"
          height={240}
          option={{
            tooltip: { trigger: "axis" },
            legend: { top: 0, right: 0 },
            grid: { left: 8, right: 16, top: 28, bottom: 8, containLabel: true },
            xAxis: { type: "time" },
            yAxis: { type: "value", scale: true },
            series: [
              {
                type: "line",
                name: "Variant",
                symbol: "none",
                color: accent,
                data: run.growth.map((p) => [p.time, p.strategy]),
              },
              {
                type: "line",
                name: "Buy and hold",
                symbol: "none",
                color: GRAY,
                data: run.growth.map((p) => [p.time, p.benchmark]),
              },
            ],
          }}
        />
        <div>
          {run.checks.map((check) => (
            <div key={check.name}>
              <span className={check.passed ? "gain" : "loss"}>{check.passed ? "✓" : "✕"}</span>{" "}
              {check.name}
            </div>
          ))}
          {!passed ? <p className="muted">The best variant does not pass every check.</p> : null}
        </div>
      </section>
      <div
        style={{ display: "grid", gridTemplateColumns: "minmax(0,1.2fr) minmax(0,1fr)", gap: 12 }}
      >
        <section className="panel">
          <PanelTitle>Variants</PanelTitle>
          <Grid
            rows={run.variants}
            columns={VARIANTS}
            rowId={(row) => row.label}
            height={300}
            dark={dark}
          />
        </section>
        <section className="panel">
          <PanelTitle>Sharpe by parameters</PanelTitle>
          {heat ? (
            <Chart
              label="Sharpe ratio by window and funds held"
              height={Math.max(140, 60 + heat.tops.length * 40)}
              option={{
                tooltip: {
                  formatter: (p: unknown) => {
                    const v = (p as { value: [number, number, number] }).value;
                    return `${heat.windows[v[0]]} days, top ${heat.tops[v[1]]}: ${v[2]?.toFixed(2)}`;
                  },
                },
                grid: { left: 8, right: 16, top: 8, bottom: 48, containLabel: true },
                xAxis: { type: "category", data: heat.windows.map(String), name: "Window" },
                yAxis: { type: "category", data: heat.tops.map((top) => `top ${top}`) },
                visualMap: {
                  min: Math.min(...heat.sharpe.flat().filter((v): v is number => v != null)),
                  max: Math.max(...heat.sharpe.flat().filter((v): v is number => v != null)),
                  orient: "horizontal",
                  left: "center",
                  bottom: 0,
                  itemHeight: 120,
                  inRange: { color: [dark ? "#2a2a28" : "#f0efea", accent] },
                  textStyle: { color: GRAY },
                },
                series: [
                  {
                    type: "heatmap",
                    label: {
                      show: true,
                      formatter: (p: unknown) =>
                        (p as { value: number[] }).value[2]?.toFixed(2) ?? "",
                    },
                    data: heat.sharpe.flatMap((row, y) => row.map((value, x) => [x, y, value])),
                  },
                ],
              }}
            />
          ) : null}
        </section>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 12 }}>
        <section className="panel">
          <PanelTitle>Walk-forward folds of the best</PanelTitle>
          <HTMLTable compact striped style={{ width: "100%" }}>
            <thead>
              <tr>
                <Th>Fold</Th>
                <Th>Sharpe</Th>
                <Th>CAGR</Th>
                <Th>Drawdown</Th>
                <Th>Days up</Th>
                <th />
              </tr>
            </thead>
            <tbody className="num">
              {run.folds.map((fold) => (
                <tr key={fold.start}>
                  <td>
                    {fold.start} to {fold.end}
                  </td>
                  <td>{fold.sharpe == null ? "—" : fold.sharpe.toFixed(2)}</td>
                  <td>{percent(fold.cagr)}</td>
                  <td>{percent(fold.max_drawdown)}</td>
                  <td>{percent(fold.win_rate, 0)}</td>
                  <td>
                    <Tag minimal intent={fold.passed ? "success" : "danger"}>
                      {fold.passed ? "Profit" : "Loss"}
                    </Tag>
                  </td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        </section>
        <section className="panel">
          <PanelTitle>Bias controls</PanelTitle>
          {run.bias.map((item) => (
            <div key={item.name} style={{ marginBottom: 4 }}>
              <span className={item.applied ? "gain" : item.applied === false ? "loss" : "muted"}>
                {item.applied ? "✓" : item.applied === false ? "✕" : "–"}
              </span>{" "}
              <strong>{item.name}</strong> <span className="muted">· {item.detail}</span>
            </div>
          ))}
          {run.event ? (
            <p className="num">
              Nautilus: CAGR {percent(run.event.event.cagr)} against{" "}
              {percent(run.event.vector.cagr)} vectorised, gap {signedPercent(run.event.cagr_gap)} a
              year
            </p>
          ) : null}
        </section>
      </div>
      <section className="panel">
        <h2 className="panel-title">Trades of the best, {run.trades.length}</h2>
        <HTMLTable compact striped style={{ width: "100%" }}>
          <thead>
            <tr>
              <Th>Entry</Th>
              <Th>Exit</Th>
              <Th>Days</Th>
              <Th>Result</Th>
            </tr>
          </thead>
          <tbody className="num">
            {[...run.trades]
              .reverse()
              .slice(0, 40)
              .map((trade) => (
                <tr key={trade.entry}>
                  <td>{trade.entry}</td>
                  <td>{trade.exit}</td>
                  <td>{trade.days}</td>
                  <td className={trade.result >= 0 ? "gain" : "loss"}>
                    {signedPercent(trade.result)}
                  </td>
                </tr>
              ))}
          </tbody>
        </HTMLTable>
      </section>
    </div>
  );
}

export function Backtesting() {
  const dark = useDark();
  const runs = api.useQuery("get", "/systematic/backtests", undefined, {
    refetchInterval: (query) =>
      (query.state.data ?? []).some((run) => run.status === "queued" || run.status === "running")
        ? 2_000
        : false,
  });
  const [chosen, setChosen] = useState<string | null>(null);
  const all = runs.data ?? [];
  const current = all.find((run) => run.id === chosen) ?? all[0];
  return (
    <div className="stack">
      <h1 className="panel-title" style={{ margin: 0 }}>
        <Explained text={page("Backtesting")}>Backtesting</Explained>
      </h1>
      <Form />
      <section className="panel">
        <PanelTitle>Runs</PanelTitle>
        <Grid
          rows={all}
          columns={RUNS}
          rowId={(row) => row.id}
          onRow={(row) => setChosen(row.id)}
          empty="No backtests yet"
          dark={dark}
        />
      </section>
      {current ? <Result run={current} /> : null}
    </div>
  );
}
