import { Button, Callout, Classes } from "@blueprintjs/core";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { detail } from "../api/client";

export function errorClass(error: unknown): string {
  const text = detail(error).toLowerCase();
  if (/timed? ?out|timeout/.test(text)) return "Timeout";
  if (/unauthori[sz]ed|forbidden|401|403|credential/.test(text)) return "Authentication";
  if (/failed to fetch|network|connection|not answering/.test(text)) return "Network";
  if (/internal server|service unavailable|bad gateway|5\d\d/.test(text)) return "Server error";
  return "Request failed";
}

const SKELETONS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8"];

interface Query {
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

export function Loadable({
  query,
  empty,
  isEmpty = false,
  rows = 3,
  children,
}: {
  query: Query;
  empty?: string;
  isEmpty?: boolean;
  rows?: number;
  children: ReactNode;
}) {
  if (query.isLoading)
    return (
      <div className="stack" style={{ gap: 6 }} aria-busy="true">
        {SKELETONS.slice(0, rows).map((key) => (
          <div key={key} className={`${Classes.SKELETON} skeleton-row`} />
        ))}
      </div>
    );
  if (query.isError)
    return (
      <Callout intent="danger" compact>
        <span>
          {errorClass(query.error)}: {detail(query.error)}
        </span>{" "}
        <Button small minimal icon="refresh" onClick={() => query.refetch()}>
          Retry
        </Button>{" "}
        <Link to="/system">System health</Link>
      </Callout>
    );
  if (isEmpty && empty) return <p className="muted">{empty}</p>;
  return <>{children}</>;
}
