import { HTMLSelect, HTMLTable } from "@blueprintjs/core";
import { useState } from "react";
import { api } from "../api/client";
import type { components } from "../api/schema";
import { ACCENT_DARK, ACCENT_LIGHT, Chart, GRAY, LOSS } from "../components/Chart";
import { Explained, PanelTitle, Th } from "../components/Explained";
import { Figure } from "../components/Figure";
import { Loadable } from "../components/Loadable";
import { money, percent, time } from "../format";
import { page } from "../glossary";
import { useDark } from "../shell/theme";
import { Storyboard } from "./Storyboard";

type Limit = components["schemas"]["Limit"];

const STEPS: { state: string; label: string }[] = [
  { state: "normal", label: "Normal" },
  { state: "watch", label: "Watch" },
  { state: "reduce", label: "Half size" },
  { state: "defensive", label: "Sells only" },
  { state: "flatten", label: "Flatten" },
];

export function limitValue(limit: Limit): string {
  if (limit.value == null) return limit.scope === "order" ? "per order" : "—";
  if (limit.unit === "bps") return `${limit.value.toFixed(0)} bps`;
  if (limit.unit === "ratio") return limit.value.toFixed(2);
  return percent(limit.value);
}

export function limitThreshold(limit: Limit): string {
  if (limit.unit === "bps") return `${limit.threshold.toFixed(0)} bps`;
  if (limit.unit === "ratio") return limit.threshold.toFixed(2);
  return percent(limit.threshold, limit.threshold < 0.05 ? 1 : 0);
}

function KillPanel() {
  const automation = api.useQuery("get", "/systematic/automation");
  const state = automation.data?.kill_state ?? "normal";
  const config = automation.data?.config;
  const at = STEPS.findIndex((step) => step.state === state);
  return (
    <section className="panel">
      <PanelTitle>Kill switch</PanelTitle>
      <ol
        style={{ display: "flex", gap: 4, listStyle: "none", margin: 0, padding: 0 }}
        aria-label="Kill switch steps"
      >
        {STEPS.map((step, index) => (
          <li
            key={step.state}
            aria-current={index === at ? "step" : undefined}
            style={{
              flex: 1,
              padding: "8px 6px",
              textAlign: "center",
              border: "1px solid var(--rule)",
              background:
                index === at
                  ? index >= 3
                    ? "var(--loss)"
                    : index >= 1
                      ? "var(--warn)"
                      : "var(--gain)"
                  : "transparent",
              color: index === at ? "#0b0b0a" : undefined,
              fontWeight: index === at ? 600 : 400,
            }}
          >
            {step.label}
          </li>
        ))}
      </ol>
      {config ? (
        <p className="muted" style={{ marginBottom: 0 }}>
          Autopilot drawdown {percent(automation.data?.book.drawdown)}: watch from{" "}
          {percent(config.max_drawdown * 0.25)}, half size from{" "}
          {percent(config.max_drawdown * config.reduce_at)}, sells only from{" "}
          {percent(config.max_drawdown * 0.75)}, flatten at {percent(config.max_drawdown, 0)}.{" "}
          {automation.data?.halted ? `Halted: ${automation.data.halted}` : ""}
        </p>
      ) : null}
    </section>
  );
}

