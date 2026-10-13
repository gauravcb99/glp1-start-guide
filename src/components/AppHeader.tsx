"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { strings } from "@/copy/strings";
import { withDemo } from "@/lib/personas/load";
import { useDemoPersona } from "./useMemberData";
import { useWhoopData } from "./WhoopDataProvider";

const NAV = [
  { href: "/week", label: strings.nav.week },
  { href: "/since", label: strings.nav.since },
  { href: "/method", label: strings.nav.method },
] as const;

export function AppHeader() {
  const persona = useDemoPersona();
  const pathname = usePathname();
  const { state, refresh } = useWhoopData();
  const loading = state.status === "loading";

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex w-full max-w-4xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <Link href={withDemo("/", persona)} className="font-semibold tracking-tight">
          {strings.appName}
        </Link>
        {persona && (
          <span className="rounded-full bg-badge px-2.5 py-0.5 text-xs font-medium text-badge-text">
            {strings.nav.syntheticBadge} {persona}
          </span>
        )}
        <nav className="flex gap-4 text-sm">
          {[...NAV, ...(persona ? [] : [{ href: "/setup", label: strings.nav.setup }])].map((item) => (
            <Link
              key={item.href}
              href={withDemo(item.href, persona)}
              className={pathname === item.href ? "font-medium text-foreground" : "text-muted hover:text-foreground"}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto text-sm">
          {persona ? (
            <Link href="/demo" className="text-muted hover:text-foreground">
              {strings.nav.exitDemo}
            </Link>
          ) : (
            (state.status === "ready" || state.status === "error" || loading) && (
              <button type="button" onClick={refresh} disabled={loading} className="text-muted hover:text-foreground disabled:opacity-60">
                {loading ? strings.nav.refreshing : strings.nav.refresh}
              </button>
            )
          )}
        </div>
      </div>
    </header>
  );
}
