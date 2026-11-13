import { Button, Dialog, DialogBody, DialogFooter, NumericInput } from "@blueprintjs/core";
import { useEffect, useState } from "react";
import { INDICATORS } from "./catalog";

export function IndicatorSettings({
  name,
  current,
  onApply,
  onReset,
  onClose,
}: {
  name: string | null;
  current: number[];
  onApply: (name: string, params: number[]) => void;
  onReset: (name: string) => void;
  onClose: () => void;
}) {
  const [values, setValues] = useState<number[]>(current);
  useEffect(() => setValues(current), [current]);
  const info = INDICATORS.find((item) => item.name === name);
  return (
    <Dialog
      isOpen={name != null}
      onClose={onClose}
      title={info ? `${info.label} settings` : "Settings"}
      style={{ width: 360 }}
    >
      <DialogBody>
        {values.length ? (
          <div className="stack">
            {values
              .map((value, index) => ({ value, id: `value-${index + 1}`, index }))
              .map((item) => (
                <div key={item.id} className="row">
                  <span className="grow">Value {item.index + 1}</span>
                  <NumericInput
                    aria-label={`Value ${item.index + 1}`}
                    value={item.value}
                    min={1}
                    stepSize={1}
                    style={{ width: 96 }}
                    onValueChange={(next) =>
                      setValues((all) =>
                        all.map((entry, at) =>
                          at === item.index && Number.isFinite(next) ? next : entry,
                        ),
                      )
                    }
                  />
                </div>
              ))}
            <p className="muted">
              Lengths and multipliers, in the order the legend shows them. Defaults come back with
              Reset.
            </p>
          </div>
        ) : (
          <p className="muted">This indicator has no settings.</p>
        )}
      </DialogBody>
      <DialogFooter
        actions={
          <>
            <Button text="Reset" onClick={() => name && onReset(name)} />
            <Button
              intent="primary"
              text="Apply"
              disabled={!values.length}
              onClick={() => name && onApply(name, values)}
            />
          </>
        }
      />
    </Dialog>
  );
}
