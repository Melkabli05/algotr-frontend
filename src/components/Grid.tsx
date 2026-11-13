import {
  AllCommunityModule,
  type ColDef,
  colorSchemeDark,
  colorSchemeLight,
  type GetRowIdParams,
  ModuleRegistry,
  type RowClickedEvent,
  themeBalham,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import { useMemo } from "react";
import { explain } from "../glossary";

ModuleRegistry.registerModules([AllCommunityModule]);

const base = themeBalham.withParams({
  fontFamily: "IBM Plex Sans, system-ui, sans-serif",
  fontSize: 12,
  headerFontSize: 11,
  rowHeight: 26,
  headerHeight: 28,
  spacing: 4,
  wrapperBorderRadius: 0,
});

export const darkGrid = base.withPart(colorSchemeDark).withParams({
  backgroundColor: "#141413",
  headerBackgroundColor: "#141413",
  borderColor: "#2a2a28",
  accentColor: "#ff9f1a",
});
export const lightGrid = base.withPart(colorSchemeLight).withParams({ accentColor: "#b86e00" });

const RIGHT = "ag-right-aligned-cell";

function tipped<T>(column: ColDef<T>): ColDef<T> {
  if (column.headerTooltip || !column.headerName) return column;
  const tip = explain(column.headerName);
  return tip ? { ...column, headerTooltip: tip } : column;
}

export function aligned<T>(columns: ColDef<T>[]): ColDef<T>[] {
  return columns.map(tipped).map((column) => {
    if (column.type !== "rightAligned" || column.cellClass == null) return column;
    const own = column.cellClass;
    return {
      ...column,
      cellClass:
        typeof own === "function"
          ? (params) => [own(params) ?? []].flat().concat(RIGHT)
          : [own].flat().concat(RIGHT),
    };
  });
}

interface Props<T> {
  rows: T[] | undefined;
  columns: ColDef<T>[];
  rowId?: (row: T) => string;
  onRow?: (row: T) => void;
  height?: number | "auto";
  empty?: string;
  dark?: boolean;
}

export function Grid<T>({
  rows,
  columns,
  rowId,
  onRow,
  height = "auto",
  empty,
  dark = true,
}: Props<T>) {
  const columnDefs = useMemo(() => aligned(columns), [columns]);
  const defaults = useMemo<ColDef<T>>(
    () => ({ sortable: true, resizable: true, minWidth: 70, enableCellChangeFlash: true }),
    [],
  );
  return (
    <div style={height === "auto" ? undefined : { height }}>
      <AgGridReact<T>
        theme={dark ? darkGrid : lightGrid}
        rowData={rows ?? []}
        columnDefs={columnDefs}
        defaultColDef={defaults}
        domLayout={height === "auto" ? "autoHeight" : "normal"}
        getRowId={rowId ? (params: GetRowIdParams<T>) => rowId(params.data) : undefined}
        onRowClicked={
          onRow ? (event: RowClickedEvent<T>) => event.data && onRow(event.data) : undefined
        }
        overlayNoRowsTemplate={empty ?? "No rows"}
        suppressCellFocus={!onRow}
        rowStyle={onRow ? { cursor: "pointer" } : undefined}
        autoSizeStrategy={{ type: "fitGridWidth" }}
        tooltipShowDelay={250}
      />
    </div>
  );
}
