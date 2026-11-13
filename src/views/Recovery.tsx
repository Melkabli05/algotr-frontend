import { Button, Callout, Dialog, DialogBody, DialogFooter, InputGroup } from "@blueprintjs/core";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router";
import { api, detail } from "../api/client";
import { percent, time } from "../format";

const CRITICAL = new Set(["defensive", "flatten"]);

const WHY: Record<string, string> = {
  watch: "the autopilot's drawdown passed a quarter of its limit",
  reduce: "the drawdown passed the reduce point, so new targets are cut to half size",
  defensive: "the drawdown passed three quarters of its limit, so the autopilot only sells",
  flatten: "the drawdown reached its limit, so the autopilot sold what it held",
};

export function Recovery() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const automation = api.useQuery("get", "/systematic/automation", undefined, {
    refetchInterval: 30_000,
  });
  const [asked, setAsked] = useState(false);
  const [typed, setTyped] = useState("");
  const resume = api.useMutation("post", "/systematic/automation/resume", {
    onSuccess: () => {
      client.invalidateQueries();
      setAsked(false);
      setTyped("");
    },
  });
  const found = automation.data;
  if (!found) return null;
  const state = found.kill_state ?? "normal";
  const halted = found.halted;
  if (!halted && !CRITICAL.has(state)) return null;
  const last = found.runs?.[0];
  const sold = (last?.executed ?? []).filter((order) => order.side === "sell").length;
  const bought = (last?.executed ?? []).filter((order) => order.side === "buy").length;
  const severe = Boolean(halted) || state === "flatten" || state === "defensive";
  return (
    <Callout
      intent={severe ? "danger" : "warning"}
      icon="warning-sign"
      title={
        halted || state === "flatten"
          ? `KILL — drawdown ${percent(found.book.drawdown)} (threshold ${percent(found.config.max_drawdown, 0)})${last ? ` at ${time(last.time)}` : ""}`
          : `CRITICAL — drawdown ${percent(found.book.drawdown)} (sells only from ${percent(found.config.max_drawdown * 0.75)})`
      }
    >
      <p style={{ margin: "4px 0" }}>
        <strong>Why:</strong> {halted ?? WHY[state] ?? state}. Drawdown{" "}
        {percent(found.book.drawdown)} of a {percent(found.config.max_drawdown, 0)} limit.
      </p>
      {last ? (
        <p style={{ margin: "4px 0" }}>
          <strong>Already done:</strong> last run {time(last.time)} was {last.status}
          {last.executed?.length ? `, ${sold} sells and ${bought} buys sent` : ", no orders sent"}
          {last.detail ? `: ${last.detail}` : ""}.
        </p>
      ) : null}
      <ol style={{ margin: "4px 0 8px", paddingLeft: 18 }}>
        <li>Read the risk events that led here.</li>
        <li>Check positions and the ledger against Alpaca.</li>
        <li>
          {halted
            ? "Resume once the cause is understood; the drawdown restarts from today's value."
            : "The step clears by itself as the drawdown recovers; nothing to switch."}
        </li>
      </ol>
      <div className="row">
        <Button small onClick={() => navigate("/risk")}>
          Risk events
        </Button>
        <Button small onClick={() => navigate("/reconciliation")}>
          Reconciliation
        </Button>
        {halted ? (
          <Button small intent="primary" onClick={() => setAsked(true)}>
            Resume autopilot
          </Button>
        ) : null}
      </div>
      <Dialog isOpen={asked} onClose={() => setAsked(false)} title="Resume the autopilot">
        <DialogBody>
          <p>
            The autopilot starts trading again at its next run, with its drawdown measured from
            today. Type RESUME to confirm.
          </p>
          <InputGroup value={typed} onValueChange={setTyped} aria-label="Type RESUME" />
          {resume.isError ? <Callout intent="danger">{detail(resume.error)}</Callout> : null}
        </DialogBody>
        <DialogFooter
          actions={
            <Button
              intent="primary"
              disabled={typed !== "RESUME"}
              loading={resume.isPending}
              onClick={() => resume.mutate({})}
            >
              Resume
            </Button>
          }
        />
      </Dialog>
    </Callout>
  );
}
