import { Button, ButtonGroup } from "@blueprintjs/core";
import type { Trace } from "./sources";

export const YEARS = [1, 3, 5, 8];

export function RuleLine({
  title,
  trace,
  loading,
  years,
  onYears,
  onExit,
}: {
  title: string;
  trace: Trace | undefined;
  loading: boolean;
  years: number;
  onYears: (years: number) => void;
  onExit: () => void;
}) {
  return (
    <div className="row overlay-line">
      <span className="grow muted">
        Backtest of {title}
        {trace
          ? `, evaluated from ${trace.evaluated_from}, fills at the ${trace.fills === "close" ? "close" : "next open"}, fee ${trace.fee_bps} bps`
          : loading
            ? ", loading"
            : ", not available"}
      </span>
      <ButtonGroup minimal>
        {YEARS.map((item) => (
          <Button
            key={item}
            small
            active={item === years}
            aria-pressed={item === years}
            aria-label={`${item} ${item === 1 ? "year" : "years"} of history`}
            text={`${item}y`}
            onClick={() => onYears(item)}
          />
        ))}
      </ButtonGroup>
      <Button small minimal icon="cross" onClick={onExit}>
        Back to live
      </Button>
    </div>
  );
}

export function TradesLine({
  fills,
  markers,
  loading,
  failed,
  onExit,
}: {
  fills: number;
  markers: number;
  loading: boolean;
  failed: boolean;
  onExit: () => void;
}) {
  const note = failed
    ? "could not load the ledger"
    : loading
      ? "loading"
      : fills === 0
        ? "no fills for this symbol in the last year"
        : `${fills} fill${fills === 1 ? "" : "s"}${markers < fills ? ` in ${markers} markers` : ""}${fills >= 500 ? ", the latest 500" : ""}`;
  return (
    <div className="row overlay-line">
      <span className="grow muted">My trades, {note}</span>
      <Button small minimal icon="cross" onClick={onExit}>
        Hide
      </Button>
    </div>
  );
}
