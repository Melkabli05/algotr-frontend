import type { Scale } from "./catalog";

const LAYOUT_KEY = "algotr-chart";
const DRAWINGS_KEY = "algotr-chart-drawings";
const DRAWINGS_KEPT = 200;

export type Colours = "classic" | "blue";

export interface Layout {
  indicators: string[];
  params: Record<string, number[]>;
  type: string;
  colours: Colours;
  scale: Scale;
  magnet: boolean;
}

export interface Drawing {
  name: string;
  points: { timestamp: number; value: number }[];
  lock?: boolean;
}

export const DEFAULT_LAYOUT: Layout = {
  indicators: ["VOL"],
  params: {},
  type: "candle_solid",
  colours: "classic",
  scale: "normal",
  magnet: false,
};

export function loadLayout(): Layout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    return raw ? { ...DEFAULT_LAYOUT, ...JSON.parse(raw) } : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function saveLayout(layout: Layout): void {
  try {
    localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    return;
  }
}

export function loadDrawings(symbol: string): Drawing[] {
  try {
    const found = JSON.parse(localStorage.getItem(`${DRAWINGS_KEY}:${symbol}`) ?? "[]");
    return Array.isArray(found) ? found.filter(isDrawing) : [];
  } catch {
    return [];
  }
}

export function saveDrawings(symbol: string, drawings: Drawing[]): void {
  try {
    const key = `${DRAWINGS_KEY}:${symbol}`;
    if (drawings.length) localStorage.setItem(key, JSON.stringify(drawings.slice(-DRAWINGS_KEPT)));
    else localStorage.removeItem(key);
  } catch {
    return;
  }
}

function isDrawing(value: unknown): value is Drawing {
  if (typeof value !== "object" || value === null) return false;
  const found = value as Partial<Drawing>;
  return (
    typeof found.name === "string" &&
    Array.isArray(found.points) &&
    found.points.every(
      (point) => Number.isFinite(point?.timestamp) && Number.isFinite(point?.value),
    )
  );
}
