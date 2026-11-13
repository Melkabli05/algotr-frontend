import {
  Button,
  Callout,
  Dialog,
  DialogBody,
  DialogFooter,
  HTMLTable,
  Tag,
} from "@blueprintjs/core";
import { useQueryClient } from "@tanstack/react-query";
import type { ColDef } from "ag-grid-community";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { api, detail } from "../api/client";
import type { components } from "../api/schema";
import { ACCENT_DARK, ACCENT_LIGHT, Chart, GRAY } from "../components/Chart";
import { numClass, percentCell, toneClass } from "../components/cells";
import { Explained, PanelTitle, Th } from "../components/Explained";
import { Figure } from "../components/Figure";
import { Grid } from "../components/Grid";
import { Loadable } from "../components/Loadable";
import { day, money, percent, signedPercent, time } from "../format";
import { page } from "../glossary";
import { useDark } from "../shell/theme";
import { Promotion, Tracking } from "./Promotion";
import { Archived, DefinitionActions, LibraryBar, VersionHistory } from "./StrategyLibrary";

type Item = components["schemas"]["StrategyOverview"];
type Config = components["schemas"]["AutomationConfig"];

export function standing(item: Item, config: Config | undefined): string {
  if (config?.paused?.includes(item.spec.name)) return "Paused";
  if (item.active)
    return config?.mode === "paper" ? "Paper" : config?.mode === "dry-run" ? "Dry run" : "Selected";
  if (!item.research) return "No data";
  if (item.streak > 0) return `Passing ${item.streak} of 10 days`;
  return "Failed checks";
}

interface Row {
  name: string;
  title: string;
  type: string;
  status: string;
  sharpe: number | null;
  cagr: number | null;
  drawdown: number | null;
  checks: string;
}

const COLUMNS: ColDef<Row>[] = [
  { field: "title", headerName: "Strategy", minWidth: 220 },
  { field: "type", headerName: "Type" },
  { field: "status", headerName: "Status" },
  {
    field: "sharpe",
    headerName: "Sharpe",
    valueFormatter: (p) => (p.value == null ? "—" : p.value.toFixed(2)),
    cellClass: numClass,
    type: "rightAligned",
  },
  {
    field: "cagr",
    headerName: "CAGR",
    valueFormatter: percentCell,
    cellClass: toneClass,
    type: "rightAligned",
  },
  {
    field: "drawdown",
    headerName: "Max drawdown",
    valueFormatter: percentCell,
    cellClass: numClass,
    type: "rightAligned",
  },
  { field: "checks", headerName: "Checks" },
];

export function Strategies() {
  const overview = api.useQuery("get", "/systematic/overview", undefined, { staleTime: 60_000 });
  const navigate = useNavigate();
  const dark = useDark();
  const config = overview.data?.status.config;
  const rows: Row[] = (overview.data?.strategies ?? []).map((item) => ({
    name: item.spec.name,
    title: item.spec.title,
    type: "Rule",
    status: standing(item, config),
    sharpe: item.research?.metrics.sharpe ?? null,
    cagr: item.research?.metrics.cagr ?? null,
    drawdown: item.research?.metrics.max_drawdown ?? null,
    checks: item.research
      ? `${item.research.checks.filter((c) => c.passed).length} of ${item.research.checks.length}`
      : "",
  }));
  if (overview.data) {
    rows.push({
      name: "ai-ensemble",
      title: "Agent ensemble (PPO, SAC, A2C)",
      type: "Reinforcement learning",
      status: overview.data.ensemble_active
        ? "Paper"
        : overview.data.ensemble_streak > 0
          ? `Passing ${overview.data.ensemble_streak} of 10 days`
          : "Failed checks",
      sharpe: null,
      cagr: null,
      drawdown: null,
      checks: "See Signals",
    });
  }
  return (
    <div className="stack">
      <div className="row">
        <h1 className="panel-title grow">
          <Explained text={page("Strategies")}>Strategies</Explained>
        </h1>
        <LibraryBar />
        <RunNow />
      </div>
      <p className="muted" style={{ margin: 0 }}>
        Each saved version of a rule is fixed; editing makes a new one. A version earns the right to
        trade through its lifecycle: research, validated, shadow (paper only), canary (a tenth of
        its capital), then live once you approve it on the Automation page.
      </p>
      <div className="panel">
        <Grid
          rows={rows}
          columns={COLUMNS}
          rowId={(row) => row.name}
          onRow={(row) =>
            navigate(row.name === "ai-ensemble" ? "/signals" : `/strategies/${row.name}`)
          }
          empty={overview.isLoading ? "Loading" : "No strategies"}
          dark={dark}
        />
      </div>
      <Archived />
      <Promotion />
    </div>
  );
}

