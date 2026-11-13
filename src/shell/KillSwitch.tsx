import {
  Button,
  Callout,
  Dialog,
  DialogBody,
  DialogFooter,
  FormGroup,
  InputGroup,
} from "@blueprintjs/core";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, detail } from "../api/client";
import { useCommand } from "./commands";
import { HotkeyTip } from "./HotkeyTip";

const WORD = "HALT";

export function KillSwitch() {
  const [step, setStep] = useState<0 | 1 | 2>(0);
  useCommand("halt", () => setStep(1));
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const client = useQueryClient();
  const automation = api.useQuery("get", "/systematic/automation");
  const halt = api.useMutation("post", "/systematic/automation/halt", {
    onSuccess: () => {
      setStep(0);
      client.invalidateQueries();
    },
  });
  const resume = api.useMutation("post", "/systematic/automation/resume", {
    onSuccess: () => client.invalidateQueries(),
  });
  const close = () => {
    setStep(0);
    setReason("");
    setTyped("");
    halt.reset();
  };
  if (automation.data?.halted) {
    return (
      <Button
        intent="warning"
        icon="play"
        loading={resume.isPending}
        onClick={() => resume.mutate({})}
      >
        Resume autopilot
      </Button>
    );
  }
  return (
    <>
      <HotkeyTip combo="esc esc">
        <Button intent="danger" icon="stop" onClick={() => setStep(1)}>
          Kill switch
        </Button>
      </HotkeyTip>
      <Dialog isOpen={step > 0} onClose={close} title="Kill switch" icon="stop">
        <DialogBody>
          {step === 1 ? (
            <p>
              Engages the global kill switch: open orders are canceled, every position is sold,
              hand-placed ones included, and nothing trades until Resume.
            </p>
          ) : (
            <>
              <FormGroup label="Reason" labelFor="halt-reason">
                <InputGroup
                  id="halt-reason"
                  value={reason}
                  onValueChange={setReason}
                  placeholder="Why trading stops"
                  autoFocus
                />
              </FormGroup>
              <FormGroup label={`Type ${WORD} to confirm`} labelFor="halt-word">
                <InputGroup id="halt-word" value={typed} onValueChange={setTyped} />
              </FormGroup>
              {halt.error ? <Callout intent="danger">{detail(halt.error)}</Callout> : null}
            </>
          )}
        </DialogBody>
        <DialogFooter
          actions={
            step === 1 ? (
              <Button intent="danger" onClick={() => setStep(2)}>
                Continue
              </Button>
            ) : (
              <Button
                intent="danger"
                disabled={typed !== WORD || reason.trim().length < 3}
                loading={halt.isPending}
                onClick={() => halt.mutate({ body: { reason: reason.trim() } })}
              >
                Sell and halt
              </Button>
            )
          }
        />
      </Dialog>
    </>
  );
}
