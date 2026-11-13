import {
  Button,
  Callout,
  Checkbox,
  Dialog,
  DialogBody,
  DialogFooter,
  FileInput,
  FormGroup,
  HTMLSelect,
  HTMLTable,
  InputGroup,
  NumericInput,
  Switch,
  TagInput,
  TextArea,
} from "@blueprintjs/core";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { api, detail, fetchClient } from "../api/client";
import type { components } from "../api/schema";
import { ACCENT_DARK, ACCENT_LIGHT, Chart, GRAY } from "../components/Chart";
import { Th } from "../components/Explained";
import { Figure } from "../components/Figure";
import { useDebounced } from "../debounce";
import { day, percent, time } from "../format";
import { useDark } from "../shell/theme";

export type Draft = components["schemas"]["StrategyDraft"];
type Signal = Draft["signal"];
type StrategyFile = components["schemas"]["StrategyFile"];
type Preview = components["schemas"]["StrategyPreview"];
type SymbolCheck = components["schemas"]["SymbolCheck"];

const WORDING: (keyof Draft)[] = ["title", "description", "note"];

export function rewordedOnly(before: Draft, after: Draft): boolean {
  const rule = (draft: Draft) =>
    JSON.stringify(Object.entries(draft).filter(([key]) => !WORDING.includes(key as keyof Draft)));
  return rule(before) === rule(after);
}

function symbolTag(found: SymbolCheck | undefined) {
  if (!found) return {};
  const history = found.days == null ? "no price history" : `${found.days} days of prices`;
  return {
    intent: found.allowed ? ("success" as const) : ("danger" as const),
    title: `${found.reason} · ${history}`,
  };
}

export const SIGNALS: Record<Signal, string> = {
  sma: "Price above its average",
  momentum: "Dual momentum",
  donchian: "Donchian breakout",
  multitrend: "Multi-speed trend",
};

const BLANK: Draft = {
  name: "",
  title: "",
  description: "",
  universe: [],
  signal: "sma",
  window: 200,
  lookbacks: [],
  target_vol: null,
  vol_window: 20,
  band: 0,
  trade_rate: 1,
  top_n: 1,
  fee_bps: 5,
  fills: "next_open",
  proxy: false,
  note: null,
};

export type EditorMode =
  | { kind: "create" }
  | { kind: "edit"; draft: Draft; version: number }
  | { kind: "duplicate"; draft: Draft };

function startingDraft(mode: EditorMode): Draft {
  if (mode.kind === "edit") return mode.draft;
  if (mode.kind === "duplicate")
    return { ...mode.draft, name: `${mode.draft.name}-copy`.slice(0, 48) };
  return BLANK;
}

const isCrypto = (draft: Draft) => draft.universe.some((symbol) => symbol.includes("/"));