export function Risk() {
  const dark = useDark();
  const summary = api.useQuery("get", "/risk/summary", undefined, { refetchInterval: 60_000 });
  const [severity, setSeverity] = useState("all");
  const data = summary.data;
  if (!data)
    return (
      <div className="stack">
        <h1 className="panel-title" style={{ margin: 0 }}>
          <Explained text={page("Risk")}>Risk</Explained>
        </h1>
        <KillPanel />
        <Loadable query={summary} rows={6} isEmpty empty="No risk data">
          {null}
        </Loadable>
        <Storyboard events={[]} />
      </div>
    );
  const events = data.events.filter((event) => severity === "all" || event.severity === severity);
  const accent = dark ? ACCENT_DARK : ACCENT_LIGHT;
  const sectorCap = data.limits.find((limit) => limit.name === "Sector")?.threshold;
  const positionCap = data.limits.find((limit) => limit.name === "Position size")?.threshold;
  return (
    <div className="stack">
      <h1 className="panel-title" style={{ margin: 0 }}>
        <Explained text={page("Risk")}>Risk</Explained>
      </h1>
      <KillPanel />
      <section className="panel">
        <h2 className="panel-title">Value at risk, last {data.days} days of today's holdings</h2>
        <div className="strip">
          {data.var.map((row) => (
            <Figure
              key={`${row.confidence}-${row.horizon}`}
              label={`${percent(row.confidence, 0)}, ${row.horizon} day${row.horizon > 1 ? "s" : ""}`}
              value={money(row.dollars)}
              note={`${percent(row.historical, 2)} historical · ${percent(row.parametric, 2)} normal · ${percent(row.shortfall, 2)} shortfall`}
            />
          ))}
          {data.var.length === 0 ? <span className="muted">No holdings</span> : null}
        </div>
      </section>
      <section className="panel">
        <PanelTitle>Limits</PanelTitle>
        <HTMLTable compact striped style={{ width: "100%" }}>
          <thead>
            <tr>
              <Th>Limit</Th>
              <Th>Now</Th>
              <Th>Threshold</Th>
              <Th style={{ width: "30%" }}>Use</Th>
              <Th>Last triggered</Th>
            </tr>
          </thead>
          <tbody>
            {data.limits.map((limit) => (
              <tr key={limit.name}>
                <td>{limit.name}</td>
                <td className="num">{limitValue(limit)}</td>
                <td className="num">{limitThreshold(limit)}</td>
                <td>
                  {limit.used == null ? (
                    <span className="muted">
                      {limit.scope === "order"
                        ? "checked on each buy"
                        : "not enough holdings to measure"}
                    </span>
                  ) : (
                    <meter
                      className="meter"
                      aria-label={limit.name}
                      min={0}
                      max={1}
                      low={0.5}
                      high={0.9}
                      optimum={0}
                      value={Math.min(limit.used, 1)}
                    />
                  )}
                </td>
                <td className="num">{limit.last_triggered ? time(limit.last_triggered) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
      </section>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
        <section className="panel">
          <h2 className="panel-title">By sector, cap {percent(sectorCap, 0)} for stocks</h2>
          <Chart
            label="Exposure by sector"
            height={40 + data.sectors.length * 30}
            option={{
              tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
              xAxis: {
                type: "value",
                max: 1,
                axisLabel: { formatter: (value: number) => `${(value * 100).toFixed(0)}%` },
              },
              yAxis: {
                type: "category",
                inverse: true,
                data: data.sectors.map((item) => item.name),
              },
              series: [
                {
                  type: "bar",
                  data: data.sectors.map((item) => item.share),
                  color: accent,
                  markLine: sectorCap
                    ? {
                        symbol: "none",
                        data: [{ xAxis: sectorCap }],
                        lineStyle: { color: LOSS },
                        label: { formatter: "cap" },
                      }
                    : undefined,
                },
              ],
            }}
          />
        </section>
        <section className="panel">
          <PanelTitle>By strategy</PanelTitle>
          <Chart
            label="Exposure by strategy"
            height={40 + data.strategies.length * 30}
            option={{
              tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
              xAxis: {
                type: "value",
                axisLabel: { formatter: (value: number) => `${(value * 100).toFixed(0)}%` },
              },
              yAxis: {
                type: "category",
                inverse: true,
                data: data.strategies.map((item) => item.name),
              },
              series: [
                { type: "bar", data: data.strategies.map((item) => item.share), color: GRAY },
              ],
            }}
          />
        </section>
        <section className="panel">
          <h2 className="panel-title">Top positions, limit {percent(positionCap, 0)}</h2>
          <Chart
            label="Largest positions"
            height={40 + data.concentration.length * 30}
            option={{
              tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
              xAxis: {
                type: "value",
                axisLabel: { formatter: (value: number) => `${(value * 100).toFixed(0)}%` },
              },
              yAxis: {
                type: "category",
                inverse: true,
                data: data.concentration.map((item) => item.name),
              },
              series: [
                {
                  type: "bar",
                  data: data.concentration.map((item) => item.share),
                  color: accent,
                  markLine: positionCap
                    ? {
                        symbol: "none",
                        data: [{ xAxis: positionCap }],
                        lineStyle: { color: LOSS },
                        label: { formatter: "limit" },
                      }
                    : undefined,
                },
              ],
            }}
          />
        </section>
        <section className="panel">
          <h2 className="panel-title">Correlation of daily returns, last {data.days} days</h2>
          {data.correlation.symbols.length < 2 ? (
            <p className="muted">Fewer than two holdings</p>
          ) : (
            <HTMLTable compact className="num">
              <thead>
                <tr>
                  <th />
                  {data.correlation.symbols.map((symbol) => (
                    <th key={symbol}>{symbol}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.correlation.symbols.map((symbol, row) => (
                  <tr key={symbol}>
                    <th>{symbol}</th>
                    {data.correlation.matrix[row]?.map((value, column) => (
                      <td
                        key={data.correlation.symbols[column]}
                        style={{
                          background: `color-mix(in srgb, ${value >= 0 ? accent : "#3987e5"} ${Math.round(Math.abs(value) * 60)}%, transparent)`,
                        }}
                      >
                        {value.toFixed(2)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </HTMLTable>
          )}
        </section>
      </div>
      <Storyboard events={data.events} />
      <section className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <PanelTitle>Risk events</PanelTitle>
          <HTMLSelect
            minimal
            value={severity}
            onChange={(event) => setSeverity(event.currentTarget.value)}
            options={[
              { value: "all", label: "All" },
              { value: "critical", label: "Critical" },
              { value: "warning", label: "Warnings" },
              { value: "info", label: "Drift" },
            ]}
            aria-label="Severity"
          />
        </div>
        {events.length === 0 ? <p className="muted">No events</p> : null}
        <ul className="feed">
          {events.map((event) => (
            <li key={`${event.time}-${event.title}`}>
              <span className="num muted">{time(event.time)}</span>
              <span
                className={
                  event.severity === "critical"
                    ? "loss"
                    : event.severity === "warning"
                      ? "warn-text"
                      : undefined
                }
              >
                {event.title}
                {event.detail ? <span className="muted"> · {event.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
