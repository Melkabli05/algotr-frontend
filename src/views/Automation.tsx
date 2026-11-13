import {
  Button,
  Callout,
  Dialog,
  DialogBody,
  DialogFooter,
  FormGroup,
  HTMLTable,
  InputGroup,
  Switch,
  Tag,
} from "@blueprintjs/core";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, detail } from "../api/client";
import { Explained, PanelTitle, Th } from "../components/Explained";
import { Loadable } from "../components/Loadable";
import { explain, page } from "../glossary";

const STAGE_INTENT: Record<string, "none" | "primary" | "success" | "warning" | "danger"> = {
  research: "none",
  validated: "primary",
  shadow: "primary",
  canary: "warning",
  live: "success",
  retired: "none",
};

const STATE_INTENT: Record<string, "success" | "warning" | "danger"> = {
  closed: "success",
  half_open: "warning",
  open: "danger",
};

function when(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleString() : "—";
}

function days(since: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000));
}

interface Ask {
  title: string;
  action: string;
  intent: "primary" | "warning" | "danger" | "success";
  note: string;
  run: (reason: string) => Promise<unknown>;
}

function ReasonDialog({ ask, onClose }: { ask: Ask | null; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const close = () => {
    setReason("");
    setError(null);
    onClose();
  };
  return (
    <Dialog isOpen={ask != null} onClose={close} title={ask?.title}>
      <DialogBody>
        <p>{ask?.note}</p>
        <FormGroup label="Reason, kept in the audit log" labelFor="automation-reason">
          <InputGroup id="automation-reason" value={reason} onValueChange={setReason} autoFocus />
        </FormGroup>
        {error ? <Callout intent="danger">{detail(error)}</Callout> : null}
      </DialogBody>
      <DialogFooter
        actions={
          <Button
            intent={ask?.intent}
            disabled={reason.trim().length < 3}
            loading={busy}
            onClick={async () => {
              if (!ask) return;
              setBusy(true);
              try {
                await ask.run(reason.trim());
                close();
              } catch (found) {
                setError(found);
              } finally {
                setBusy(false);
              }
            }}
          >
            {ask?.action}
          </Button>
        }
      />
    </Dialog>
  );
}

function Lifecycle({ setAsk }: { setAsk: (ask: Ask) => void }) {
  const strategies = api.useQuery("get", "/lifecycle", undefined, { refetchInterval: 60_000 });
  const events = api.useQuery("get", "/lifecycle/events", { params: { query: { limit: 30 } } });
  const approve = api.useMutation("post", "/lifecycle/{name}/approve");
  const client = useQueryClient();
  return (
    <section className="panel stack">
      <PanelTitle>Lifecycle</PanelTitle>
      <Loadable query={strategies} isEmpty={!strategies.data?.length} empty="No strategies yet">
        <HTMLTable compact striped style={{ width: "100%" }}>
          <thead>
            <tr>
              <Th>Strategy</Th>
              <Th>Stage</Th>
              <Th>Capital</Th>
              <Th>Days in stage</Th>
              <Th>Version</Th>
              <Th>Gates</Th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(strategies.data ?? []).map((item) => (
              <tr key={item.name}>
                <td>{item.title}</td>
                <td>
                  <Tag minimal intent={STAGE_INTENT[item.stage]}>
                    {item.stage}
                  </Tag>
                </td>
                <td>{Math.round(item.capital * 100)}%</td>
                <td>{days(item.stage_since)}</td>
                <td>
                  <Explained
                    text={`Code ${item.version.code_hash.slice(0, 12)}, git ${item.version.git_sha?.slice(0, 7) ?? "unknown"}, ${item.version.engine}`}
                  >
                    {item.version.code_hash.slice(0, 8)}
                  </Explained>
                </td>
                <td>
                  {item.gates.length === 0 ? (
                    <span className="muted">
                      {item.stage === "live" ? "monitored" : "not judged yet"}
                    </span>
                  ) : (
                    <div className="stack" style={{ gap: 2 }}>
                      {item.gates.map((gate) => (
                        <span key={gate.name} className={gate.passed ? "gain" : "loss"}>
                          <Explained text={gate.detail}>
                            {gate.passed ? "pass" : "fail"} · {gate.name}
                          </Explained>
                        </span>
                      ))}
                    </div>
                  )}
                </td>
                <td>
                  {item.awaiting_approval ? (
                    <Button
                      small
                      intent="success"
                      onClick={() =>
                        setAsk({
                          title: `Approve ${item.title} for live`,
                          action: "Approve",
                          intent: "success",
                          note: "The canary passed every gate. Live trades its full allocation.",
                          run: async (reason) => {
                            await approve.mutateAsync({
                              params: { path: { name: item.name } },
                              body: { reason },
                            });
                            await client.invalidateQueries();
                          },
                        })
                      }
                    >
                      Approve to live
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
      </Loadable>
      <h3 className="panel-title">
        <Explained text="Every move between stages, with the gates passed and who made it.">
          Moves
        </Explained>
      </h3>
      <Loadable query={events} isEmpty={!events.data?.length} empty="No moves yet">
        <HTMLTable compact style={{ width: "100%" }}>
          <thead>
            <tr>
              <Th>Time</Th>
              <Th>Strategy</Th>
              <Th text="The stage it left and the one it entered.">Move</Th>
              <Th text="auto: by the gates; manual: by a person; bootstrap: when the lifecycle started.">
                By
              </Th>
              <Th>Detail</Th>
            </tr>
          </thead>
          <tbody>
            {(events.data ?? []).map((event) => (
              <tr key={event.id}>
                <td>{when(event.time)}</td>
                <td>{event.strategy}</td>
                <td>
                  {event.from_stage ?? "—"} → {event.to_stage}
                </td>
                <td>{event.actor}</td>
                <td>{event.reason}</td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
      </Loadable>
    </section>
  );
}

function Safety({ setAsk }: { setAsk: (ask: Ask) => void }) {
  const overview = api.useQuery("get", "/breakers", undefined, { refetchInterval: 15_000 });
  const reset = api.useMutation("post", "/breakers/{name}/reset");
  const toggle = api.useMutation("put", "/breakers/switches/{name}");
  const client = useQueryClient();
  const switches = overview.data?.switches ?? [];
  const engaged = (name: string) => switches.find((item) => item.name === name)?.engaged ?? false;
  const flip = (name: string, on: boolean) =>
    setAsk({
      title: `${on ? "Engage" : "Release"} the ${name} kill switch`,
      action: on ? "Engage" : "Release",
      intent: on ? "danger" : "primary",
      note: on
        ? name.startsWith("strategy:")
          ? "The strategy stops sending targets; the arbiter sells what it held at the next rebalance."
          : "Open orders are canceled, every position is sold and nothing trades until released."
        : "Trading may resume once no other switch or breaker stops it.",
      run: async (reason) => {
        await toggle.mutateAsync({ params: { path: { name } }, body: { engaged: on, reason } });
        await client.invalidateQueries();
      },
    });
  return (
    <section className="panel stack">
      <PanelTitle text={explain("circuit breakers")}>Circuit breakers and kill switches</PanelTitle>
      <Loadable query={overview}>
        {overview.data?.stopped ? (
          <Callout intent="danger" title="Trading is stopped">
            {overview.data.stopped}
          </Callout>
        ) : null}
        <div className="row" style={{ gap: 24 }}>
          {["global", "account"].map((name) => (
            <Switch
              key={name}
              large
              checked={engaged(name)}
              onChange={() => flip(name, !engaged(name))}
              labelElement={
                <Explained text={explain("kill switches")}>{`${name} kill switch`}</Explained>
              }
            />
          ))}
        </div>
        {switches.filter((item) => item.scope === "strategy").length ? (
          <HTMLTable compact style={{ width: "100%" }}>
            <thead>
              <tr>
                <Th text="A switch that stops one strategy.">Strategy switch</Th>
                <Th>State</Th>
                <Th>Detail</Th>
                <th />
              </tr>
            </thead>
            <tbody>
              {switches
                .filter((item) => item.scope === "strategy")
                .map((item) => (
                  <tr key={item.name}>
                    <td>{item.name.replace("strategy:", "")}</td>
                    <td>
                      <Tag minimal intent={item.engaged ? "danger" : "success"}>
                        {item.engaged ? "engaged" : "released"}
                      </Tag>
                    </td>
                    <td>{item.reason ?? "—"}</td>
                    <td>
                      <Button small onClick={() => flip(item.name, !item.engaged)}>
                        {item.engaged ? "Release" : "Engage"}
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </HTMLTable>
        ) : null}
        <HTMLTable compact striped style={{ width: "100%" }}>
          <thead>
            <tr>
              <Th text="What the breaker guards: the whole system, the portfolio, or one strategy.">
                Breaker
              </Th>
              <Th text={explain("circuit breakers")}>Level</Th>
              <Th text="closed: normal. open: blocking. half-open: the next check decides.">
                State
              </Th>
              <Th>Detail</Th>
              <Th text="When an open breaker is tried again. Portfolio and system breakers only close by hand.">
                Retry
              </Th>
              <Th text="How many times it has opened.">Trips</Th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(overview.data?.breakers ?? []).length === 0 ? (
              <tr>
                <td colSpan={7} className="muted">
                  No breaker has opened yet: every level is closed.
                </td>
              </tr>
            ) : null}
            {(overview.data?.breakers ?? []).map((item) => (
              <tr key={item.name}>
                <td>{item.name}</td>
                <td>{item.level}</td>
                <td>
                  <Tag minimal intent={STATE_INTENT[item.state]}>
                    {item.state.replace("_", "-")}
                  </Tag>
                </td>
                <td>{item.reason ?? "—"}</td>
                <td>
                  {item.retry_at ? when(item.retry_at) : item.state === "closed" ? "—" : "by hand"}
                </td>
                <td>{item.trips}</td>
                <td>
                  {item.state !== "closed" ? (
                    <Button
                      small
                      onClick={() =>
                        setAsk({
                          title: `Reset the ${item.name} breaker`,
                          action: "Reset",
                          intent: "warning",
                          note: "Closing it lets trading through again at this level.",
                          run: async (reason) => {
                            await reset.mutateAsync({
                              params: { path: { name: item.name } },
                              body: { reason },
                            });
                            await client.invalidateQueries();
                          },
                        })
                      }
                    >
                      Reset
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
        {overview.data?.events.length ? (
          <HTMLTable compact style={{ width: "100%" }}>
            <thead>
              <tr>
                <Th>Time</Th>
                <Th text={explain("breaker events")}>Breaker</Th>
                <Th>Change</Th>
                <Th>Detail</Th>
              </tr>
            </thead>
            <tbody>
              {overview.data.events.slice(0, 20).map((event) => (
                <tr key={event.id}>
                  <td>{when(event.time)}</td>
                  <td>{event.name}</td>
                  <td>
                    {event.from_state} → {event.to_state}
                  </td>
                  <td>{event.reason}</td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        ) : null}
      </Loadable>
    </section>
  );
}

function Models({ setAsk }: { setAsk: (ask: Ask) => void }) {
  const models = api.useQuery("get", "/models", undefined, { refetchInterval: 300_000 });
  const promote = api.useMutation("post", "/models/{model_id}/promote");
  const client = useQueryClient();
  return (
    <section className="panel stack">
      <PanelTitle text={explain("model registry")}>Model registry</PanelTitle>
      <Loadable query={models} isEmpty={!models.data?.length} empty="No models registered yet">
        <HTMLTable compact striped style={{ width: "100%" }}>
          <thead>
            <tr>
              <Th text="The model and its version.">Model</Th>
              <Th text="rl_agent: a reinforcement-learning agent. classifier: scores text.">
                Type
              </Th>
              <Th text={explain("deployment stage")}>Stage</Th>
              <Th text="The data the model was trained on.">Trained on</Th>
              <Th text="Sharpe of the agent on its own training data; optimistic by nature.">
                In-sample Sharpe
              </Th>
              <Th text="When it last became the production model.">Promoted</Th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(models.data ?? []).map((item) => (
              <tr key={item.model_id}>
                <td>{item.model_id}</td>
                <td>{item.model_type}</td>
                <td>
                  <Tag minimal intent={item.deployment_stage === "production" ? "success" : "none"}>
                    {item.deployment_stage}
                  </Tag>
                </td>
                <td>{item.training_data_version}</td>
                <td>
                  {typeof item.metrics.in_sample_sharpe === "number"
                    ? item.metrics.in_sample_sharpe.toFixed(2)
                    : "—"}
                </td>
                <td>{when(item.promoted_at)}</td>
                <td>
                  {item.deployment_stage !== "production" ? (
                    <Button
                      small
                      onClick={() =>
                        setAsk({
                          title: `Make ${item.model_id} the production model`,
                          action: item.deployment_stage === "archived" ? "Roll back" : "Promote",
                          intent: "warning",
                          note: "The current production version is archived; the agents use this one from their next decision.",
                          run: async (reason) => {
                            await promote.mutateAsync({
                              params: { path: { model_id: item.model_id } },
                              body: { reason },
                            });
                            await client.invalidateQueries();
                          },
                        })
                      }
                    >
                      {item.deployment_stage === "archived" ? "Roll back" : "Promote"}
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
      </Loadable>
    </section>
  );
}

function DataQuality() {
  const report = api.useQuery(
    "get",
    "/data-quality",
    { params: { query: { limit: 100 } } },
    {
      refetchInterval: 300_000,
    },
  );
  return (
    <section className="panel stack">
      <div className="row">
        <PanelTitle text={explain("data quality")}>Data quality</PanelTitle>
        <span className="grow" />
        {report.data ? (
          <Explained text={explain("chain verified")}>
            <Tag minimal intent={report.data.verified ? "success" : "danger"}>
              {report.data.verified ? "record intact" : "record altered"}
            </Tag>
          </Explained>
        ) : null}
      </div>
      <Loadable
        query={report}
        isEmpty={!report.data?.findings.length}
        empty="No problem found in the market data"
      >
        <HTMLTable compact striped style={{ width: "100%" }}>
          <thead>
            <tr>
              <Th text="When it was found.">Found</Th>
              <Th>Symbol</Th>
              <Th text="The trading day the bar belongs to.">Session</Th>
              <Th text={explain("quality flags")}>Problem</Th>
              <Th>Detail</Th>
              <Th text="api: the hourly check; node: a strategy checking its own bars.">Source</Th>
            </tr>
          </thead>
          <tbody>
            {(report.data?.findings ?? []).map((item) => (
              <tr key={item.id}>
                <td>{when(item.time)}</td>
                <td>{item.symbol}</td>
                <td>{item.session}</td>
                <td>{item.reason_code.replace("_", " ")}</td>
                <td>{item.detail}</td>
                <td>{item.source}</td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
      </Loadable>
    </section>
  );
}

export function Automation() {
  const [ask, setAsk] = useState<Ask | null>(null);
  return (
    <div className="stack">
      <h1 className="panel-title" style={{ margin: 0 }}>
        <Explained text={page("automation")}>Automation</Explained>
      </h1>
      <Lifecycle setAsk={setAsk} />
      <Safety setAsk={setAsk} />
      <Models setAsk={setAsk} />
      <DataQuality />
      <ReasonDialog ask={ask} onClose={() => setAsk(null)} />
    </div>
  );
}