export function StrategyEditor({ mode, onClose }: { mode: EditorMode; onClose: () => void }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Draft>(() => startingDraft(mode));
  const [note, setNote] = useState("");
  const [template, setTemplate] = useState("");
  const templates = api.useQuery("get", "/strategies/templates", undefined, {
    enabled: mode.kind === "create",
  });
  const done = (name: string) => {
    client.invalidateQueries();
    onClose();
    navigate(`/strategies/${name}`);
  };
  const create = api.useMutation("post", "/strategies", { onSuccess: (made) => done(made.name) });
  const update = api.useMutation("put", "/strategies/{name}", {
    onSuccess: (made) => done(made.name),
  });
  const preview = api.useMutation("post", "/strategies/preview");
  const [tested, setTested] = useState("");
  const pending = useDebounced(draft);
  const check = api.useQuery(
    "post",
    "/strategies/check",
    {
      body: {
        universe: pending.universe,
        draft: pending as unknown as Record<string, unknown>,
      },
    },
    { retry: false },
  );
  const verdicts = Object.fromEntries(
    (check.data?.symbols ?? []).map((item) => [item.symbol, item]),
  );
  const problems = check.data?.problems ?? [];
  const warnings = check.data?.warnings ?? [];
  const measured = check.data?.measured_cost;
  const ready = check.isSuccess && problems.length === 0;
  const backtest = () => {
    setTested(JSON.stringify(draft));
    preview.mutate({ body: { draft } });
  };
  const saving = create.isPending || update.isPending;
  const error = create.error ?? update.error;
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));
  const save = () => {
    const body = { draft, note: note.trim() || null };
    if (mode.kind === "edit") update.mutate({ params: { path: { name: draft.name } }, body });
    else create.mutate({ body });
  };
  const usesWindow = draft.signal === "sma" || draft.signal === "momentum";
  const usesLookbacks = draft.signal === "donchian" || draft.signal === "multitrend";
  const title =
    mode.kind === "edit"
      ? `Edit ${draft.name}`
      : mode.kind === "duplicate"
        ? "Duplicate strategy"
        : "New strategy";
  return (
    <Dialog isOpen onClose={onClose} title={title} style={{ width: 640 }}>
      <DialogBody>
        {mode.kind === "create" ? (
          <FormGroup label="Start from" labelFor="strategy-template">
            <HTMLSelect
              id="strategy-template"
              fill
              value={template}
              onChange={(event) => {
                setTemplate(event.target.value);
                const found = templates.data?.find((item) => item.name === event.target.value);
                setDraft(found ? { ...found, name: `${found.name}-copy`.slice(0, 48) } : BLANK);
              }}
            >
              <option value="">Blank</option>
              {(templates.data ?? []).map((item) => (
                <option key={item.name} value={item.name}>
                  {item.title}
                </option>
              ))}
            </HTMLSelect>
          </FormGroup>
        ) : null}
        <div className="form-pair">
          <FormGroup
            label="Name"
            labelFor="strategy-name"
            helperText="Lower case letters, digits and dashes"
          >
            <InputGroup
              id="strategy-name"
              value={draft.name}
              disabled={mode.kind === "edit"}
              onValueChange={(value) => set("name", value.toLowerCase())}
            />
          </FormGroup>
          <FormGroup label="Title" labelFor="strategy-title">
            <InputGroup
              id="strategy-title"
              value={draft.title}
              onValueChange={(value) => set("title", value)}
            />
          </FormGroup>
        </div>
        <FormGroup label="Description" labelFor="strategy-description">
          <TextArea
            id="strategy-description"
            fill
            rows={3}
            style={{ fontFamily: "inherit" }}
            value={draft.description}
            onChange={(event) => set("description", event.target.value)}
          />
        </FormGroup>
        <FormGroup
          label="Universe"
          labelFor="strategy-universe"
          helperText="Stocks and Shariah funds, or coins such as BTC/USD; each must pass the Shariah screen"
        >
          <TagInput
            values={draft.universe}
            inputProps={{ id: "strategy-universe" }}
            addOnBlur
            tagProps={(value) => symbolTag(verdicts[String(value)])}
            onChange={(values) =>
              set(
                "universe",
                values.map((value) => String(value).trim().toUpperCase()).filter(Boolean),
              )
            }
          />
        </FormGroup>
        <div className="form-pair">
          <FormGroup label="Signal" labelFor="strategy-signal">
            <HTMLSelect
              id="strategy-signal"
              fill
              value={draft.signal}
              onChange={(event) => set("signal", event.target.value as Signal)}
            >
              {Object.entries(SIGNALS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </HTMLSelect>
          </FormGroup>
          {usesWindow ? (
            <FormGroup label="Window, days" labelFor="strategy-window">
              <NumericInput
                id="strategy-window"
                fill
                min={5}
                max={400}
                value={draft.window}
                onValueChange={(value) => set("window", value)}
              />
            </FormGroup>
          ) : null}
          {usesLookbacks ? (
            <FormGroup
              label="Lookbacks, days"
              labelFor="strategy-lookbacks"
              helperText="Each window votes"
            >
              <TagInput
                values={draft.lookbacks.map(String)}
                inputProps={{ id: "strategy-lookbacks" }}
                addOnBlur
                onChange={(values) =>
                  set(
                    "lookbacks",
                    values.map((value) => Number(value)).filter((value) => value >= 2),
                  )
                }
              />
            </FormGroup>
          ) : null}
        </div>
        {draft.signal === "momentum" ? (
          <FormGroup label="Holdings" labelFor="strategy-top" helperText="Best performers held">
            <NumericInput
              id="strategy-top"
              min={1}
              max={Math.max(1, draft.universe.length)}
              value={draft.top_n}
              onValueChange={(value) => set("top_n", value)}
            />
          </FormGroup>
        ) : null}
        <Switch
          label="Size to a target volatility, never above 1x"
          checked={draft.target_vol != null}
          onChange={(event) => set("target_vol", event.currentTarget.checked ? 0.15 : null)}
        />
        {draft.target_vol != null ? (
          <div className="form-pair">
            <FormGroup label="Target volatility, % a year" labelFor="strategy-vol">
              <NumericInput
                id="strategy-vol"
                fill
                min={2}
                max={100}
                value={Math.round(draft.target_vol * 100)}
                onValueChange={(value) => set("target_vol", value / 100)}
              />
            </FormGroup>
            <FormGroup label="Measured over, days" labelFor="strategy-vol-window">
              <NumericInput
                id="strategy-vol-window"
                fill
                min={5}
                max={250}
                value={draft.vol_window}
                onValueChange={(value) => set("vol_window", value)}
              />
            </FormGroup>
          </div>
        ) : null}
        <div className="form-pair">
          <FormGroup
            label="Traded each day, %"
            labelFor="strategy-rate"
            helperText="100 moves straight to the target"
          >
            <NumericInput
              id="strategy-rate"
              fill
              min={1}
              max={100}
              value={Math.round(draft.trade_rate * 100)}
              onValueChange={(value) => set("trade_rate", value / 100)}
            />
          </FormGroup>
          <FormGroup
            label="No-trade band, %"
            labelFor="strategy-band"
            helperText="Smaller changes are skipped"
          >
            <NumericInput
              id="strategy-band"
              fill
              min={0}
              max={50}
              value={Math.round(draft.band * 100)}
              onValueChange={(value) => set("band", value / 100)}
            />
          </FormGroup>
        </div>
        <div className="form-pair">
          <FormGroup
            label="Cost per trade, bps"
            labelFor="strategy-fee"
            helperText={
              measured ? (
                <>
                  Your {measured.orders} {measured.asset} fills cost {measured.cost_bps} bps{" "}
                  <Button
                    small
                    minimal
                    intent="primary"
                    onClick={() => set("fee_bps", measured.cost_bps)}
                  >
                    Use it
                  </Button>
                </>
              ) : undefined
            }
          >
            <NumericInput
              id="strategy-fee"
              fill
              min={0}
              max={500}
              value={draft.fee_bps}
              onValueChange={(value) => set("fee_bps", value)}
            />
          </FormGroup>
          <FormGroup label="Fills" labelFor="strategy-fills">
            <HTMLSelect
              id="strategy-fills"
              fill
              value={draft.fills}
              onChange={(event) => set("fills", event.target.value as Draft["fills"])}
            >
              <option value="next_open">Next open</option>
              <option value="close">Close</option>
            </HTMLSelect>
          </FormGroup>
        </div>
        {isCrypto(draft) ? null : (
          <Checkbox
            label="Judge significance on the US market's century (US equity funds only)"
            checked={draft.proxy}
            onChange={(event) => set("proxy", event.currentTarget.checked)}
          />
        )}
        <FormGroup label="Note on this version" labelFor="strategy-note">
          <InputGroup
            id="strategy-note"
            value={note}
            placeholder="Why it changed"
            onValueChange={setNote}
          />
        </FormGroup>
        {warnings.length ? (
          <Callout intent="warning" style={{ marginBottom: 8 }}>
            {warnings.map((warning) => (
              <div key={warning}>{warning}</div>
            ))}
          </Callout>
        ) : null}
        {problems.length ? (
          <div className="muted" style={{ marginBottom: 8 }}>
            Before it can be saved:
            {problems.map((problem) => (
              <div key={problem}>· {problem}</div>
            ))}
          </div>
        ) : null}
        {mode.kind === "edit" && rewordedOnly(mode.draft, draft) ? (
          <Callout intent="primary">
            Only the wording changes: version {mode.version + 1} keeps its lifecycle stage.
          </Callout>
        ) : mode.kind === "edit" ? (
          <Callout intent="warning">
            Saving makes version {mode.version + 1}. The lifecycle starts it again at research, so
            if this strategy trades now it stops until the new version passes its gates.
          </Callout>
        ) : (
          <Callout>New strategies start in research with no capital.</Callout>
        )}
        {preview.data ? (
          <PreviewPanel found={preview.data} stale={tested !== JSON.stringify(draft)} />
        ) : null}
        {preview.error ? (
          <Callout intent="danger" style={{ marginTop: 8 }}>
            {detail(preview.error)}
          </Callout>
        ) : null}
        {error ? (
          <Callout intent="danger" style={{ marginTop: 8 }}>
            {detail(error)}
          </Callout>
        ) : null}
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <span className="muted grow" style={{ fontSize: 12 }}>
              A rule backtested for the first time counts as a trial
            </span>
            <Button onClick={onClose}>Cancel</Button>
            <Button icon="play" disabled={!ready} loading={preview.isPending} onClick={backtest}>
              Backtest
            </Button>
            <Button intent="primary" disabled={!ready} loading={saving} onClick={save}>
              Save
            </Button>
          </>
        }
      />
    </Dialog>
  );
}

