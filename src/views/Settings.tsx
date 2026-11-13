import {
  Button,
  Callout,
  Checkbox,
  Dialog,
  DialogBody,
  DialogFooter,
  FormGroup,
  HTMLSelect,
  HTMLTable,
  InputGroup,
  NumericInput,
  Switch,
  Tag,
} from "@blueprintjs/core";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, detail } from "../api/client";
import type { components } from "../api/schema";
import { Explained, PanelTitle, Th } from "../components/Explained";
import { savedZone, saveZone, time, ZONES, type Zone } from "../format";
import { page } from "../glossary";

type Limits = components["schemas"]["RiskLimits"];
type Config = components["schemas"]["AutomationConfig"];
type Sleeve = components["schemas"]["SleeveConfig"];
type AlertSettings = components["schemas"]["AlertSettings"];
type Channel = "in_app" | "email" | "webhook";

interface Field<T> {
  key: keyof T & string;
  label: string;
  unit: "percent" | "bps" | "ratio";
  min: number;
  max: number;
}

const LIMITS: Field<Limits>[] = [
  { key: "position_share", label: "Largest position", unit: "percent", min: 1, max: 100 },
  { key: "daily_loss", label: "Daily loss stop", unit: "percent", min: 0.1, max: 50 },
  { key: "adv_share", label: "Share of daily volume", unit: "percent", min: 0.1, max: 100 },
  { key: "spread_bps", label: "Widest stock spread", unit: "bps", min: 1, max: 1000 },
  { key: "sector_share", label: "Largest sector", unit: "percent", min: 1, max: 100 },
  { key: "correlation", label: "Correlation warning", unit: "ratio", min: 0.05, max: 1 },
  { key: "book_imbalance", label: "Coin book imbalance", unit: "ratio", min: 0, max: 1 },
];

const AUTOPILOT: Field<Config>[] = [
  { key: "allocation", label: "Allocation", unit: "percent", min: 1, max: 100 },
  { key: "max_drawdown", label: "Drawdown that flattens", unit: "percent", min: 2, max: 50 },
  { key: "reduce_at", label: "Reduce at, share of that", unit: "percent", min: 10, max: 100 },
];

const shown = (unit: Field<unknown>["unit"], value: number) =>
  unit === "percent" ? Number((value * 100).toFixed(4)) : value;
const stored = (unit: Field<unknown>["unit"], value: number) =>
  unit === "percent" ? value / 100 : value;
const written = (unit: Field<unknown>["unit"], value: unknown) =>
  typeof value !== "number"
    ? String(value)
    : unit === "percent"
      ? `${shown(unit, value)}%`
      : unit === "bps"
        ? `${value} bps`
        : String(value);

interface Change {
  label: string;
  before: string;
  after: string;
}

function changes<T extends object>(fields: Field<T>[], before: T, after: T): Change[] {
  return fields
    .filter((field) => before[field.key] !== after[field.key])
    .map((field) => ({
      label: field.label,
      before: written(field.unit, before[field.key]),
      after: written(field.unit, after[field.key]),
    }));
}

