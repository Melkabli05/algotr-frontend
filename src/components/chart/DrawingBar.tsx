import { Button } from "@blueprintjs/core";
import { TOOLS } from "./catalog";
import { ToolIcon } from "./icons";
import { Tip } from "./Tip";
import { useToolbar } from "./useToolbar";

const GROUPS = ["lines", "channels", "fib", "free"] as const;

export function DrawingBar({
  tool,
  magnet,
  hidden,
  count,
  onTool,
  onMagnet,
  onHidden,
  onClear,
}: {
  tool: string | null;
  magnet: boolean;
  hidden: boolean;
  count: number;
  onTool: (name: string) => void;
  onMagnet: () => void;
  onHidden: () => void;
  onClear: () => void;
}) {
  const bar = useToolbar("vertical");
  return (
    <div
      className="chart-tools"
      role="toolbar"
      aria-label="Drawing tools"
      aria-orientation="vertical"
      ref={bar.ref}
      onKeyDown={bar.onKeyDown}
      onFocus={bar.onFocus}
    >
      {GROUPS.map((group) => (
        <div className="chart-tools-group" key={group}>
          {TOOLS.filter((item) => item.group === group).map((item) => (
            <Tip
              key={item.name}
              label={item.label}
              about={item.about}
              combo={item.hotkey}
              placement="right"
            >
              <Button
                minimal
                active={tool === item.name}
                aria-label={item.label}
                aria-pressed={tool === item.name}
                icon={<ToolIcon name={item.name} />}
                onClick={() => onTool(item.name)}
              />
            </Tip>
          ))}
        </div>
      ))}
      <div className="chart-tools-group">
        <Tip
          label="Magnet"
          about="Snaps drawing points to the nearest open, high, low or close."
          combo="alt+m"
          placement="right"
        >
          <Button
            minimal
            active={magnet}
            aria-label="Magnet"
            aria-pressed={magnet}
            icon={<ToolIcon name="magnet" />}
            onClick={onMagnet}
          />
        </Tip>
        <Tip
          label={hidden ? "Show drawings" : "Hide drawings"}
          about="Hides every drawing on this chart without deleting them."
          placement="right"
        >
          <Button
            minimal
            active={hidden}
            aria-label={hidden ? "Show drawings" : "Hide drawings"}
            aria-pressed={hidden}
            icon={hidden ? "eye-off" : "eye-open"}
            disabled={!count}
            onClick={onHidden}
          />
        </Tip>
        <Tip
          label="Remove drawings"
          about="Deletes every drawing on this symbol. Right-click one drawing to delete just it."
          placement="right"
        >
          <Button
            minimal
            aria-label="Remove drawings"
            icon="trash"
            disabled={!count}
            onClick={onClear}
          />
        </Tip>
      </div>
    </div>
  );
}
