import { Button, Callout } from "@blueprintjs/core";
import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { OrderTicket } from "../views/OrderTicket";
import { useFocusedSymbol } from "./commands";
import { EnvTint } from "./EnvTint";
import { Footer } from "./Footer";
import { CriticalStrip, StaleBanner } from "./Freshness";
import { Hotkeys } from "./Hotkeys";
import { HotkeyTip } from "./HotkeyTip";
import { allowedOnPhone, usePhone } from "./mobile";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { ThemeContext, useTheme } from "./theme";
import { TicketContext, type TicketStart } from "./ticket";

export function Shell() {
  const [theme, toggleTheme] = useTheme();
  const phone = usePhone();
  const { pathname } = useLocation();
  useEffect(() => {
    document.body.classList.toggle("is-phone", phone);
  }, [phone]);
  const [ticket, setTicket] = useState(false);
  const [start, setStart] = useState<TicketStart>();
  const focused = useFocusedSymbol();
  const open = useCallback(
    (next?: TicketStart) => {
      setStart(next ?? { symbol: focused });
      setTicket(true);
    },
    [focused],
  );
  return (
    <ThemeContext.Provider value={theme}>
      <TicketContext.Provider value={open}>
        <div className="shell">
          <EnvTint />
          <Hotkeys />
          <Sidebar />
          <TopBar theme={theme} toggleTheme={toggleTheme} />
          <main className="shell-main">
            <CriticalStrip />
            <StaleBanner />
            {phone && !allowedOnPhone(pathname) ? (
              <Callout intent="primary" icon="mobile-phone" title="Not on a phone">
                This view changes orders, strategies or settings, which the phone view leaves to the
                desktop. The phone shows the command center, positions, the dashboard, signals and
                alerts, and keeps the kill switch.
              </Callout>
            ) : (
              <Outlet />
            )}
          </main>
          <Footer />
          <HotkeyTip combo="b">
            <Button
              className="ticket-button"
              intent="primary"
              large
              icon="plus"
              text="Order"
              onClick={() => open()}
              aria-label="New order"
            />
          </HotkeyTip>
          <OrderTicket isOpen={ticket} onClose={() => setTicket(false)} initial={start} />
        </div>
      </TicketContext.Provider>
    </ThemeContext.Provider>
  );
}
