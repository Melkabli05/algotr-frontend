import {
  Button,
  Callout,
  ControlGroup,
  Dialog,
  DialogBody,
  DialogFooter,
  FormGroup,
  HTMLSelect,
  HTMLTable,
  InputGroup,
  NumericInput,
  SegmentedControl,
} from "@blueprintjs/core";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api, detail } from "../api/client";
import type { components } from "../api/schema";
import { Th } from "../components/Explained";
import { Figure } from "../components/Figure";
import { useDebounced } from "../debounce";
import { money, percent, quantity, time } from "../format";
import { useEnv } from "../shell/env";
import type { TicketStart } from "../shell/ticket";
import { useStream } from "../stream/store";

type Request = components["schemas"]["OrderRequest"];
type AlgoRequest = components["schemas"]["AlgoRequest"];
type IcebergRequest = components["schemas"]["IcebergRequest"];
type Kind = "market" | "limit" | "stop" | "stop_limit" | "trailing_stop";
type Exits = "simple" | "bracket" | "oto" | "oco";
export type Route = "direct" | "iceberg" | "twap" | "vwap" | "shortfall";

const KINDS: { value: Kind; label: string }[] = [
  { value: "market", label: "Market" },
  { value: "limit", label: "Limit" },
  { value: "stop", label: "Stop" },
  { value: "stop_limit", label: "Stop-limit" },
  { value: "trailing_stop", label: "Trailing stop" },
];
const ROUTES: { value: Route; label: string }[] = [
  { value: "direct", label: "Direct" },
  { value: "iceberg", label: "Iceberg" },
  { value: "twap", label: "TWAP" },
  { value: "vwap", label: "VWAP" },
  { value: "shortfall", label: "Shortfall" },
];
const EXITS: { value: Exits; label: string }[] = [
  { value: "simple", label: "No exits" },
  { value: "bracket", label: "Bracket" },
  { value: "oto", label: "One triggers other" },
  { value: "oco", label: "One cancels other" },
];

export interface Form {
  symbol: string;
  side: "buy" | "sell";
  kind: Kind;
  qty: number;
  limit: number | null;
  stop: number | null;
  tif: "day" | "gtc";
  trail?: number | null;
  exits?: Exits;
  takeProfit?: number | null;
  stopLoss?: number | null;
}

export function requestOf(form: Form): Request {
  const crypto = form.symbol.includes("/");
  const exits = form.exits ?? "simple";
  const priced = (kinds: Kind[], value: number | null | undefined) =>
    kinds.includes(form.kind) ? (value ?? null) : null;
  return {
    symbol: form.symbol.trim().toUpperCase(),
    side: form.side,
    type: form.kind,
    qty: form.qty,
    time_in_force: crypto && form.tif === "day" ? "gtc" : form.tif,
    limit_price: priced(["limit", "stop_limit"], form.limit),
    stop_price: priced(["stop", "stop_limit"], form.stop),
    trail_percent: priced(["trailing_stop"], form.trail),
    order_class: exits,
    take_profit: exits === "simple" ? null : (form.takeProfit ?? null),
    stop_loss: exits === "simple" ? null : (form.stopLoss ?? null),
  };
}

export function algoOf(
  route: Exclude<Route, "direct" | "iceberg">,
  form: Form,
  plan: { duration: number; slices: number; aversion: number },
): AlgoRequest {
  return {
    algo: route,
    symbol: form.symbol.trim().toUpperCase(),
    side: form.side,
    qty: form.qty,
    duration: plan.duration,
    slices: route === "vwap" ? null : plan.slices,
    limit_price: form.kind === "limit" ? form.limit : null,
    tilt: 0,
    risk_aversion: route === "shortfall" ? plan.aversion : 1,
  };
}

function Price({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <FormGroup label={label} labelFor={id}>
      <NumericInput
        id={id}
        fill
        min={0}
        minorStepSize={0.0001}
        value={value ?? ""}
        onValueChange={(next) => onChange(Number.isFinite(next) ? next : null)}
      />
    </FormGroup>
  );
}