function Pause({ name, config }: { name: string; config: Config }) {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const paused = (config.paused ?? []).includes(name as never);
  const save = api.useMutation("put", "/systematic/automation", {
    onSuccess: () => {
      client.invalidateQueries();
      setOpen(false);
    },
  });
  const next = paused
    ? (config.paused ?? []).filter((item) => item !== name)
    : [...(config.paused ?? []), name];
  return (
    <>
      <Button icon={paused ? "play" : "pause"} onClick={() => setOpen(true)}>
        {paused ? "Resume" : "Pause"}
      </Button>
      <Dialog
        isOpen={open}
        onClose={() => setOpen(false)}
        title={paused ? "Resume strategy" : "Pause strategy"}
      >
        <DialogBody>
          <p>
            {paused
              ? "The strategy is chosen again when it passes its checks; the next run trades it."
              : "The next run sells what this strategy holds and leaves it out until resumed."}
          </p>
          {save.error ? <Callout intent="danger">{detail(save.error)}</Callout> : null}
        </DialogBody>
        <DialogFooter
          actions={
            <Button
              intent="primary"
              loading={save.isPending}
              onClick={() => save.mutate({ body: { ...config, paused: next as never } })}
            >
              {paused ? "Resume" : "Pause"}
            </Button>
          }
        />
      </Dialog>
    </>
  );
}

const PARAMETERS: [string, string][] = [
  ["signal", "Signal"],
  ["window", "Window, days"],
  ["lookbacks", "Lookbacks, days"],
  ["top_n", "Holdings"],
  ["target_vol", "Target volatility"],
  ["vol_window", "Volatility window, days"],
  ["trade_rate", "Traded each day"],
  ["band", "No-trade band"],
  ["fee_bps", "Cost per trade, bps"],
  ["fills", "Fills"],
  ["proxy", "Long-history proxy"],
];

const WORDS: Record<string, string> = {
  sma: "Price above its average",
  momentum: "Dual momentum",
  donchian: "Donchian breakout",
  multitrend: "Multi-speed trend",
  next_open: "Next open",
  close: "Close",
  true: "Yes",
  false: "No",
};

export function shown(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  return WORDS[String(value)] ?? String(value);
}

