import { type KLineData, registerIndicator } from "klinecharts";

export const RULE_LINES = "RULE_LINES";
export const RULE_PANE = "RULE_PANE";
export const RULE_NAMES = new Set([RULE_LINES, RULE_PANE]);

export interface RuleExtend {
  shade: string;
  bar: string;
}

const line = (name: string) => `l:${name}`;
const value = (name: string) => `v:${name}`;

export const extra = {
  line,
  value,
  held: "held",
  target: "target",
};

export const WEIGHT = "weight";

let registered = false;

export function registerRule(): void {
  if (registered) return;
  registered = true;
  registerIndicator<Record<string, number | undefined>, string, RuleExtend>({
    name: RULE_LINES,
    shortName: "Rule",
    series: "price",
    calcParams: [],
    shouldOhlc: false,
    regenerateFigures: (names) =>
      names.map((name) => ({ key: name, title: `${name}: `, type: "line" })),
    calc: (bars, indicator) =>
      bars.map((bar) =>
        Object.fromEntries(indicator.calcParams.map((name) => [name, numeric(bar[line(name)])])),
      ),
    draw: ({ ctx, chart, indicator, bounding, xAxis }) => {
      const { from, to } = chart.getVisibleRange();
      const bars = chart.getDataList();
      const half = chart.getBarSpace().halfBar;
      const shade = indicator.extendData?.shade;
      if (!shade) return false;
      ctx.save();
      ctx.fillStyle = shade;
      let start: number | null = null;
      const close = (end: number) => {
        if (start == null) return;
        const left = xAxis.convertToPixel(start) - half;
        ctx.fillRect(left, 0, xAxis.convertToPixel(end) + half - left, bounding.height);
        start = null;
      };
      for (let at = Math.max(from - 1, 0); at < Math.min(to + 1, bars.length); at += 1) {
        if (held(bars[at]) > 0) start = start ?? at;
        else close(at - 1);
      }
      close(Math.min(to + 1, bars.length) - 1);
      ctx.restore();
      return false;
    },
  });
  registerIndicator<Record<string, number | undefined>, string, RuleExtend>({
    name: RULE_PANE,
    shortName: "Position",
    series: "normal",
    calcParams: [],
    shouldOhlc: false,
    regenerateFigures: (names) =>
      names.map((name) =>
        name === WEIGHT
          ? {
              key: name,
              title: "Held: ",
              type: "bar",
              baseValue: 0,
              styles: ({ indicator }) => ({
                color: (indicator.extendData as RuleExtend | undefined)?.bar,
              }),
            }
          : { key: name, title: `${name}: `, type: "line" },
      ),
    calc: (bars, indicator) =>
      bars.map((bar) =>
        Object.fromEntries(
          indicator.calcParams.map((name) => [
            name,
            numeric(name === WEIGHT ? bar[extra.held] : bar[value(name)]),
          ]),
        ),
      ),
  });
}

function numeric(input: unknown): number | undefined {
  return typeof input === "number" && Number.isFinite(input) ? input : undefined;
}

function held(bar: KLineData | undefined): number {
  return numeric(bar?.[extra.held]) ?? 0;
}
