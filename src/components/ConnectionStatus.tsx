"use client";

import { useEffect, useState } from "react";
import { strings } from "@/copy/strings";
import { queuedFetchJson } from "@/lib/whoop/browserQueue";

type Status = "loading" | "connected" | "notConnected";

const copy = strings.connection;

/** Shows whether a WHOOP session exists, via /api/auth/status. */
export function ConnectionStatus({ showConnect = true }: { showConnect?: boolean }) {
  const [status, setStatus] = useState<Status>("loading");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const connectFailed = new URLSearchParams(window.location.search).get("connect") === "failed";

    queuedFetchJson("/api/auth/status")
      .then((res) => (res.ok ? (res.body as { connected?: boolean }) : { connected: false }))
      .catch(() => ({ connected: false }))
      .then((body) => {
        if (cancelled) return;
        setFailed(connectFailed && !body.connected);
        setStatus(body.connected ? "connected" : "notConnected");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return <p className="text-sm text-muted">{copy.checking}</p>;
  }

  if (status === "connected") {
    return (
      <div className="flex items-center gap-4">
        <p className="text-sm font-medium">{copy.connected}</p>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="text-sm text-muted underline hover:text-foreground">
            {copy.disconnect}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {failed && <p className="text-sm text-red-500">{copy.failed}</p>}
      <div className="flex items-center gap-4">
        <p className="text-sm text-muted">{copy.notConnected}</p>
        {showConnect && (
          // Plain <a>, not <Link>, so nothing prefetches the login route.
          <a
            href="/api/auth/login"
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            {copy.connect}
          </a>
        )}
      </div>
    </div>
  );
}