export function StrategyDetail() {
  const { name = "" } = useParams();
  const dark = useDark();
  const overview = api.useQuery("get", "/systematic/overview", undefined, { staleTime: 60_000 });
  const stats = api.useQuery("get", "/systematic/strategies/{name}/stats", {
    params: { path: { name: name as never } },
  });
  const check = api.useMutation("post", "/systematic/validate/{name}");
  const item = overview.data?.strategies.find((found) => found.spec.name === name);
  const config = overview.data?.status.config;
  if (!item)
    return (
      <Loadable query={overview} rows={6} isEmpty empty="No such strategy">
        {null}
      </Loadable>
    );
  const research = item.research;
  const record = stats.data?.stats;
  const growth = research?.growth ?? [];
  return (
    <div className="stack">
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <h1 style={{ margin: 0, fontSize: 18, flex: 1 }}>{item.spec.title}</h1>
        <Tag minimal>{standing(item, config)}</Tag>
        <DefinitionActions name={name} />
        {config ? <Pause name={name} config={config} /> : null}
      </div>
      <p className="muted" style={{ margin: 0 }}>
        {item.spec.description} {item.spec.note}
      </p>
      <section className="panel strip">
        <Figure lead label="CAGR" value={percent(research?.metrics.cagr)} />
        <Figure label="Sharpe" value={research?.metrics.sharpe.toFixed(2) ?? "—"} />
        <Figure label="Sortino" value={record?.sortino?.toFixed(2) ?? "—"} />
        <Figure label="Calmar" value={record?.calmar?.toFixed(2) ?? "—"} />
        <Figure label="Max drawdown" value={percent(research?.metrics.max_drawdown)} />
        <Figure label="Win rate" value={percent(record?.win_rate)} />
        <Figure label="Profit factor" value={record?.profit_factor?.toFixed(2) ?? "—"} />
        <Figure
          label="Average holding"
          value={record?.average_days == null ? "—" : `${record.average_days.toFixed(0)} days`}
        />
        <Figure label="Capital now" value={money(stats.data?.capital)} />
      </section>
      <Tracking name={name} />
      <section className="panel">
        <h2 className="panel-title">
          Growth of $10,000 against buy and hold,{" "}
          {research ? `${day(research.start)} to ${day(research.end)}` : ""}
        </h2>
        <Chart
          label="Strategy against buy and hold"
          height={280}
          option={{
            tooltip: { trigger: "axis" },
            legend: { top: 0, right: 0 },
            xAxis: { type: "time" },
            yAxis: { type: "value", scale: true },
            series: [
              {
                type: "line",
                name: "Strategy",
                symbol: "none",
                color: dark ? ACCENT_DARK : ACCENT_LIGHT,
                data: growth.map((p) => [p.time, p.strategy]),
              },
              {
                type: "line",
                name: "Buy and hold",
                symbol: "none",
                color: GRAY,
                data: growth.map((p) => [p.time, p.benchmark]),
              },
            ],
          }}
        />
      </section>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <section className="panel">
          <PanelTitle>Checks</PanelTitle>
          {research?.checks.map((found) => (
            <div key={found.name}>
              <span className={found.passed ? "gain" : "loss"}>{found.passed ? "✓" : "✕"}</span>{" "}
              {found.name}
            </div>
          ))}
          {research?.evidence ? (
            <p className="muted">
              On {research.evidence.name}: Sharpe {research.evidence.metrics.sharpe.toFixed(2)}{" "}
              against {research.evidence.benchmark.sharpe.toFixed(2)}, p{" "}
              {percent(research.evidence.sharpe_p)}.
            </p>
          ) : null}
        </section>
        <section className="panel">
          <PanelTitle>Parameters of the current version</PanelTitle>
          <HTMLTable compact>
            <tbody>
              {PARAMETERS.filter(([key]) => {
                const value = item.spec[key as keyof typeof item.spec];
                if (key === "top_n" && item.spec.signal !== "momentum") return false;
                if (key === "vol_window" && item.spec.target_vol == null) return false;
                if (key === "trade_rate" && item.spec.trade_rate === 1) return false;
                if (key === "band" && !item.spec.band) return false;
                return value != null && !(Array.isArray(value) && value.length === 0);
              }).map(([key, label]) => (
                <tr key={key}>
                  <td>{label}</td>
                  <td className="num">{shown(item.spec[key as keyof typeof item.spec])}</td>
                </tr>
              ))}
              <tr>
                <td>Universe</td>
                <td className="num">{item.spec.universe.join(", ")}</td>
              </tr>
            </tbody>
          </HTMLTable>
        </section>
      </div>
      <VersionHistory name={name} />
      <section className="panel">
        <PanelTitle>Recent signals</PanelTitle>
        <HTMLTable compact striped style={{ width: "100%" }}>
          <thead>
            <tr>
              <Th>Run</Th>
              <Th>Weights</Th>
              <Th>Run status</Th>
            </tr>
          </thead>
          <tbody>
            {(stats.data?.signals ?? []).slice(0, 15).map((signal) => (
              <tr key={signal.time}>
                <td className="num">{time(signal.time)}</td>
                <td className="num">
                  {Object.entries(signal.weights)
                    .map(([symbol, weight]) => `${symbol} ${percent(weight, 0)}`)
                    .join(" · ")}
                </td>
                <td>{signal.status}</td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
      </section>
      {item.spec.signal === "sma" ? (
        <section className="panel">
          <PanelTitle>Event-driven check</PanelTitle>
          <Button
            icon="play"
            loading={check.isPending}
            onClick={() => check.mutate({ params: { path: { name: name as never } } })}
          >
            Run in Nautilus
          </Button>
          {check.data ? (
            <p className="num">
              CAGR {percent(check.data.event.cagr)} event-driven against{" "}
              {percent(check.data.vector.cagr)} vectorised · gap{" "}
              {signedPercent(check.data.cagr_gap)} a year · {check.data.orders} orders ·{" "}
              {money(check.data.commissions)} fees
            </p>
          ) : null}
          {check.error ? <Callout intent="danger">{detail(check.error)}</Callout> : null}
        </section>
      ) : null}
    </div>
  );
}

function RunNow() {
  const client = useQueryClient();
  const [asked, setAsked] = useState(false);
  const automation = api.useQuery("get", "/systematic/automation");
  const run = api.useMutation("post", "/systematic/automation/run", {
    onSuccess: () => {
      client.invalidateQueries();
      setAsked(false);
    },
  });
  const mode = automation.data?.config.mode ?? "off";
  return (
    <>
      <Button small icon="play" disabled={mode === "off"} onClick={() => setAsked(true)}>
        Run now
      </Button>
      <Dialog isOpen={asked} onClose={() => setAsked(false)} title="Run the autopilot now">
        <DialogBody>
          <p>
            Rebalances the chosen strategies now, in {mode} mode
            {mode === "paper" ? ", placing paper orders" : ", without placing orders"}.
          </p>
          {run.isError ? <Callout intent="danger">{detail(run.error)}</Callout> : null}
          {run.data ? (
            <Callout intent={run.data.status === "ok" ? "success" : "warning"}>
              {run.data.status}
              {run.data.detail ? `: ${run.data.detail}` : ""}
            </Callout>
          ) : null}
        </DialogBody>
        <DialogFooter
          actions={
            <Button intent="primary" loading={run.isPending} onClick={() => run.mutate({})}>
              Run
            </Button>
          }
        />
      </Dialog>
    </>
  );
}
