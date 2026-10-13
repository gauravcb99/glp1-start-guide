"use client";

// Shows the friendly not-connected / no-inputs / loading / error states, then renders the page
// body with the member's data once it is ready.
import type { ReactNode } from "react";
import { strings } from "@/copy/strings";
import type { PersonaId } from "@/config/personas";
import type { DailyRow, MemberInputs } from "@/lib/analysis/types";
import { Loading, Notice } from "./Notice";
import { useMemberData } from "./useMemberData";

export type ReadyData = { persona: PersonaId | null; inputs: MemberInputs; rows: DailyRow[] };

export function MemberGate({ children }: { children: (data: ReadyData) => ReactNode }) {
  const data = useMemberData();
  const n = strings.notices;
  switch (data.state) {
    case "loading":
      return <Loading label={data.demo ? n.loadingDemo : n.loading} />;
    case "notConnected":
      return (
        <Notice
          title={n.notConnected.title}
          body={n.notConnected.body}
          action={{ href: "/api/auth/login", label: strings.connection.connect, external: true }}
        />
      );
    case "noInputs":
      return <Notice title={n.noInputs.title} body={n.noInputs.body} action={{ href: "/setup", label: n.noInputs.action }} />;
    case "error":
      return <Notice title={n.error.title} body={n.error.body(data.httpStatus)} />;
    case "ready":
      return <>{children(data)}</>;
  }
}
