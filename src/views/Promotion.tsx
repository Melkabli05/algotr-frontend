import { Callout, HTMLTable, ProgressBar, Tag } from "@blueprintjs/core";
import { api } from "../api/client";
import { ACCENT_DARK, ACCENT_LIGHT, Chart, GAIN, GRAY, LOSS } from "../components/Chart";
import { PanelTitle, Th } from "../components/Explained";
import { Loadable } from "../components/Loadable";
import { signedPercent } from "../format";
import { useDark } from "../shell/theme";

const DAYS = 10;

export function nextPromotion(days: number, from = new Date()): string {
  const found = new Date(from);
  let left = days;
  while (left > 0) {
    found.setDate(found.getDate() + 1);
    if (found.getDay() !== 0 && found.getDay() !== 6) left -= 1;
  }
  return found.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function stage(active: boolean, streak: number, mode: string): string {
  if (active)
    return mode === "paper" ? "Paper" : mode === "dry-run" ? "Dry run" : "Passing, autopilot off";
  if (streak > 0) return "Candidate";
  return "Research";
}

export function Promotion() {
  const overview = api.useQuery("get", "/systematic/overview", undefined, { staleTime: 60_000 });
  const execution = api.useQuery("get", "/systematic/execution", undefined, { staleTime: 300_000 });
  const mode = overview.data?.status.config.mode ?? "off";
  const rows = [
    ...(overview.data?.strategies ?? []).map((item) => ({
      name: item.spec.title,
      active: item.active,
      streak: item.streak,
      checks: item.research?.checks ?? [],
    })),
    ...(overview.data
      ? [
          {
            name: "Agent ensemble",
            active: overview.data.ensemble_active,
            streak: overview.data.ensemble_streak,
            checks: [],
          },
        ]
      : []),
  ];
  return (
    <section className="panel stack">
      <PanelTitle>Promotion readiness</PanelTitle>
      <Loadable query={overview}>
        <HTMLTable compact striped style={{ width: "100%" }}>
          <thead>
            <tr>
              <Th>Strategy</Th>
              <Th>Stage</Th>
              <Th>Gates</Th>
              <Th style={{ width: 200 }}>Days in a row</Th>
              <Th>Days in stage</Th>
              <Th>Next step</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const passing = Math.max(row.streak, 0);
              const failing = Math.max(-row.streak, 0);
              const passed = row.checks.filter((check) => check.passed).length;
              return (
                <tr key={row.name}>
                  <td>{row.name}</td>
                  <td>
                    <Tag
                      minimal
                      intent={row.active ? "success" : row.streak > 0 ? "warning" : "none"}
                    >
                      {stage(row.active, row.streak, mode)}
                    </Tag>
                  </td>
                  <td>
                    {row.checks.length ? (
                      <span
                        className="gate-row"
                        title={row.checks
                          .map((check) => `${check.passed ? "pass" : "fail"}: ${check.name}`)
                          .join("\n")}
                      >
                        {row.checks.map((check) => (
                          <span
                            key={check.name}
                            className={`gate ${check.passed ? "gate-pass" : "gate-fail"}`}
                          />
                        ))}
                        <span className="num muted">
                          {" "}
                          {passed}/{row.checks.length}
                        </span>
                      </span>
                    ) : (
                      "see Research"
                    )}
                  </td>
                  <td>
                    <ProgressBar
                      animate={false}
                      stripes={false}
                      intent={row.active ? (failing ? "danger" : "success") : "warning"}
                      value={row.active ? 1 - failing / DAYS : passing / DAYS}
                    />
                  </td>
                  <td className="num">{Math.abs(row.streak)}</td>
                  <td className="muted">
                    {row.active
                      ? failing
                        ? `stops after ${DAYS - failing} more failing days`
                        : "holds while the gates pass"
                      : passing
                        ? `trades on ${nextPromotion(DAYS - passing)} if it keeps passing`
                        : "needs every gate to pass"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </HTMLTable>
      </Loadable>
      <h3 className="panel-title">Paper fills against the backtest's cost</h3>
      <Loadable
        query={execution}
        isEmpty={(execution.data?.summaries ?? []).length === 0}
        empty="No settled autopilot fills yet"
      >
        <HTMLTable compact className="num" style={{ width: "100%" }}>
          <thead>
            <tr>
              <Th>Asset</Th>
              <Th className="right">Orders</Th>
              <Th className="right">Paid, bps</Th>
              <Th className="right">Backtest assumes, bps</Th>
              <Th className="right">Shortfall, bps</Th>
            </tr>
          </thead>
          <tbody>
            {(execution.data?.summaries ?? []).map((row) => (
              <tr key={row.asset}>
                <td>{row.asset}</td>
                <td className="right">{row.orders}</td>
                <td
                  className={`right ${row.cost_bps != null && row.cost_bps > row.assumed_bps ? "loss" : ""}`}
                >
                  {row.cost_bps?.toFixed(1) ?? "—"}
                </td>
                <td className="right">{row.assumed_bps.toFixed(1)}</td>
                <td className="right">{row.shortfall_bps?.toFixed(1) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
        <p className="muted">
          Paid above what the backtest assumes means paper results will trail it. The fills shown
          are this account's, paper or live.
        </p>
      </Loadable>
    </section>
  );
}

export function Tracking({ name }: { name: string }) {
  const dark = useDark();
  const found = api.useQuery("get", "/systematic/strategies/{name}/tracking", {
    params: { path: { name: name as never } },
  });
  const points = found.data?.points ?? [];
  const gap = found.data?.gap;
  return (
    <section className="panel">
      <h2 className="panel-title">
        Paper against the backtest
        {found.data?.gap != null ? `, gap ${signedPercent(found.data.gap)}` : ""}
      </h2>
      <Loadable query={found} isEmpty={points.length === 0} empty={found.data?.note}>
        {gap != null && Math.abs(gap) > 0.1 ? (
          <Callout intent="warning" compact>
            Paper is {signedPercent(gap)} from the backtest since {found.data?.since}: the rule's
            assumptions may no longer hold.
          </Callout>
        ) : null}
        <Chart
          label="Paper value against the backtest over the same days"
          height={240}
          option={{
            tooltip: { trigger: "axis" },
            legend: { top: 0 },
            grid: { top: 28 },
            xAxis: { type: "time" },
            yAxis: [
              { type: "value", scale: true },
              {
                type: "value",
                show: false,
                min:
                  -Math.max(
                    0.01,
                    ...points.map((point) => Math.abs(point.paper - (point.model ?? point.paper))),
                  ) * 4,
                max:
                  Math.max(
                    0.01,
                    ...points.map((point) => Math.abs(point.paper - (point.model ?? point.paper))),
                  ) * 4,
              },
            ],
            series: [
              {
                type: "bar",
                name: "Divergence",
                yAxisIndex: 1,
                barWidth: "90%",
                data: points.map((point) => {
                  const diff = point.paper - (point.model ?? point.paper);
                  return {
                    value: [point.day, diff],
                    itemStyle: { color: diff >= 0 ? GAIN : LOSS, opacity: 0.25 },
                  };
                }),
              },
              {
                type: "line",
                name: "Paper",
                showSymbol: false,
                data: points.map((point) => [point.day, point.paper]),
                color: dark ? ACCENT_DARK : ACCENT_LIGHT,
              },
              {
                type: "line",
                name: "Backtest",
                showSymbol: false,
                data: points.map((point) => [point.day, point.model]),
                color: GRAY,
                lineStyle: { type: "dashed" },
              },
            ],
          }}
        />
        <p className="muted">{found.data?.note}</p>
      </Loadable>
    </section>
  );
}