function Confirm({
  title,
  found,
  note,
  pending,
  error,
  onClose,
  onConfirm,
}: {
  title: string;
  found: Change[];
  note?: string;
  pending: boolean;
  error: unknown;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog isOpen onClose={onClose} title={title}>
      <DialogBody>
        <HTMLTable compact>
          <thead>
            <tr>
              <Th>Setting</Th>
              <Th>Now</Th>
              <Th>New</Th>
            </tr>
          </thead>
          <tbody className="num">
            {found.map((item) => (
              <tr key={item.label}>
                <td>{item.label}</td>
                <td>{item.before}</td>
                <td>{item.after}</td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
        <p className="muted" style={{ marginTop: 12 }}>
          {note ?? "The change is written to the audit log with what it replaced."}
        </p>
        {error ? (
          <Callout intent="danger" compact>
            {detail(error)}
          </Callout>
        ) : null}
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button onClick={onClose}>Cancel</Button>
            <Button intent="primary" loading={pending} onClick={onConfirm}>
              Save
            </Button>
          </>
        }
      />
    </Dialog>
  );
}

function NumberFields<T extends object>({
  fields,
  draft,
  onChange,
}: {
  fields: Field<T>[];
  draft: T;
  onChange: (next: T) => void;
}) {
  return (
    <div className="settings-fields">
      {fields.map((field) => (
        <FormGroup
          key={field.key}
          label={field.label}
          labelFor={field.key}
          labelInfo={field.unit === "ratio" ? "" : field.unit === "percent" ? "%" : "bps"}
        >
          <NumericInput
            id={field.key}
            small
            fill
            min={field.min}
            max={field.max}
            minorStepSize={0.01}
            stepSize={field.unit === "ratio" ? 0.05 : 1}
            value={shown(field.unit, Number(draft[field.key]))}
            onValueChange={(value) =>
              Number.isFinite(value) &&
              onChange({ ...draft, [field.key]: stored(field.unit, value) })
            }
          />
        </FormGroup>
      ))}
    </div>
  );
}

function RiskLimits() {
  const client = useQueryClient();
  const limits = api.useQuery("get", "/settings/limits");
  const [draft, setDraft] = useState<Limits>();
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setDraft(limits.data), [limits.data]);
  const done = () => {
    client.invalidateQueries();
    setConfirming(false);
  };
  const save = api.useMutation("put", "/settings/limits", { onSuccess: done });
  const reset = api.useMutation("delete", "/settings/limits", { onSuccess: done });
  if (!limits.data || !draft) return null;
  const found = changes(LIMITS, limits.data, draft);
  return (
    <section className="panel stack">
      <div className="row">
        <h2 className="panel-title grow">Risk limits</h2>
        <Button small loading={reset.isPending} onClick={() => reset.mutate({})}>
          Environment defaults
        </Button>
        <Button small intent="primary" disabled={!found.length} onClick={() => setConfirming(true)}>
          Review changes
        </Button>
      </div>
      <NumberFields fields={LIMITS} draft={draft} onChange={setDraft} />
      <p className="muted">Every manual and autopilot buy is checked against these.</p>
      {confirming ? (
        <Confirm
          title="Change risk limits"
          found={found}
          pending={save.isPending}
          error={save.error}
          onClose={() => setConfirming(false)}
          onConfirm={() => save.mutate({ body: draft })}
        />
      ) : null}
    </section>
  );
}

const MODES = [
  { value: "off", label: "Off" },
  { value: "dry-run", label: "Dry run" },
  { value: "paper", label: "Paper" },
];

const FLAGS: { key: "automatic" | "crypto"; label: string }[] = [
  { key: "automatic", label: "Choose the strategies that pass the gates" },
  { key: "crypto", label: "Trade crypto" },
];

function Autopilot() {
  const client = useQueryClient();
  const automation = api.useQuery("get", "/systematic/automation");
  const [draft, setDraft] = useState<Config>();
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setDraft(automation.data?.config), [automation.data]);
  const save = api.useMutation("put", "/systematic/automation", {
    onSuccess: () => {
      client.invalidateQueries();
      setConfirming(false);
    },
  });
  const saved = automation.data?.config;
  if (!saved || !draft) return null;
  const found = [
    ...(saved.mode !== draft.mode
      ? [{ label: "Mode", before: saved.mode ?? "off", after: draft.mode ?? "off" }]
      : []),
    ...(saved.engine !== draft.engine
      ? [{ label: "Engine", before: saved.engine ?? "", after: draft.engine ?? "" }]
      : []),
    ...changes(AUTOPILOT, saved, draft),
    ...(JSON.stringify(saved.sleeve) !== JSON.stringify(draft.sleeve)
      ? [
          {
            label: "Scanner sleeve",
            before: `${saved.sleeve?.mode ?? "off"}, ${written("percent", saved.sleeve?.share ?? 0)}`,
            after: `${draft.sleeve?.mode ?? "off"}, ${written("percent", draft.sleeve?.share ?? 0)}`,
          },
        ]
      : []),
    ...FLAGS.filter((flag) => saved[flag.key] !== draft[flag.key]).map((flag) => ({
      label: flag.label,
      before: saved[flag.key] ? "Yes" : "No",
      after: draft[flag.key] ? "Yes" : "No",
    })),
  ];
  const sleeve: Sleeve = draft.sleeve ?? { mode: "off", share: 0 };
  return (
    <section className="panel stack">
      <div className="row">
        <h2 className="panel-title grow">Autopilot</h2>
        <Button small intent="primary" disabled={!found.length} onClick={() => setConfirming(true)}>
          Review changes
        </Button>
      </div>
      <div className="settings-fields">
        <FormGroup label="Mode" labelFor="mode">
          <HTMLSelect
            id="mode"
            fill
            value={draft.mode ?? "off"}
            options={MODES}
            onChange={(event) =>
              setDraft({ ...draft, mode: event.currentTarget.value as Config["mode"] })
            }
          />
        </FormGroup>
        <FormGroup label="Engine" labelFor="engine">
          <HTMLSelect
            id="engine"
            fill
            value={draft.engine ?? "nautilus"}
            options={[
              { value: "nautilus", label: "Nautilus" },
              { value: "alpaca", label: "Alpaca orders" },
            ]}
            onChange={(event) =>
              setDraft({ ...draft, engine: event.currentTarget.value as Config["engine"] })
            }
          />
        </FormGroup>
      </div>
      <NumberFields fields={AUTOPILOT} draft={draft} onChange={setDraft} />
      {FLAGS.map((flag) => (
        <Switch
          key={flag.key}
          label={flag.label}
          checked={Boolean(draft[flag.key])}
          onChange={() => setDraft({ ...draft, [flag.key]: !draft[flag.key] })}
        />
      ))}
      <div className="settings-fields">
        <FormGroup label="Scanner sleeve" labelFor="sleeve">
          <HTMLSelect
            id="sleeve"
            fill
            value={sleeve.mode ?? "off"}
            options={[
              { value: "off", label: "Off" },
              { value: "shadow", label: "Shadow, no orders" },
              { value: "trade", label: "Trade" },
            ]}
            onChange={(event) =>
              setDraft({
                ...draft,
                sleeve: { ...sleeve, mode: event.currentTarget.value as Sleeve["mode"] },
              })
            }
          />
        </FormGroup>
        <FormGroup label="Sleeve share" labelFor="share" labelInfo="% of the allocation">
          <NumericInput
            id="share"
            small
            fill
            min={0}
            max={25}
            value={shown("percent", sleeve.share ?? 0)}
            onValueChange={(value) =>
              Number.isFinite(value) &&
              setDraft({ ...draft, sleeve: { ...sleeve, share: value / 100 } })
            }
          />
        </FormGroup>
      </div>
      <p className="muted">
        A live account is traded only once ALPACA_TRADING_MODE=live is set on the server.
      </p>
      {confirming ? (
        <Confirm
          title="Change the autopilot"
          found={found}
          note={
            saved.mode === "off" && draft.mode !== "off"
              ? "Turning the autopilot on runs it straight away. The change is written to the audit log."
              : undefined
          }
          pending={save.isPending}
          error={save.error}
          onClose={() => setConfirming(false)}
          onConfirm={() => save.mutate({ body: draft })}
        />
      ) : null}
    </section>
  );
}

