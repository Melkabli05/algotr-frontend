import { Icon } from "@blueprintjs/core";
import { useEnv } from "./env";

export function EnvChip({ large = false }: { large?: boolean }) {
  const env = useEnv();
  const live = env !== "paper";
  return (
    <span className={`env ${live ? "env-live" : "env-paper"} ${large ? "" : "env-small"}`}>
      {live ? <Icon icon="lock" size={large ? 12 : 10} style={{ marginRight: 4 }} /> : null}
      {env === "paper" ? "PAPER" : env === "live" ? "LIVE" : "ACCOUNT UNKNOWN"}
    </span>
  );
}

export const ENV_COLUMN = {
  headerName: "Env",
  colId: "env",
  width: 90,
  minWidth: 80,
  sortable: false,
  cellRenderer: () => <EnvChip />,
};
