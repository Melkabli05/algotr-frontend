import { toCsv } from "../csv";
import { variantCount } from "../views/Backtesting";
import { limitThreshold, limitValue } from "../views/Risk";

describe("phase 3 helpers", () => {
  it("counts the variants a sweep will run", () => {
    expect(variantCount([100, 250, 25], null)).toBe(7);
    expect(variantCount([63, 252, 63], [1, 2])).toBe(8);
    expect(variantCount([200, 100, 10], null)).toBe(0);
  });

  it("writes a limit in its own unit", () => {
    const limit = {
      name: "x",
      value: 0.483,
      threshold: 0.25,
      used: 1.9,
      unit: "share",
      scope: "account" as const,
      last_triggered: null,
    };
    expect(limitValue(limit)).toBe("48.3%");
    expect(limitThreshold(limit)).toBe("25%");
    expect(limitValue({ ...limit, value: null, scope: "order" })).toBe("per order");
    expect(limitValue({ ...limit, value: null, scope: "account" })).toBe("—");
    expect(limitThreshold({ ...limit, unit: "bps", threshold: 50 })).toBe("50 bps");
    expect(limitThreshold({ ...limit, unit: "share", threshold: 0.01 })).toBe("1.0%");
  });

  it("quotes CSV cells that need it", () => {
    expect(toCsv([{ a: "x, y", b: 'say "hi"', c: null }])).toBe('a,b,c\n"x, y","say ""hi""",');
    expect(toCsv([])).toBe("");
  });
});
