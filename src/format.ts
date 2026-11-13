const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const plain = new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 });

export const money = (value: number | null | undefined): string =>
  value == null ? "—" : usd.format(value);

export const signedMoney = (value: number | null | undefined): string =>
  value == null ? "—" : `${value >= 0 ? "+" : "−"}${usd.format(Math.abs(value))}`;

export const percent = (value: number | null | undefined, digits = 1): string =>
  value == null ? "—" : `${(value * 100).toFixed(digits)}%`;

export const signedPercent = (value: number | null | undefined, digits = 2): string =>
  value == null ? "—" : `${value >= 0 ? "+" : "−"}${Math.abs(value * 100).toFixed(digits)}%`;

export const quantity = (value: number | null | undefined): string =>
  value == null ? "—" : plain.format(value);

export const ZONES = ["local", "UTC", "America/New_York"] as const;
export type Zone = (typeof ZONES)[number];
const ZONE_KEY = "algotr-zone";

export function savedZone(): Zone {
  try {
    const found = localStorage.getItem(ZONE_KEY);
    return ZONES.find((zone) => zone === found) ?? "local";
  } catch {
    return "local";
  }
}

export function saveZone(zone: Zone): void {
  try {
    localStorage.setItem(ZONE_KEY, zone);
  } catch {
    return;
  }
}

const zone = savedZone();
const timeZone = zone === "local" ? undefined : zone;

export const time = (value: string | Date): string =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });

export const tone = (value: number | null | undefined): "gain" | "loss" | "flat" =>
  value == null || value === 0 ? "flat" : value > 0 ? "gain" : "loss";

export const day = (value: string | Date): string =>
  new Date(value).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone,
  });
