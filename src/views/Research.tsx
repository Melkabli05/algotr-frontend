import { Button, Callout, HTMLTable, Tab, Tabs, Tag } from "@blueprintjs/core";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, detail } from "../api/client";
import type { components } from "../api/schema";
import { Explained, PanelTitle, Th } from "../components/Explained";
import { Figure } from "../components/Figure";
import { day, percent, signedPercent, time } from "../format";
import { page } from "../glossary";

type Judgement = components["schemas"]["Judgement"];
type Group = { name: string; verdict: Judgement; note?: string };

const ratio = (value: number | null | undefined, digits = 2) =>
  value == null || !Number.isFinite(value) ? "—" : value.toFixed(digits);

function Passed({ value }: { value: boolean }) {
  return (
    <Tag minimal intent={value ? "success" : "danger"}>
      {value ? "pass" : "fail"}
    </Tag>
  );
}

function Groups({ groups }: { groups: Group[] }) {
  return (
    <HTMLTable compact striped style={{ width: "100%" }}>
      <thead>
        <tr>
          <Th>Candidate</Th>
          <Th>Median Sharpe</Th>
          <Th>Seeds</Th>
          <Th>Trend</Th>
          <Th>Hold</Th>
          <Th>Deflated</Th>
          <Th>Overfit</Th>
          <Th>Reality p</Th>
          <Th>Gates</Th>
          <Th>Eligible</Th>
        </tr>
      </thead>
      <tbody className="num">
        {groups.map(({ name, verdict }) => (
          <tr key={name}>
            <td>{name}</td>
            <td>{ratio(verdict.reliability.median)}</td>
            <td>
              {ratio(verdict.reliability.minimum)} to {ratio(verdict.reliability.maximum)}
            </td>
            <td>{ratio(verdict.trend_sharpe)}</td>
            <td>{ratio(verdict.hold_sharpe)}</td>
            <td>{percent(verdict.deflated_sharpe, 0)}</td>
            <td>{percent(verdict.probability_of_overfitting, 0)}</td>
            <td>{ratio(verdict.reality_check_p, 3)}</td>
            <td
              title={verdict.gates
                .map((gate) => `${gate.passed ? "✓" : "✗"} ${gate.name}`)
                .join("\n")}
            >
              {verdict.gates.filter((gate) => gate.passed).length}/{verdict.gates.length}
            </td>
            <td>
              <Passed value={verdict.eligible} />
            </td>
          </tr>
        ))}
      </tbody>
    </HTMLTable>
  );
}

