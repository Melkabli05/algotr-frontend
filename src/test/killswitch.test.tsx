import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KillSwitch } from "../shell/KillSwitch";

const calls = vi.hoisted(() => {
  const seen: { url: string; method: string; body: string | null }[] = [];
  const reply = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  globalThis.fetch = async (input: RequestInfo | URL) => {
    const request = input as Request;
    seen.push({
      url: request.url,
      method: request.method,
      body: request.method === "POST" ? await request.text() : null,
    });
    if (request.url.endsWith("/systematic/automation/halt")) return reply({ status: "halted" });
    return reply({ halted: null, kill_state: "normal", book: { drawdown: 0 }, config: {} });
  };
  return seen;
});

it("halts only after a reason and the typed word", async () => {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <KillSwitch />
    </QueryClientProvider>,
  );
  await user.click(await screen.findByRole("button", { name: "Kill switch" }));
  await user.click(screen.getByRole("button", { name: "Continue" }));
  const halt = screen.getByRole("button", { name: "Sell and halt" });
  expect(halt).toBeDisabled();
  await user.type(screen.getByLabelText("Reason"), "testing");
  expect(halt).toBeDisabled();
  await user.type(screen.getByLabelText("Type HALT to confirm"), "HALT");
  expect(halt).toBeEnabled();
  await user.click(halt);
  await waitFor(() => expect(calls.some((call) => call.url.endsWith("/halt"))).toBe(true));
  expect(calls.find((call) => call.url.endsWith("/halt"))?.body).toBe(
    JSON.stringify({ reason: "testing" }),
  );
});
