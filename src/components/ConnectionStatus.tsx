"use client";

import { useEffect, useState } from "react";
import { strings } from "@/copy/strings";
import { queuedFetch } from "@/lib/whoop/browserQueue";

type Status = "loading" | "connected" | "notConnected";

const copy = strings.connection;

/** Shows whether a WHOOP session exists, via /api/auth/status. */
export function ConnectionStatus() {
  const [status, setStatus] = useState<Status>("loading");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const connectFailed = new URLSearchParams(window.location.search).get("connect") === "failed";

    queuedFetch("/api/auth/status")
      .then((res) => (res.ok ? res.json() : { connected: false }))
      .catch(() => ({ connected: false }))
      .then((body: { connected?: boolean }) => {
        if (cancelled) return;
        setFailed(connectFailed && !body.connected);
        setStatus(body.connected ? "connected" : "notConnected");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return <p className="text-sm text-zinc-500">{copy.checking}</p>;
  }

  if (status === "connected") {
    return (
      <div className="flex items-center gap-4">
        <p className="text-sm font-medium">{copy.connected}</p>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="text-sm text-zinc-500 underline hover:text-zinc-800">
            {copy.disconnect}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {failed && <p className="text-sm text-red-700">{copy.failed}</p>}
      <div className="flex items-center gap-4">
        <p className="text-sm text-zinc-500">{copy.notConnected}</p>
        {/* Plain <a>, not <Link>, so nothing prefetches the login route. */}
        <a
          href="/api/auth/login"
          className="rounded-full bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          {copy.connect}
        </a>
      </div>
    </div>
  );
}
