import { MenuItem } from "@blueprintjs/core";
import { type ItemRenderer, Omnibar } from "@blueprintjs/select";
import { INDICATORS, type IndicatorInfo } from "./catalog";

const INPUT = { placeholder: "Search indicators by name or kind" };
const NO_RESULTS = <MenuItem disabled text="Nothing matches" />;

const matches = (text: string, item: IndicatorInfo) =>
  `${item.name} ${item.label} ${item.group} ${item.main ? "on the chart" : "own pane"}`
    .toLowerCase()
    .includes(text.toLowerCase().trim());

export function IndicatorSearch({
  open,
  active,
  onToggle,
  onClose,
}: {
  open: boolean;
  active: string[];
  onToggle: (name: string) => void;
  onClose: () => void;
}) {
  const render: ItemRenderer<IndicatorInfo> = (item, { handleClick, modifiers }) =>
    modifiers.matchesPredicate ? (
      <MenuItem
        key={item.name}
        roleStructure="listoption"
        selected={active.includes(item.name)}
        active={modifiers.active}
        onClick={handleClick}
        shouldDismissPopover={false}
        text={
          <span className="indicator-row">
            <span className="indicator-name">
              {item.label} <span className="muted">{item.name}</span>
            </span>
            <span className="muted indicator-about">{item.about}</span>
          </span>
        }
        label={item.main ? "On chart" : "Pane"}
      />
    ) : null;
  return (
    <Omnibar<IndicatorInfo>
      isOpen={open}
      items={INDICATORS}
      itemRenderer={render}
      itemPredicate={matches}
      onItemSelect={(item) => onToggle(item.name)}
      onClose={onClose}
      inputProps={INPUT}
      noResults={NO_RESULTS}
      initialContent={undefined}
      resetOnSelect={false}
    />
  );
}