function PreviewPanel({ found, stale }: { found: Preview; stale: boolean }) {
  const dark = useDark();
  const result = found.result;
  return (
    <section className="panel" style={{ marginTop: 8 }}>
      <h2 className="panel-title">
        Backtest, {day(result.start)} to {day(result.end)}
        {stale ? " · the draft has changed since" : ""}
      </h2>
      <div className="strip">
        <Figure
          lead
          label="Sharpe"
          value={result.metrics.sharpe.toFixed(2)}
          note={`buy and hold ${result.benchmark.sharpe.toFixed(2)}`}
        />
        <Figure label="CAGR" value={percent(result.metrics.cagr)} />
        <Figure label="Max drawdown" value={percent(result.metrics.max_drawdown)} />
        <Figure
          label="Deflated Sharpe, own history"
          value={percent(result.deflated_sharpe)}
          note={
            result.evidence
              ? `${percent(result.evidence.deflated_sharpe)} on the market since 1927`
              : undefined
          }
        />
      </div>
      {result.checks.map((item) => (
        <div key={item.name}>
          <span className={item.passed ? "gain" : "loss"}>{item.passed ? "✓" : "✕"}</span>{" "}
          {item.name}
        </div>
      ))}
      <p className="muted">
        {found.new_trial
          ? `A new rule: the search now counts ${found.trials} distinct rules.`
          : `Tried before, so no new trial; the search counts ${found.trials} rules.`}
      </p>
      <Chart
        label="Draft against buy and hold"
        height={160}
        option={{
          animation: false,
          tooltip: { trigger: "axis" },
          xAxis: { type: "time" },
          yAxis: { type: "value", scale: true },
          series: [
            {
              type: "line",
              name: "Draft",
              symbol: "none",
              color: dark ? ACCENT_DARK : ACCENT_LIGHT,
              data: result.growth.map((point) => [point.time, point.strategy]),
            },
            {
              type: "line",
              name: "Buy and hold",
              symbol: "none",
              color: GRAY,
              data: result.growth.map((point) => [point.time, point.benchmark]),
            },
          ],
        }}
      />
    </section>
  );
}

