import {
  Button,
  ButtonGroup,
  Menu,
  MenuDivider,
  MenuItem,
  mergeRefs,
  PopoverNext,
  Tooltip,
} from "@blueprintjs/core";
import type { IconName } from "@blueprintjs/icons";
import type { ReactElement } from "react";
import { FRAMES, INDICATORS, SCALES, type Scale, TYPES } from "./catalog";
import type { Colours } from "./layout";
import { Tip, TipText } from "./Tip";
import { useToolbar } from "./useToolbar";

function MenuButton({
  tip,
  text,
  icon,
  menu,
}: {
  tip: string;
  text: string;
  icon?: IconName;
  menu: ReactElement;
}) {
  return (
    <PopoverNext
      content={menu}
      placement="bottom-start"
      renderTarget={({ isOpen, ref: popoverRef, ...popoverProps }) => (
        <Tooltip
          placement="bottom"
          hoverOpenDelay={350}
          compact
          disabled={isOpen}
          content={<TipText label={tip} />}
          renderTarget={({ isOpen: _open, ref: tipRef, ...tipProps }) => (
            <Button
              {...popoverProps}
              {...tipProps}
              ref={mergeRefs(popoverRef, tipRef)}
              small
              minimal
              active={isOpen}
              icon={icon}
              endIcon="caret-down"
              aria-label={tip}
            >
              {text}
            </Button>
          )}
        />
      )}
    />
  );
}

export interface SourceControl {
  current: string;
  options: { value: string; label: string; about: string }[];
  onChange: (value: string) => void;
}

export function TopBar({
  frame,
  onFrame,
  frozen,
  source,
  indicators,
  onIndicators,
  type,
  onType,
  colours,
  onColours,
  scale,
  onScale,
  streaming,
  expanded,
  onReset,
  onShot,
  onExpand,
}: {
  frame: string;
  onFrame: (frame: string) => void;
  frozen: boolean;
  source?: SourceControl;
  indicators: number;
  onIndicators: () => void;
  type: string;
  onType: (type: string) => void;
  colours: Colours;
  onColours: (colours: Colours) => void;
  scale: Scale;
  onScale: (scale: Scale) => void;
  streaming: boolean;
  expanded: boolean;
  onReset: () => void;
  onShot: () => void;
  onExpand: () => void;
}) {
  const bar = useToolbar("horizontal");
  const locked = (value: string) => frozen && value !== "1Day";
  const typeName = TYPES.find((item) => item.value === type)?.label ?? "Candles";
  const menu = (
    <Menu>
      <MenuDivider title="Chart type" />
      {TYPES.map((item) => (
        <MenuItem
          key={item.value}
          text={item.label}
          roleStructure="listoption"
          selected={item.value === type}
          onClick={() => onType(item.value)}
        />
      ))}
      <MenuDivider title="Colours" />
      <MenuItem
        text="Blue and orange"
        label="Colour-blind safe"
        roleStructure="listoption"
        selected={colours === "blue"}
        shouldDismissPopover={false}
        onClick={() => onColours(colours === "blue" ? "classic" : "blue")}
      />
    </Menu>
  );
  return (
    <div
      className="chart-bar"
      role="toolbar"
      aria-label="Chart controls"
      ref={bar.ref}
      onKeyDown={bar.onKeyDown}
      onFocus={bar.onFocus}
    >
      <ButtonGroup minimal>
        {FRAMES.map((item) => (
          <Tip
            key={item.value}
            label={item.label}
            about={locked(item.value) ? "Locked: a backtest runs on daily bars" : "Bar size"}
            placement="bottom"
          >
            <Button
              small
              active={frame === item.value}
              aria-disabled={locked(item.value)}
              aria-pressed={frame === item.value}
              aria-label={item.label}
              className={locked(item.value) ? "chart-frame chart-locked" : "chart-frame"}
              text={item.short}
              onClick={() => {
                if (!locked(item.value)) onFrame(item.value);
              }}
            />
          </Tip>
        ))}
      </ButtonGroup>
      <hr className="chart-sep" />
      <Tip
        label="Indicators"
        about={`Search ${INDICATORS.length} indicators and add them to the chart.`}
        combo="alt+i"
      >
        <Button
          small
          minimal
          icon="timeline-line-chart"
          aria-label="Indicators"
          onClick={onIndicators}
        >
          Indicators{indicators ? <span className="chart-count">{indicators}</span> : null}
        </Button>
      </Tip>
      <MenuButton tip="Chart type and colours" text={typeName} menu={menu} />
      {source ? (
        <MenuButton
          tip="What to overlay on the chart"
          icon="layers"
          text={source.options.find((item) => item.value === source.current)?.label ?? "Overlay"}
          menu={
            <Menu>
              <MenuDivider title="Overlay" />
              {source.options.map((item) => (
                <MenuItem
                  key={item.value}
                  roleStructure="listoption"
                  selected={item.value === source.current}
                  text={item.label}
                  label={item.about}
                  onClick={() => source.onChange(item.value)}
                />
              ))}
            </Menu>
          }
        />
      ) : null}
      <hr className="chart-sep" />
      <ButtonGroup minimal>
        {SCALES.map((item) => (
          <Tip
            key={item.value}
            label={item.label}
            combo={"hotkey" in item ? item.hotkey : undefined}
            placement="bottom"
          >
            <Button
              small
              active={scale === item.value}
              aria-pressed={scale === item.value}
              aria-label={item.label}
              text={item.short}
              onClick={() => onScale(item.value)}
            />
          </Tip>
        ))}
      </ButtonGroup>
      <span className="grow" />
      <Tip
        label={streaming ? "Streaming live" : "Polling"}
        about={
          streaming
            ? "Every trade updates the last bar as it prints."
            : "Not streamed yet; the last bar refreshes every 5 seconds."
        }
        placement="bottom-end"
      >
        <span className="chart-live" role="status">
          <span className={streaming ? "dot dot-ok" : "dot dot-idle"} />
          {streaming ? "Live" : "Polled"}
        </span>
      </Tip>
      <hr className="chart-sep" />
      <Tip
        label="Reset view"
        about="Back to the latest bar and automatic zoom."
        combo="alt+r"
        placement="bottom"
      >
        <Button small minimal icon="reset" aria-label="Reset view" onClick={onReset} />
      </Tip>
      <Tip label="Save as image" about="Downloads the chart as a PNG." placement="bottom">
        <Button small minimal icon="camera" aria-label="Save as image" onClick={onShot} />
      </Tip>
      <Tip
        label={expanded ? "Back to the page" : "Full window"}
        about={
          expanded ? "Leaves the full window; Esc does too while the chart has focus." : undefined
        }
        combo="alt+enter"
        placement="bottom-end"
      >
        <Button
          small
          minimal
          icon={expanded ? "minimize" : "maximize"}
          aria-label={expanded ? "Back to the page" : "Full window"}
          aria-pressed={expanded}
          onClick={onExpand}
        />
      </Tip>
    </div>
  );
}