function RuleLab() {
  const client = useQueryClient();
  const lab = api.useQuery("get", "/systematic/lab");
  const run = api.useMutation("post", "/systematic/lab", {
    onSuccess: () => client.invalidateQueries({ queryKey: ["get", "/systematic/lab"] }),
  });
  return (
    <div className="stack">
      <div className="row">
        <p className="muted grow">
          Every variant of every rule family, judged on the same history. Each run adds its variants
          to the trial count the deflated Sharpe uses.
        </p>
        <Button small icon="play" loading={run.isPending} onClick={() => run.mutate({})}>
          Run lab
        </Button>
      </div>
      {run.isError ? <Callout intent="danger">{detail(run.error)}</Callout> : null}
      {(lab.data?.families ?? []).map((family) => (
        <section key={family.family} className="panel stack">
          <div className="row">
            <h2 className="panel-title grow">{family.title}</h2>
            <span className="muted num">
              {day(family.start)} to {day(family.end)} · {family.trials} variants ·{" "}
              {family.cumulative_trials} tried in all · overfit{" "}
              {percent(family.probability_of_overfitting, 0)} · reality p{" "}
              {ratio(family.reality_check_p, 3)}
            </span>
          </div>
          <HTMLTable compact striped style={{ width: "100%" }}>
            <thead>
              <tr>
                <Th>Variant</Th>
                <Th>Sharpe</Th>
                <Th>CAGR</Th>
                <Th>Max drawdown</Th>
                <Th>t</Th>
                <Th>Deflated</Th>
                <Th>Consistency</Th>
                <Th>Beats cash</Th>
                <Th>Survives</Th>
              </tr>
            </thead>
            <tbody className="num">
              {family.candidates.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{ratio(row.sharpe)}</td>
                  <td>{signedPercent(row.cagr, 1)}</td>
                  <td>{percent(row.max_drawdown, 1)}</td>
                  <td>{ratio(row.t_statistic)}</td>
                  <td>{percent(row.deflated_sharpe, 0)}</td>
                  <td>{percent(row.consistency, 0)}</td>
                  <td>
                    <Passed value={row.beats_cash} />
                  </td>
                  <td>
                    <Passed value={row.survives} />
                  </td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        </section>
      ))}
    </div>
  );
}

function Agents() {
  const agents = api.useQuery("get", "/systematic/agents");
  const status = agents.data?.status;
  const evaluation = agents.data?.evaluation;
  return (
    <div className="stack">
      <section className="panel stack">
        <PanelTitle>Agents followed</PanelTitle>
        <HTMLTable compact striped style={{ width: "100%" }}>
          <thead>
            <tr>
              <Th>Agent</Th>
              <Th>Days followed</Th>
              <Th>Since</Th>
              <Th>Sharpe</Th>
              <Th>Ensemble weight</Th>
              <Th>Unexplained</Th>
            </tr>
          </thead>
          <tbody className="num">
            {(status?.agents ?? []).map((agent) => (
              <tr key={agent.algorithm}>
                <td>{agent.algorithm.toUpperCase()}</td>
                <td>{agent.days}</td>
                <td>{agent.first ? day(agent.first) : "—"}</td>
                <td>{ratio(agent.sharpe)}</td>
                <td>{percent(status?.ensemble?.[agent.algorithm], 0)}</td>
                <td>{agent.unexplained}</td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
        <p className="muted">
          Ensemble Sharpe {ratio(status?.ensemble_sharpe)}. Agents place paper orders only once they
          pass every gate for ten days running.
        </p>
      </section>
      <section className="panel stack">
        <div className="row">
          <h2 className="panel-title grow">Judged by the gates</h2>
          {evaluation ? (
            <span className="muted num">
              {time(evaluation.time)} · {evaluation.retrains} retrains · {evaluation.total_trials}{" "}
              trials
            </span>
          ) : null}
        </div>
        {evaluation ? (
          <Groups groups={evaluation.groups} />
        ) : (
          <p className="muted">Not judged yet: run `poe ai-evaluate`.</p>
        )}
      </section>
    </div>
  );
}

function Finrl() {
  const client = useQueryClient();
  const finrl = api.useQuery("get", "/systematic/lab/finrl");
  const run = api.useMutation("post", "/systematic/lab/finrl", {
    onSuccess: () => client.invalidateQueries({ queryKey: ["get", "/systematic/lab/finrl"] }),
  });
  const result = finrl.data?.result;
  return (
    <div className="stack">
      <div className="row">
        <p className="muted grow">
          FinRL's agents in their own environment, judged by the same gates. Takes about 15 minutes;
          nothing here changes what the autopilot trades.
        </p>
        <Button
          small
          icon="play"
          disabled={!finrl.data?.available}
          loading={run.isPending}
          onClick={() => run.mutate({})}
        >
          Run FinRL
        </Button>
      </div>
      {finrl.data && !finrl.data.available ? (
        <Callout intent="warning">The FinRL environment is not set up: `poe finrl-setup`.</Callout>
      ) : null}
      {run.isError ? <Callout intent="danger">{detail(run.error)}</Callout> : null}
      {result ? (
        <>
          <section className="panel strip">
            <Figure label="Trials" value={result.total_trials} />
            <Figure
              label="Tuning, best validation Sharpe"
              value={ratio(Number(result.tuning?.best_validation_sharpe ?? Number.NaN))}
            />
            <Figure label="Run time" value={`${Math.round(result.seconds / 60)} min`} />
            <Figure
              label="Packages"
              value={Object.entries(result.packages)
                .slice(0, 2)
                .map(([name, version]) => `${name} ${version}`)
                .join(", ")}
            />
          </section>
          <section className="panel stack">
            <PanelTitle>Judged by the gates</PanelTitle>
            <Groups groups={result.groups} />
          </section>
        </>
      ) : null}
    </div>
  );
}

function Scanner() {
  const client = useQueryClient();
  const evaluation = api.useQuery("get", "/scanner/evaluation");
  const shadow = api.useQuery("get", "/scanner/shadow");
  const sleeve = api.useQuery("get", "/scanner/sleeve");
  const run = api.useMutation("post", "/scanner/evaluate", {
    onSuccess: () => client.invalidateQueries({ queryKey: ["get", "/scanner/evaluation"] }),
  });
  const found = evaluation.data;
  const horizons = shadow.data?.horizons ?? [];
  return (
    <div className="stack">
      <section className="panel stack">
        <div className="row">
          <h2 className="panel-title grow">Variants on history</h2>
          {found ? (
            <span className="muted num">
              {day(found.start)} to {day(found.end)} · {found.symbols} symbols · overfit{" "}
              {percent(found.probability_of_overfitting, 0)}
            </span>
          ) : null}
          <Button small icon="play" loading={run.isPending} onClick={() => run.mutate({})}>
            Evaluate
          </Button>
        </div>
        {run.isError ? <Callout intent="danger">{detail(run.error)}</Callout> : null}
        <HTMLTable compact striped style={{ width: "100%" }}>
          <thead>
            <tr>
              <Th>Variant</Th>
              <Th>Sharpe</Th>
              <Th>Out of sample</Th>
              <Th>CAGR</Th>
              <Th>Max drawdown</Th>
              <Th>Turnover</Th>
              <Th>Deflated</Th>
              <Th>Checks</Th>
            </tr>
          </thead>
          <tbody className="num">
            {found ? (
              <tr className="muted">
                <td>Benchmark, every listed name</td>
                <td>{ratio(found.benchmark.sharpe)}</td>
                <td />
                <td>{signedPercent(found.benchmark.cagr, 1)}</td>
                <td>{percent(found.benchmark.max_drawdown, 1)}</td>
                <td>{ratio(found.benchmark.turnover)}</td>
                <td />
                <td />
              </tr>
            ) : null}
            {(found?.variants ?? []).map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                <td>{ratio(row.metrics.sharpe)}</td>
                <td>{ratio(row.out_of_sample?.sharpe)}</td>
                <td>{signedPercent(row.metrics.cagr, 1)}</td>
                <td>{percent(row.metrics.max_drawdown, 1)}</td>
                <td>{ratio(row.metrics.turnover)}</td>
                <td>{percent(row.deflated_sharpe, 0)}</td>
                <td
                  title={row.checks
                    .map((check) => `${check.passed ? "✓" : "✗"} ${check.name}`)
                    .join("\n")}
                >
                  {row.checks.filter((check) => check.passed).length}/{row.checks.length}
                </td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
        {(found?.notes ?? []).map((note) => (
          <p key={note} className="muted" style={{ margin: 0 }}>
            {note}
          </p>
        ))}
      </section>
      <div className="settings-grid">
        <section className="panel stack">
          <PanelTitle>Shadow picks, mean excess over SPUS</PanelTitle>
          <HTMLTable compact striped style={{ width: "100%" }}>
            <thead>
              <tr>
                <Th>Variant</Th>
                <Th>Scans</Th>
                {horizons.map((days) => (
                  <th key={days}>{days} day</th>
                ))}
              </tr>
            </thead>
            <tbody className="num">
              {(shadow.data?.summary ?? []).map((row) => (
                <tr key={row.variant}>
                  <td>{row.variant}</td>
                  <td>{row.scans}</td>
                  {horizons.map((days) => (
                    <td key={days}>
                      {signedPercent(row.mean_excess_spus[String(days)] ?? null)}
                      <span className="muted"> ({row.completed[String(days)] ?? 0})</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        </section>
        <section className="panel stack">
          <div className="row">
            <h2 className="panel-title grow">Sleeve, {sleeve.data?.variant ?? ""}</h2>
            {sleeve.data ? <Passed value={sleeve.data.passed} /> : null}
          </div>
          <HTMLTable compact>
            <tbody>
              {(sleeve.data?.criteria ?? []).map((item) => (
                <tr key={item.name}>
                  <td>{item.name}</td>
                  <td>
                    <Passed value={item.passed} />
                  </td>
                  <td className="muted">{item.detail}</td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
          <p className="muted num">
            {(sleeve.data?.holdings ?? [])
              .map((item) => `${item.symbol} ${percent(item.weight, 0)}`)
              .join(", ")}
          </p>
          <p className="muted">Mode and share are set in Settings.</p>
        </section>
      </div>
    </div>
  );
}

const TABS = ["lab", "agents", "finrl", "scanner"] as const;

export function Research() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("lab");
  return (
    <div className="stack">
      <h1 className="panel-title" style={{ margin: 0 }}>
        <Explained text={page("Research")}>Research</Explained>
      </h1>
      <Tabs
        id="research"
        selectedTabId={tab}
        onChange={(next) => setTab(next as (typeof TABS)[number])}
        renderActiveTabPanelOnly
      >
        <Tab id="lab" title="Rule lab" panel={<RuleLab />} />
        <Tab id="agents" title="Agents" panel={<Agents />} />
        <Tab id="finrl" title="FinRL" panel={<Finrl />} />
        <Tab id="scanner" title="Scanner" panel={<Scanner />} />
      </Tabs>
    </div>
  );
}