const bps = (value: number | null | undefined) => (value == null ? "—" : `${value.toFixed(1)} bps`);

const span = (pair: number[] | null | undefined, show: (value: number) => string) =>
  pair?.[0] != null && pair[1] != null ? `${show(pair[0])}–${show(pair[1])}` : "—";

function CostPanel({ body, enabled }: { body: Request; enabled: boolean }) {
  const found = api.useQuery("post", "/orders/estimate", { body }, { enabled, retry: false });
  const data = found.data;
  if (!data) return null;
  if (!data.marketable)
    return (
      <p className="muted num" style={{ margin: "8px 0 0" }}>
        Chance the price touches the limit, {data.horizon}:{" "}
        {data.fill_probability == null ? "—" : percent(data.fill_probability, 0)} · random-walk
        estimate from 20 sessions
      </p>
    );
  return (
    <div className="stack" style={{ gap: 4, marginTop: 8 }}>
      <div className="strip">
        <Figure
          label="Expected cost"
          value={`${span(data.total_bps, (value) => value.toFixed(1))} bps`}
          note={span(data.total_dollars, money)}
        />
        <Figure label="Half spread" value={bps(data.spread_bps)} />
        <Figure
          label="Temporary impact"
          value={`${span(data.impact_bps, (value) => value.toFixed(1))} bps`}
        />
        <Figure label="Permanent impact" value={bps(data.permanent_bps)} />
        <Figure
          label="Of daily volume"
          value={data.participation == null ? "—" : percent(data.participation, 2)}
        />
      </div>
      <span className="muted">{data.note}</span>
    </div>
  );
}

function RiskDelta({
  body,
  enabled,
}: {
  body: { symbol: string; side: "buy" | "sell"; qty: number; price: number | null };
  enabled: boolean;
}) {
  const found = api.useQuery("post", "/risk/what-if", { body }, { enabled, retry: false });
  if (!found.data) return null;
  const show = (value: number | null | undefined, unit: string) =>
    value == null
      ? "—"
      : unit === "dollars"
        ? money(value)
        : unit === "share"
          ? percent(value)
          : value.toFixed(2);
  return (
    <HTMLTable compact className="num" style={{ width: "100%", marginTop: 8 }}>
      <thead>
        <tr>
          <Th>After this order</Th>
          <Th className="right">Now</Th>
          <Th className="right">After</Th>
        </tr>
      </thead>
      <tbody>
        {found.data.changes.map((change) => {
          const delta =
            change.before != null && change.after != null ? change.after - change.before : null;
          const near =
            change.cap != null && change.after != null && change.after >= change.cap * 0.9;
          return (
            <tr key={change.name}>
              <td>{change.name}</td>
              <td className="right">{show(change.before, change.unit)}</td>
              <td className={`right ${near ? "loss" : delta && delta > 0 ? "warn-text" : ""}`}>
                {delta != null && change.unit !== "dollars"
                  ? `${delta >= 0 ? "+" : "−"}${show(Math.abs(delta), change.unit)} → `
                  : ""}
                {show(change.after, change.unit)}
                {change.cap != null ? (
                  <span className="muted"> (cap {show(change.cap, change.unit)})</span>
                ) : null}
              </td>
            </tr>
          );
        })}
      </tbody>
    </HTMLTable>
  );
}

function AlgoPreview({ body, enabled }: { body: AlgoRequest; enabled: boolean }) {
  const preview = api.useQuery("post", "/orders/algo/preview", { body }, { enabled, retry: false });
  if (preview.error)
    return (
      <Callout intent="danger" compact>
        {detail(preview.error)}
      </Callout>
    );
  const plan = preview.data;
  if (!plan) return null;
  const first = plan.slices.slice(0, 4);
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="strip">
        <Figure label="Slices" value={plan.slices.length} />
        <Figure label="From" value={time(plan.start)} />
        <Figure label="To" value={time(plan.end)} />
        <Figure label="Arrival price" value={money(plan.arrival_price)} />
      </div>
      <HTMLTable compact className="num">
        <tbody>
          {first.map((item) => (
            <tr key={item.due}>
              <td>{time(item.due)}</td>
              <td>{quantity(item.qty)}</td>
            </tr>
          ))}
          {plan.slices.length > first.length ? (
            <tr>
              <td colSpan={2} className="muted">
                and {plan.slices.length - first.length} more
              </td>
            </tr>
          ) : null}
        </tbody>
      </HTMLTable>
    </div>
  );
}

