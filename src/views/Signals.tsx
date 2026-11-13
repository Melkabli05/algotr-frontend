import { Button, Callout, Collapse, HTMLSelect, HTMLTable, Tag } from "@blueprintjs/core";
import { useQueryClient } from "@tanstack/react-query";
import type { ColDef } from "ag-grid-community";
import { useMemo, useState } from "react";
import { api } from "../api/client";
import { Chart, GAIN, GRAY, LOSS } from "../components/Chart";
import { numClass } from "../components/cells";
import { Explained, PanelTitle, Th } from "../components/Explained";
import { Grid } from "../components/Grid";
import { percent, signedPercent } from "../format";
import { page } from "../glossary";
import { useDark } from "../shell/theme";
import { ConfidenceBadge, confidenceOf, useConfidence } from "./confidence";
import { Outcomes } from "./Outcomes";
import {
  type Explanations,
  nameOf,
  narrative,
  percentile,
  type Signal,
  signalsOf,
  waterfall,
} from "./xai";

const ALGORITHMS = ["ppo", "sac", "a2c"] as const;

function DriftBanner() {
  const [open, setOpen] = useState(false);
  const drift = api.useQuery("get", "/drift/status", undefined, { refetchInterval: 60_000 });
  const client = useQueryClient();
  const check = api.useMutation("post", "/drift/check", {
    onSuccess: () => client.invalidateQueries({ queryKey: ["get", "/drift/status"] }),
  });
  const streams = drift.data?.streams ?? [];
  const cut = streams.filter((stream) => stream.until);
  const month = Date.now() - 30 * 86_400_000;
  const recent = streams.filter((stream) =>
    stream.events.some((event) => event.adverse && new Date(event.time).getTime() > month),
  );
  const state = cut.length ? "danger" : recent.length ? "warning" : "success";
  const line = cut.length
    ? `Sized down: ${cut.map((stream) => stream.name).join(", ")}; retraining asked`
    : recent.length
      ? `Adverse change in the last 30 days: ${recent.map((stream) => stream.name).join(", ")}`
      : "No adverse drift in the last 30 days";
  return (
    <Callout intent={state} icon={state === "success" ? "tick-circle" : "warning-sign"} compact>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Drift · {line}</span>
        <Button
          small
          minimal
          icon="refresh"
          loading={check.isPending}
          onClick={() => check.mutate({})}
        >
          Check now
        </Button>
        <Button
          small
          minimal
          onClick={() => setOpen(!open)}
          rightIcon={open ? "chevron-up" : "chevron-down"}
        >
          Streams
        </Button>
      </div>
      <Collapse isOpen={open}>
        <HTMLTable compact style={{ width: "100%" }}>
          <thead>
            <tr>
              <Th>Stream</Th>
              <Th>Distance from baseline</Th>
              <Th>Size</Th>
              <Th>Last change</Th>
            </tr>
          </thead>
          <tbody className="num">
            {streams.map((stream) => {
              const last = stream.events.at(-1);
              return (
                <tr key={stream.name}>
                  <td>{stream.name}</td>
                  <td>{stream.distance == null ? "—" : stream.distance.toFixed(2)}</td>
                  <td>{percent(stream.scale, 0)}</td>
                  <td>
                    {last ? `${last.time} ${last.kind}${last.adverse ? ", adverse" : ""}` : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </HTMLTable>
      </Collapse>
    </Callout>
  );
}

const COLUMNS: ColDef<Signal>[] = [
  { field: "decided", headerName: "Day", sort: "desc", cellClass: numClass, minWidth: 104 },
  { field: "algorithm", headerName: "Model", valueFormatter: (p) => String(p.value).toUpperCase() },
  { field: "symbol", headerName: "Symbol" },
  {
    field: "direction",
    headerName: "Signal",
    cellClass: (p) => (p.value === "Buy" ? "gain" : p.value === "Sell" ? "loss" : "muted"),
  },
  {
    field: "confidence",
    headerName: "Confidence",
    cellRenderer: (p: { value: number | null | undefined }) => (
      <ConfidenceBadge value={p.value ?? null} />
    ),
    type: "rightAligned",
  },
  {
    field: "weight",
    headerName: "Weight",
    valueFormatter: (p) => percent(p.value),
    cellClass: numClass,
    type: "rightAligned",
  },
  {
    field: "change",
    headerName: "Change",
    valueFormatter: (p) => signedPercent(p.value, 1),
    cellClass: numClass,
    type: "rightAligned",
  },
];

export function Detail({
  signal,
  explanations,
  traded,
}: {
  signal: Signal;
  explanations: Explanations;
  traded: boolean;
}) {
  const client = useQueryClient();
  const feedback = api.useQuery("get", "/systematic/signals/feedback");
  const give = api.useMutation("post", "/systematic/signals/feedback", {
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["get", "/systematic/signals/feedback"] }),
  });
  const { decision, symbol } = signal;
  const bars = waterfall(decision, symbol);
  const verdict = (feedback.data ?? []).find(
    (item) => item.algorithm === signal.algorithm && item.decided === signal.decided,
  );
  const groups = Object.keys(decision.values);
  const history = (group: string) =>
    explanations.decisions
      .map((found) => found.inputs[group]?.[symbol])
      .filter((value): value is number => value != null);
  const overall = explanations.overall?.values ?? {};
  const importance = Object.entries(overall)
    .map(([group, values]) => ({ group, value: values[symbol] ?? 0 }))
    .sort((a, b) => a.value - b.value);
  return (
    <div className="stack">
      <section className="panel">
        <div style={{ display: "flex", gap: 12, alignItems: "baseline", flexWrap: "wrap" }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>
            {signal.direction} {symbol} · {percent(signal.weight)}
          </h2>
          <span className="muted">
            {explanations.algorithm.toUpperCase()} model {decision.version}, trained{" "}
            {decision.trained}, decided {decision.decided}
          </span>
          <Tag minimal>
            {traded ? "Traded through the ensemble" : "Held in the agents' pretend portfolio"}
          </Tag>
        </div>
        <p>{narrative(signal, explanations)}</p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Button
            small
            icon="thumbs-up"
            active={verdict?.verdict === "agree"}
            loading={give.isPending}
            onClick={() =>
              give.mutate({
                body: {
                  algorithm: signal.algorithm,
                  decided: signal.decided,
                  verdict: "agree",
                  note: symbol,
                },
              })
            }
          >
            Agree with decision
          </Button>
          <Button
            small
            icon="flag"
            intent={verdict?.verdict === "flag" ? "warning" : "none"}
            loading={give.isPending}
            onClick={() =>
              give.mutate({
                body: {
                  algorithm: signal.algorithm,
                  decided: signal.decided,
                  verdict: "flag",
                  note: symbol,
                },
              })
            }
          >
            Flag for review
          </Button>
          {verdict ? (
            <span className="muted">
              Recorded: {verdict.verdict === "agree" ? "agreed" : "flagged"}
            </span>
          ) : null}
        </div>
      </section>
      <section className="panel">
        <h2 className="panel-title">
          SHAP, from the average weight {percent(decision.base[symbol])} to {percent(signal.weight)}
        </h2>
        <Chart
          label={`SHAP waterfall for ${symbol}`}
          height={40 + bars.length * 28}
          option={{
            tooltip: {
              trigger: "axis",
              axisPointer: { type: "shadow" },
              formatter: (items: unknown) => {
                const [first] = items as { dataIndex: number }[];
                const bar = first ? bars[first.dataIndex] : undefined;
                return bar ? `${bar.label}: ${signedPercent(bar.value, 1)}` : "";
              },
            },
            xAxis: {
              type: "value",
              axisLabel: { formatter: (value: number) => `${(value * 100).toFixed(0)}%` },
            },
            yAxis: { type: "category", inverse: true, data: bars.map((bar) => bar.label) },
            series: [
              {
                type: "bar",
                stack: "w",
                itemStyle: { color: "transparent" },
                data: bars.map((bar) => Math.min(bar.start, bar.end)),
                silent: true,
              },
              {
                type: "bar",
                stack: "w",
                data: bars.map((bar) => ({
                  value: Math.abs(bar.value),
                  itemStyle: { color: bar.value >= 0 ? GAIN : LOSS },
                })),
                label: {
                  show: true,
                  position: "right",
                  formatter: (params: { dataIndex: number }) =>
                    signedPercent(bars[params.dataIndex]?.value ?? 0, 1),
                  color: GRAY,
                },
              },
            ],
          }}
        />
      </section>
      <div
        style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr)", gap: 12 }}
      >
        <section className="panel">
          <PanelTitle>Features</PanelTitle>
          <HTMLTable compact striped style={{ width: "100%" }}>
            <thead>
              <tr>
                <Th>Feature</Th>
                <Th>Value (z)</Th>
                <Th>Push</Th>
                <th>Percentile, last {explanations.decisions.length} days</th>
              </tr>
            </thead>
            <tbody className="num">
              {groups
                .map((group) => ({
                  group,
                  input: decision.inputs[group]?.[symbol],
                  push: decision.values[group]?.[symbol] ?? 0,
                }))
                .sort((a, b) => Math.abs(b.push) - Math.abs(a.push))
                .map(({ group, input, push }) => {
                  const rank = input == null ? null : percentile(history(group), input);
                  return (
                    <tr key={group}>
                      <td>{nameOf(group)}</td>
                      <td>{input == null ? "—" : input.toFixed(2)}</td>
                      <td className={push > 0 ? "gain" : push < 0 ? "loss" : ""}>
                        {signedPercent(push, 1)}
                      </td>
                      <td>{rank == null ? "—" : `${Math.round(rank * 100)}th`}</td>
                    </tr>
                  );
                })}
            </tbody>
          </HTMLTable>
        </section>
        <section className="panel">
          <h2 className="panel-title">
            What the model relies on,{" "}
            {explanations.overall ? `${explanations.overall.days} training days` : "no sample yet"}
          </h2>
          <Chart
            label={`Average SHAP importance for ${symbol}`}
            height={40 + importance.length * 22}
            option={{
              tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
              xAxis: { type: "value", splitNumber: 3 },
              yAxis: { type: "category", data: importance.map((item) => nameOf(item.group)) },
              series: [{ type: "bar", data: importance.map((item) => item.value), color: GRAY }],
            }}
          />
        </section>
      </div>
    </div>
  );
}

export function Signals() {
  const dark = useDark();
  const ppo = api.useQuery("get", "/systematic/agents/{algorithm}/explanations", {
    params: { path: { algorithm: "ppo" }, query: { limit: 60 } },
  });
  const sac = api.useQuery("get", "/systematic/agents/{algorithm}/explanations", {
    params: { path: { algorithm: "sac" }, query: { limit: 60 } },
  });
  const a2c = api.useQuery("get", "/systematic/agents/{algorithm}/explanations", {
    params: { path: { algorithm: "a2c" }, query: { limit: 60 } },
  });
  const overview = api.useQuery("get", "/systematic/overview", undefined, { staleTime: 60_000 });
  const [model, setModel] = useState<string>("all");
  const [symbol, setSymbol] = useState<string>("all");
  const [moves, setMoves] = useState(false);
  const [chosen, setChosen] = useState<string | null>(null);
  const found = useMemo(
    () => [ppo.data, sac.data, a2c.data].filter((item): item is Explanations => Boolean(item)),
    [ppo.data, sac.data, a2c.data],
  );
  const sure = useConfidence();
  const all = useMemo(
    () =>
      found
        .flatMap(signalsOf)
        .map((signal) => ({ ...signal, confidence: confidenceOf(sure, signal) })),
    [found, sure],
  );
  const shown = all.filter(
    (signal) =>
      (model === "all" || signal.algorithm === model) &&
      (symbol === "all" || signal.symbol === symbol) &&
      (!moves || signal.direction !== "Hold"),
  );
  const current = all.find((signal) => signal.key === chosen) ?? shown[0];
  const explanations = found.find((item) => item.algorithm === current?.algorithm);
  const symbols = [...new Set(all.map((signal) => signal.symbol))];
  return (
    <div className="stack">
      <h1 className="panel-title" style={{ margin: 0 }}>
        <Explained text={page("Signals and explanations")}>Signals and explanations</Explained>
      </h1>
      <DriftBanner />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 520px) minmax(0, 1fr)",
          gap: 12,
          alignItems: "start",
        }}
      >
        <section className="panel stack">
          <div style={{ display: "flex", gap: 8 }}>
            <HTMLSelect
              value={model}
              onChange={(event) => setModel(event.currentTarget.value)}
              options={[
                { value: "all", label: "All models" },
                ...ALGORITHMS.map((value) => ({ value, label: value.toUpperCase() })),
              ]}
              aria-label="Model"
            />
            <HTMLSelect
              value={symbol}
              onChange={(event) => setSymbol(event.currentTarget.value)}
              options={[
                { value: "all", label: "All symbols" },
                ...symbols.map((value) => ({ value, label: value })),
              ]}
              aria-label="Symbol"
            />
            <Button small active={moves} onClick={() => setMoves(!moves)}>
              Moves only
            </Button>
          </div>
          <Grid
            rows={shown}
            columns={COLUMNS}
            rowId={(row) => row.key}
            onRow={(row) => setChosen(row.key)}
            height={560}
            empty="No decisions explained yet"
            dark={dark}
          />
        </section>
        {current && explanations ? (
          <Detail
            signal={current}
            explanations={explanations}
            traded={overview.data?.ensemble_active ?? false}
          />
        ) : (
          <p className="muted">No decision chosen</p>
        )}
      </div>
      <h2 className="panel-title" style={{ margin: "8px 0 0" }}>
        Prediction outcomes
      </h2>
      <Outcomes />
    </div>
  );
}