export async function downloadExport(name?: string): Promise<void> {
  const found = name
    ? await fetchClient.GET("/strategies/{name}/export", { params: { path: { name } } })
    : await fetchClient.GET("/strategies/export");
  if (!found.data) throw new Error(detail(found.error));
  const blob = new Blob([JSON.stringify(found.data, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${name ?? "strategies"}.strategy.json`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function ImportDialog({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const [file, setFile] = useState<StrategyFile | null>(null);
  const [fileName, setFileName] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [copy, setCopy] = useState(false);
  const run = api.useMutation("post", "/strategies/import", {
    onSuccess: () => client.invalidateQueries(),
  });
  const read = async (chosen: File | undefined) => {
    setProblem(null);
    setFile(null);
    run.reset();
    if (!chosen) return;
    setFileName(chosen.name);
    try {
      setFile(JSON.parse(await chosen.text()) as StrategyFile);
    } catch {
      setProblem("The file is not JSON");
    }
  };
  return (
    <Dialog isOpen onClose={onClose} title="Import strategies">
      <DialogBody>
        <FormGroup label="Strategy file" helperText="A .strategy.json exported from this platform">
          <FileInput
            fill
            text={fileName || "Choose a file"}
            inputProps={{ accept: "application/json,.json" }}
            onInputChange={(event) => read(event.currentTarget.files?.[0])}
          />
        </FormGroup>
        {file?.strategies ? (
          <p>
            {file.strategies.length} strateg{file.strategies.length === 1 ? "y" : "ies"}:{" "}
            {file.strategies.map((item) => item.draft.name).join(", ")}
          </p>
        ) : null}
        <Checkbox
          label="Import a name already taken as a numbered copy"
          checked={copy}
          onChange={(event) => setCopy(event.currentTarget.checked)}
        />
        <p className="muted">
          Each one is checked and starts in research with no capital. Results in the file are shown
          for reference only; the platform tests every strategy itself.
        </p>
        {problem ? <Callout intent="danger">{problem}</Callout> : null}
        {run.error ? <Callout intent="danger">{detail(run.error)}</Callout> : null}
        {run.data ? (
          <Callout intent="success">
            Imported {run.data.names.join(", ")}
            {Object.keys(run.data.renamed).length
              ? `; renamed ${Object.entries(run.data.renamed)
                  .map(([from, to]) => `${from} to ${to}`)
                  .join(", ")}`
              : ""}
          </Callout>
        ) : null}
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button onClick={onClose}>{run.data ? "Close" : "Cancel"}</Button>
            {run.data ? null : (
              <Button
                intent="primary"
                disabled={!file}
                loading={run.isPending}
                onClick={() => file && run.mutate({ body: file, params: { query: { copy } } })}
              >
                Import
              </Button>
            )}
          </>
        }
      />
    </Dialog>
  );
}

export function LibraryBar() {
  const [editing, setEditing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  return (
    <>
      <Button small icon="plus" intent="primary" onClick={() => setEditing(true)}>
        New strategy
      </Button>
      <Button small icon="import" onClick={() => setImporting(true)}>
        Import
      </Button>
      <Button
        small
        icon="export"
        onClick={() => downloadExport().catch((error) => setExportError(detail(error)))}
      >
        Export all
      </Button>
      {exportError ? <span className="loss">{exportError}</span> : null}
      {editing ? (
        <StrategyEditor mode={{ kind: "create" }} onClose={() => setEditing(false)} />
      ) : null}
      {importing ? <ImportDialog onClose={() => setImporting(false)} /> : null}
    </>
  );
}

export function Archived() {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const listed = api.useQuery(
    "get",
    "/strategies",
    { params: { query: { archived: true } } },
    { enabled: open },
  );
  const restore = api.useMutation("post", "/strategies/{name}/restore", {
    onSuccess: () => client.invalidateQueries(),
  });
  const archived = (listed.data ?? []).filter((item) => item.archived);
  return (
    <section className="panel">
      <Switch label="Show archived" checked={open} onChange={() => setOpen(!open)} />
      {open ? (
        archived.length ? (
          <HTMLTable compact style={{ width: "100%" }}>
            <thead>
              <tr>
                <Th>Strategy</Th>
                <Th>Version</Th>
                <Th>Archived</Th>
                <Th>{""}</Th>
              </tr>
            </thead>
            <tbody>
              {archived.map((item) => (
                <tr key={item.name}>
                  <td>{item.title}</td>
                  <td className="num">v{item.version}</td>
                  <td className="num">{time(item.updated)}</td>
                  <td>
                    <Button
                      small
                      loading={restore.isPending}
                      onClick={() => restore.mutate({ params: { path: { name: item.name } } })}
                    >
                      Restore
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </HTMLTable>
        ) : (
          <p className="muted">Nothing archived</p>
        )
      ) : null}
      {restore.error ? <Callout intent="danger">{detail(restore.error)}</Callout> : null}
    </section>
  );
}

export function DefinitionActions({ name }: { name: string }) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const found = api.useQuery("get", "/strategies/{name}", { params: { path: { name } } });
  const [mode, setMode] = useState<EditorMode | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const archive = api.useMutation("post", "/strategies/{name}/archive", {
    onSuccess: () => {
      client.invalidateQueries();
      navigate("/strategies");
    },
  });
  const current = found.data;
  if (!current) return null;
  return (
    <>
      <Button
        icon="edit"
        onClick={() => setMode({ kind: "edit", draft: current.draft, version: current.version })}
      >
        Edit
      </Button>
      <Button icon="duplicate" onClick={() => setMode({ kind: "duplicate", draft: current.draft })}>
        Duplicate
      </Button>
      <Button
        icon="export"
        onClick={() => downloadExport(name).catch((error) => setExportError(detail(error)))}
      >
        Export
      </Button>
      <Button icon="archive" onClick={() => setArchiving(true)}>
        Archive
      </Button>
      {exportError ? <span className="loss">{exportError}</span> : null}
      {mode ? <StrategyEditor mode={mode} onClose={() => setMode(null)} /> : null}
      <Dialog isOpen={archiving} onClose={() => setArchiving(false)} title="Archive strategy">
        <DialogBody>
          <p>
            It leaves every list, backtest and lifecycle check until restored. Its versions are kept
            and still count as trials.
          </p>
          {archive.error ? <Callout intent="danger">{detail(archive.error)}</Callout> : null}
        </DialogBody>
        <DialogFooter
          actions={
            <Button
              intent="danger"
              loading={archive.isPending}
              onClick={() => archive.mutate({ params: { path: { name } } })}
            >
              Archive
            </Button>
          }
        />
      </Dialog>
    </>
  );
}

const LABELS: [keyof Draft, string][] = [
  ["title", "Title"],
  ["universe", "Universe"],
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
  ["note", "Note"],
];

const SHARES = new Set<keyof Draft>(["target_vol", "trade_rate", "band"]);

export function described(key: keyof Draft, value: unknown): string {
  if (value == null || (Array.isArray(value) && value.length === 0)) return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (SHARES.has(key)) return `${Math.round(Number(value) * 100)}%`;
  if (key === "signal") return SIGNALS[value as Signal] ?? String(value);
  if (key === "fills") return value === "close" ? "Close" : "Next open";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

type Change = components["schemas"]["FieldChange"];

export function changed(changes: Change[]): string {
  const label = (field: string) =>
    LABELS.find(([key]) => key === field)?.[1] ?? field.replace(/_/g, " ");
  return changes
    .map((item) => {
      const field = item.field as keyof Draft;
      return `${label(item.field)} ${described(field, item.before)} → ${described(field, item.after)}`;
    })
    .join(" · ");
}

export function VersionHistory({ name }: { name: string }) {
  const found = api.useQuery("get", "/strategies/{name}", { params: { path: { name } } });
  const [shown, setShown] = useState<number | null>(null);
  const version = api.useQuery(
    "get",
    "/strategies/{name}/versions/{version}",
    { params: { path: { name, version: shown ?? 0 } } },
    { enabled: shown != null },
  );
  const current = found.data;
  if (!current) return null;
  return (
    <section className="panel">
      <h2 className="panel-title">
        Versions · {current.source === "template" ? "built in" : current.source}
      </h2>
      <HTMLTable compact style={{ width: "100%" }}>
        <thead>
          <tr>
            <Th>Version</Th>
            <Th>Saved</Th>
            <Th>What changed</Th>
            <Th>Note</Th>
            <Th>{""}</Th>
          </tr>
        </thead>
        <tbody>
          {current.history.map((item) => (
            <tr key={item.version}>
              <td className="num">
                v{item.version}
                {item.version === current.version ? " · current" : ""}
              </td>
              <td className="num">{time(item.created)}</td>
              <td>{changed(item.changes) || (item.version === 1 ? "first version" : "")}</td>
              <td>{item.note ?? ""}</td>
              <td>
                <Button small minimal onClick={() => setShown(item.version)}>
                  View
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </HTMLTable>
      <Dialog
        isOpen={shown != null}
        onClose={() => setShown(null)}
        title={`${name} v${shown ?? ""}`}
      >
        <DialogBody>
          {version.data ? (
            <HTMLTable compact style={{ width: "100%" }}>
              <tbody>
                {LABELS.map(([key, label]) => (
                  <tr key={key}>
                    <td>{label}</td>
                    <td className="num">{described(key, version.data[key])}</td>
                  </tr>
                ))}
              </tbody>
            </HTMLTable>
          ) : null}
        </DialogBody>
      </Dialog>
    </section>
  );
}