export function OrderTicket({
  isOpen,
  onClose,
  initial,
}: {
  isOpen: boolean;
  onClose: () => void;
  initial?: TicketStart;
}) {
  const [symbol, setSymbol] = useState(initial?.symbol ?? "SPUS");
  const [side, setSide] = useState<"buy" | "sell">(initial?.side ?? "buy");
  const [route, setRoute] = useState<Route>("direct");
  const [kind, setKind] = useState<Kind>("limit");
  const [qty, setQty] = useState(1);
  const [limit, setLimit] = useState<number | null>(null);
  const [stop, setStop] = useState<number | null>(null);
  const [trail, setTrail] = useState<number | null>(1);
  const [tif, setTif] = useState<"day" | "gtc">("day");
  const [exits, setExits] = useState<Exits>("simple");
  const [takeProfit, setTakeProfit] = useState<number | null>(null);
  const [stopLoss, setStopLoss] = useState<number | null>(null);
  const [display, setDisplay] = useState(1);
  const [duration, setDuration] = useState(30);
  const [slices, setSlices] = useState(6);
  const [aversion, setAversion] = useState(1);
  const [typed, setTyped] = useState("");
  const env = useEnv();
  const live = env !== "paper";
  useEffect(() => {
    if (!initial) return;
    if (initial.symbol) setSymbol(initial.symbol);
    if (initial.side) setSide(initial.side);
    if (initial.price != null) {
      setRoute("direct");
      setKind("limit");
      setLimit(initial.price);
    } else setLimit(null);
    if (initial.qty != null) setQty(initial.qty);
    if (initial.route) setRoute(initial.route);
  }, [initial]);
  const client = useQueryClient();
  const quote = useStream().quotes[symbol.trim().toUpperCase()];
  const latest = api.useQuery(
    "get",
    "/market/bars",
    { params: { query: { symbol: symbol.trim().toUpperCase(), timeframe: "1Min", limit: 1 } } },
    { enabled: isOpen && !quote && symbol.trim().length > 0, retry: false },
  );
  const touch = quote
    ? side === "buy"
      ? quote.ask_price
      : quote.bid_price
    : (latest.data?.at(-1)?.close ?? null);
  useEffect(() => {
    if (limit == null && touch) setLimit(touch);
  }, [limit, touch]);
  const direct = route === "direct";
  const shownKind: Kind = direct
    ? kind
    : route === "iceberg"
      ? "limit"
      : kind === "market"
        ? "market"
        : "limit";
  const form: Form = {
    symbol,
    side,
    kind: shownKind,
    qty,
    limit,
    stop,
    tif,
    trail,
    exits: direct ? exits : "simple",
    takeProfit,
    stopLoss,
  };
  const request = requestOf(form);
  const pending = useDebounced(request);
  const ready = isOpen && pending.symbol.length > 0 && pending.qty > 0;
  const check = api.useQuery(
    "post",
    "/orders/check",
    { body: { ...pending, order_class: "simple", take_profit: null, stop_loss: null } },
    { enabled: ready, retry: false },
  );
  const algo =
    route === "twap" || route === "vwap" || route === "shortfall"
      ? algoOf(route, form, { duration, slices, aversion })
      : null;
  const pendingAlgo = useDebounced(algo);
  const iceberg: IcebergRequest = {
    symbol: request.symbol,
    side,
    qty,
    display_qty: display,
    limit_price: limit ?? 0,
    time_in_force: tif,
  };
  const done = {
    onSuccess: () => {
      client.invalidateQueries();
      setTyped("");
      onClose();
    },
  };
  const confirmed =
    !live || typed.trim() === String(qty) || typed.trim().toUpperCase() === "CONFIRM";
  const place = api.useMutation("post", "/orders", done);
  const placeIceberg = api.useMutation("post", "/orders/iceberg", done);
  const placeAlgo = api.useMutation("post", "/orders/algo", done);
  const placing = place.isPending || placeIceberg.isPending || placeAlgo.isPending;
  const failed = place.error ?? placeIceberg.error ?? placeAlgo.error;
  const submit = () => {
    if (route === "iceberg") placeIceberg.mutate({ body: iceberg });
    else if (algo) placeAlgo.mutate({ body: algo });
    else place.mutate({ body: request });
  };
  const verdict = check.data;
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="row">
          New order
          <span className={`env ${env === "paper" ? "env-paper" : "env-live"}`}>
            {env === "paper" ? "PAPER" : env === "live" ? "LIVE" : "ACCOUNT UNKNOWN"}
          </span>
        </span>
      }
      icon="exchange"
      style={{ width: 560 }}
    >
      <DialogBody className="ticket-body">
        {env === "paper" ? (
          <div className="watermark" aria-hidden="true">
            SIMULATION
          </div>
        ) : null}
        <FormGroup
          label="Symbol"
          labelFor="ticket-symbol"
          helperText={
            quote ? `Bid ${money(quote.bid_price)} · Ask ${money(quote.ask_price)}` : undefined
          }
        >
          <InputGroup id="ticket-symbol" value={symbol} onValueChange={setSymbol} autoFocus />
        </FormGroup>
        <ControlGroup fill style={{ marginBottom: 12 }}>
          <SegmentedControl
            value={side}
            onValueChange={(value) => setSide(value as "buy" | "sell")}
            options={[
              { label: "Buy", value: "buy" },
              { label: "Sell", value: "sell" },
            ]}
          />
          <HTMLSelect
            value={route}
            onChange={(event) => setRoute(event.currentTarget.value as Route)}
            options={ROUTES}
            aria-label="Execution"
          />
          {direct ? (
            <HTMLSelect
              value={kind}
              onChange={(event) => setKind(event.currentTarget.value as Kind)}
              options={KINDS}
              aria-label="Order type"
            />
          ) : route !== "iceberg" ? (
            <HTMLSelect
              value={shownKind}
              onChange={(event) => setKind(event.currentTarget.value as Kind)}
              options={KINDS.slice(0, 2)}
              aria-label="Slice type"
            />
          ) : null}
          {route === "direct" || route === "iceberg" ? (
            <HTMLSelect
              value={tif}
              onChange={(event) => setTif(event.currentTarget.value as "day" | "gtc")}
              options={[
                { value: "day", label: "Day" },
                { value: "gtc", label: "Good till canceled" },
              ]}
              aria-label="Time in force"
            />
          ) : null}
        </ControlGroup>
        <div className="settings-fields">
          <FormGroup label="Quantity" labelFor="ticket-qty">
            <NumericInput
              id="ticket-qty"
              fill
              min={0}
              minorStepSize={0.000001}
              value={qty}
              onValueChange={(value) => setQty(Number.isFinite(value) ? value : 0)}
            />
          </FormGroup>
          {shownKind === "limit" || shownKind === "stop_limit" ? (
            <Price id="ticket-limit" label="Limit price" value={limit} onChange={setLimit} />
          ) : null}
          {shownKind === "stop" || shownKind === "stop_limit" ? (
            <Price id="ticket-stop" label="Stop price" value={stop} onChange={setStop} />
          ) : null}
          {shownKind === "trailing_stop" ? (
            <Price id="ticket-trail" label="Trail, %" value={trail} onChange={setTrail} />
          ) : null}
          {route === "iceberg" ? (
            <FormGroup label="Shown at a time" labelFor="ticket-display">
              <NumericInput
                id="ticket-display"
                fill
                min={0}
                value={display}
                onValueChange={(value) => setDisplay(Number.isFinite(value) ? value : 0)}
              />
            </FormGroup>
          ) : null}
          {algo ? (
            <FormGroup label="Over, minutes" labelFor="ticket-duration">
              <NumericInput
                id="ticket-duration"
                fill
                min={1}
                max={390}
                value={duration}
                onValueChange={(value) => setDuration(Number.isFinite(value) ? value : 1)}
              />
            </FormGroup>
          ) : null}
          {algo && route !== "vwap" ? (
            <FormGroup label="Slices" labelFor="ticket-slices">
              <NumericInput
                id="ticket-slices"
                fill
                min={2}
                max={100}
                value={slices}
                onValueChange={(value) => setSlices(Number.isFinite(value) ? value : 2)}
              />
            </FormGroup>
          ) : null}
          {route === "shortfall" ? (
            <FormGroup label="Urgency" labelFor="ticket-aversion" labelInfo="0 to 100">
              <NumericInput
                id="ticket-aversion"
                fill
                min={0}
                max={100}
                value={aversion}
                onValueChange={(value) => setAversion(Number.isFinite(value) ? value : 0)}
              />
            </FormGroup>
          ) : null}
        </div>
        {direct ? (
          <FormGroup label="Exits" labelFor="ticket-exits" inline>
            <HTMLSelect
              id="ticket-exits"
              value={exits}
              onChange={(event) => setExits(event.currentTarget.value as Exits)}
              options={EXITS}
            />
          </FormGroup>
        ) : null}
        {direct && exits !== "simple" ? (
          <div className="settings-fields">
            <Price
              id="ticket-take"
              label="Take profit"
              value={takeProfit}
              onChange={setTakeProfit}
            />
            <Price id="ticket-loss" label="Stop loss" value={stopLoss} onChange={setStopLoss} />
          </div>
        ) : null}
        <div className="strip" style={{ marginTop: 8 }}>
          <Figure label="Estimated cost" value={money(verdict?.cost)} />
          <Figure label="Position after" value={money(verdict?.position_value)} />
          <Figure label="Share of account" value={percent(verdict?.position_share)} />
        </div>
        <CostPanel
          body={
            direct
              ? pending
              : {
                  ...pending,
                  type: shownKind === "limit" ? "limit" : "market",
                  order_class: "simple",
                }
          }
          enabled={ready}
        />
        <RiskDelta
          body={{
            symbol: pending.symbol,
            side: pending.side,
            qty: pending.qty,
            price: pending.limit_price ?? null,
          }}
          enabled={ready && Boolean(verdict?.allowed)}
        />
        {pendingAlgo ? (
          <div style={{ marginTop: 12 }}>
            <AlgoPreview body={pendingAlgo} enabled={isOpen && pendingAlgo.qty > 0} />
          </div>
        ) : null}
        <div style={{ marginTop: 12 }} aria-live="polite">
          {check.error ? <Callout intent="danger">{detail(check.error)}</Callout> : null}
          {verdict ? (
            <Callout
              intent={verdict.allowed ? "success" : "danger"}
              icon={verdict.allowed ? "tick" : "cross"}
            >
              {verdict.allowed ? "Passes every check" : verdict.reason}
            </Callout>
          ) : null}
          {failed ? <Callout intent="danger">{detail(failed)}</Callout> : null}
        </div>
        {live ? (
          <FormGroup
            label={<span>Type the quantity or CONFIRM</span>}
            labelFor="ticket-confirm"
            style={{ marginTop: 12 }}
          >
            <InputGroup id="ticket-confirm" value={typed} onValueChange={setTyped} />
          </FormGroup>
        ) : null}
      </DialogBody>
      <DialogFooter
        actions={
          <>
            {live ? <span className="env env-live env-small">REAL CAPITAL</span> : null}
            <Button
              intent={side === "buy" ? "success" : "danger"}
              disabled={!verdict?.allowed || !confirmed}
              loading={placing}
              onClick={submit}
            >
              {side === "buy" ? "Buy" : "Sell"} {request.symbol}
              {direct ? "" : ` by ${ROUTES.find((item) => item.value === route)?.label}`}
            </Button>
          </>
        }
      />
    </Dialog>
  );
}