const CHANNELS: { key: Channel; label: string }[] = [
  { key: "in_app", label: "In app" },
  { key: "email", label: "Email" },
  { key: "webhook", label: "Webhook" },
];

const TIER_INTENT: Record<string, "danger" | "warning" | "none"> = {
  P0: "danger",
  P1: "warning",
  P2: "none",
};

function PriceAlerts() {
  const client = useQueryClient();
  const settings = api.useQuery("get", "/alerts/settings");
  const [symbol, setSymbol] = useState("BTC/USD");
  const [price, setPrice] = useState<number | null>(null);
  const [above, setAbove] = useState(true);
  const done = {
    onSuccess: () => client.invalidateQueries({ queryKey: ["get", "/alerts/settings"] }),
  };
  const add = api.useMutation("post", "/alerts/price", done);
  const remove = api.useMutation("delete", "/alerts/price/{alert_id}", done);
  const prices = settings.data?.settings.prices ?? [];
  const muted = Object.entries(settings.data?.settings.muted ?? {}).filter(
    ([, until]) => new Date(until).getTime() > Date.now(),
  );
  return (
    <section className="panel stack">
      <PanelTitle>Price alerts</PanelTitle>
      <div className="row">
        <InputGroup
          small
          aria-label="Symbol"
          value={symbol}
          onValueChange={setSymbol}
          style={{ width: 110 }}
        />
        <HTMLSelect
          aria-label="Direction"
          value={above ? "above" : "below"}
          options={[
            { value: "above", label: "rises to" },
            { value: "below", label: "falls to" },
          ]}
          onChange={(event) => setAbove(event.currentTarget.value === "above")}
        />
        <NumericInput
          small
          aria-label="Price"
          min={0}
          value={price ?? ""}
          onValueChange={(value) => setPrice(Number.isFinite(value) && value > 0 ? value : null)}
          style={{ width: 110 }}
        />
        <Button
          small
          intent="primary"
          disabled={!price || !symbol.trim()}
          loading={add.isPending}
          onClick={() => price && add.mutate({ body: { symbol: symbol.trim(), above, price } })}
        >
          Add
        </Button>
      </div>
      <HTMLTable compact className="num">
        <tbody>
          {prices.map((item) => (
            <tr key={item.id}>
              <td>{item.symbol}</td>
              <td>{item.above ? "rises to" : "falls to"}</td>
              <td>{item.price}</td>
              <td>
                <Button
                  small
                  minimal
                  icon="cross"
                  aria-label={`Remove the ${item.symbol} alert`}
                  onClick={() => remove.mutate({ params: { path: { alert_id: item.id } } })}
                />
              </td>
            </tr>
          ))}
          {prices.length === 0 ? (
            <tr>
              <td className="muted">None set; right-click a level on the order book to add one</td>
            </tr>
          ) : null}
        </tbody>
      </HTMLTable>
      {muted.length ? (
        <p className="muted">
          Muted:{" "}
          {muted
            .map(([key, until]) => `${key.replace(":", " for ")} until ${time(until)}`)
            .join(", ")}
        </p>
      ) : null}
      <p className="muted">Each fires once when the quote's mid crosses it, then is removed.</p>
    </section>
  );
}

