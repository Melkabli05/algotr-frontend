import { cumulative } from "../views/OrderBook";
import { shown, standing } from "../views/Strategies";
import {
  type Explanations,
  MIN_HISTORY,
  narrative,
  percentile,
  signalsOf,
  waterfall,
} from "../views/xai";

const decision = (decided: string, spus: number, values: Record<string, number>) => ({
  decided,
  version: 2,
  trained: "2026-11-01",
  weights: { SPUS: spus, HLAL: 1 - spus - 0.1, cash: 0.1 },
  base: { SPUS: 0.3, HLAL: 0.3, cash: 0.4 },
  values: Object.fromEntries(
    Object.entries(values).map(([group, value]) => [group, { SPUS: value, HLAL: -value, cash: 0 }]),
  ),
  inputs: Object.fromEntries(Object.keys(values).map((group) => [group, { SPUS: 1, HLAL: -1 }])),
  residual: 0,
});

const explanations = {
  algorithm: "ppo",
  version: 2,
  assets: ["SPUS", "HLAL", "cash"],
  groups: ["ret_5", "sma_30", "held"],
  decisions: [
    decision("2026-11-05", 0.6, { ret_5: 0.25, sma_30: 0.1, held: -0.05 }),
    decision("2026-11-04", 0.3, { ret_5: 0, sma_30: 0, held: 0 }),
  ],
  overall: null,
  across: {},
  unexplained: 0,
} as unknown as Explanations;

describe("signals from decisions", () => {
  it("turns a change of weight into buy, sell or hold, newest first", () => {
    const found = signalsOf(explanations);
    expect(found.map((signal) => [signal.decided, signal.symbol, signal.direction])).toEqual([
      ["2026-11-05", "HLAL", "Sell"],
      ["2026-11-05", "SPUS", "Buy"],
      ["2026-11-04", "HLAL", "Hold"],
      ["2026-11-04", "SPUS", "Hold"],
    ]);
    expect(found[1]?.change).toBeCloseTo(0.3);
  });

  it("builds the waterfall from the baseline, largest push first, ending at the weight", () => {
    const bars = waterfall(explanations.decisions[0] as never, "SPUS");
    expect(bars.map((bar) => bar.label)).toEqual([
      "5-day return",
      "Price vs 30-day average",
      "Weights already held",
    ]);
    expect(bars[0]?.start).toBeCloseTo(0.3);
    expect(bars.at(-1)?.end).toBeCloseTo(0.6);
  });

  it("folds the smallest pushes into one bar", () => {
    const many = decision("d", 0.5, {
      a: 0.1,
      b: 0.09,
      c: 0.08,
      d: 0.07,
      e: 0.06,
      f: 0.05,
      g: 0.04,
      h: 0.03,
      i: -0.02,
      j: 0.01,
    });
    const bars = waterfall(many as never, "SPUS", 8);
    expect(bars).toHaveLength(9);
    expect(bars.at(-1)?.label).toBe("2 other features");
    expect(bars.at(-1)?.value).toBeCloseTo(-0.01);
  });

  it("writes what pushed the weight up and what held it back", () => {
    const [, buy] = signalsOf(explanations);
    expect(buy && narrative(buy, explanations)).toBe(
      "On 2026-11-05 PPO raised SPUS to 60.0%, against an average of 30.0%. Pushed up by 5-day return (+25.0 points) and price vs 30-day average (+10.0 points). Held back by weights already held (−5.0 points).",
    );
  });

  it("gives a percentile only with enough history", () => {
    expect(percentile([1, 2, 3], 2)).toBeNull();
    const values = Array.from({ length: MIN_HISTORY }, (_, index) => index);
    expect(percentile(values, 4.5)).toBe(0.5);
  });
});

describe("order book and strategies", () => {
  it("sums the depth level by level", () => {
    expect(
      cumulative([
        { price: 10, size: 1 },
        { price: 9, size: 2 },
      ]),
    ).toEqual([
      [10, 1],
      [9, 3],
    ]);
  });

  it("names a strategy's standing and shows parameters in words", () => {
    const item = {
      spec: { name: "halal-etf-trend" },
      active: true,
      research: {},
      streak: 0,
    } as never;
    expect(standing(item, { mode: "paper", paused: [] } as never)).toBe("Paper");
    expect(standing(item, { mode: "paper", paused: ["halal-etf-trend"] } as never)).toBe("Paused");
    expect(
      standing({ ...(item as object), active: false, streak: 4 } as never, { paused: [] } as never),
    ).toBe("Passing 4 of 10 days");
    expect(shown("next_open")).toBe("Next open");
    expect(shown(true)).toBe("Yes");
    expect(shown(["SPUS", "HLAL"])).toBe("SPUS, HLAL");
  });
});
