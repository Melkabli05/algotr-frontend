import { createContext, useContext } from "react";

export interface TicketStart {
  symbol: string;
  side?: "buy" | "sell";
  price?: number;
  qty?: number;
  route?: "direct" | "iceberg" | "twap" | "vwap" | "shortfall";
}

export const TicketContext = createContext<(start?: TicketStart) => void>(() => undefined);

export function useTicket(): (start?: TicketStart) => void {
  return useContext(TicketContext);
}
