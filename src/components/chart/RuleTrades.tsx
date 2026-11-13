import { HTMLTable } from "@blueprintjs/core";
import { money, percent, signedPercent } from "../../format";
import { Figure } from "../Figure";
import type { Trace } from "./sources";

export function RuleTrades({
  trace,
  onPick,
}: {
  trace: Trace;
  onPick: (trade: Trace["trades"][number]) => void;
}) {
  const done = trace.trades.filter((trade) => !trade.open);
  const wins = done.filter((trade) => trade.gain > 0).length;
  const average = done.length
    ? done.reduce((sum, trade) => sum + trade.gain, 0) / done.length
    : null;
  const held = trace.bars.filter((bar) => bar.held > 0).length;
  return (
    <div className="stack">
      <div className="strip">
        <Figure label="Trades" value={trace.trades.length} />
        <Figure label="Won" value={done.length ? percent(wins / done.length, 0) : "—"} />
        <Figure label="Average gain" value={average == null ? "—" : signedPercent(average)} />
        <Figure label="Days held" value={`${held} of ${trace.bars.length}`} />
        <Figure label="Fee" value={`${trace.fee_bps} bps`} />
      </div>
      <div className="rule-trades">
        <HTMLTable compact interactive style={{ width: "100%" }}>
          <thead>
            <tr>
              <th>#</th>
              <th>Entry</th>
              <th>Entry price</th>
              <th>Exit</th>
              <th>Exit price</th>
              <th>Days</th>
              <th>Weight</th>
              <th>Gain</th>
            </tr>
          </thead>
          <tbody className="num">
            {[...trace.trades].reverse().map((trade, at) => (
              <tr
                key={trade.entry}
                title={[trade.why_entry, trade.why_exit].filter(Boolean).join(". ")}
                onClick={() => onPick(trade)}
              >
                <td>{trace.trades.length - at}</td>
                <td>{trade.entry}</td>
                <td>{money(trade.entry_price)}</td>
                <td>{trade.exit ?? "open"}</td>
                <td>{trade.exit_price == null ? "—" : money(trade.exit_price)}</td>
                <td>{trade.days}</td>
                <td>{percent(trade.weight, 0)}</td>
                <td className={trade.gain >= 0 ? "gain" : "loss"}>{signedPercent(trade.gain)}</td>
              </tr>
            ))}
          </tbody>
        </HTMLTable>
      </div>
    </div>
  );
}
