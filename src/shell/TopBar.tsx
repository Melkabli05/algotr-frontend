import { Button, HotkeysContext } from "@blueprintjs/core";
import { useContext } from "react";
import { api } from "../api/client";
import { Figure } from "../components/Figure";
import { money, percent, signedMoney, signedPercent, tone } from "../format";
import { Alerts } from "./Alerts";
import { emit } from "./commands";
import { EnvChip } from "./EnvChip";
import { KillSwitch } from "./KillSwitch";
import type { Theme } from "./theme";

interface Props {
  theme: Theme;
  toggleTheme: () => void;
}

export function TopBar({ theme, toggleTheme }: Props) {
  const account = api.useQuery("get", "/account", undefined, { refetchInterval: 15_000 });
  const automation = api.useQuery("get", "/systematic/automation", undefined, {
    refetchInterval: 30_000,
  });
  const [, dispatch] = useContext(HotkeysContext);
  const data = account.data;
  return (
    <header className="shell-top">
      <span role="status">
        <EnvChip large />
      </span>
      <Figure label="Account value" value={money(data?.equity)} />
      <Figure
        label="Today"
        value={`${signedMoney(data?.day_pl)} (${signedPercent(data ? data.day_pl_pct / 100 : null)})`}
        tone={tone(data?.day_pl)}
      />
      <Figure label="Autopilot drawdown" value={percent(automation.data?.book.drawdown)} />
      <div style={{ flex: 1 }} />
      <Button
        minimal
        icon="key-command"
        aria-label="Command palette"
        title="Command palette (Ctrl+K)"
        onClick={() => emit("palette")}
      />
      <Button
        minimal
        icon="help"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
        onClick={() => dispatch({ type: "OPEN_DIALOG" })}
      />
      <KillSwitch />
      <Alerts />
      <Button
        minimal
        icon={theme === "dark" ? "flash" : "moon"}
        aria-label={theme === "dark" ? "Light theme" : "Dark theme"}
        onClick={toggleTheme}
      />
    </header>
  );
}