function AlertRules() {
  const client = useQueryClient();
  const settings = api.useQuery("get", "/alerts/settings");
  const [draft, setDraft] = useState<AlertSettings>();
  useEffect(() => setDraft(settings.data?.settings), [settings.data]);
  const save = api.useMutation("put", "/alerts/settings", {
    onSuccess: () => client.invalidateQueries(),
  });
  const test = api.useMutation("post", "/alerts/test", {
    onSuccess: () => client.invalidateQueries({ queryKey: ["get", "/alerts"] }),
  });
  const view = settings.data;
  if (!view || !draft) return null;
  const rules = draft.rules ?? {};
  const toggle = (kind: string, channel: Channel) => {
    const rule = { in_app: true, email: false, webhook: false, ...rules[kind as never] };
    setDraft({ ...draft, rules: { ...rules, [kind]: { ...rule, [channel]: !rule[channel] } } });
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(view.settings);
  return (
    <section className="panel stack">
      <div className="row">
        <h2 className="panel-title grow">Alerts</h2>
        <Button small loading={test.isPending} onClick={() => test.mutate({})}>
          Send test
        </Button>
        <Button
          small
          intent="primary"
          disabled={!dirty}
          loading={save.isPending}
          onClick={() => save.mutate({ body: draft })}
        >
          Save
        </Button>
      </div>
      <HTMLTable compact>
        <thead>
          <tr>
            <Th>Event</Th>
            <Th>Tier</Th>
            {CHANNELS.map((channel) => (
              <th key={channel.key}>{channel.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Object.entries(view.kinds).map(([kind, title]) => {
            const fixed = view.unmutable.includes(kind);
            const rule = rules[kind as never] as Record<Channel, boolean> | undefined;
            return (
              <tr key={kind}>
                <td>
                  {title}{" "}
                  {fixed ? (
                    <Tag minimal intent="warning">
                      always sent
                    </Tag>
                  ) : null}
                </td>
                <td>
                  <Tag minimal intent={TIER_INTENT[view.tiers[kind] ?? "P2"]}>
                    {view.tiers[kind]}
                  </Tag>
                </td>
                {CHANNELS.map((channel) => (
                  <td key={channel.key}>
                    <Checkbox
                      aria-label={`${title}, ${channel.label}`}
                      style={{ margin: 0 }}
                      disabled={fixed}
                      checked={fixed || Boolean(rule?.[channel.key] ?? channel.key === "in_app")}
                      onChange={() => toggle(kind, channel.key)}
                    />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </HTMLTable>
      <FormGroup label="Webhook URL" labelFor="webhook" labelInfo="Slack, Discord or any JSON POST">
        <InputGroup
          id="webhook"
          small
          value={draft.webhook_url ?? ""}
          placeholder="https://hooks.slack.com/services/…"
          onValueChange={(value) => setDraft({ ...draft, webhook_url: value || null })}
        />
      </FormGroup>
      <p className="muted">
        {view.email_ready
          ? `Email goes to ${view.email_to}.`
          : "Email is off: set SMTP_HOST, ALERT_EMAIL_FROM and ALERT_EMAIL_TO in .env."}
      </p>
      {test.data ? (
        <Callout compact>
          Test:{" "}
          {Object.entries(test.data.channels ?? {})
            .map(([channel, outcome]) => `${channel} ${outcome}`)
            .join(", ") || "no channel configured"}
        </Callout>
      ) : null}
      {save.error ? (
        <Callout intent="danger" compact>
          {detail(save.error)}
        </Callout>
      ) : null}
    </section>
  );
}

function Universes() {
  const overview = api.useQuery("get", "/systematic/overview", undefined, { staleTime: 60_000 });
  const universe = api.useQuery("get", "/compliance/universe", undefined, { staleTime: 300_000 });
  const allowed = (universe.data ?? []).filter((item) => item.allowed).length;
  return (
    <section className="panel stack">
      <PanelTitle>Universes</PanelTitle>
      <HTMLTable compact>
        <thead>
          <tr>
            <Th>Strategy</Th>
            <Th>Symbols</Th>
          </tr>
        </thead>
        <tbody>
          {(overview.data?.strategies ?? []).map((item) => (
            <tr key={item.spec.name}>
              <td>{item.spec.name}</td>
              <td className="num">{item.spec.universe.join(", ")}</td>
            </tr>
          ))}
          <tr>
            <td>Scanner and manual buys</td>
            <td className="num">{allowed} symbols on a Shariah list</td>
          </tr>
        </tbody>
      </HTMLTable>
      <p className="muted">Fixed in the strategy catalog; variants are tried in the rule lab.</p>
    </section>
  );
}

function Display() {
  const [zone, setZone] = useState<Zone>(savedZone);
  return (
    <section className="panel stack">
      <PanelTitle>Display</PanelTitle>
      <FormGroup label="Times shown in" labelFor="zone" inline>
        <HTMLSelect
          id="zone"
          value={zone}
          options={ZONES.map((value) => ({
            value,
            label: value === "local" ? "This computer's zone" : value,
          }))}
          onChange={(event) => {
            const next = event.currentTarget.value as Zone;
            setZone(next);
            saveZone(next);
            window.location.reload();
          }}
        />
      </FormGroup>
      <p className="muted">Theme: the button in the top bar.</p>
    </section>
  );
}

export function Settings() {
  return (
    <div className="stack">
      <h1 className="panel-title" style={{ margin: 0 }}>
        <Explained text={page("Settings")}>Settings</Explained>
      </h1>
      <div className="settings-grid">
        <RiskLimits />
        <Autopilot />
        <AlertRules />
        <div className="stack">
          <PriceAlerts />
          <Universes />
          <Display />
        </div>
      </div>
    </div>
  );
}
