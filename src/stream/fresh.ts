export const COIN_STALE_MS = 30_000;
export const STOCK_STALE_MS = 60_000;

export function quoteStale(
  symbol: string,
  quoteTime: string | undefined,
  marketOpen: boolean,
  now: number,
): boolean {
  const coin = symbol.includes("/") || symbol.endsWith("USD");
  if (!coin && !marketOpen) return false;
  if (!quoteTime) return false;
  return now - new Date(quoteTime).getTime() > (coin ? COIN_STALE_MS : STOCK_STALE_MS);
}
